// Motion compiler: spec + layout + body index -> a flat list of GSAP ops on one paused timeline.
//
// Two phases (see references/motion-grammar.md):
//   build   (0 .. ~3s)  everything enters in reading order and data-flow order
//   ambient (.. end)    signal traffic (style "flow": the system runs continuously and cards
//                       breathe as packets arrive; style "tour": one spotlight walks the story)
//                       plus small seeded idle effects. Body text never moves, so every frame
//                       after the build is a poster.
//
// Ops are plain JSON so the plan is inspectable; the runtime only interprets them.
// No callbacks (HyperFrames seeks with events suppressed) and no randomness without the seed.

const r3 = (n) => Math.round(n * 1000) / 1000;
const q = (attr, v) => `[${attr}="${v}"]`;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function compileMotion({ spec, layout, index, theme }) {
  const D = spec.meta.duration;
  const amb = spec.ambient;
  const rnd = mulberry32(spec.meta.seed);
  const init = [], ops = [], packets = [], events = [];
  let buildEnd = 0;

  const fromTo = (s, at, f, v) => { ops.push({ m: 'fromTo', s, at: r3(at), f, v }); return at + (v.duration || 0); };
  const to = (s, at, v) => { ops.push({ m: 'to', s, at: r3(at), v }); return at + (v.duration || 0); };
  const build = (s, at, f, v) => { buildEnd = Math.max(buildEnd, fromTo(s, at, f, v)); };
  const mark = (name, t) => events.push({ name, t: r3(t) });

  const IN = (extra = {}) => ({ opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', ...extra });
  const POP = (extra = {}) => ({ opacity: 1, scale: 1, y: 0, duration: 0.5, ease: 'back.out(1.7)', ...extra });

  // ------------------------------------------------------------------ build: header + brand
  build(q('data-amp', 'kicker'), 0, { opacity: 0, y: -6 }, IN({ duration: 0.4 }));
  build(q('data-amp', 'title'), 0.06, { opacity: 0, y: 12 }, IN({ duration: 0.6, ease: 'power3.out' }));
  build(q('data-amp', 'subtitle'), 0.2, { opacity: 0, y: 8 }, IN());
  if (spec.header.stamp) {
    build(q('data-amp', 'stamp'), 0.5, { opacity: 0, scale: 0.5, rotation: -40 }, { opacity: 1, scale: 1, rotation: 0, duration: 0.7, ease: 'back.out(1.8)' });
    to(q('data-amp', 'stamp-ring'), 0, { rotation: 360 * Math.max(1, Math.round(D / 20)), svgOrigin: '48 48', duration: D, ease: 'none' });
  }
  if (spec.brand.image) build(q('data-amp', 'brand-art'), 0.14, { opacity: 0, scale: 0.9, y: 14 }, POP({ duration: 0.65, ease: 'back.out(1.4)' }));
  const letters = [...(spec.brand.wordmark || spec.meta.id)].length;
  for (let i = 0; i < letters; i++) {
    build(`[data-amp="wordmark"] span:nth-child(${i + 1})`, 0.34 + i * 0.07, { opacity: 0, y: 26 }, IN({ duration: 0.5, ease: 'back.out(2.2)' }));
  }
  build(q('data-amp', 'tagline'), 0.52, { opacity: 0, y: 6 }, IN({ duration: 0.4 }));
  const dotCount = layout.nodes.filter((n) => n.tier <= 1).length;
  for (let i = 0; i < dotCount; i++) {
    build(q('data-dot', i), 0.6 + i * 0.04, { scale: 0 }, { scale: 1, duration: 0.35, ease: 'back.out(3)' });
  }
  build(q('data-amp', 'blurb'), 0.66, { opacity: 0, y: 6 }, IN());
  spec.brand.stats.forEach((_, i) => build(`[data-amp="stats"] li:nth-child(${i + 1})`, 0.76 + i * 0.07, { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: 0.4, ease: 'power2.out' }));

  // ------------------------------------------------------------------ build: figure
  const E = Object.fromEntries(layout.edges.map((e) => [e.id, e]));
  const nodeSel = (id) => q('data-node', id);
  const draw = (e, at, dur) => {
    const sel = e.dashed ? q('data-edge-mask', e.id) : q('data-edge', e.id);
    build(sel, at, { strokeDashoffset: e.len }, { strokeDashoffset: 0, duration: dur, ease: 'power1.inOut' });
    if (e.arrow) build(q('data-arrow', e.id), at + dur - 0.06, { opacity: 0 }, { opacity: 1, duration: 0.14, ease: 'none' });
    return at + dur;
  };
  const stage = (name, at, dur) => {
    let end = at;
    layout.edges.filter((e) => e.stage === name).forEach((e) => { end = Math.max(end, draw(e, at, dur)); });
    return end;
  };
  const [root, ...rest] = layout.nodes;
  const row1 = rest.filter((n) => n.tier === 1);
  const row2 = rest.filter((n) => n.tier === 2);

  build(q('data-amp', 'panel'), 0.22, { opacity: 0, scale: 0.985 }, { opacity: 1, scale: 1, duration: 0.55, ease: 'power2.out' });
  build(q('data-amp', 'figlabel'), 0.32, { opacity: 0, x: -8 }, { opacity: 1, x: 0, duration: 0.4, ease: 'power2.out' });
  build(nodeSel(root.id), 0.36, { opacity: 0, scale: 0.86, y: 10 }, POP());
  stage('e1', 0.6, 0.12);
  stage('e2', 0.7, 0.22);
  let t = stage('e3', 0.9, 0.12);
  const t1Start = t - 0.06;
  row1.forEach((n, i) => build(nodeSel(n.id), t1Start + i * 0.06, { opacity: 0, scale: 0.86, y: 12 }, POP({ duration: 0.45 })));
  t = stage('e5', t1Start + 0.34, 0.12);
  t = stage('e6', t - 0.02, 0.24);
  t = stage('e7', t - 0.02, 0.12);
  const t2Start = t - 0.06;
  row2.forEach((n, i) => build(nodeSel(n.id), t2Start + i * 0.07, { opacity: 0, scale: 0.86, y: 12 }, POP({ duration: 0.45 })));
  stage('e9', t2Start + 0.28, 0.15);
  t = stage('e10', t2Start + 0.36, 0.12);
  t = stage('e11', t - 0.02, 0.28);
  if (layout.busLabel) build(q('data-amp', 'buslabel'), t - 0.1, { opacity: 0, y: -4 }, IN({ duration: 0.35 }));
  if (E.feedback) {
    const fbEnd = draw(E.feedback, t - 0.04, 0.5);
    if (layout.feedback?.label) build(q('data-amp', 'fblabel'), fbEnd - 0.25, { opacity: 0, x: 8 }, { opacity: 1, x: 0, duration: 0.4, ease: 'power2.out' });
    if (amb.feedback_ants) {
      const ants = Math.max(1, Math.round((D - fbEnd) * 2));
      to(q('data-edge', 'feedback'), fbEnd, { strokeDashoffset: -11 * ants, duration: r3(D - fbEnd), ease: 'none' });
    }
  }
  mark('figure-built', buildEnd);

  // ------------------------------------------------------------------ build: caption, rule, body, footer
  build(q('data-amp', 'rule'), 0.5, { scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, duration: 0.8, ease: 'power2.inOut' });
  if (spec.figure.caption) build(q('data-amp', 'caption'), 0.56, { opacity: 0, y: 8 }, IN());
  index.anim.forEach((kind, k) => build(q('data-anim', k), 0.62 + k * 0.04, { opacity: 0, y: 10 }, IN({ duration: kind === 'insert' ? 0.6 : 0.5 })));
  const insertBase = Math.max(1.8, 0.62 + index.anim.length * 0.04);
  index.cycles.forEach((c, ci) => {
    const circ = 2 * Math.PI * 52;
    build(q('data-cycle-ring', c.id), insertBase + ci * 0.2, { strokeDashoffset: circ }, { strokeDashoffset: 0, duration: 0.7, ease: 'power2.inOut' });
    for (let i = 0; i < c.n; i++) {
      build(q('data-cycle-step', `${c.id}-${i}`), insertBase + ci * 0.2 + 0.12 + i * (0.6 / c.n), { opacity: 0, scale: 0.4, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(2.5)' });
    }
    build(q('data-cycle-orbit', c.id), insertBase + ci * 0.2 + 0.7, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'none' });
  });
  index.takeaways.forEach((tk) => {
    for (let i = 0; i < tk.n; i++) {
      build(`[data-block="${tk.id}"] li:nth-child(${i + 1})`, insertBase + 0.1 + i * 0.09, { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: 0.4, ease: 'power2.out' });
    }
  });
  index.marks.forEach((m, k) => build(m.sel, insertBase + 0.2 + k * 0.1, { '--mk': 0 }, { '--mk': 1, duration: 0.55, ease: 'power2.inOut' }));
  build(q('data-amp', 'footer'), 1.6, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'none' });

  buildEnd = r3(buildEnd);
  const A = r3(buildEnd + 0.3);
  mark('build-end', buildEnd);

  // ------------------------------------------------------------------ ambient: title sweep (starts during build)
  if (amb.title_sweep && spec.header.sweep) {
    const start = 1.1, dur = 1.7, gap = 2.5;
    const reps = Math.floor((D - start - dur) / (dur + gap));
    fromTo('.amp-title .amp-sweep', start, { backgroundPosition: '100% 50%' }, { backgroundPosition: '0% 50%', duration: dur, ease: 'sine.inOut', repeat: reps, repeatDelay: gap, immediateRender: false });
  }

  // ------------------------------------------------------------------ ambient: signal traffic
  // Packets ride real edges at a constant speed; each arrival makes its target card breathe
  // (scale + ring + glow via --hl). Packet divs are pooled per route and reused trip after trip.
  const SPEED = 560; // px per second
  const routes = Object.fromEntries(layout.routes.map((r) => [r.id, r]));
  const lanes = {};
  let pk = 0;
  const trip = (routeId, at) => {
    const r = routes[routeId];
    if (!r || !amb.packets) return null;
    const pool = (lanes[routeId] ||= []);
    let lane = pool.find((l) => l.free <= at);
    if (!lane) {
      lane = { id: `pk-${pk++}`, free: 0 };
      pool.push(lane);
      packets.push({ id: lane.id, hue: r.hue });
    }
    const kf = [{ opacity: 1, duration: 0.08, ease: 'none' }];
    for (let i = 1; i < r.pts.length; i++) {
      const [x0, y0] = r.pts[i - 1], [x1, y1] = r.pts[i];
      kf.push({ x: x1, y: y1, duration: r3(Math.max(0.04, Math.hypot(x1 - x0, y1 - y0) / SPEED)), ease: 'none' });
    }
    kf.push({ opacity: 0, duration: 0.14, ease: 'none' });
    ops.push({ m: 'set', s: `#${lane.id}`, at: r3(at), v: { x: r.pts[0][0], y: r.pts[0][1] } });
    to(`#${lane.id}`, at, { keyframes: kf, ease: 'none' });
    lane.free = at + 0.08 + r.len / SPEED + 0.2;
    return at + 0.08 + r.len / SPEED; // arrival time
  };
  const busy = {};
  const pulse = (id, at, peak = 1, hold = 0.2) => {
    if (at < (busy[id] || 0)) return false; // never stack two pulses on one card
    to(nodeSel(id), at, { '--hl': peak, duration: 0.22, ease: 'power2.out' });
    to(nodeSel(id), at + 0.22 + hold, { '--hl': 0, duration: 0.55, ease: 'sine.inOut' });
    busy[id] = at + 0.22 + hold + 0.57;
    return true;
  };
  const SPOT_PAD = 5;
  const SPOT = q('data-amp', 'spot');
  const spotBox = (n) => ({ x: n.x - SPOT_PAD, y: n.y - SPOT_PAD, width: n.w + SPOT_PAD * 2, height: n.h + SPOT_PAD * 2 });
  // glide to a neighbour
  const spotTo = (n, at, hue) => to(SPOT, at, { ...spotBox(n), borderColor: hue, opacity: 1, duration: 0.42, ease: 'power3.inOut' });
  // long jumps fade out and reappear on the target; a ring morphing diagonally across the figure reads as noise
  const spotJump = (n, at, hue) => {
    to(SPOT, at, { opacity: 0, duration: 0.18, ease: 'power1.in' });
    ops.push({ m: 'set', s: SPOT, at: r3(at + 0.2), v: { ...spotBox(n), borderColor: hue, scale: 1.1 } });
    to(SPOT, at + 0.22, { opacity: 1, scale: 1, duration: 0.3, ease: 'power2.out' });
  };
  init.push({ s: SPOT, v: spotBox(root) });
  const hueHex = (n) => theme.hues[n.hue] || n.hue;
  const byId = Object.fromEntries(layout.nodes.map((n) => [n.id, n]));
  const workers = spec.story.map((s) => byId[s.target]).filter((n) => n && n.tier === 1);
  const dotIndex = Object.fromEntries(layout.nodes.filter((n) => n.tier <= 1).map((n, i) => [n.id, i]));
  const dotPulse = (id, at) => {
    if (dotIndex[id] == null) return;
    to(q('data-dot', dotIndex[id]), at, { scale: 1.7, duration: 0.22, ease: 'power2.out' });
    to(q('data-dot', dotIndex[id]), at + 0.5, { scale: 1, duration: 0.35, ease: 'power2.inOut' });
  };
  const handoffTarget = (n) => {
    const end = routes[`handoff-${n.id}`]?.pts.at(-1);
    return end && row2.find((m) => Math.abs(m.x + m.w / 2 - end[0]) < 1);
  };
  const fbFrom = layout.feedback && byId[layout.feedback.from];

  if (amb.style === 'flow' && workers.length) {
    // The system runs continuously: the root beats, each beat dispatches the next workers in story
    // order, workers hand off to the substrate, a wave walks the substrate row, and every few beats
    // a result rides the dashed edge home. Nothing launches after `settle`, so the last frame is calm.
    const BEAT = 1.2, PER = 2, WORK = 0.5;
    const settle = D - 1.1;
    const fbLen = routes.feedback ? 0.08 + routes.feedback.len / SPEED : 0;
    const fbBeats = new Set();
    if (routes.feedback) {
      for (let k = 3, n = 0; A + k * BEAT < settle; k += 4, n++) {
        const hb = A + k * BEAT, dep = hb - fbLen;
        if (fbFrom) pulse(fbFrom.id, dep - 0.12, 0.85, 0.05);
        trip('feedback', dep);
        mark(`feedback${n ? `#${n}` : ''}`, (dep + hb) / 2);
        mark(`cycle-${n}`, hb);
        fbBeats.add(k);
      }
    }
    const seen = new Set();
    let w = 0;
    for (let k = 0, hb = A; hb < settle; k++, hb = A + k * BEAT) {
      const home = fbBeats.has(k);
      pulse(root.id, hb - 0.04, home ? 1 : 0.7, home ? 0.25 : 0.06);
      if (home) dotPulse(root.id, hb - 0.04);
      for (let p = 0; p < PER; p++) {
        const n = workers[w++ % workers.length];
        const arrive = trip(`dispatch-${n.id}`, hb + 0.06 + p * 0.16);
        if (arrive == null || arrive > settle) continue;
        if (pulse(n.id, arrive - 0.04, 1, 0.3)) dotPulse(n.id, arrive - 0.04);
        if (!seen.has(n.id)) { seen.add(n.id); mark(`spot:${n.id}`, arrive + 0.16); }
        const landed = handoffTarget(n);
        const h = trip(`handoff-${n.id}`, arrive + WORK + rnd() * 0.16);
        if (h != null && landed) pulse(landed.id, h - 0.04, 0.75, 0.1);
      }
    }
    row2.slice(0, -1).forEach((n, j) => {
      for (let i = 0, at = A + 1.4 + j * 0.38; at < settle; i++, at += 1.9) {
        const arr = trip(`flow-${n.id}`, at);
        if (arr == null) break;
        pulse(row2[j + 1].id, arr - 0.04, 0.6, 0.05);
        if (i === 0 && j === Math.floor((row2.length - 1) / 2)) mark('flow', (at + arr) / 2);
      }
    });
  } else if (amb.style === 'tour' && workers.length) {
    // One focus at a time: a spotlight ring tours the workers on fixed 0.8 s beats, then walks the
    // substrate row; the cycle closes with the feedback packet and repeats while it fits.
    const STEP = 0.8, HOP = 0.42, BEAT0 = 0.75;
    let cycle = 0;
    let c0 = A;
    const cycleLen = () => BEAT0 + (workers.length - 1) * STEP + 0.9 + (row2.length - 1) * HOP + 0.45 + (routes.feedback ? 0.08 + routes.feedback.len / SPEED : 0) + 0.8 + 0.25;
    while (c0 + cycleLen() <= D - 0.2) {
      mark(`cycle-${cycle}`, c0);
      workers.forEach((n, i) => {
        // fixed beat: the spotlight lands on schedule, the packet leaves early enough to arrive on it
        const beat = c0 + BEAT0 + i * STEP;
        const r = routes[`dispatch-${n.id}`];
        const depart = beat - (r ? 0.08 + r.len / SPEED : 0);
        pulse(root.id, depart - 0.05, 0.55, 0.05);
        trip(`dispatch-${n.id}`, depart);
        if (i === 0) spotJump(n, beat - 0.45, hueHex(n));
        else spotTo(n, beat - 0.32, hueHex(n));
        pulse(n.id, beat - 0.05, 1, 0.45);
        dotPulse(n.id, beat - 0.05);
        mark(`spot:${n.id}${cycle ? `#${cycle}` : ''}`, beat + 0.2);
        const arrive = trip(`handoff-${n.id}`, beat + 0.42);
        const landed = handoffTarget(n);
        if (arrive != null && landed) pulse(landed.id, arrive - 0.05, 0.7, 0.15);
      });
      const F = c0 + BEAT0 + (workers.length - 1) * STEP + 0.9;
      mark(`flow${cycle ? `#${cycle}` : ''}`, F + 0.6);
      row2.forEach((n, j) => {
        const at = F + j * HOP;
        if (j === 0) spotJump(n, at - 0.1, hueHex(n));
        else spotTo(n, at, hueHex(n));
        pulse(n.id, at + 0.3, 0.9, 0.05);
        if (j < row2.length - 1) trip(`flow-${n.id}`, at + HOP - 0.12);
      });
      const outcomeAt = F + (row2.length - 1) * HOP;
      let end = outcomeAt + 0.9;
      if (routes.feedback) {
        const back = trip('feedback', outcomeAt + 0.45);
        mark(`feedback${cycle ? `#${cycle}` : ''}`, (outcomeAt + 0.45 + back) / 2);
        spotJump(root, back - 0.45, hueHex(root));
        pulse(root.id, back - 0.05, 1, 0.35);
        dotPulse(root.id, back - 0.05);
        end = back + 0.8;
      }
      to(SPOT, end - 0.35, { opacity: 0, duration: 0.3, ease: 'power1.out' });
      c0 = end + 0.25;
      cycle++;
    }
  }

  // ------------------------------------------------------------------ ambient: marching edges
  // A dashed overlay on every solid edge fades in after the build and marches in the edge's direction.
  if (amb.edge_flow) {
    const from = r3(buildEnd - 0.25);
    fromTo('.amp-edges .fl', from, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'none', immediateRender: false });
    const PERIOD = 10, RATE = 22; // dash period (px, matches CSS) and march speed (px/s)
    const steps = Math.max(1, Math.round(((D - from) * RATE) / PERIOD));
    to('.amp-edges .fl', from, { strokeDashoffset: -PERIOD * steps, duration: r3(D - from), ease: 'none' });
  }

  // ------------------------------------------------------------------ ambient: neon wordmark
  // Each letter's glow breathes on its own phase while the whole word drifts a little in hue.
  if (amb.wordmark) {
    const start = r3(buildEnd - 0.6);
    for (let i = 0; i < letters; i++) {
      const sel = `[data-amp="wordmark"] span:nth-child(${i + 1})`;
      const half = r3(1.25 + rnd() * 0.5);
      const reps = Math.floor((D - start - i * 0.3) / half) - 1;
      if (reps < 1) continue;
      fromTo(sel, start + i * 0.3, { '--g': 0.35 }, { '--g': 1, duration: half, ease: 'sine.inOut', yoyo: true, repeat: reps % 2 ? reps : reps - 1, immediateRender: false });
    }
    const half = 2.6;
    const reps = Math.floor((D - start) / half) - 1;
    if (reps >= 1) fromTo(q('data-amp', 'wordmark'), start, { '--hr': -18 }, { '--hr': 24, duration: half, ease: 'sine.inOut', yoyo: true, repeat: reps % 2 ? reps : reps - 1, immediateRender: false });
  }

  // ------------------------------------------------------------------ ambient: idle mascots
  if (amb.mascots) {
    const bob = (sel, amp, start) => {
      const period = 1.9 + rnd() * 0.9;
      const phase = rnd() * period;
      const half = period / 2;
      const reps = Math.floor((D - start - phase) / half) - 1;
      if (reps < 1) return;
      fromTo(sel, start + phase, { y: 0 }, { y: -amp, duration: r3(half), ease: 'sine.inOut', yoyo: true, repeat: reps % 2 ? reps : reps - 1, immediateRender: false });
    };
    if (spec.brand.image) bob('[data-amp="brand-art"] img', 4, A - 0.6);
    layout.nodes.filter((n) => n.mascot).forEach((n) => bob(`${nodeSel(n.id)} .amp-mascot img`, n.tier === 0 ? 3 : 2.5, A));
  }

  // ------------------------------------------------------------------ ambient: section heading sweeps
  if (amb.headings && index.headings.length) {
    const every = 1.6, dur = 1.1;
    let k = 0;
    for (let at = A + 0.8; at + dur < D - 0.1; at += every, k++) {
      const h = index.headings[k % index.headings.length];
      fromTo(h.sel, at, { backgroundPosition: '100% 50%' }, { backgroundPosition: '0% 50%', duration: dur, ease: 'sine.inOut', immediateRender: false });
    }
  }

  // ------------------------------------------------------------------ ambient: highlighter redraw
  if (amb.marks && index.marks.length) {
    const every = 2.2;
    let k = 0;
    for (let at = A + 2.5; at + 1.2 < D - 0.1; at += every, k++) {
      const m = index.marks[k % index.marks.length];
      to(m.sel, at, { '--mk': 0, duration: 0.25, ease: 'power1.in' });
      to(m.sel, at + 0.35, { '--mk': 1, duration: 0.7, ease: 'power2.out' });
    }
  }

  // ------------------------------------------------------------------ ambient: cycle inserts
  if (amb.cycle) {
    index.cycles.forEach((c) => {
      const start = A - 0.2;
      const per = 0.9;
      let k = 0;
      for (let at = start; at + per < D - 0.1; at += per, k++) {
        const s = q('data-cycle-step', `${c.id}-${k % c.n}`);
        to(s, at, { '--on': 1, duration: 0.18, ease: 'power2.out' });
        to(s, at + per - 0.12, { '--on': 0, duration: 0.3, ease: 'power2.in' });
      }
      const turns = Math.max(1, Math.round((D - start) / 7));
      to(q('data-cycle-orbit', c.id), start, { rotation: 360 * turns, svgOrigin: `${r3(c.cx)} ${c.cy}`, duration: r3(D - start), ease: 'none' });
    });
  }

  const poster = r3(buildEnd + 0.15);
  return {
    packets,
    events,
    runtime: { id: spec.meta.id, duration: D, buildEnd, poster, init, ops, events },
  };
}

// Timestamps worth screenshotting during review.
export function reviewTimes(plan, D) {
  const ev = Object.fromEntries(plan.events.map((e) => [e.name, e.t]));
  const b = plan.runtime.buildEnd;
  const picks = [0.35, 0.9, 1.5, 2.1, Math.min(2.7, b - 0.1), plan.runtime.poster];
  for (const name of Object.keys(ev)) if (/^spot:|^flow|^feedback/.test(name) && !name.includes('#')) picks.push(ev[name]);
  picks.push(D - 0.15);
  return [...new Set(picks.map((t) => r3(t)))].filter((t) => t >= 0 && t <= D).sort((a, b2) => a - b2);
}
