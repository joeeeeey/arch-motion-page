# Review rubric (HTML stage)

One pass: edit spec → `build.mjs` → `review.mjs` → read `contact.png` and the console → edit spec. Each pass takes about 5 s. Render the MP4 only after the page passes.

## 1. Machine gate: fit report (must be OK)

| Issue kind | Meaning | Fix in the spec |
|---|---|---|
| `column-overflow col=N` | blocks exceed 728 px | trim prose, drop a table row, shorten code, move a block to a column with room |
| low fill (< 88%) | column ends early | add a sentence, a table row or a filmstrip, or move a block in |
| `node-overflow` | card content taller than card | shorten `sub` (tier 1 ≤ 44, tier 2 ≤ 34) |
| `title-clipped` / `title-wraps` | node title too wide | shorten `title` or use a shorter synonym |
| `header-overflow` | title or subtitle wider than the header | budget 52 / 120 chars; rephrase |
| `brand-overflow` | brand column taller than 520 | shorten the blurb, drop a stat |
| `caption-collides-rule` | caption is 3 lines | caption ≤ ~300 chars |
| `label-overflow` | feedback label too long | ≤ 48 chars, `Head: tail` form |
| missing selector | template and motion disagree | compiler bug; fix the code, not the spec |
| font not loaded | no face of that family loaded | check `theme.json` fonts and `vendor/fonts`; for zh, the subset step in the build log |

Also read the `build.mjs` output:
- **Budget warnings:** fix them unless the fit report proves the text fits.
- **`build-in`:** target ≤ 3.2 s.
- **Story beats:** `out/amp-build.json → events` should show every worker as a `spot:*` event, in story order.

## 2. Visual rubric (read the contact sheet, then zoom)

Score each item pass or fail. Fix all fails before rendering.

**Build (frames before the poster):**
- [ ] The reading order is obvious: header → brand/figure → caption → columns.
- [ ] The figure assembles in data-flow order. No edge appears before both of its endpoints.
- [ ] Nothing pops in on top of something unreadable. No half-faded text survives into the poster.

**Poster (`poster` frame):**
- [ ] It works as a static A4 page: balanced columns, nothing clipped, no orphan heading at the bottom of a column.
- [ ] The figure is legible at 50% zoom: titles readable, edges distinct, the bus label not colliding.
- [ ] The palette is coherent: worker and substrate hues pair as intended, and the outcome is coral.

**Story (`spot:*`, `flow`, `feedback` frames; zoom `--zoom 288,148,752,520`):**
- [ ] `flow`: each card swells exactly when its packet lands, and two to three cards breathe at once at most. `tour`: one focus at a time, with spotlight, glow and dot on the same node.
- [ ] The packet is on its edge and hue-matched, and arrives as its card lights up.
- [ ] The hand-off goes to the right substrate node (`to:`).
- [ ] The feedback packet travels the dashed edge and the loop reads as a loop.

**Idle:**
- [ ] Mascot bob is subtle (no visible jitter in a `--burst`).
- [ ] Marching edges stay quiet: dashes read as direction, not as a second set of packets.
- [ ] The neon wordmark glows but the letters stay crisp; zoom the brand column to check.
- [ ] At most one heading sweep and one highlighter redraw are visible at a time.
- [ ] The last frame (`t = duration − .15`) is as clean as the poster, so loops and video ends look intentional.

**Copy:**
- [ ] Every claim on the page is true for the system, and numbers match the implementation or the source docs.
- [ ] The title sweep word is the concept the page is about.

## 3. Useful review commands

```bash
node scripts/review.mjs out                                        # default moments
node scripts/review.mjs out --zoom 288,148,752,520 --scale 2       # figure close-up
node scripts/review.mjs out --times 4.1,4.28 --zoom 40,148,1000,520
node scripts/review.mjs out --burst 3:7:15                         # smoothness check → review/burst.mp4
node scripts/review.mjs out --page single/<id>.html --present 1440x900,820x1180,1440x900:fit   # published single file, centred and scaled
open "out/index.html?debug"                                        # red outlines on fit offenders
```

## 4. Before render

- [ ] Fit report OK, rubric passes, the user has seen the HTML (or a contact sheet) and approved.
- [ ] `scripts/render.sh out --check-only` passes `hyperframes lint` and `check`.
- [ ] Render: `scripts/render.sh out --output <name>.mp4`. Spot-check the MP4 at the poster time and two story beats.
