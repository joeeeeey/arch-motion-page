#!/usr/bin/env node
// spec.yaml -> self-contained page folder (index.html + runtime + GSAP + fonts + assets).
// The output folder is also a HyperFrames project root: index.html is the composition.
//
//   node scripts/build.mjs examples/self-intro/spec.yaml [--out examples/self-intro/out] [--theme name] [--single]
//
// spec.<x>.yaml builds into out-<x>/ by default (e.g. spec.zh.yaml -> out-zh/).
// --single also writes <out>/single/<id>[-<lang>].html with fonts, images and scripts inlined, for publishing.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { loadSpec } from '../lib/spec.mjs';
import { layoutTiered } from '../lib/archetypes/tiered.mjs';
import { compileMotion, reviewTimes } from '../lib/motion.mjs';
import { GEOM, renderBody, renderPage } from '../templates/paper-a4.mjs';
import { LANG_FONTS, LATIN_RANGE } from '../lib/lang.mjs';
import { fontPath, pageCodepoints, subsetFonts } from '../lib/fonts.mjs';

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// GSAP comes from npm (pinned in package.json) rather than being vendored: its license does not grant redistribution.
const GSAP = createRequire(import.meta.url).resolve('gsap/dist/gsap.min.js');
const BASE_CSS = `.amp-debug [data-amp-issue]{outline:2px solid #ff2d2d!important;outline-offset:-1px}
/* present mode (runtime adds .amp-present when a person opens the page): centred, scaled stage */
html.amp-present body{display:flex;min-height:100vh;box-sizing:border-box;overflow-x:hidden}
.amp-stage{position:relative;flex:none;margin:auto;overflow:hidden;box-shadow:0 1px 3px rgba(15,20,30,.08),0 18px 50px rgba(15,20,30,.14)}
.amp-stage.flush{box-shadow:none}
.amp-stage>.amp-page{position:absolute;left:0;top:0;transform-origin:0 0}`;
const FONT_SLOT = '/*amp:font-face*/';
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff2': 'font/woff2' };

function args(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) a[argv[i].slice(2)] = argv[i + 1]?.startsWith('--') || argv[i + 1] == null ? true : argv[++i];
    else a._.push(argv[i]);
  }
  return a;
}

// A theme is theme.json + theme.css. "extends": "<base>" layers the CSS after the base theme's
// and merges hues/fonts, so a skin only restates the tokens and rules it changes.
function loadTheme(name, seen = []) {
  const dir = path.join(SKILL, 'themes', name);
  if (!fs.existsSync(dir)) throw new Error(`unknown theme ${name} (have ${fs.readdirSync(path.join(SKILL, 'themes')).join(', ')})`);
  if (seen.includes(name)) throw new Error(`theme extends cycle: ${[...seen, name].join(' -> ')}`);
  const theme = JSON.parse(fs.readFileSync(path.join(dir, 'theme.json'), 'utf8'));
  const css = fs.readFileSync(path.join(dir, 'theme.css'), 'utf8');
  if (!theme.extends) return { ...theme, css };
  const base = loadTheme(theme.extends, [...seen, name]);
  const fonts = [...base.fonts, ...(theme.fonts || [])].filter((f, i, all) => all.findIndex((g) => g.file === f.file) === i);
  return {
    ...base, ...theme,
    hues: { ...base.hues, ...(theme.hues || {}) },
    fonts,
    css: `${base.css}\n/* ===== ${name} (extends ${theme.extends}) ===== */\n${css}`,
  };
}

function copy(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

export function build(specFile, opts = {}) {
  const spec = loadSpec(specFile);
  const theme = loadTheme(opts.theme || spec.meta.theme);
  const variant = path.basename(specFile).match(/^spec\.(.+)\.ya?ml$/)?.[1];
  const out = path.resolve(opts.out || path.join(path.dirname(path.resolve(specFile)), variant ? `out-${variant}` : 'out'));
  const lang = spec.meta.lang;
  const fonts = [...theme.fonts, ...LANG_FONTS[lang]];

  const layout = layoutTiered(spec.figure, GEOM.figure.w, GEOM.hero.h);
  const body = renderBody(spec, theme);
  const plan = compileMotion({ spec, layout, index: body.index, theme });
  plan.runtime.fonts = [...new Set(fonts.map((f) => f.family))];

  // Fonts: vendored Latin TTFs are copied as is; CJK fonts (and everything under --single) are
  // subset to the code points this page uses, which needs the HTML first.
  let html = renderPage({ spec, layout, theme, plan, body, css: `${theme.css}\n${BASE_CSS}`, fontCss: FONT_SLOT });
  const vendor = path.join(SKILL, 'vendor/fonts');
  const subsetted = fonts.filter((f) => f.cjk || opts.single);
  const woff2 = subsetted.length ? subsetFonts(subsetted.map((f) => ({ src: fontPath(f.file, vendor), codepoints: pageCodepoints(html) }))) : [];
  const files = fonts.map((f) => {
    const k = subsetted.indexOf(f);
    return k < 0 ? { src: fontPath(f.file, vendor), name: f.file } : { src: woff2[k], name: `${path.parse(f.file).name}.woff2` };
  });
  const fontCss = fonts.map((f, i) => {
    const fmt = files[i].name.endsWith('.woff2') ? 'woff2' : 'truetype';
    const range = !f.cjk && LATIN_RANGE[lang] ? `;unicode-range:${LATIN_RANGE[lang]}` : '';
    return `@font-face{font-family:"${f.family}";src:url("fonts/${files[i].name}") format("${fmt}");font-weight:${f.weight};font-style:${f.style};font-display:block${range}}`;
  }).join('\n');
  html = html.replace(FONT_SLOT, () => fontCss);

  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'index.html'), html);
  copy(GSAP, path.join(out, 'gsap.min.js'));
  copy(path.join(SKILL, 'runtime/amp-runtime.js'), path.join(out, 'amp-runtime.js'));
  files.forEach((f) => copy(f.src, path.join(out, 'fonts', f.name)));

  const assets = new Set();
  if (spec.brand.image) assets.add(spec.brand.image.rel);
  for (const n of layout.nodes) if (n.mascot) assets.add(n.mascot.rel);
  for (const col of spec.body) for (const b of col) {
    if (b.src) assets.add(b.src.rel);
    for (const f of b.frames || []) assets.add(f.src.rel);
  }
  for (const rel of assets) {
    if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`asset ${rel} must live inside the spec folder`);
    copy(path.join(spec.dir, rel), path.join(out, rel));
  }

  let single = null;
  if (opts.single) {
    // In a subdir: HyperFrames rejects a second root-level HTML file with a composition id.
    single = path.join(out, 'single', `${spec.meta.id}${lang === 'en' ? '' : `-${lang}`}.html`);
    fs.mkdirSync(path.dirname(single), { recursive: true });
    fs.writeFileSync(single, inlineAll(html, out));
  }

  const meta = {
    id: spec.meta.id,
    lang,
    single: single && path.relative(out, single),
    theme: theme.name,
    duration: spec.meta.duration,
    size: [GEOM.W, GEOM.H],
    buildEnd: plan.runtime.buildEnd,
    poster: plan.runtime.poster,
    loopFrom: plan.runtime.loopFrom,
    ops: plan.runtime.ops.length,
    packets: plan.packets.length,
    events: plan.events,
    reviewTimes: reviewTimes(plan, spec.meta.duration),
    warnings: spec.warnings,
    seam: plan.seam,
  };
  fs.writeFileSync(path.join(out, 'amp-build.json'), JSON.stringify({ ...meta, layout }, null, 1));
  return { out, meta };
}

// One self-contained file: scripts inline, fonts and images as data URIs.
function inlineAll(html, out) {
  const dataUri = (rel) => `data:${MIME[path.extname(rel).toLowerCase()] || 'application/octet-stream'};base64,${fs.readFileSync(path.join(out, rel)).toString('base64')}`;
  const script = (rel) => fs.readFileSync(path.join(out, rel), 'utf8').replace(/<\/script/gi, '<\\/script');
  return html
    .replace(/<script src="([^"]+)"><\/script>/g, (_, rel) => `<script>${script(rel)}</script>`)
    .replace(/url\("(fonts\/[^"]+)"\)/g, (_, rel) => `url("${dataUri(rel)}")`)
    .replace(/<img src="([^"]+)"/g, (m, rel) => (/^(data|https?):/.test(rel) ? m : `<img src="${dataUri(rel)}"`));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const a = args(process.argv.slice(2));
  if (!a._[0]) {
    console.error('usage: build.mjs <spec.yaml> [--out dir] [--theme name] [--single]');
    process.exit(2);
  }
  try {
    const { out, meta } = build(a._[0], { out: a.out, theme: a.theme, single: !!a.single });
    const shown = (f) => { const r = path.relative(process.cwd(), f); return r.startsWith('..') ? f : r; };
    console.log(`built ${shown(out)}/index.html  ${meta.size.join('x')}  ${meta.duration}s  lang ${meta.lang}  build-in ${meta.buildEnd}s  loop ${meta.loopFrom}-${meta.duration}s  ops ${meta.ops}  packets ${meta.packets}`);
    if (meta.single) console.log(`single ${shown(path.join(out, meta.single))}  ${(fs.statSync(path.join(out, meta.single)).size / 1048576).toFixed(1)} MB`);
    for (const w of meta.warnings) console.log(`  warn  ${w}`);
    for (const s of meta.seam) console.log(`  warn  loop seam: ${s} is still moving at the loop start or past the end`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
