// Re-encodes a video for the web: same aspect, a given size and bitrate,
// H.264, set to start playing before it has fully downloaded. No ffmpeg needed.
//   swift tools/webify.swift IN.mp4 OUT.mp4 WIDTH HEIGHT BITRATE   (e.g. 1320 720 4500000)
import Foundation
import AVFoundation
let a = CommandLine.arguments
let src = URL(fileURLWithPath: a[1]), dst = URL(fileURLWithPath: a[2])
let W = Int(a[3])!, H = Int(a[4])!, bitrate = Int(a[5])!
try? FileManager.default.removeItem(at: dst)
let asset = AVURLAsset(url: src)
let track = asset.tracks(withMediaType: .video)[0]
let fps = track.nominalFrameRate
let reader = try AVAssetReader(asset: asset)
let out = AVAssetReaderTrackOutput(track: track, outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
reader.add(out)
let writer = try AVAssetWriter(outputURL: dst, fileType: .mp4)
writer.shouldOptimizeForNetworkUse = true   // moov atom up front: starts playing before it's all downloaded
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
  AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: W, AVVideoHeightKey: H,
  AVVideoScalingModeKey: AVVideoScalingModeResizeAspectFill,
  AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: bitrate, AVVideoExpectedSourceFrameRateKey: Int(fps.rounded()),
    AVVideoMaxKeyFrameIntervalKey: Int(fps.rounded()), AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel]])
input.expectsMediaDataInRealTime = false
writer.add(input)
reader.startReading(); writer.startWriting(); writer.startSession(atSourceTime: .zero)
var n = 0
while let sb = out.copyNextSampleBuffer() {
  while !input.isReadyForMoreMediaData { Thread.sleep(forTimeInterval: 0.002) }
  input.append(sb); n += 1
}
input.markAsFinished()
let done = DispatchSemaphore(value: 0)
writer.finishWriting { done.signal() }
done.wait()
print(writer.status == .completed ? "ok \(n) frames at \(fps) fps" : "failed \(String(describing: writer.error))")
