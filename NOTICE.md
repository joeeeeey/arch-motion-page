# Third-party notices

The MIT license in [LICENSE](LICENSE) covers this repository's own code and
documentation. The components below keep their own licenses.

## Bundled fonts (SIL Open Font License 1.1)

| Files | Copyright | License text |
|---|---|---|
| `vendor/fonts/Tinos-*.ttf` | The Tinos Project Authors (https://github.com/googlefonts/tinos) | `vendor/fonts/OFL-Tinos.txt` |
| `vendor/fonts/Inter.ttf` | The Inter Project Authors (https://github.com/rsms/inter) | `vendor/fonts/OFL-Inter.txt` |
| `vendor/fonts/JetBrainsMono.ttf` | The JetBrains Mono Project Authors (https://github.com/JetBrains/JetBrainsMono) | `vendor/fonts/OFL-JetBrainsMono.txt` |

Built pages embed subsets of these fonts. The OFL permits that; the subsets
stay under the OFL.

## Downloaded at build time (not in this repository)

- **Noto Serif SC and Noto Sans SC** (SIL OFL 1.1, Adobe and Google). `lib/fonts.mjs`
  downloads them once from `notofonts/noto-cjk` at a pinned commit and checks a
  pinned sha256. Chinese pages embed subsets of them.
- **[GSAP](https://gsap.com) 3.15.0**, installed by `npm install` under the
  [GSAP Standard License](https://gsap.com/standard-license). The build copies
  `gsap.min.js` into each output folder, so built pages carry it under that
  license. The demo pages on the `gh-pages` branch are such builds.
- **[HyperFrames](https://www.npmjs.com/package/hyperframes)**, installed inside
  the render container by `scripts/render.sh`. It is never installed on the host
  or redistributed here.
- **fonttools and brotli** (Python), installed inside the font-subsetting
  container by `lib/fonts.mjs`.

## Example artwork

The plush mascots in `examples/self-intro/assets/` were generated with an image
model from the prompts in `examples/self-intro/assets/source/`. They are
illustrations for the example page and are released with it under the MIT
license in [LICENSE](LICENSE).
