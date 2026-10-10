// Font pipeline for CJK pages and single-file output.
//
// - Large fonts are not vendored. They are downloaded once into a host cache, pinned by commit and sha256.
// - Subsetting (pyftsubset -> woff2) runs inside Docker with --network none, so no third-party tool runs
//   on the host. AMP_SUBSET=host runs the same fonttools version through `uv run` instead.
// - Subsets are cached by (font sha256, code points, fonttools version), so rebuilds skip the container.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

export const CACHE = process.env.AMP_CACHE || path.join(os.homedir(), '.cache', 'arch-motion-page');
const FONTTOOLS = '4.66.1';
const BROTLI = '1.2.0';
const IMAGE = `amp-fonttools:${FONTTOOLS}`;

const NOTO_CJK = 'https://raw.githubusercontent.com/notofonts/noto-cjk/f8d157532fbfaeda587e826d4cd5b21a49186f7c';
const REMOTE = {
  'NotoSerifSC-Regular.otf': [`${NOTO_CJK}/Serif/SubsetOTF/SC/NotoSerifSC-Regular.otf`, 'e8f396decc1f0963a016a989c3d8852e863d1350996f573860a80767c83a1cd3'],
  'NotoSerifSC-Bold.otf': [`${NOTO_CJK}/Serif/SubsetOTF/SC/NotoSerifSC-Bold.otf`, '24693d48bdb9152f0a06b02af625638a1097abd6de4010ebba027f6e82710527'],
  'NotoSansSC-Regular.otf': [`${NOTO_CJK}/Sans/SubsetOTF/SC/NotoSansSC-Regular.otf`, 'faa6c9df652116dde789d351359f3d7e5d2285a2b2a1f04a2d7244df706d5ea9'],
  'NotoSansSC-Bold.otf': [`${NOTO_CJK}/Sans/SubsetOTF/SC/NotoSansSC-Bold.otf`, 'c6cb5a93abaa9edc8ee7463b7ebb7f42d618d40e6ed2f7a5371c97b0b64767c0'],
};

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

// Absolute path of a font file: vendored fonts first, then the pinned remote set (downloaded on demand).
export function fontPath(file, vendorDir) {
  const local = path.join(vendorDir, file);
  if (fs.existsSync(local)) return local;
  const remote = REMOTE[file];
  if (!remote) throw new Error(`font ${file} is neither vendored nor in the pinned remote set`);
  const dst = path.join(CACHE, 'fonts', file);
  if (!fs.existsSync(dst)) {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    console.error(`downloading ${file} (one-time, pinned)`);
    execFileSync('curl', ['-fsSL', '--retry', '2', '-o', `${dst}.part`, remote[0]], { stdio: 'inherit' });
    fs.renameSync(`${dst}.part`, dst);
  }
  const got = sha256(fs.readFileSync(dst));
  if (got !== remote[1]) {
    fs.rmSync(dst);
    throw new Error(`${file}: sha256 ${got} does not match the pinned ${remote[1]}; removed, rerun to fetch again`);
  }
  return dst;
}

// Code points a page can show: printable ASCII and Latin-1, plus every other character in the HTML.
export function pageCodepoints(html) {
  const cps = new Set();
  for (let c = 0x20; c <= 0xff; c++) if (c < 0x7f || c > 0x9f) cps.add(c);
  for (const ch of html) { const c = ch.codePointAt(0); if (c > 0x7f) cps.add(c); }
  return [...cps].sort((a, b) => a - b);
}

// jobs: [{ src, codepoints }] -> same order, absolute paths of cached woff2 subsets.
export function subsetFonts(jobs) {
  const dir = path.join(CACHE, 'subset');
  fs.mkdirSync(dir, { recursive: true });
  const shaOf = new Map();
  const planned = jobs.map((j) => {
    if (!shaOf.has(j.src)) shaOf.set(j.src, sha256(fs.readFileSync(j.src)));
    const key = sha256(JSON.stringify([shaOf.get(j.src), j.codepoints, FONTTOOLS])).slice(0, 24);
    return { ...j, key, out: path.join(dir, `${key}.woff2`) };
  });
  const todo = planned.filter((p, i) => !fs.existsSync(p.out) && planned.findIndex((q) => q.key === p.key) === i);
  if (todo.length) runSubset(todo, dir);
  for (const p of planned) if (!fs.existsSync(p.out)) throw new Error(`subsetting ${path.basename(p.src)} produced no output`);
  return planned.map((p) => p.out);
}

function runSubset(todo, dir) {
  const work = fs.mkdtempSync(path.join(dir, 'job-'));
  try {
    const srcDirs = [...new Set(todo.map((t) => path.dirname(t.src)))];
    const host = process.env.AMP_SUBSET === 'host';
    const lines = todo.map((t) => {
      fs.writeFileSync(path.join(work, `${t.key}.txt`), t.codepoints.map((c) => c.toString(16)).join('\n'));
      const src = host ? t.src : `/src${srcDirs.indexOf(path.dirname(t.src))}/${path.basename(t.src)}`;
      const w = host ? work : '/w';
      return `pyftsubset '${src}' --unicodes-file='${w}/${t.key}.txt' --flavor=woff2 --layout-features='*' --output-file='${w}/${t.key}.woff2'`;
    });
    const script = `set -e\n${lines.join('\n')}\n`;
    console.error(`subsetting ${todo.length} font(s) ${host ? 'on the host via uv' : `in Docker (${IMAGE})`}`);
    if (host) {
      execFileSync('uv', ['run', '--no-project', '--with', `fonttools==${FONTTOOLS}`, '--with', `brotli==${BROTLI}`, 'sh', '-c', script], { stdio: ['ignore', 'ignore', 'inherit'] });
    } else {
      ensureImage();
      const mounts = srcDirs.flatMap((d, i) => ['-v', `${d}:/src${i}:ro`]);
      execFileSync('docker', ['run', '--rm', '--network', 'none', ...mounts, '-v', `${work}:/w`, IMAGE, 'sh', '-c', script], { stdio: ['ignore', 'ignore', 'inherit'] });
    }
    for (const t of todo) fs.renameSync(path.join(work, `${t.key}.woff2`), t.out);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

const hasImage = (ref) => {
  try { execFileSync('docker', ['image', 'inspect', ref], { stdio: 'ignore' }); return true; } catch { return false; }
};

// One-time image: pip install in a throwaway container, then commit. `docker build` is avoided on purpose,
// and the public base is pulled with an empty DOCKER_CONFIG: a desktop credential helper can block on a keychain.
function ensureImage() {
  if (hasImage(IMAGE)) return;
  console.error(`creating ${IMAGE} (one-time)`);
  const base = 'python:3.12-slim-bookworm';
  if (!hasImage(base)) {
    const cfg = fs.mkdtempSync(path.join(os.tmpdir(), 'amp-docker-'));
    try {
      fs.writeFileSync(path.join(cfg, 'config.json'), '{}');
      const host = execFileSync('docker', ['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'], { encoding: 'utf8' }).trim();
      execFileSync('docker', ['pull', '-q', base], { stdio: ['ignore', 'ignore', 'inherit'], env: { ...process.env, DOCKER_CONFIG: cfg, DOCKER_HOST: host } });
    } finally { fs.rmSync(cfg, { recursive: true, force: true }); }
  }
  const name = `amp-fonttools-build-${process.pid}`;
  try {
    execFileSync('docker', ['run', '--name', name, base, 'pip', 'install', '--no-cache-dir',
      '--disable-pip-version-check', '--root-user-action=ignore', '-q', `fonttools==${FONTTOOLS}`, `brotli==${BROTLI}`], { stdio: ['ignore', 'ignore', 'inherit'] });
    execFileSync('docker', ['commit', '-c', 'WORKDIR /w', name, IMAGE], { stdio: 'ignore' });
  } finally {
    execFileSync('docker', ['rm', '-f', name], { stdio: 'ignore' });
  }
}
