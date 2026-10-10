# Motion grammar

`lib/motion.mjs` compiles spec + layout + body index into a flat JSON op list. `runtime/amp-runtime.js` interprets the list into **one paused GSAP timeline** registered at `window.__timelines[<meta.id>]`.

## Contract (HyperFrames-compatible)

- **Root element:** `data-composition-id`, `data-start="0"`, `data-width`, `data-height`, `data-duration`. The timeline is padded to exactly `duration`.
- **Ops:**
  - `{ m: 'fromTo' | 'to' | 'set', s: selector, at, f?, v }`.
  - `init` holds `gsap.set` calls applied before the timeline is built.
- **No callbacks:** no `onUpdate`, no `onComplete`. HyperFrames seeks with events suppressed, so every visual must be a pure function of time.
- **No randomness except the seeded mulberry32 PRNG** (`meta.seed`). No `Date.now()`, no `performance.now()`.
- **Fonts and GSAP are local.** `@font-face` uses `font-display: block`.

## Phase 1: build (0 → ~3 s)

The page enters in reading order and the figure enters in data-flow order. A typical schedule (s):

| Element | Start (s) |
|---|---|
| kicker | 0 |
| title | .06 |
| subtitle | .2 |
| stamp pop | .5 |
| brand art | .14 |
| wordmark letters | .34 + .07 i |
| dots, blurb, stats | from .6 |
| figure panel, label | .22 / .32 |
| root pop | .36 |
| trunk | .6 |
| bus | .7 |
| drops | .9 |

After that, the figure continues in sequence:
1. Worker cards, staggered .06.
2. Rises, bus 2 and drops, then substrate cards, staggered .07.
3. Flow arrows, rises, results bus and bus label.
4. The feedback edge, drawn through a mask over .5 s, then its label.

In parallel, the text and footer enter:
- rule (.5) and caption (.56);
- body blocks (.62 + .04 k);
- inserts (≥ 1.8 s), then marks (+.2 + .1 k);
- footer (1.6).

`buildEnd` should land near 3.0 s. The poster is `buildEnd + .15`.

## Phase 2: ambient (buildEnd + .3 → end)

The default `flow` style keeps the whole system running instead of touring one node at a time:

1. **Heartbeat.** From `A = buildEnd + .3` the root pulses every `BEAT = 1.2 s` (`--hl` to .7; to 1 on feedback beats).
2. **Dispatch.** Each beat sends packets to the next `PER = 2` workers in story order (.16 s apart). A packet rides its edge at 560 px/s.
3. **Breathe.** When a packet lands, the card swells: `--hl` 0 → 1 in .22 s, holds .3 s, eases back over .55 s. The theme maps `--hl` to `scale(1 + .035·hl)`, a 2 px lift, a hue ring and a glow, on `.amp-card`, so it never fights the build transforms on `.amp-node`. Pulses on one card never stack.
4. **Hand-off.** After `WORK = .5 s` (+ seeded jitter up to .16 s) the worker sends a packet to its substrate node, which breathes at .75.
5. **Substrate wave.** Every 1.9 s a packet hops between tier-2 neighbours; each arrival breathes the next card at .6.
6. **Return.** Every fourth beat a result leaves the feedback source early enough to land on the root's heartbeat.

Nothing launches after `settle = duration − 1.1`, so the last frame is calm. Packet divs are pooled per route and reused trip after trip.

The `tour` style is the older spotlight tour: a ring glides to each worker on fixed .8 s beats (packets depart early enough to land on the beat), walks tier 2 with .42 s hops, and closes with the feedback packet. Use it when the story is strictly sequential.

**Idle effects** run on mismatched periods, so they never sync:

| Effect | Period | What moves |
|---|---|---|
| Title sweep | dur 1.7 s + gap 2.5 s | `background-position` of a 300%-wide gradient clipped to text |
| Mascot bob | 1.9–2.8 s each, seeded period and phase | `y` up 2.5–4 px, yoyo, always ends at rest |
| Heading sweep | one heading every 1.6 s | same gradient trick on section headings |
| Highlighter redraw | one mark every 2.2 s | `--mk` 1 → 0 → 1 (`background-size` of the mark) |
| Cycle insert | step every .9 s; orbit continuous | `--on` per step; orbit rotation with `svgOrigin` |
| Feedback ants | continuous | `strokeDashoffset` of the dashed edge |
| Stamp | one turn per ~20 s of `duration` (whole turns, so the loop is seamless) | ring rotation |
| Marching edges | continuous, 22 px/s, whole dash periods | `strokeDashoffset` of a dashed `.fl` overlay on every solid edge, faded in at the end of the build |
| Neon wordmark | 1.25–1.75 s per letter (seeded), hue drift 2.6 s | per-letter `--g` (blur and opacity of the glow copies) and word `--hr` (`hue-rotate` −18° → 24°) |

## Techniques and gotchas

- **Edges draw** by tweening `strokeDashoffset` from `len` to 0 (`stroke-dasharray: len len`).
- **Dashed edges** cannot use that trick, because it would destroy the dash pattern. Draw the dashed path inside an SVG `<mask>` whose solid stroke gets the dashoffset tween.
- **Packets:**
  - Each packet occurrence is its own absolutely positioned `div`.
  - It moves with GSAP keyframes on `x`/`y` through the route's corner points, with `ease: 'none'` and segment durations proportional to length.
  - Opacity fades in and out at the ends.
- **CSS custom properties are tweenable.** `--hl` drives card lift, shadow and tint; `--mk` drives marks; `--on` drives cycle steps. A single tween then updates several properties consistently.
- **Do not tween CSS `translate`/`scale`/`rotate` on an element GSAP also transforms.** GSAP folds them into `transform` and resets them. Use a wrapper:
  - `.amp-node` gets build transforms from GSAP.
  - `.amp-card` gets the `translate` driven by `--hl`.
- **Never animate body text position or size after the build.** Prefer `opacity`, `transform` and custom properties. Avoid layout properties: they are expensive and nondeterministic across renderers.
- **Ensure glows never overlap on one node.** The compiler tracks `glowEnd[id]` and skips a glow that would start before the previous one ended.
- **Keep event names stable** (`spot:<id>`, `flow`, `feedback`, `cycle-N`, suffix `#N` for repeats). `review.mjs` labels frames with them, and `reviewTimes()` picks review moments from them.

## Adding an effect

1. Emit ops in `compileMotion` behind an `ambient.<flag>` (default true in `lib/spec.mjs`).
2. Address elements through `data-*` attributes rendered by the template, never through positional selectors.
3. Rebuild, then run `review.mjs --burst a:b:15` over the effect's window and watch `burst.mp4`.
4. Check that `report.missingSelectors` is empty.
