#!/usr/bin/env node
// Exports the scene to an MP4, frame by frame, at its full size.
//
//   node tools/export.js --out ~/Desktop/my-video.mp4 [--fps 60] [--url http://localhost:8140/]
//
// Your timeline lives in your browser (localStorage), which a fresh hidden
// Chrome can't see. So this waits for the workspace tab to hand it over: in
// that tab's console run  sendForExport()  (it posts to 127.0.0.1:8131).
// Or pass a saved copy: --storage timeline.json
//
// Then: a headless Chrome loads the page in ?export mode with your timeline,
// draws each frame with window.seek(t), captures it, and tools/encode.swift
// turns the frames into an H.264 MP4. Needs Google Chrome and Xcode's swift.

const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const arg = (name, dflt) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : dflt; };
const URL_ = arg('url', 'http://localhost:8140/');
const FPS = Number(arg('fps', 60));
const OUT = path.resolve((arg('out', path.join(os.homedir(), 'Desktop', 'motion-export.mp4'))).replace(/^~/, os.homedir()));
const STORAGE = arg('storage');
const BITRATE = Number(arg('bitrate', 24000000));
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function receiveTimeline() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'content-type');
      if (req.method === 'OPTIONS') { res.end(); return; }
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => { res.end(`received ${body.length} bytes`); srv.close(); resolve(JSON.parse(body)); });
    });
    srv.listen(8131, '127.0.0.1', () => console.log('Waiting for the timeline: in the workspace tab\'s console, run  sendForExport()'));
  });
}

async function main() {
  const storage = STORAGE ? JSON.parse(fs.readFileSync(STORAGE, 'utf8')) : await receiveTimeline();
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'motion-export-'));
  const frames = path.join(work, 'frames');
  fs.mkdirSync(frames);
  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${path.join(work, 'profile')}`,
    '--hide-scrollbars', '--force-device-scale-factor=1', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });
  try {
    for (let i = 0; i < 60; i++) { try { await fetch(`http://127.0.0.1:${PORT}/json/version`); break; } catch (e) { await sleep(200); } }
    const page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener('open', r));
    let id = 0;
    const pending = new Map();
    ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
    const send = (method, params = {}) => new Promise((res, rej) => {
      const i = ++id;
      pending.set(i, (m) => (m.error ? rej(new Error(`${method}: ${JSON.stringify(m.error)}`)) : res(m.result)));
      ws.send(JSON.stringify({ id: i, method, params }));
    });
    const evaluate = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
      return r.result.value;
    };
    await send('Page.enable');
    await send('Runtime.enable');
    // your timeline into this profile's storage, on the page's origin
    await send('Page.navigate', { url: new URL('README.md', URL_).href });
    await sleep(600);
    await evaluate(`(() => { const s = ${JSON.stringify(storage)}; for (const k in s) if (s[k] != null) localStorage.setItem(k, s[k]); return true; })()`);
    // the scene's size first, then the page at exactly that size
    await send('Page.navigate', { url: `${URL_}?export` });
    for (let i = 0; i < 100; i++) { if (await evaluate('!!window.EXPORT_READY')) break; await sleep(150); }
    const scene = await evaluate('({ w: SCENE.width || 1920, h: SCENE.height || 1080, d: SCENE.duration })');
    await send('Emulation.setDeviceMetricsOverride', { width: scene.w, height: scene.h, deviceScaleFactor: 1, mobile: false });
    await sleep(300);
    const N = Math.round(scene.d * FPS);
    console.log(`Rendering ${N} frames · ${scene.w}x${scene.h} · ${FPS} fps · ${scene.d}s`);
    const t0 = Date.now();
    for (let f = 0; f < N; f++) {
      await evaluate(`(async () => { window.seek(${f / FPS}); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); return 1; })()`);
      const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: scene.w, height: scene.h, scale: 1 } });
      fs.writeFileSync(path.join(frames, `frame_${String(f).padStart(4, '0')}.png`), Buffer.from(shot.data, 'base64'));
      if (f % FPS === 0) console.log(`  ${f}/${N}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    ws.close();
    chrome.kill();
    console.log('Encoding…');
    execFileSync('swift', [path.join(__dirname, 'encode.swift'), frames, OUT, String(N), String(scene.w), String(scene.h), String(FPS), String(BITRATE)], { stdio: 'inherit' });
  } finally {
    chrome.kill();
    fs.rmSync(work, { recursive: true, force: true });
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
