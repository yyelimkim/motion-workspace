// Encodes a folder of PNG frames (frame_0000.png …) to an H.264 MP4 with
// macOS's own encoder (AVFoundation): no ffmpeg needed.
//   swift tools/encode.swift FRAMES_DIR OUT.mp4 COUNT WIDTH HEIGHT FPS [BITRATE]
import Foundation
import AVFoundation
import CoreMedia
import CoreVideo
import ImageIO
import CoreGraphics

let args = CommandLine.arguments
guard args.count >= 7 else { fatalError("Usage: encode.swift FRAMES_DIR OUT.mp4 COUNT WIDTH HEIGHT FPS [BITRATE]") }
let dir = URL(fileURLWithPath: args[1], isDirectory: true)
let out = URL(fileURLWithPath: args[2])
let count = Int(args[3])!, W = Int(args[4])!, H = Int(args[5])!, fps = Int(args[6])!
let bitrate = args.count > 7 ? Int(args[7])! : 24_000_000
try? FileManager.default.removeItem(at: out)
let writer = try AVAssetWriter(outputURL: out, fileType: .mp4)
writer.shouldOptimizeForNetworkUse = true
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
    AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: W, AVVideoHeightKey: H,
    AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: bitrate, AVVideoExpectedSourceFrameRateKey: fps,
        AVVideoMaxKeyFrameIntervalKey: fps, AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
    ],
])
input.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
    kCVPixelBufferWidthKey as String: W, kCVPixelBufferHeightKey as String: H,
    kCVPixelBufferCGImageCompatibilityKey as String: true, kCVPixelBufferCGBitmapContextCompatibilityKey as String: true,
])
writer.add(input)
guard writer.startWriting() else { fatalError("Could not start writer: \(writer.error?.localizedDescription ?? "unknown")") }
writer.startSession(atSourceTime: .zero)
let pool = adaptor.pixelBufferPool!
let colorSpace = CGColorSpaceCreateDeviceRGB()
for i in 0..<count {
    while !input.isReadyForMoreMediaData { Thread.sleep(forTimeInterval: 0.002) }
    let url = dir.appendingPathComponent(String(format: "frame_%04d.png", i))
    guard let src = CGImageSourceCreateWithURL(url as CFURL, nil), let image = CGImageSourceCreateImageAtIndex(src, 0, nil) else { fatalError("Could not read frame \(i)") }
    var maybe: CVPixelBuffer?
    CVPixelBufferPoolCreatePixelBuffer(kCFAllocatorDefault, pool, &maybe)
    guard let buf = maybe else { fatalError("Could not allocate a frame") }
    CVPixelBufferLockBaseAddress(buf, [])
    let ctx = CGContext(data: CVPixelBufferGetBaseAddress(buf), width: W, height: H, bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(buf), space: colorSpace, bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue)!
    ctx.interpolationQuality = .high
    ctx.draw(image, in: CGRect(x: 0, y: 0, width: W, height: H))
    CVPixelBufferUnlockBaseAddress(buf, [])
    guard adaptor.append(buf, withPresentationTime: CMTime(value: CMTimeValue(i), timescale: CMTimeScale(fps))) else { fatalError("Failed at frame \(i)") }
}
input.markAsFinished()
let done = DispatchSemaphore(value: 0)
writer.finishWriting { done.signal() }
done.wait()
guard writer.status == .completed else { fatalError("Encoding failed: \(writer.error?.localizedDescription ?? "unknown")") }
print("Wrote \(out.path) · \(W)x\(H) · \(fps) fps · \(count) frames")
