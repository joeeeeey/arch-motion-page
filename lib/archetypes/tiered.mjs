// Tiered orchestration layout: one root, a row of workers, a row of substrate nodes,
// a results bus, and an optional dashed feedback edge from an outcome node back to the root.
//
// Everything is computed once at build time in the figure's own coordinate system
// (0,0 = figure panel top-left). The runtime never measures the DOM to position things.

const DEF = {
  padX: 24,            // side padding; also keeps the right-hand feedback lane clear
  capH: 34,            // room reserved for the "Fig. 1." caption line
  rootW: 300, rootH: 66,
  gapY: 20,            // vertical distance between a row and the bus below/above it
  t1H: 152, t1Gap: 8,
  t2H: 112, t2Gap: 16,
  busLabelH: 22,
  laneInset: 10,       // feedback lane distance from the right panel edge
};

const len = (pts) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
const r1 = (n) => Math.round(n * 10) / 10;

function row(nodes, y, h, gap, W, padX) {
  const n = nodes.length;
  const w = (W - padX * 2 - gap * (n - 1)) / n;
  return nodes.map((nd, i) => ({ ...nd, x: r1(padX + i * (w + gap)), y, w: r1(w), h }));
}

export function layoutTiered(fig, W, H, opts = {}) {
  const o = { ...DEF, ...opts, ...(fig.layout || {}) };
  const [t0, t1, t2] = fig.tiers;
  if (!t0 || t0.nodes.length !== 1) throw new Error('tiered: tier 0 must contain exactly one root node');
  if (!t1 || !t2) throw new Error('tiered: needs three tiers (root, workers, substrate)');

  const t1H = t1.height || o.t1H;
  const t2H = t2.height || o.t2H;
  const needed = o.capH + o.rootH + o.gapY * 4 + t1H + t2H + o.gapY + o.busLabelH;
  const spare = H - needed;
  if (spare < 0) throw new Error(`tiered: figure needs ${needed}px of height, panel has ${H}px`);
  const top = o.capH + Math.min(spare / 2, 18);

  const root = { ...t0.nodes[0], tier: 0, x: r1((W - o.rootW) / 2), y: r1(top), w: o.rootW, h: o.rootH };
  const bus1 = r1(root.y + root.h + o.gapY);
  const row1 = row(t1.nodes, r1(bus1 + o.gapY), t1H, o.t1Gap, W, o.padX).map((n) => ({ ...n, tier: 1 }));
  const bus2 = r1(row1[0].y + t1H + o.gapY);
  const row2 = row(t2.nodes, r1(bus2 + o.gapY), t2H, o.t2Gap, W, o.padX).map((n) => ({ ...n, tier: 2 }));
  const bus3 = r1(row2[0].y + t2H + o.gapY);

  const cx = (n) => r1(n.x + n.w / 2);
  const cy = (n) => r1(n.y + n.h / 2);
  const bottom = (n) => r1(n.y + n.h);
  const right = (n) => r1(n.x + n.w);

  const edges = [];
  const add = (id, stage, pts, extra = {}) => edges.push({ id, stage, pts, len: r1(len(pts)), ...extra });

  // root -> workers
  add('trunk', 'e1', [[cx(root), bottom(root)], [cx(root), bus1]]);
  add('bus1-l', 'e2', [[cx(root), bus1], [cx(row1[0]), bus1]]);
  add('bus1-r', 'e2', [[cx(root), bus1], [cx(row1.at(-1)), bus1]]);
  row1.forEach((n) => add(`drop1-${n.id}`, 'e3', [[cx(n), bus1], [cx(n), n.y]], { arrow: true }));

  // workers -> substrate
  row1.forEach((n) => add(`rise1-${n.id}`, 'e5', [[cx(n), bottom(n)], [cx(n), bus2]]));
  const xs2 = [...row1, ...row2].map(cx);
  add('bus2', 'e6', [[Math.min(...xs2), bus2], [Math.max(...xs2), bus2]]);
  row2.forEach((n) => add(`drop2-${n.id}`, 'e7', [[cx(n), bus2], [cx(n), n.y]], { arrow: true }));
  if (t2.flow !== false) {
    row2.slice(0, -1).forEach((n, i) =>
      add(`flow-${n.id}`, 'e9', [[right(n) + 2, cy(n)], [row2[i + 1].x - 2, cy(n)]], { arrow: true }));
  }

  // substrate -> results bus
  row2.forEach((n) => add(`rise2-${n.id}`, 'e10', [[cx(n), bottom(n)], [cx(n), bus3]]));
  add('bus3', 'e11', [[cx(row2[0]), bus3], [cx(row2.at(-1)), bus3]]);

  // feedback: outcome -> lane -> root
  let feedback = null;
  if (fig.feedback) {
    const from = row2.find((n) => n.id === fig.feedback.from) || row2.at(-1);
    const lane = W - o.laneInset;
    const ry = r1(root.y + root.h * 0.5);
    const pts = [[right(from), cy(from)], [lane, cy(from)], [lane, ry], [right(root) + 2, ry]];
    add('feedback', 'e12', pts, { arrow: true, dashed: true });
    feedback = { from: from.id, label: fig.feedback.label, labelBox: { x: r1(right(root) + 16), y: r1(root.y - 4), w: r1(lane - right(root) - 22), h: r1(ry - root.y - 2) } };
  }

  // signal packet routes (colour comes from the worker that owns the route)
  const nearest = (x) => row2.reduce((b, n) => (Math.abs(cx(n) - x) < Math.abs(cx(b) - x) ? n : b), row2[0]);
  const routes = [];
  row1.forEach((n) => {
    routes.push({ id: `dispatch-${n.id}`, hue: n.hue, pts: [[cx(root), bottom(root)], [cx(root), bus1], [cx(n), bus1], [cx(n), n.y]] });
    const to = row2.find((m) => m.id === n.to) || nearest(cx(n));
    routes.push({ id: `handoff-${n.id}`, hue: n.hue, pts: [[cx(n), bottom(n)], [cx(n), bus2], [cx(to), bus2], [cx(to), to.y]] });
  });
  if (t2.flow !== false) {
    row2.slice(0, -1).forEach((n, i) => routes.push({ id: `flow-${n.id}`, hue: n.hue, pts: [[right(n), cy(n)], [row2[i + 1].x, cy(n)]] }));
  }
  if (feedback) routes.push({ id: 'feedback', hue: 'outcome', pts: edges.find((e) => e.id === 'feedback').pts });
  routes.forEach((r) => (r.len = r1(len(r.pts))));

  // highlight rings around whole rows (used by "tier:N" story steps)
  const ring = (rowN, id) => {
    const pad = 5;
    const x = rowN[0].x - pad, y = rowN[0].y - pad;
    return { id, x: r1(x), y: r1(y), w: r1(right(rowN.at(-1)) + pad - x), h: r1(rowN[0].h + pad * 2) };
  };
  const rings = [ring(row1, 'tier:1'), ring(row2, 'tier:2')];

  return {
    W, H,
    nodes: [root, ...row1, ...row2],
    edges, routes, rings, feedback,
    buses: { bus1, bus2, bus3 },
    busLabel: fig.bus_label ? { text: fig.bus_label, x: r1(W / 2), y: r1(bus3 + 4) } : null,
  };
}
