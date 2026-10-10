# spec.yaml schema

The spec is the only file an agent writes. `lib/spec.mjs` validates it.
- **Errors** stop the build: missing fields, bad references, wrong counts, missing assets.
- **Warnings** flag budget overruns. Budgets are display widths: a CJK character counts 2.

The runtime fit report is the final judge of whether text fits.

Inline markup is allowed in every prose field (`lib/markup.mjs`):

| Markup | Renders as |
|---|---|
| `` `code` `` | mono chip |
| `==mark==` | animated highlighter (body only) |
| `**bold**` | bold |
| `*em*` | italic |
| ` -- ` | em dash |

## meta

| Field | Default | Notes |
|---|---|---|
| `id` | required | lowercase slug; becomes `data-composition-id` |
| `title` | header.title | `<title>` of the HTML |
| `duration` | 24 | seconds, 8..120. Two story cycles need ≈ 20 s with 6 workers. |
| `theme` | plush-academic | folder under `themes/` (`--theme` overrides) |
| `seed` | 7 | seeds the idle-effect PRNG |
| `lang` | en | `en` or `zh`. `zh` switches the template strings (摘要, 图 1, 要点), adds Noto Serif/Sans SC (subset per page in Docker) and CJK typesetting CSS. Variants live as `spec.<lang>.yaml` and build into `out-<lang>/`. |

## header

| Field | Budget | Notes |
|---|---|---|
| `kicker` | 64 | small caps line, left. Use `**Brand**` to emphasise. |
| `meta` | | small caps line, right (version · date) |
| `title` | 52 | one line, 44 px serif |
| `sweep` | | a word or phrase inside `title` that gets the gradient sweep |
| `subtitle` | 120 | one italic line |
| `stamp` | | optional rotating badge: `{ text: "phrase · repeated · ", center: abc }`. The text is stretched to the full circle, so 30–40 chars reads best. |

## brand (left column of the hero, 226 × 520)

| Field | Budget | Notes |
|---|---|---|
| `image` | | transparent PNG, ~720 px wide; sits on a soft radial glow, 214 px tall area |
| `wordmark` | | short (≤ 6 chars looks best); letters pop in one by one, then glow as a neon gradient (the theme's `neon` colours) |
| `tagline` | 40 | small caps under the wordmark |
| `blurb` | 120 | one serif sentence |
| `stats` | 28 each | 2–4 items `{ icon, text }`; icons from the set below |

One coloured dot is drawn per tier-0/1 node; during the story the active node's dot pulses.

## figure

```yaml
figure:
  archetype: tiered              # only archetype today
  label: The amp pipeline        # "FIG. 1 · <label>" in the panel corner
  label_lead: Fig. 1             # optional
  caption: >-                    # ≤ 300 chars, two lines under the hero
    ...
  tiers:
    - nodes: [ {root} ]                 # tier 0: exactly 1 node
    - nodes: [ {worker}, ... ]          # tier 1: 3..7 nodes
    - nodes: [ {substrate}, ... ]       # tier 2: 2..6 nodes, left → right is the flow direction
  feedback: { from: <tier-2 id>, label: "Head: tail text" }   # optional dashed edge back to the root
  bus_label: a · b · c           # optional small caps under the tier-2 bus (≤ 56)
```

**Tier fields:**
- `nodes`
- `height`: overrides the card height, defaults 152 / 112.
- `flow: false`: tier 2 only; drops the left-to-right flow arrows and flow packets.

`figure.layout` can override archetype constants such as `{ gapY: 18, t1Gap: 10 }`. See `DEF` in `lib/archetypes/tiered.mjs`. Treat it as a last resort.

**Node fields:**
- `id`: slug; defaults to a slug of `title`.
- `title`, `sub` (budgets below).
- `hue`: a theme hue name.
- `mascot`: transparent PNG.
- `icon`: tier 2 only, when no mascot.
- `to`: tier 1 only; the tier-2 node this worker hands off to. Defaults to the nearest one below.
- `outcome: true`: tier 2 only; outcome styling.

| Tier | title | sub | Card |
|---|---|---|---|
| 0 root | 18 | 44 | 300 × 66, mascot left |
| 1 workers | 12 | 44 | ≈ 108 × 152, mascot on a tinted header |
| 2 substrate | 14 | 34 | ≈ 128 × 112, icon badge or mascot |

**Hue defaults:**
- Tiers 0–1 cycle blue, green, yellow, sky, magenta, orange, purple, coral.
- Tier 2 gets `system`, or `outcome` when `outcome: true`.
- Give a worker the same hue as the substrate node it feeds; the eye follows colour.

The feedback label is split on the first `:` or `：`. The head becomes small caps, the tail becomes italic. Max width 48.

## story (optional)

```yaml
story: [researcher, writer, layout]   # or [{ target: id }]; default = every tier-1 node in order
```

`story` sets the order in which workers are served. What happens to them depends on `ambient.style`:

- `flow` (default): the system runs continuously. The root beats every 1.2 s and each beat dispatches the next two workers. Each card swells as its packet lands, then hands off to its substrate node. A wave walks tier 2, and every fourth beat a result rides the feedback edge home.
- `tour`: one focus at a time. A spotlight ring visits each worker on 0.8 s beats, walks tier 2, and closes with the feedback packet. Cycles repeat while they fit in `duration`.

## ambient (optional)

| Key | Default | Effect |
|---|---|---|
| `style` | flow | `flow`, `tour` or `none` (see story) |
| `packets` | true | signal packets on the edges |
| `edge_flow` | true | dashes march along every solid edge after the build |
| `wordmark` | true | neon wordmark breathes (per-letter glow plus a slow hue drift) |
| `title_sweep`, `headings` | true | colour sweeps across the title and section headings |
| `mascots`, `marks`, `cycle`, `feedback_ants` | true | mascot bob, highlighter redraw, cycle diagram, dashed feedback edge |

Set a key to `false` to disable that effect. The legacy `spotlight: false` maps to `style: none`.

## body

`body.columns` must hold exactly 3 lists of blocks. Each column is 313 × 728 px. Blocks render top to bottom; nothing reflows between columns.

| type | Fields | Notes |
|---|---|---|
| `abstract` | `text`, `label` | opens with an italic "Abstract—" lead |
| `section` | `heading`, `level` (1 or 2), `text` (string or list of paragraphs) | level 1 = small caps roman numerals ("I. Introduction"); level 2 = italic ("A. …") |
| `para` | `text` | paragraphs without a heading |
| `cycle` | `title`, `steps` (3..6, ≤ 12 chars each), `center`, `hue` | circular process diagram; steps light up in turn, orbit dots rotate. 156 px + title. |
| `takeaways` | `title`, `items` | numbered, coloured counters, items pop in |
| `quote` | `text`, `by`, `hue` | pull quote with a coloured rule |
| `list` | `heading`, `items` | bullet list |
| `code` | `title`, `text`, `hue` | YAML-highlighted, ≤ 34 chars per line at this column width |
| `image` | `src`, `height` (160), `caption` | |
| `filmstrip` | `frames: [{src, label}]` (2..5), `caption` | captured frames; `review.mjs --thumb 320` makes them |
| `table` | `title`, `columns`, `rows` | booktabs style; every row needs one cell per column |

Fill targets: 88–99% per column (shown by `review.mjs`). Typical heights at 313 px wide:

| Block | Approx. height |
|---|---|
| paragraph | 19 px per line, ~48 chars per line |
| heading | 30 px |
| cycle | 190 px |
| code | 40 px + 17 px per line |
| table | 50 px + 19 px per row |
| filmstrip (3 frames) | 110 px |

## footer

`left`, `center`, `right`: one small caps line each.

## Icons

`file palette graph timeline film gear database brain search bars check spark` (`lib/icons.mjs`; add more there).
