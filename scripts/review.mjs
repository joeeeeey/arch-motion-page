#!/usr/bin/env node
// HTML-stage review: seek the built page to named moments in headless Chrome (CDP, no npm deps),
// save full-page frames, a labelled contact sheet and the runtime fit report.
//
//   node scripts/review.mjs examples/self-intro/out [--times 0.5,2,9] [--burst 0:3:10] [--zoom x,y,w,h] [--scale 2]
//                          [--thumb 320] [--dest dir] [--page file.html] [--present 1440x900,820x1180,1440x900:fit]
//   --thumb    downscale frames to this width, e.g. for a filmstrip block
//   --page     review another file in the out dir, e.g. the --single build
//   --present  also capture present mode (centred, scaled) at these window sizes; ':fit' = whole page
//
// Output goes to <spec dir>/review/ (review-zh/ for out-zh/). Uses the local Chrome (CHROME env to override) with a throwaway profile.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2' };
const CHROME_CANDIDATES = [
  process.env.CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].filter(Boolean);

function args(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) a[argv[i].slice(2)] = argv[i + 1]?.startsWith('--') || argv[i + 1] == null ? true : argv[++i];
    else a._.push(argv[i]);
  }
  return a;
}

function serve(rootDir) {
  const server = http.createServer((req, res) => {
    const p = path.join(rootDir, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(rootDir) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}

async function launchChrome() {
  const bin = CHROME_CANDIDATES.find((c) => fs.existsSync(c));
  if (!bin) throw new Error('Chrome not found; set CHROME=/path/to/chrome');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'amp-chrome-'));
  const proc = spawn(bin, [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--mute-audio',
    '--force-color-profile=srgb', '--font-render-hinting=none', 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  const wsBrowser = await new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => reject(new Error('Chrome did not start')), 15000);
    proc.stderr.on('data', (d) => {
      buf += d;
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) { clearTimeout(timer); resolve(m[1]); }
    });
    proc.on('exit', (c) => reject(new Error(`Chrome exited ${c}`)));
  });
  const port = new URL(wsBrowser).port;
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = list.find((t) => t.type === 'page');
  const close = async () => {
    const exited = new Promise((r) => (proc.exitCode != null ? r() : proc.once('exit', r)));
    proc.kill('SIGKILL');
    await exited; // Chrome may still be flushing the profile; removing it earlier races (ENOTEMPTY)
    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch { /* temp dir, best effort */ }
  };
  return { wsUrl: page.webSocketDebuggerUrl, close };
}

function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const waiters = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(`${msg.error.message}`)) : resolve(msg.result);
    } else if (msg.method) {
      for (let i = waiters.length - 1; i >= 0; i--) if (waiters[i].method === msg.method) { waiters[i].resolve(msg.params); waiters.splice(i, 1); }
    }
  };
  const api = {
    open: new Promise((r) => (ws.onopen = r)),
    send: (method, params = {}) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })); }),
    once: (method) => new Promise((resolve) => waiters.push({ method, resolve })),
    eval: async (expression) => {
      const r = await api.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    },
    close: () => ws.close(),
  };
  return api;
}

const fmt = (t) => t.toFixed(2).padStart(5, '0');

async function main() {
  const a = args(process.argv.slice(2));
  const outDir = path.resolve(a._[0] || '.');
  const pageName = a.page || 'index.html'; // e.g. --page single/amp-zh.html to review a --single file
  const indexFile = path.join(outDir, pageName);
  if (!fs.existsSync(indexFile)) throw new Error(`${indexFile} not found; run build first`);
  const buildInfo = JSON.parse(fs.readFileSync(path.join(outDir, 'amp-build.json'), 'utf8'));
  const [W, H] = buildInfo.size;
  const scale = parseFloat(a.scale || 1);
  const specDir = path.dirname(outDir);
  // out -> review, out-zh -> review-zh; never derive a dest that could be the out dir itself
  const outName = path.basename(outDir);
  const reviewDir = path.resolve(a.dest || path.join(specDir, outName.startsWith('out') ? outName.replace(/^out/, 'review') : 'review'));
  if (reviewDir === outDir) throw new Error('review dest must differ from the out dir');
  fs.rmSync(reviewDir, { recursive: true, force: true });
  fs.mkdirSync(reviewDir, { recursive: true });

  const server = await serve(specDir);
  const base = `http://127.0.0.1:${server.address().port}`;
  const chrome = await launchChrome();
  const c = cdp(chrome.wsUrl);
  await c.open;
  try {
    await c.send('Page.enable');
    await c.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: scale, mobile: false });
    const loaded = c.once('Page.loadEventFired');
    const pageUrl = `${base}/${path.relative(specDir, outDir)}/${pageName}`;
    await c.send('Page.navigate', { url: `${pageUrl}?review` });
    await loaded;
    const report = await c.eval('window.__amp.ready');
    fs.writeFileSync(path.join(reviewDir, 'report.json'), JSON.stringify(report, null, 1));

    const zoom = a.zoom ? a.zoom.split(',').map(Number) : null;
    const shoot = async (t, file) => {
      await c.eval(`window.__amp.seek(${t})`);
      await c.eval('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))');
      const s = a.thumb ? parseFloat(a.thumb) / (zoom ? zoom[2] : W) : 1;
      const clip = zoom ? { x: zoom[0], y: zoom[1], width: zoom[2], height: zoom[3], scale: s } : { x: 0, y: 0, width: W, height: H, scale: s };
      const { data } = await c.send('Page.captureScreenshot', { format: 'png', clip });
      fs.writeFileSync(file, Buffer.from(data, 'base64'));
    };

    const frames = [];
    if (a.burst) {
      const [s, e, fps] = a.burst.split(':').map(Number);
      const dir = path.join(reviewDir, 'burst');
      fs.mkdirSync(dir);
      let k = 0;
      for (let t = s; t <= e + 1e-6; t += 1 / fps, k++) {
        const f = path.join(dir, `f${String(k).padStart(4, '0')}.png`);
        await shoot(t, f);
        frames.push({ t, file: path.relative(reviewDir, f) });
      }
      const ff = ['ffmpeg', path.join(os.homedir(), '.local/bin/ffmpeg')].find((b) => spawnSync(b, ['-version']).status === 0);
      if (ff) {
        spawnSync(ff, ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(dir, 'f%04d.png'), '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-pix_fmt', 'yuv420p', path.join(reviewDir, 'burst.mp4')]);
      }
    } else {
      const times = a.times ? a.times.split(',').map(Number) : buildInfo.reviewTimes;
      const names = Object.fromEntries(buildInfo.events.map((e) => [e.t.toFixed(3), e.name]));
      for (const t of times) {
        const f = path.join(reviewDir, `t${fmt(t)}.png`);
        await shoot(t, f);
        frames.push({ t, label: names[t.toFixed(3)] || (t === buildInfo.poster ? 'poster' : ''), file: path.basename(f) });
      }
    }

    // present mode: the page as a reader sees it, centred and scaled in a real window
    const shots = [];
    if (a.present) {
      for (const v of String(a.present === true ? '1440x900,820x1180,1440x900:fit' : a.present).split(',')) {
        const [vw, vh] = v.split(':')[0].split('x').map(Number);
        const fit = v.endsWith(':fit');
        await c.send('Emulation.setDeviceMetricsOverride', { width: vw, height: vh, deviceScaleFactor: 1, mobile: false });
        const ld = c.once('Page.loadEventFired');
        await c.send('Page.navigate', { url: `${pageUrl}?present&t=${buildInfo.poster}${fit ? '&fit' : ''}` });
        await ld;
        await c.eval('window.__amp.ready.then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))');
        const { data } = await c.send('Page.captureScreenshot', { format: 'png' });
        const f = `present-${vw}x${vh}${fit ? '-fit' : ''}.png`;
        fs.writeFileSync(path.join(reviewDir, f), Buffer.from(data, 'base64'));
        shots.push(f);
      }
    }

    // contact sheet, rendered by the same Chrome
    const cols = Math.min(4, frames.length);
    const thumbW = zoom ? Math.min(480, zoom[2]) : 300;
    const thumbH = Math.round(thumbW * (zoom ? zoom[3] / zoom[2] : H / W));
    const sheetW = cols * (thumbW + 16) + 16;
    const sheetH = Math.ceil(frames.length / cols) * (thumbH + 40) + 16;
    const sheet = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#2a2a2e;font:600 13px Menlo,monospace;color:#ddd}
      .g{display:grid;grid-template-columns:repeat(${cols},${thumbW}px);gap:16px 16px;padding:16px}
      figure{margin:0}img{width:${thumbW}px;height:${thumbH}px;display:block;background:#fff}figcaption{padding:5px 2px 0;white-space:nowrap;overflow:hidden}</style>
      <div class="g">${frames.map((f) => `<figure><img src="${f.file}"><figcaption>t=${f.t.toFixed(2)}s ${f.label || ''}</figcaption></figure>`).join('')}</div>`;
    fs.writeFileSync(path.join(reviewDir, 'contact.html'), sheet);
    await c.send('Emulation.setDeviceMetricsOverride', { width: sheetW, height: sheetH, deviceScaleFactor: 1, mobile: false });
    const sheetServer = await serve(reviewDir); // --dest may live outside the spec folder
    const sheetLoaded = c.once('Page.loadEventFired');
    await c.send('Page.navigate', { url: `http://127.0.0.1:${sheetServer.address().port}/contact.html` });
    await sheetLoaded;
    sheetServer.close();
    const { data } = await c.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: sheetW, height: sheetH, scale: 1 } });
    fs.writeFileSync(path.join(reviewDir, 'contact.png'), Buffer.from(data, 'base64'));

    // console summary
    console.log(`review -> ${path.relative(process.cwd(), reviewDir)}  (${frames.length} frames + contact.png + report.json)`);
    if (shots.length) console.log(`present: ${shots.join(', ')}`);
    console.log(`fit: ${report.ok ? 'OK' : 'ISSUES'}  build-in ${report.buildEnd}s  ops ${report.ops}`);
    for (const col of report.columns) console.log(`  col ${col.col}: ${col.used}/${col.avail}px  fill ${(col.fill * 100).toFixed(0)}%`);
    for (const i of report.issues) console.log(`  ! ${i.kind}  ${i.where}  ${i.detail}`);
    for (const s of report.missingSelectors) console.log(`  ! missing selector ${s}`);
    for (const f of report.fonts) if (!f.loaded) console.log(`  ! font not loaded: ${f.family}`);
  } finally {
    c.close();
    server.close();
    await chrome.close();
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
