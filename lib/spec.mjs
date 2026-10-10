// Load, validate and normalise a page spec (spec.yaml).
// The spec is the only thing an agent writes; everything downstream is deterministic.

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { LANGS, textWidth } from './lang.mjs';
import { ICON_NAMES } from './icons.mjs';

const ROLE_HUES = ['blue', 'green', 'yellow', 'sky', 'magenta', 'orange', 'purple', 'coral'];
const BLOCK_TYPES = ['abstract', 'section', 'para', 'cycle', 'takeaways', 'quote', 'list', 'code', 'image', 'filmstrip', 'table'];

// Character budgets are a cheap first gate; the runtime fit report is the real one.
export const BUDGET = {
  title: 52, subtitle: 120, kicker: 64, caption: 300, tagline: 40, blurb: 120, stat: 28,
  rootTitle: 18, rootSub: 44,
  t1Title: 12, t1Sub: 44,
  t2Title: 14, t2Sub: 34,
  feedback: 48, busLabel: 56,
};

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function loadSpec(file) {
  const abs = path.resolve(file);
  const raw = YAML.parse(fs.readFileSync(abs, 'utf8'));
  return normalizeSpec(raw, path.dirname(abs));
}

export function normalizeSpec(raw, dir) {
  const errors = [];
  const warnings = [];
  const need = (ok, msg) => { if (!ok) errors.push(msg); return ok; };
  const budget = (val, max, where) => {
    const w = val ? textWidth(val) : 0; // CJK counts double
    if (w > max) warnings.push(`${where}: width ${w} > budget ${max}`);
  };
  const asset = (p, where) => {
    if (!p) return null;
    const abs = path.resolve(dir, p);
    if (!fs.existsSync(abs)) errors.push(`${where}: missing asset ${p}`);
    return { rel: p, abs };
  };

  const meta = { duration: 24, theme: 'plush-academic', template: 'paper-a4', lang: 'en', seed: 7, ...(raw.meta || {}) };
  need(meta.id && /^[a-z0-9-]+$/.test(meta.id), 'meta.id must be a lowercase slug');
  need(meta.duration >= 8 && meta.duration <= 120, 'meta.duration must be 8..120 seconds');
  need(LANGS.includes(meta.lang), `meta.lang must be one of ${LANGS.join(', ')} (got ${meta.lang})`);

  const header = { ...(raw.header || {}) };
  need(header.title, 'header.title is required');
  budget(header.title, BUDGET.title, 'header.title');
  budget(header.subtitle, BUDGET.subtitle, 'header.subtitle');
  budget(header.kicker, BUDGET.kicker, 'header.kicker');
  if (header.sweep) need(header.title?.includes(header.sweep), `header.sweep "${header.sweep}" must appear in header.title`);

  const brand = { stats: [], ...(raw.brand || {}) };
  brand.image = asset(brand.image, 'brand.image');
  budget(brand.tagline, BUDGET.tagline, 'brand.tagline');
  budget(brand.blurb, BUDGET.blurb, 'brand.blurb');
  brand.stats.forEach((s, i) => budget(s, BUDGET.stat, `brand.stats[${i}]`));

  const fig = { archetype: 'tiered', ...(raw.figure || {}) };
  need(fig.archetype === 'tiered', `figure.archetype "${fig.archetype}" is not implemented (tiered)`);
  need(Array.isArray(fig.tiers) && fig.tiers.length === 3, 'figure.tiers must have exactly 3 tiers');
  budget(fig.caption, BUDGET.caption, 'figure.caption');
  budget(fig.feedback?.label, BUDGET.feedback, 'figure.feedback.label');
  budget(fig.bus_label, BUDGET.busLabel, 'figure.bus_label');

  const ids = new Set();
  let hueIdx = 0;
  fig.tiers = (fig.tiers || []).map((tier, ti) => {
    const t = Array.isArray(tier) ? { nodes: tier } : { ...tier };
    t.nodes = (t.nodes || []).map((n0, ni) => {
      const n = typeof n0 === 'string' ? { title: n0 } : { ...n0 };
      n.id = n.id || slug(n.title || '') || `t${ti}n${ni}`; // CJK titles slug to nothing
      need(!ids.has(n.id), `duplicate node id ${n.id}`);
      ids.add(n.id);
      if (!n.hue) n.hue = ti === 2 ? (n.outcome ? 'outcome' : 'system') : ROLE_HUES[hueIdx++ % ROLE_HUES.length];
      n.mascot = asset(n.mascot, `node ${n.id}.mascot`);
      if (n.icon) need(ICON_NAMES.includes(n.icon), `node ${n.id}: unknown icon ${n.icon} (have ${ICON_NAMES.join(', ')})`);
      const [bt, bs] = ti === 0 ? [BUDGET.rootTitle, BUDGET.rootSub] : ti === 1 ? [BUDGET.t1Title, BUDGET.t1Sub] : [BUDGET.t2Title, BUDGET.t2Sub];
      budget(n.title, bt, `node ${n.id}.title`);
      budget(n.sub, bs, `node ${n.id}.sub`);
      return n;
    });
    return t;
  });
  if (fig.tiers[1]) need(fig.tiers[1].nodes.length >= 3 && fig.tiers[1].nodes.length <= 7, 'tier 1 needs 3..7 nodes');
  if (fig.tiers[2]) need(fig.tiers[2].nodes.length >= 2 && fig.tiers[2].nodes.length <= 6, 'tier 2 needs 2..6 nodes');
  for (const n of fig.tiers[1]?.nodes || []) if (n.to) need(ids.has(n.to), `node ${n.id}.to references unknown node ${n.to}`);
  if (fig.feedback?.from) need(ids.has(fig.feedback.from), `figure.feedback.from references unknown node ${fig.feedback.from}`);

  const cols = raw.body?.columns || [];
  need(cols.length === 3, 'body.columns must have exactly 3 columns');
  const body = cols.map((col, ci) => (col || []).map((b0, bi) => {
    const b = { ...b0 };
    need(BLOCK_TYPES.includes(b.type), `body col ${ci} block ${bi}: unknown type ${b.type}`);
    if (typeof b.text === 'string') b.text = [b.text];
    if (b.type === 'image') b.src = asset(b.src, `body col ${ci} block ${bi}.src`);
    if (b.type === 'filmstrip') {
      need(b.frames?.length >= 2 && b.frames.length <= 5, 'filmstrip block needs 2..5 frames');
      b.frames = (b.frames || []).map((f, fi) => ({ ...f, src: asset(f.src, `body col ${ci} block ${bi}.frames[${fi}]`) }));
    }
    if (b.type === 'table') need(Array.isArray(b.columns) && Array.isArray(b.rows) && b.rows.every((r) => r.length === b.columns.length), `table block ${b.id || bi}: every row needs ${b.columns?.length} cells`);
    if (b.type === 'cycle') need(b.steps?.length >= 3 && b.steps.length <= 6, `cycle block needs 3..6 steps`);
    b.id = `c${ci}b${bi}`;
    return b;
  }));

  const ambient = {
    style: 'flow', title_sweep: true, packets: true, mascots: true,
    marks: true, headings: true, cycle: true, feedback_ants: true, edge_flow: true, wordmark: true,
    ...(raw.ambient || {}),
  };
  if (raw.ambient?.spotlight === false && !raw.ambient.style) ambient.style = 'none';
  need(['flow', 'tour', 'none'].includes(ambient.style), `ambient.style must be flow, tour or none (got ${ambient.style})`);

  const story = (raw.story || fig.tiers[1]?.nodes.map((n) => ({ target: n.id })) || []).map((s) => (typeof s === 'string' ? { target: s } : s));
  for (const s of story) need(ids.has(s.target), `story target ${s.target} is not a node`);

  if (errors.length) {
    const e = new Error(`spec invalid:\n  - ${errors.join('\n  - ')}`);
    e.errors = errors;
    throw e;
  }
  return { meta, header, brand, figure: fig, body, story, ambient, footer: raw.footer || {}, warnings, dir };
}
