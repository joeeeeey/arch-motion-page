// Language layer: the template's fixed strings, extra font families, and the CSS that a script
// needs on top of any theme. A theme never knows which language it is set in.

export const LANGS = ['en', 'zh'];

export const LOCALE = {
  en: { abstract: 'Abstract', abstractSep: '—', fig: 'Fig. 1', figSep: '.', overview: 'System overview', takeaways: 'Key Takeaways' },
  zh: { abstract: '摘要', abstractSep: '：', fig: '图 1', figSep: '', overview: '系统总览', takeaways: '要点' },
};

// CJK families are appended to every theme stack through --cjk-serif / --cjk-sans (see theme.css).
// Files come from lib/fonts.mjs (pinned download, subset per page).
export const LANG_FONTS = {
  en: [],
  zh: [
    { family: 'Noto Serif SC', file: 'NotoSerifSC-Regular.otf', weight: 400, style: 'normal', cjk: true },
    { family: 'Noto Serif SC', file: 'NotoSerifSC-Bold.otf', weight: 700, style: 'normal', cjk: true },
    { family: 'Noto Sans SC', file: 'NotoSansSC-Regular.otf', weight: 400, style: 'normal', cjk: true },
    { family: 'Noto Sans SC', file: 'NotoSansSC-Bold.otf', weight: 700, style: 'normal', cjk: true },
  ],
};

// Latin faces must not claim CJK punctuation, or quotes and dashes come out half-width.
export const LATIN_RANGE = {
  zh: 'U+0000-2013, U+2015-2017, U+201A-201B, U+201E-2025, U+2027-10FFFF',
};

const CSS = {
  en: '',
  zh: `
:root { --cjk-serif: "Noto Serif SC"; --cjk-sans: "Noto Sans SC"; }
/* CJK has no italic: keep it upright inside *em* and italic subs, Latin keeps its real italics */
.amp-page { font-synthesis-style: none; line-break: strict; }
.amp-col { font-size: 13.4px; line-height: 1.62; hyphens: manual; }
.amp-col p + p { text-indent: 2em; }
.amp-abstract p { font-size: 13px; line-height: 1.62; }
.amp-h1, .amp-h2 { letter-spacing: .04em; }
.amp-h2 { font-style: normal; }
.amp-takeaways li { line-height: 1.55; }
.amp-quote p { font-size: 15px; line-height: 1.5; }
.amp-caption { line-height: 1.55; hyphens: manual; }
.amp-blurb { line-height: 1.55; }
/* short card labels break only at punctuation or spaces: no single-character orphans */
.amp-node-sub { line-height: 1.35; word-break: keep-all; overflow-wrap: anywhere; }
.amp-subtitle { letter-spacing: .02em; }
.amp-kicker, .amp-tagline, .amp-figlabel, .amp-buslabel, .amp-footer, .amp-box-title, .amp-fblabel .k, .amp-quote cite { letter-spacing: .08em; }
.amp-table-title, .amp-table thead th { font-variant: normal; letter-spacing: .02em; }
`,
};

export const langCss = (lang) => CSS[lang] || '';

// Display width for budgets: a CJK character takes about two Latin ones.
const WIDE = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/u;
export const textWidth = (s) => [...String(s)].reduce((w, c) => w + (WIDE.test(c) ? 2 : 1), 0);
