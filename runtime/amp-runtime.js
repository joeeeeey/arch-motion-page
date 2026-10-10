/* amp runtime: interprets the compiled motion plan into ONE paused GSAP timeline,
   exposes it as window.__amp.tl for the page to register with HyperFrames, and writes a fit report
   for the review loop.

   Modes (query string, standalone only):
     (none)      autoplay + loop, for humans opening the file
     ?t=12.5     seek and hold a frame
     ?poster     hold the poster frame (end of build)
     ?fit        start with the whole page fitted to the window
     ?review     paused at 1:1, top-left; window.__amp exposes seek() and report for scripted screenshots
     ?debug      outline every fit-report offender in red
   Present mode (any human view, i.e. not ?review and not automated): the page sits centred on a
   desk and scales down to the window width. Keys: Space play/pause, F fit page, arrows step 1 s,
   Home restart. prefers-reduced-motion holds the poster frame.
   Under HyperFrames (registry pre-created, or navigator.webdriver) the timeline stays paused. */
(function () {
  'use strict';
  var plan = JSON.parse(document.getElementById('amp-plan').textContent);
  var root = document.querySelector('[data-composition-id]');
  var hosted = !!window.__timelines;
  window.__timelines = window.__timelines || {};

  var i, op;
  for (i = 0; i < plan.init.length; i++) gsap.set(plan.init[i].s, plan.init[i].v);

  var tl = gsap.timeline({ paused: true, defaults: { overwrite: false } });
  for (i = 0; i < plan.ops.length; i++) {
    op = plan.ops[i];
    if (op.m === 'fromTo') tl.fromTo(op.s, op.f, op.v, op.at);
    else if (op.m === 'to') tl.to(op.s, op.v, op.at);
    else if (op.m === 'set') tl.set(op.s, op.v, op.at);
  }
  // Pin the timeline length to the composition duration so HF and loops agree.
  // The page registers tl in window.__timelines with an inline script right after this one.
  if (tl.duration() < plan.duration) tl.set({}, {}, plan.duration);

  // ---------------------------------------------------------------- fit report
  function rect(el) { return el.getBoundingClientRect(); }
  function fitReport() {
    var issues = [], cols = [], missing = [];
    var seen = {};
    plan.ops.concat(plan.init).forEach(function (o) {
      if (seen[o.s]) return; seen[o.s] = 1;
      try { if (!document.querySelector(o.s)) missing.push(o.s); } catch (e) { missing.push(o.s + ' (bad selector)'); }
    });
    function flag(el, kind, detail) { issues.push({ kind: kind, where: describe(el), detail: detail }); el.setAttribute('data-amp-issue', kind); }
    function describe(el) {
      var n = el.closest('[data-node],[data-block],[data-amp],[data-col]');
      if (!n) return el.className || el.tagName;
      return ['data-node', 'data-block', 'data-amp', 'data-col'].map(function (a) { return n.hasAttribute(a) ? a.slice(5) + '=' + n.getAttribute(a) : ''; }).join('').trim();
    }

    document.querySelectorAll('.amp-col').forEach(function (col) {
      var top = rect(col).top, used = 0;
      Array.prototype.forEach.call(col.children, function (c) {
        var mb = parseFloat(getComputedStyle(c).marginBottom) || 0;
        used = Math.max(used, c.offsetTop + c.offsetHeight + (c === col.lastElementChild ? 0 : mb));
      });
      var avail = col.clientHeight;
      cols.push({ col: +col.getAttribute('data-col'), used: Math.round(used), avail: avail, fill: +(used / avail).toFixed(3) });
      if (used > avail + 0.5) flag(col, 'column-overflow', Math.round(used - avail) + 'px over');
    });
    document.querySelectorAll('.amp-card').forEach(function (card) {
      if (card.scrollHeight > card.clientHeight + 1) flag(card, 'node-overflow', (card.scrollHeight - card.clientHeight) + 'px taller than card');
      card.querySelectorAll('.amp-node-title').forEach(function (t) {
        if (t.scrollWidth > t.clientWidth + 1) flag(t, 'title-clipped', t.textContent);
        if (t.getClientRects().length && t.offsetHeight > parseFloat(getComputedStyle(t).lineHeight) * 1.5) flag(t, 'title-wraps', t.textContent);
      });
    });
    ['title', 'subtitle'].forEach(function (k) {
      var el = document.querySelector('[data-amp="' + k + '"]');
      if (el && el.scrollWidth > el.parentElement.clientWidth + 1) flag(el, 'header-overflow', (el.scrollWidth - el.parentElement.clientWidth) + 'px');
    });
    var brand = document.querySelector('[data-amp="brand"]');
    if (brand && brand.scrollHeight > brand.clientHeight + 1) flag(brand, 'brand-overflow', (brand.scrollHeight - brand.clientHeight) + 'px');
    var cap = document.querySelector('[data-amp="caption"]'), rule = document.querySelector('[data-amp="rule"]');
    if (cap && rule && rect(cap).bottom > rect(rule).top - 4) flag(cap, 'caption-collides-rule', Math.round(rect(cap).bottom - rect(rule).top + 4) + 'px');
    var fb = document.querySelector('[data-amp="fblabel"]');
    if (fb && fb.scrollHeight > fb.clientHeight + 1) flag(fb, 'label-overflow', (fb.scrollHeight - fb.clientHeight) + 'px');

    // A family counts as loaded when any of its faces is: browsers only fetch the weights a page uses.
    var faces = [];
    if (document.fonts) document.fonts.forEach(function (ff) { faces.push(ff); });
    var fontsOk = (plan.fonts || []).map(function (f) {
      return { family: f, loaded: faces.some(function (ff) { return ff.family.replace(/["']/g, '') === f && ff.status === 'loaded'; }) };
    });
    return {
      ok: issues.length === 0 && missing.length === 0,
      duration: plan.duration, buildEnd: plan.buildEnd, poster: plan.poster,
      ops: plan.ops.length, columns: cols, issues: issues, missingSelectors: missing, fonts: fontsOk, events: plan.events,
    };
  }

  // ---------------------------------------------------------------- modes
  var params = new URLSearchParams(location.search);
  var automated = hosted || navigator.webdriver || params.has('hf');
  var api = {
    tl: tl, plan: plan, report: null,
    seek: function (t) { tl.pause(); tl.seek(Math.max(0, Math.min(plan.duration, t)), false); return tl.time(); },
    ready: null,
  };
  window.__amp = api;

  api.ready = Promise.all([
    document.fonts ? document.fonts.ready : Promise.resolve(),
    Promise.all(Array.prototype.map.call(document.images, function (img) {
      return img.complete ? 0 : new Promise(function (r) { img.onload = img.onerror = r; });
    })),
  ]).then(function () {
    api.report = fitReport();
    document.getElementById('amp-report').textContent = JSON.stringify(api.report);
    if (params.has('debug')) document.documentElement.classList.add('amp-debug');
    if (!api.report.ok && !automated) console.warn('[amp] fit report', api.report);
    return api.report;
  });

  var present = params.has('present') || (!automated && !params.has('review')); // ?present forces it, for tests
  if (present) stage();

  var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (params.has('t')) api.seek(parseFloat(params.get('t')) || 0);
  else if (params.has('poster') || (present && still)) api.seek(plan.poster);
  else if (present) { tl.repeat(-1); tl.play(0); }

  // ---------------------------------------------------------------- present mode
  function stage() {
    var W = +root.getAttribute('data-width'), H = +root.getAttribute('data-height');
    var PAD = 32, fit = params.has('fit');
    var box = document.createElement('div');
    box.className = 'amp-stage';
    root.parentNode.insertBefore(box, root);
    box.appendChild(root);
    document.documentElement.classList.add('amp-present');

    function layout() {
      var vw = document.documentElement.clientWidth, vh = window.innerHeight;
      var roomy = vw >= W + 2 * PAD;
      var pad = roomy ? PAD : 0;
      var s = Math.min(1, (vw - 2 * pad) / W);
      if (fit) s = Math.min((vw - 2 * PAD) / W, (vh - 2 * PAD) / H);
      if (fit) pad = PAD;
      document.body.style.padding = pad + 'px';
      box.classList.toggle('flush', !pad);
      box.style.width = W * s + 'px';
      box.style.height = H * s + 'px';
      root.style.transform = s === 1 ? '' : 'scale(' + s + ')';
    }
    layout();
    window.addEventListener('resize', layout);

    document.addEventListener('keydown', function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var k = e.key;
      if (k === ' ') {
        if (tl.paused() || !tl.isActive()) { tl.repeat(-1); tl.play(); } else tl.pause();
      } else if (k === 'f' || k === 'F') { fit = !fit; layout(); }
      else if (k === 'ArrowRight' || k === 'ArrowLeft') {
        tl.pause(); tl.seek(Math.max(0, Math.min(plan.duration, tl.time() + (k === 'ArrowRight' ? 1 : -1))), false);
      } else if (k === 'Home') { tl.repeat(-1); tl.play(0); }
      else return;
      e.preventDefault();
    });
  }
})();
