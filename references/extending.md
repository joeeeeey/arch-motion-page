# Extending amp

There are four extension points. Each one is independent of the others, so a new theme works with every spec and a new effect works with every theme.

## 1. Themes (art templates)

`themes/<name>/theme.json` + `theme.css`. Select a theme with `meta.theme` or `build.mjs --theme <name>`.

```json
{ "name": "blueprint", "extends": "plush-academic",
  "hues": { "blue": "#6f9bff", "...": "..." }, "sweep": ["..."], "edge": "#5f82b3",
  "neon": ["#6f9bff", "#4cc3f5", "#3fd28f", "#f2c14e", "#ff9a4d", "#ff6fbf"],
  "fonts": [ { "family": "X", "file": "X.ttf", "weight": 400, "style": "normal" } ] }
```

- `extends` layers the CSS after the base theme and merges `hues` and `fonts`. A skin then restates only what changes; `themes/blueprint/` has about 60 lines.
- **Hue names are the contract** between specs and themes. Every theme must define `blue green yellow sky magenta orange purple coral system outcome`.
- **Tokens a skin usually overrides:**
  - Paper and ink: `--paper --ink --ink-2 --ink-3 --line --panel --panel-dot --card`.
  - Tints: `--tint` (base of hue tints) and `--shade` (base of hue shades).
  - Surroundings and code: `--desk --code-bg --code-ink`.
  - Effects: `--glow-a --glow-b --mark-a`, `--flow` (marching-edge dashes), `--wm-core` (neon letter fill).
- `neon` is the wordmark gradient, left to right. On dark paper, raise the glow in CSS (`.amp-wordmark span::before/::after` filters); `themes/blueprint/` shows how.
  - Fonts: `--serif --sans --mono --label`.
- Font files go in `vendor/fonts/`. Use only OFL or other redistributable fonts.
- Keep `var(--cjk-serif, …)` / `var(--cjk-sans, …)` in every font stack you override, so the language layer can slot CJK faces in.
- Keep geometry out of themes. If a font change makes text wider, the fit report will say so. Fix it with font size in the theme, not by changing `GEOM`.
- Review a new theme against the self-intro: `node scripts/build.mjs examples/self-intro/spec.yaml --theme <name> --out /tmp/amp-<name>/out`, then `review.mjs`.

## 2. Archetypes (figure layouts)

`lib/archetypes/<name>.mjs` exports a pure function `(figure, W, H, opts) → layout` with this shape:

```js
{ W, H,
  nodes:  [{ id, tier, x, y, w, h, title, sub, hue, mascot?, icon?, outcome? }],   // nodes[0] is the root
  edges:  [{ id, stage, pts: [[x,y],...], len, arrow?, dashed? }],                  // stage = build order group
  routes: [{ id, hue, pts, len }],         // packet paths: dispatch-<id>, handoff-<id>, flow-<id>, feedback
  rings, feedback: { from, label, labelBox } | null, busLabel: { text, x, y } | null }
```

Today `lib/motion.mjs` draws edges by the tiered stage names (`e1`…`e12`) and assumes tiers 0/1/2. A new archetype must either:
- reuse those stage names and tier numbers, for example a hub-and-spoke where spokes are tier 1 and stores are tier 2; or
- add its own build schedule branch in `compileMotion`.

Register it in `scripts/build.mjs` and in `lib/spec.mjs` (archetype validation).

Candidate archetypes:
- `pipeline`: a left-to-right stage chain.
- `hub`: a central platform with radial clients.
- `layers`: a stacked platform diagram.
- `swimlane`: a request sequence across services.

## 3. Templates (page formats)

`templates/<name>.mjs` exports `GEOM`, `renderBody` and `renderPage`. `paper-a4` is the only one today.
- A `slide-16x9` template would reuse the same spec with a wider hero and two columns.
- A `poster-a3` template would use larger type.

Keep every page-level box absolutely positioned from `GEOM`, so Chrome review and HyperFrames render identically.

## 4. Languages

`lib/lang.mjs` is the language layer; themes never know the language.
- `LOCALE`: the template's fixed strings (abstract, figure label, takeaways).
- `LANG_FONTS`: extra faces. Large ones are not vendored: add the file to `REMOTE` in `lib/fonts.mjs` with a pinned URL (commit, not branch) and its sha256. The build downloads it once into `~/.cache/arch-motion-page/fonts/` and subsets it per page in Docker.
- `LATIN_RANGE`: `unicode-range` for the Latin faces, so they do not claim the script's punctuation (curly quotes, dashes, ellipsis).
- `CSS`: typesetting rules for the script (line height, indents, no synthetic italics, label spacing).
- Add the code to `LANGS` and the width rule to `textWidth` if the script is wide.

## 5. Motion effects and block types

- **Effects:** see `motion-grammar.md` → "Adding an effect". Add an `ambient.<flag>` default in `lib/spec.mjs`.
- **Block types:**
  1. Add the type to `BLOCK_TYPES` and its validation in `lib/spec.mjs`.
  2. Add a renderer case in `renderBody` with `data-anim` (build-in order) and `data-*` hooks for any ambient effect.
  3. Add CSS in the base theme using tokens only.
  4. Document it in `spec-schema.md`.
- **Icons:** add 24 × 24 stroke paths to `lib/icons.mjs`.
