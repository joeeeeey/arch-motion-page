// paper-a4: a portrait A4 page laid out like a short academic paper.
// Header, brand column + figure panel (hero), figure caption, rule, three body columns, footer.
// All page-level boxes are absolute so the layout is identical in Chrome review and HyperFrames.

import { esc, inline } from '../lib/markup.mjs';
import { icon } from '../lib/icons.mjs';
import { LOCALE, langCss } from '../lib/lang.mjs';

const loc = (spec) => LOCALE[spec.meta.lang] || LOCALE.en;
// Inline markup stripped, for <meta> text.
const plain = (s) => String(s).replace(/ -- /g, ' — ').replace(/[`*]|==/g, '').replace(/\s+/g, ' ').trim();

export const GEOM = {
  W: 1080, H: 1528, mx: 40,
  header: { x: 40, y: 28, w: 1000 },
  hero: { y: 148, h: 520 },
  brand: { x: 40, w: 226 },
  figure: { x: 288, w: 752 },
  caption: { x: 40, y: 682, w: 1000 },
  rule: { y: 748 },
  body: { x: 40, y: 764, w: 1000, h: 728, gap: 30 },
  footer: { x: 40, y: 1504, w: 1000 },
};

const px = (n) => `${Math.round(n * 10) / 10}px`;
const box = (b) => `left:${px(b.x)};top:${px(b.y)};width:${px(b.w)}${b.h != null ? `;height:${px(b.h)}` : ''}`;
const MARK_HUES = ['yellow', 'sky', 'green', 'magenta'];
const ROLE_HUES = ['blue', 'green', 'yellow', 'sky', 'magenta', 'orange', 'purple', 'coral'];

function yamlHighlight(src) {
  return src.split('\n').map((line) => {
    const m = line.match(/^(.*?)(\s#.*)?$/);
    let code = esc(m[1]);
    code = code.replace(/^(\s*-?\s*)([A-Za-z_][\w-]*)(:)/, '$1<span class="k">$2</span>$3');
    code = code.replace(/(&quot;[^&]*&quot;)/g, '<span class="s">$1</span>');
    return code + (m[2] ? `<span class="c">${esc(m[2])}</span>` : '');
  }).join('\n');
}

function cycleSvg(b, w, hueOf) {
  const n = b.steps.length;
  const H = 156, cx = w / 2, cy = 80, r = 52;
  const steps = b.steps.map((label, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
    const c = Math.cos(a);
    let tx = x, ty = y + 4, anchor = 'middle';
    if (c > 0.3) { tx = x + 15; anchor = 'start'; }
    else if (c < -0.3) { tx = x - 15; anchor = 'end'; }
    else ty = Math.sin(a) < 0 ? y - 15 : y + 24;
    return `<g class="step" data-cycle-step="${b.id}-${i}">`
      + `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="8"/><circle class="fill" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5"/>`
      + `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="${anchor}">${esc(label)}</text></g>`;
  }).join('');
  const circ = (2 * Math.PI * r).toFixed(1);
  return `<svg width="${w}" height="${H}" viewBox="0 0 ${w} ${H}">`
    + `<circle class="ring" data-cycle-ring="${b.id}" cx="${cx}" cy="${cy}" r="${r}" stroke-dasharray="${circ} ${circ}" transform="rotate(-90 ${cx} ${cy})"/>`
    + `<g class="orbit" data-cycle-orbit="${b.id}"><circle cx="${cx + r}" cy="${cy}" r="3.2"/><circle cx="${cx - r}" cy="${cy}" r="3.2"/></g>`
    + (b.center ? `<text class="center" x="${cx}" y="${cy + 4}" text-anchor="middle">${esc(b.center)}</text>` : '')
    + steps + '</svg>';
}

// Body columns. Returns HTML plus an index the motion compiler uses (reading order, marks, headings, inserts).
export function renderBody(spec, theme) {
  const L = loc(spec);
  const g = GEOM.body;
  const colW = (g.w - g.gap * 2) / 3;
  const index = { anim: [], marks: [], headings: [], cycles: [], takeaways: [], cols: [] };
  let anim = 0, hIdx = 0;
  const A = (kind) => { index.anim.push(kind); return `data-anim="${anim++}"`; };
  const heading = (cls, text) => {
    const hue = ROLE_HUES[hIdx % ROLE_HUES.length];
    index.headings.push({ sel: `[data-heading="${hIdx}"]`, hue });
    return `<div class="${cls}" ${A('heading')}><span class="amp-hsweep" data-heading="${hIdx++}" style="--hue:var(--h-${hue})">${inline(text)}</span></div>`;
  };

  const cols = spec.body.map((blocks, ci) => {
    const html = blocks.map((b) => {
      const hue = b.hue || 'blue';
      switch (b.type) {
        case 'abstract':
          return `<div class="amp-block amp-abstract" data-block="${b.id}" ${A('abstract')}>${b.text.map((t, i) => `<p>${i === 0 ? `<em class="lead">${esc(b.label || L.abstract)}</em>${L.abstractSep}` : ''}${inline(t)}</p>`).join('')}</div>`;
        case 'section':
          return `<div class="amp-block" data-block="${b.id}">${b.heading ? heading(b.level === 2 ? 'amp-h2' : 'amp-h1', b.heading) : ''}${(b.text || []).map((t) => `<p ${A('p')}>${inline(t)}</p>`).join('')}</div>`;
        case 'para':
          return `<div class="amp-block" data-block="${b.id}">${b.text.map((t) => `<p ${A('p')}>${inline(t)}</p>`).join('')}</div>`;
        case 'cycle':
          index.cycles.push({ id: b.id, n: b.steps.length, cx: (colW - 26) / 2, cy: 80 });
          return `<div class="amp-box amp-cycle" data-block="${b.id}" ${A('insert')} style="--hue:var(--h-${hue})">${b.title ? `<div class="amp-box-title">${esc(b.title)}</div>` : ''}${cycleSvg(b, colW - 26, hue)}</div>`;
        case 'takeaways':
          index.takeaways.push({ id: b.id, n: b.items.length });
          return `<div class="amp-box amp-takeaways" data-block="${b.id}" ${A('insert')} style="--hue:var(--h-${hue})"><div class="amp-box-title">${esc(b.title || L.takeaways)}</div><ol>${b.items.map((t, i) => `<li style="--li-hue:var(--h-${ROLE_HUES[i % ROLE_HUES.length]})">${inline(t)}</li>`).join('')}</ol></div>`;
        case 'quote':
          return `<blockquote class="amp-quote" data-block="${b.id}" ${A('insert')} style="--hue:var(--h-${hue})"><p>${inline(b.text.join(' '))}</p>${b.by ? `<cite>${esc(b.by)}</cite>` : ''}</blockquote>`;
        case 'list':
          return `<div class="amp-block amp-list" data-block="${b.id}" ${A('insert')}>${b.heading ? heading('amp-h2', b.heading) : ''}<ul>${b.items.map((t) => `<li>${inline(t)}</li>`).join('')}</ul></div>`;
        case 'code':
          return `<div class="amp-box amp-code" data-block="${b.id}" ${A('insert')} style="--hue:var(--h-${hue})">${b.title ? `<div class="amp-box-title">${esc(b.title)}</div>` : ''}<pre>${yamlHighlight(b.text.join('\n').replace(/\n+$/, ''))}</pre></div>`;
        case 'filmstrip':
          return `<div class="amp-block amp-filmstrip" data-block="${b.id}" ${A('insert')}><div class="amp-strip" style="grid-template-columns:repeat(${b.frames.length},1fr)">${b.frames.map((f) => `<figure><img src="${esc(f.src.rel)}" alt="">${f.label ? `<figcaption>${esc(f.label)}</figcaption>` : ''}</figure>`).join('')}</div>${b.caption ? `<div class="amp-strip-cap">${inline(b.caption)}</div>` : ''}</div>`;
        case 'table':
          return `<div class="amp-block amp-table" data-block="${b.id}" ${A('insert')}>${b.title ? `<div class="amp-table-title">${inline(b.title)}</div>` : ''}<table><thead><tr>${b.columns.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${b.rows.map((r) => `<tr>${r.map((c) => `<td>${inline(String(c))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
        case 'image':
          return `<div class="amp-block amp-image" data-block="${b.id}" ${A('insert')}><img src="${esc(b.src.rel)}" style="height:${b.height || 160}px" alt="">${b.caption ? `<div class="cap">${inline(b.caption)}</div>` : ''}</div>`;
        default:
          return '';
      }
    }).join('\n');
    const x = g.x + ci * (colW + g.gap);
    index.cols.push({ x, w: colW });
    return `<div class="amp-col" data-col="${ci}" style="${box({ x, y: g.y, w: colW, h: g.h })}">\n${html}\n</div>`;
  });

  let mk = 0;
  const html = cols.join('\n').replace(/<mark class="amp-mark">/g, () => {
    const hue = MARK_HUES[mk % MARK_HUES.length];
    index.marks.push({ sel: `[data-mark="${mk}"]`, hue });
    return `<mark class="amp-mark" data-mark="${mk++}" style="--hue:var(--h-${hue})">`;
  });
  return { html, index };
}

function nodeHtml(n, hues) {
  const style = `${box(n)};height:${px(n.h)};--hue:${hues[n.hue] || n.hue}`;
  const cls = `amp-node t${n.tier}${n.outcome ? ' outcome' : ''}`;
  const mascot = n.mascot ? `<div class="amp-mascot"><img src="${esc(n.mascot.rel)}" alt=""></div>` : '';
  const title = `<div class="amp-node-title">${esc(n.title)}</div>`;
  const sub = n.sub ? `<div class="amp-node-sub">${inline(n.sub)}</div>` : '';
  let inner;
  if (n.tier === 0) inner = `${mascot}<div class="amp-text">${title}${sub}</div>`;
  else if (n.tier === 1) inner = `${mascot}${title}${sub}`;
  else inner = `${mascot || `<div class="amp-badge">${icon(n.icon || 'spark')}</div>`}${title}${sub}`;
  return `<div class="${cls}" data-node="${esc(n.id)}" style="${style}"><div class="amp-card">${inner}</div></div>`;
}

function arrowHead(pts) {
  const [x1, y1] = pts.at(-2), [x2, y2] = pts.at(-1);
  const d = Math.hypot(x2 - x1, y2 - y1) || 1;
  const ux = (x2 - x1) / d, uy = (y2 - y1) / d;
  const L = 7, Wd = 4;
  const bx = x2 - ux * L, by = y2 - uy * L;
  const f = (n) => n.toFixed(1);
  return `M${f(x2)},${f(y2)}L${f(bx - uy * Wd)},${f(by + ux * Wd)}L${f(bx + uy * Wd)},${f(by - ux * Wd)}Z`;
}

const pathD = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join('');

function figureHtml(spec, layout, theme, plan) {
  const L = loc(spec);
  const { W, H } = layout;
  const fig = spec.figure;
  const edges = layout.edges.map((e) => {
    if (e.dashed) return `<path class="e fb" data-edge="${e.id}" d="${pathD(e.pts)}" mask="url(#m-${e.id})"/>`;
    const cls = e.id === 'bus3' ? 'e bus3' : 'e';
    return `<path class="${cls}" data-edge="${e.id}" d="${pathD(e.pts)}" stroke-dasharray="${e.len} ${e.len}"/>`;
  }).join('\n');
  const masks = layout.edges.filter((e) => e.dashed).map((e) =>
    `<mask id="m-${e.id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><path data-edge-mask="${e.id}" d="${pathD(e.pts)}" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${e.len} ${e.len}"/></mask>`).join('');
  // marching-dash overlays: invisible until the ambient phase fades them in
  const flows = layout.edges.filter((e) => !e.dashed).map((e) => `<path class="fl" data-flow-edge="${e.id}" d="${pathD(e.pts)}"/>`).join('');
  const arrows = layout.edges.filter((e) => e.arrow).map((e) =>
    `<path class="ah${e.dashed ? ' fb' : ''}" data-arrow="${e.id}" d="${arrowHead(e.pts)}"/>`).join('\n');
  const rings = layout.rings.map((r) => `<div class="amp-ring" data-ring="${r.id}" style="${box(r)}"></div>`).join('');
  const nodes = layout.nodes.map((n) => nodeHtml(n, theme.hues)).join('\n');
  const packets = plan.packets.map((p) => `<div class="amp-packet" id="${p.id}" style="--hue:${theme.hues[p.hue] || p.hue}"></div>`).join('');
  const bus = layout.busLabel ? `<div class="amp-buslabel" data-amp="buslabel" style="left:${px(layout.busLabel.x)};top:${px(layout.busLabel.y)}">${esc(layout.busLabel.text)}</div>` : '';
  const fbText = layout.feedback?.label || '';
  const fbCut = fbText.search(/[:：]/);
  const [fbHead, fbTail] = fbCut >= 0 ? [fbText.slice(0, fbCut), fbText.slice(fbCut + 1).trim()] : ['', fbText];
  const fb = fbText ? `<div class="amp-fblabel" data-amp="fblabel" style="${box(layout.feedback.labelBox)}">${fbHead ? `<span class="k">${esc(fbHead)}</span>` : ''}<span>${inline(fbTail)}</span></div>` : '';
  const g = GEOM.figure, hero = GEOM.hero;
  return `<figure class="amp-figure" data-amp="figure" style="${box({ x: g.x, y: hero.y, w: g.w, h: hero.h })}">
<div class="amp-panel" data-amp="panel"></div>
<div class="amp-figlabel" data-amp="figlabel"><b>${esc(fig.label_lead || L.fig)}</b> · ${esc(fig.label || L.overview)}</div>
<svg class="amp-edges" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${masks}</defs>
${edges}
${flows}
${arrows}
</svg>
${rings}
${nodes}
${bus}${fb}
${packets}
<div class="amp-spot" data-amp="spot"></div>
</figure>`;
}

function brandHtml(spec, layout, theme) {
  const b = spec.brand, g = GEOM.brand, hero = GEOM.hero;
  const chars = [...(b.wordmark || spec.meta.id)];
  const neon = theme.neon || theme.sweep;
  // One gradient spans the whole word; each letter shows its slice of it (--i) in two blurred halo layers.
  const grad = `linear-gradient(90deg, ${neon.join(', ')})`;
  const word = chars.map((c, i) => `<span data-ch="${esc(c)}" style="--i:${(i / Math.max(1, chars.length - 1)).toFixed(3)}">${esc(c)}</span>`).join('');
  const dotNodes = layout.nodes.filter((n) => n.tier <= 1);
  const dots = dotNodes.map((n, i) => `<i data-dot="${i}" style="--hue:${theme.hues[n.hue] || n.hue}"></i>`).join('');
  const stats = b.stats.map((s) => {
    const [ic, ...rest] = typeof s === 'string' ? ['check', s] : [s.icon, s.text];
    return `<li>${icon(ic)}<span>${inline(rest.join(''))}</span></li>`;
  }).join('');
  return `<aside class="amp-brand" data-amp="brand" style="${box({ x: g.x, y: hero.y, w: g.w, h: hero.h })}">
${b.image ? `<div class="amp-brand-art" data-amp="brand-art"><img src="${esc(b.image.rel)}" alt=""></div>` : ''}
<div class="amp-wordmark" data-amp="wordmark" data-layout-ignore style="--n:${chars.length};--wm-grad:${grad}">${word}</div>
${b.tagline ? `<div class="amp-tagline" data-amp="tagline">${esc(b.tagline)}</div>` : ''}
<div class="amp-dots" data-amp="dots">${dots}</div>
${b.blurb ? `<p class="amp-blurb" data-amp="blurb">${inline(b.blurb)}</p>` : ''}
${stats ? `<ul class="amp-stats" data-amp="stats">${stats}</ul>` : ''}
</aside>`;
}

// Circular rotating stamp in the header's free corner. textLength makes any phrase fill the ring exactly.
// The stamp and the neon wordmark are decoration and logotype: data-layout-ignore exempts them from
// HyperFrames' layout and contrast audits (body copy is never exempted).
export const STAMP = { size: 96, r: 37 };
function stampHtml(st) {
  const { size, r } = STAMP, c = size / 2;
  const circ = (2 * Math.PI * r).toFixed(1);
  const text = typeof st === 'string' ? st : st.text;
  return `<div class="amp-stamp" data-amp="stamp" data-layout-ignore style="width:${size}px;height:${size}px"><svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`
    + `<defs><path id="amp-stamp-path" d="M${c},${c - r}a${r},${r} 0 1,1 0,${2 * r}a${r},${r} 0 1,1 0,-${2 * r}"/></defs>`
    + `<circle class="disc" cx="${c}" cy="${c}" r="${c - 1}"/><circle class="inner" cx="${c}" cy="${c}" r="${r - 9}"/>`
    + `<g class="ring" data-amp="stamp-ring"><text><textPath href="#amp-stamp-path" textLength="${circ}" lengthAdjust="spacing">${esc(text)}</textPath></text></g>`
    + `<text class="center" x="${c}" y="${c + 7}" text-anchor="middle">${esc(st.center || 'amp')}</text></svg></div>`;
}

export function renderPage({ spec, layout, theme, plan, body, css, fontCss }) {
  const L = loc(spec);
  const h = spec.header;
  const g = GEOM;
  const title = h.sweep ? esc(h.title).replace(esc(h.sweep), `<span class="amp-sweep">${esc(h.sweep)}</span>`) : esc(h.title);
  const hueVars = Object.entries(theme.hues).map(([k, v]) => `--h-${k}:${v};`).join('');
  const f = spec.footer;
  return `<!doctype html>
<html lang="${esc(spec.meta.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(spec.meta.title || h.title)}</title>
<meta name="description" content="${esc(plain(h.subtitle || spec.figure.caption || ''))}">
<meta property="og:title" content="${esc(spec.meta.title || h.title)}">
<meta property="og:description" content="${esc(plain(h.subtitle || spec.figure.caption || ''))}">
<style>
${fontCss}
:root{${hueVars}--sweep:${theme.sweep.join(', ')};--edge:${theme.edge};}
${css}
${langCss(spec.meta.lang)}
</style>
</head>
<body>
<div id="amp-root" class="amp-page theme-${esc(theme.name)}" data-composition-id="${esc(spec.meta.id)}" data-start="0" data-width="${g.W}" data-height="${g.H}" data-duration="${spec.meta.duration}" style="width:${g.W}px;height:${g.H}px">
<header class="amp-header" style="${box(g.header)}">
<div class="amp-kicker" data-amp="kicker"><span>${inline(h.kicker || '')}</span><span>${inline(h.meta || '')}</span></div>
<h1 class="amp-title" data-amp="title">${title}</h1>
${h.stamp ? stampHtml(h.stamp) : ''}
${h.subtitle ? `<div class="amp-subtitle" data-amp="subtitle">${inline(h.subtitle)}</div>` : ''}
</header>
${brandHtml(spec, layout, theme)}
${figureHtml(spec, layout, theme, plan)}
${spec.figure.caption ? `<p class="amp-caption" data-amp="caption" style="${box(g.caption)}"><b>${esc(spec.figure.label_lead || L.fig)}${L.figSep}</b> ${inline(spec.figure.caption)}</p>` : ''}
<hr class="amp-rule" data-amp="rule" style="${box({ x: g.mx, y: g.rule.y, w: g.W - g.mx * 2 })}">
${body.html}
<div class="amp-footer" data-amp="footer" style="${box(g.footer)}"><span>${inline(f.left || '')}</span><span>${inline(f.center || '')}</span><span>${inline(f.right || '')}</span></div>
</div>
<script type="application/json" id="amp-plan">${JSON.stringify(plan.runtime).replace(/</g, '\\u003c')}</script>
<script id="amp-report" type="application/json">{}</script>
<script src="gsap.min.js"></script>
<script src="amp-runtime.js"></script>
<script>/* registered inline: HyperFrames' static lint reads only the HTML */ window.__timelines["${spec.meta.id}"] = window.__amp.tl;</script>
</body>
</html>
`;
}
