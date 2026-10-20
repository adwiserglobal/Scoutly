import type { DemoImage, DemoSiteData, IconId, StyleId } from './types.js';

const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

// ---------------------------------------------------------------------------
// Icons (24x24, stroke)
// ---------------------------------------------------------------------------
const ICONS: Record<IconId, string> = {
  check: '<path d="M5 12.5l4.2 4.2L19 7"/>',
  star: '<path d="M12 3.2l2.7 5.5 6 .9-4.4 4.2 1 6-5.3-2.8-5.3 2.8 1-6L3.3 9.6l6-.9z"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.500 15.400 12 20 12 20z"/>',
  tool: '<path d="M14.500 6.200a4.200 4.200 0 0 0-5.300 5.300L3.500 17.200l3.300 3.300 5.700-5.700a4.200 4.200 0 0 0 5.300-5.300l-2.600 2.600-2.400-.6-.6-2.400z"/>',
  scissors: '<circle cx="6" cy="6.500" r="2.500"/><circle cx="6" cy="17.500" r="2.500"/><path d="M8 8l12 9M8 16L20 7"/>',
  tooth: '<path d="M8 3.500C5.500 3.500 4 5.300 4 7.800c0 2 1 3 1 5.200 0 3 1 7.500 3 7.500 1.700 0 1.700-4.300 4-4.300s2.300 4.300 4 4.300c2 0 3-4.500 3-7.500 0-2.200 1-3.200 1-5.200 0-2.500-1.500-4.300-4-4.300-1.500 0-2.300.7-4 .7S9.500 3.500 8 3.500z"/>',
  cutlery: '<path d="M6 3v7M4 3v5a2 2 0 0 0 4 0V3M6 10v11M17 3c-2.200 1.700-3 4.200-3 7.500h3V21"/>',
  car: '<path d="M4.500 15.500l1.600-5.600A2 2 0 0 1 8 8.500h8a2 2 0 0 1 1.900 1.400l1.600 5.600"/><path d="M3.500 15.500h17V19h-17zM7 19v1.500M17 19v1.500"/><circle cx="7.500" cy="15.500" r=".6"/><circle cx="16.500" cy="15.500" r=".6"/>',
  home: '<path d="M3.500 11.500L12 4l8.500 7.500M5.500 10v10h13V10M10 20v-6h4v6"/>',
  shield: '<path d="M12 3l7.500 2.800v6c0 4.700-3.200 7.800-7.500 9.200-4.300-1.400-7.500-4.500-7.500-9.200v-6z"/><path d="M9 12l2.200 2.200L15.500 10"/>',
  clock: '<circle cx="12" cy="12" r="8.500"/><path d="M12 7.500V12l3 2"/>',
  phone: '<path d="M5.500 4h3.500l1.800 4.500-2.200 1.400a11 11 0 0 0 5 5l1.400-2.200 4.500 1.800v3.500a2 2 0 0 1-2 2A15.500 15.500 0 0 1 3.500 6a2 2 0 0 1 2-2z"/>',
  pin: '<path d="M12 21s-7-6-7-11.200a7 7 0 0 1 14 0C19 15 12 21 12 21z"/><circle cx="12" cy="9.800" r="2.600"/>',
  sparkle: '<path d="M12 3l1.900 5.600L19.500 10.500l-5.600 1.900L12 18l-1.900-5.600L4.500 10.500l5.600-1.900zM19 16l.8 2.200L22 19l-2.200.8L19 22l-.8-2.200L16 19l2.200-.8z"/>',
  leaf: '<path d="M5 19.500C5 10.500 10 5 20 5c0 10-5 15-14 15"/><path d="M5 19.500L13 11.500"/>',
  dumbbell: '<path d="M3 9.500v5M6 7v10M18 7v10M21 9.500v5M6 12h12"/>',
  book: '<path d="M4 5.500A2.500 2.500 0 0 1 6.500 3H19v15H6.500A2.500 2.500 0 0 0 4 20.500z"/><path d="M4 20.500A2.500 2.500 0 0 0 6.500 23H19v-5"/>',
  camera: '<path d="M4 8h3.200l1.800-2.800h6L16.800 8H20v11H4z"/><circle cx="12" cy="13.500" r="3.500"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3M14 9l2 2"/>',
  bag: '<path d="M5 8.500h14L18 20H6z"/><path d="M9 8.500a3 3 0 0 1 6 0"/>',
};
const icon = (id: IconId, cls = 'ic') =>
  `<svg class="${cls}" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[id] || ICONS.check}</svg>`;

// ---------------------------------------------------------------------------
// Themes
// ---------------------------------------------------------------------------
interface Theme {
  fonts: string; // google fonts query
  heading: string;
  body: string;
  headingWeight: number;
  headingCase: string;
  dark: boolean;
  bg: string; surface: string; surface2: string; ink: string; muted: string; line: string;
  accents: [string, string];
  onAccent: string;
  radius: number;
  hero: 'split' | 'full' | 'center';
  tracking: string;
}

const THEMES: Record<StyleId, Theme> = {
  clean: {
    fonts: 'Plus+Jakarta+Sans:wght@400;500;600;700;800', heading: "'Plus Jakarta Sans'", body: "'Plus Jakarta Sans'",
    headingWeight: 800, headingCase: 'none', dark: false, bg: '#ffffff', surface: '#f4f8fc', surface2: '#e9f1f9',
    ink: '#0e1b2c', muted: '#51607a', line: '#e1e8f0', accents: ['#0b78d6', '#0f9d8a'], onAccent: '#fff', radius: 18, hero: 'split', tracking: '-0.035em',
  },
  warm: {
    fonts: 'Fraunces:opsz,wght@9..144,500;9..144,700&family=Inter:wght@400;500;600', heading: "'Fraunces'", body: "'Inter'",
    headingWeight: 700, headingCase: 'none', dark: false, bg: '#fbf6ee', surface: '#f4ebdd', surface2: '#ecdfca',
    ink: '#2b1d12', muted: '#6d5a48', line: '#e6d8c3', accents: ['#c8501a', '#9a6a12'], onAccent: '#fff', radius: 20, hero: 'full', tracking: '-0.02em',
  },
  bold: {
    fonts: 'Barlow+Condensed:wght@600;700;800&family=Inter:wght@400;500;600', heading: "'Barlow Condensed'", body: "'Inter'",
    headingWeight: 800, headingCase: 'uppercase', dark: true, bg: '#0d0e11', surface: '#16181d', surface2: '#1f2229',
    ink: '#f5f5f2', muted: '#a3a7b0', line: '#2a2d35', accents: ['#ff5a12', '#ffc21a'], onAccent: '#0d0e11', radius: 8, hero: 'full', tracking: '0.005em',
  },
  elegant: {
    fonts: 'Cormorant+Garamond:wght@500;600;700&family=Jost:wght@400;500;600', heading: "'Cormorant Garamond'", body: "'Jost'",
    headingWeight: 600, headingCase: 'none', dark: false, bg: '#faf8f4', surface: '#f2ede5', surface2: '#e9e1d4',
    ink: '#201b16', muted: '#6a5f52', line: '#e4dccf', accents: ['#9b7142', '#7b5a78'], onAccent: '#fff', radius: 4, hero: 'split', tracking: '-0.01em',
  },
  fresh: {
    fonts: 'Outfit:wght@400;500;600;700;800', heading: "'Outfit'", body: "'Outfit'",
    headingWeight: 700, headingCase: 'none', dark: false, bg: '#f5fbf7', surface: '#e9f6ee', surface2: '#d9eee2',
    ink: '#10281b', muted: '#4a6656', line: '#d6eadd', accents: ['#1b9a52', '#e08a06'], onAccent: '#fff', radius: 26, hero: 'center', tracking: '-0.03em',
  },
  noir: {
    fonts: 'Sora:wght@400;500;600;700&family=Inter:wght@400;500;600', heading: "'Sora'", body: "'Inter'",
    headingWeight: 700, headingCase: 'none', dark: true, bg: '#0a0f1f', surface: '#111a33', surface2: '#18244a',
    ink: '#eef2ff', muted: '#9aa7c7', line: '#222f55', accents: ['#6d8dff', '#35c4f0'], onAccent: '#0a0f1f', radius: 16, hero: 'split', tracking: '-0.03em',
  },
};

const hexRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
};

function css(theme: Theme, accent: string) {
  const r = theme.radius;
  return `
*{box-sizing:border-box;margin:0}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
:root{--bg:${theme.bg};--surface:${theme.surface};--surface2:${theme.surface2};--ink:${theme.ink};--muted:${theme.muted};--line:${theme.line};--accent:${accent};--accent-rgb:${hexRgb(accent)};--on:${theme.onAccent};--r:${r}px;--hf:${theme.heading},Georgia,serif;--bf:${theme.body},system-ui,-apple-system,"Segoe UI",sans-serif}
body{background:var(--bg);color:var(--ink);font-family:var(--bf);font-size:17px;line-height:1.65;-webkit-font-smoothing:antialiased;overflow-x:hidden}
img{display:block;max-width:100%;height:auto}
a{color:inherit;text-decoration:none}
h1,h2,h3{font-family:var(--hf);font-weight:${theme.headingWeight};text-transform:${theme.headingCase};letter-spacing:${theme.tracking};line-height:1.08}
h1{font-size:clamp(2.35rem,6.4vw,4.6rem)}
h2{font-size:clamp(1.8rem,4.2vw,3rem)}
h3{font-size:1.22rem;line-height:1.25}
.wrap{width:min(1160px,100% - 40px);margin-inline:auto}
.sec{padding:clamp(56px,9vw,104px) 0}
.alt{background:var(--surface)}
.eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:.78rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--accent)}
.eyebrow::before{content:"";width:26px;height:2px;background:currentColor;border-radius:2px}
.lead{font-size:clamp(1.05rem,2vw,1.28rem);color:var(--muted);max-width:56ch}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:52px;padding:0 26px;border-radius:calc(var(--r) * .75);font-weight:700;font-size:1rem;background:var(--accent);color:var(--on);box-shadow:0 10px 30px -10px rgba(var(--accent-rgb),.65);transition:transform .18s,box-shadow .18s,filter .18s}
.btn:hover{transform:translateY(-2px);filter:brightness(1.06)}
.btn.ghost{background:transparent;color:var(--ink);box-shadow:inset 0 0 0 1.5px var(--line)}
.btn.ghost:hover{box-shadow:inset 0 0 0 1.5px var(--accent);color:var(--accent)}
.ic{width:24px;height:24px;flex:none}
.demo{background:#0b0c10;color:#e9e9ee;font:500 13px/1.4 system-ui,sans-serif}
.demo .wrap{display:flex;gap:14px;align-items:center;justify-content:space-between;padding:9px 0;flex-wrap:wrap}
.demo b{color:#fff}.demo a{color:#ffb089;font-weight:700;white-space:nowrap}
header.top{position:sticky;top:0;z-index:20;background:rgba(var(--accent-rgb),0);backdrop-filter:saturate(1.4) blur(14px);background-color:${theme.dark ? 'rgba(10,12,18,.72)' : 'rgba(255,255,255,.78)'};border-bottom:1px solid var(--line)}
header.top .wrap{display:flex;align-items:center;justify-content:space-between;gap:18px;min-height:68px}
.brand{font-family:var(--hf);font-weight:${theme.headingWeight};font-size:1.25rem;letter-spacing:${theme.tracking};text-transform:${theme.headingCase};display:flex;align-items:center;gap:10px}
.brand i{display:grid;place-items:center;width:34px;height:34px;border-radius:calc(var(--r) * .55);background:var(--accent);color:var(--on);font-style:normal;font-size:.95rem}
nav.links{display:none;gap:26px;font-size:.95rem;font-weight:600;color:var(--muted)}
nav.links a:hover{color:var(--accent)}
header .btn{min-height:44px;padding:0 20px;font-size:.92rem}
@media(min-width:900px){nav.links{display:flex}}
.hero{position:relative;overflow:hidden}
.hero .eyebrow{margin-bottom:22px}
.hero h1{margin-bottom:22px}
.hero .cta{display:flex;flex-wrap:wrap;gap:12px;margin-top:34px}
.split{display:grid;gap:44px;align-items:center;padding:clamp(40px,7vw,88px) 0}
@media(min-width:900px){.split{grid-template-columns:1.05fr .95fr;gap:64px}}
.frame{position:relative}
.frame::before{content:"";position:absolute;inset:-14px -14px 14px 14px;border-radius:var(--r);background:var(--accent);opacity:.16}
.frame img,.frame .art{position:relative;width:100%;aspect-ratio:4/4.4;object-fit:cover;border-radius:var(--r);box-shadow:0 30px 70px -30px rgba(0,0,0,.45)}
.art{background:radial-gradient(120% 90% at 20% 10%,rgba(var(--accent-rgb),.55),transparent 60%),linear-gradient(160deg,var(--surface2),var(--surface));display:grid;place-items:center;color:var(--accent);overflow:hidden}
.art .ic{width:34%;height:auto;opacity:.9;stroke-width:1.1}
.art::after{content:"";position:absolute;inset:0;background-image:radial-gradient(rgba(var(--accent-rgb),.28) 1.2px,transparent 1.4px);background-size:22px 22px;mask-image:linear-gradient(160deg,#000,transparent 70%)}
.badge{position:absolute;left:-10px;bottom:26px;z-index:2;display:flex;align-items:center;gap:12px;padding:14px 18px;background:var(--bg);border:1px solid var(--line);border-radius:calc(var(--r) * .8);box-shadow:0 18px 40px -18px rgba(0,0,0,.5);font-size:.9rem;line-height:1.25}
.badge b{display:block;font-family:var(--hf);font-size:1.5rem}
.badge .ic{color:var(--accent)}
.full{min-height:min(88vh,760px);display:grid;align-items:end;color:#fff}
.full>img,.full>.art{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:0;box-shadow:none;aspect-ratio:auto}
.full::before{content:"";position:absolute;inset:0;z-index:1;background:linear-gradient(180deg,rgba(8,8,10,.35) 0%,rgba(8,8,10,.55) 45%,rgba(8,8,10,.9) 100%)}
.full .wrap{position:relative;z-index:2;padding:clamp(90px,14vw,170px) 0 clamp(46px,7vw,84px)}
.full .lead{color:rgba(255,255,255,.86)}
.full .eyebrow{color:#fff}
.full .btn.ghost{color:#fff;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.5)}
.center{padding:clamp(48px,8vw,96px) 0 0;text-align:center}
.center .lead{margin-inline:auto}.center .cta{justify-content:center}
.mosaic{display:grid;grid-template-columns:repeat(6,1fr);gap:14px;margin-top:clamp(40px,6vw,72px)}
.mosaic>*{border-radius:var(--r);object-fit:cover;width:100%;height:100%;min-height:170px;aspect-ratio:auto}
.mosaic>:nth-child(1){grid-column:span 6;min-height:clamp(220px,36vw,440px)}
.mosaic>:nth-child(n+2){grid-column:span 3}
@media(min-width:760px){.mosaic>:nth-child(1){grid-column:span 3;grid-row:span 2}.mosaic>:nth-child(n+2){grid-column:span 3;min-height:210px}}
.strip{border-block:1px solid var(--line);background:var(--surface)}
.strip .wrap{display:grid;gap:18px;padding:22px 0;grid-template-columns:repeat(auto-fit,minmax(190px,1fr))}
.strip div{display:flex;gap:12px;align-items:center;font-size:.95rem;font-weight:600}
.strip .ic{color:var(--accent)}
.head{max-width:680px;margin-bottom:clamp(30px,5vw,56px)}
.head h2{margin-top:14px}
.head p{margin-top:14px;color:var(--muted)}
.grid{display:grid;gap:18px;grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}
.card{padding:28px;border:1px solid var(--line);border-radius:var(--r);background:var(--bg);transition:transform .2s,border-color .2s,box-shadow .2s}
.alt .card{background:var(--bg)}
.card:hover{transform:translateY(-4px);border-color:rgba(var(--accent-rgb),.5);box-shadow:0 24px 50px -30px rgba(var(--accent-rgb),.55)}
.card .ico{display:grid;place-items:center;width:52px;height:52px;border-radius:calc(var(--r) * .7);background:rgba(var(--accent-rgb),.12);color:var(--accent);margin-bottom:18px}
.card p{margin-top:10px;color:var(--muted);font-size:.98rem}
.about{display:grid;gap:44px;align-items:center}
@media(min-width:900px){.about{grid-template-columns:.9fr 1.1fr;gap:72px}}
.about img,.about .art{width:100%;aspect-ratio:5/4;object-fit:cover;border-radius:var(--r)}
.about p{color:var(--muted);margin-top:18px}
.about h2{margin-top:14px}
.hl{display:grid;gap:14px;margin-top:30px}
.hl div{display:flex;gap:14px;align-items:flex-start;padding:16px 18px;border-radius:calc(var(--r) * .8);background:var(--surface)}
.hl .ic{color:var(--accent);margin-top:3px}
.hl b{display:block;font-family:var(--hf);font-size:1.08rem;line-height:1.3;text-transform:${theme.headingCase}}
.hl span{color:var(--muted);font-size:.95rem}
.gallery{display:grid;gap:14px;grid-template-columns:1fr}
@media(min-width:720px){.gallery{grid-template-columns:1.3fr 1fr 1fr}}
.gallery img{width:100%;height:100%;min-height:240px;object-fit:cover;border-radius:var(--r)}
.steps{display:grid;gap:18px;counter-reset:s;grid-template-columns:repeat(auto-fit,minmax(250px,1fr))}
.step{counter-increment:s;padding:6px 0}
.step::before{content:"0" counter(s);display:block;font-family:var(--hf);font-size:3.2rem;font-weight:${theme.headingWeight};line-height:1;color:var(--accent);opacity:.9;margin-bottom:14px}
.step p{color:var(--muted);margin-top:8px}
.faq{max-width:820px}
details{border-bottom:1px solid var(--line);padding:6px 0}
summary{cursor:pointer;list-style:none;display:flex;justify-content:space-between;gap:18px;align-items:center;padding:18px 0;font-weight:700;font-size:1.06rem}
summary::-webkit-details-marker{display:none}
summary::after{content:"+";font-size:1.6rem;line-height:1;color:var(--accent);transition:transform .2s}
details[open] summary::after{transform:rotate(45deg)}
details p{color:var(--muted);padding:0 0 20px;max-width:68ch}
.cta-band{position:relative;overflow:hidden;border-radius:calc(var(--r) * 1.4);padding:clamp(36px,6vw,72px);background:linear-gradient(135deg,var(--accent),color-mix(in srgb,var(--accent) 55%,#000));color:var(--on);text-align:center}
.cta-band::after{content:"";position:absolute;inset:0;background:radial-gradient(60% 80% at 85% 0%,rgba(255,255,255,.28),transparent 60%);pointer-events:none}
.cta-band h2{position:relative;color:inherit}.cta-band p{position:relative;margin:14px auto 28px;max-width:52ch;opacity:.92}
.cta-band .btn{position:relative;background:var(--on);color:var(--accent);box-shadow:0 14px 34px -14px rgba(0,0,0,.6)}
.contact{display:grid;gap:18px;grid-template-columns:repeat(auto-fit,minmax(250px,1fr))}
.contact .card{display:flex;gap:16px;align-items:flex-start}
.contact .card:hover{transform:none}
.contact .ic{color:var(--accent);margin-top:2px}
.contact b{display:block;font-size:.8rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:4px}
.contact a:hover{color:var(--accent)}
footer{padding:36px 0 46px;border-top:1px solid var(--line);font-size:.9rem;color:var(--muted)}
footer .wrap{display:flex;flex-wrap:wrap;gap:12px 28px;justify-content:space-between}
.wa{position:fixed;right:18px;bottom:18px;z-index:30;display:grid;place-items:center;width:58px;height:58px;border-radius:50%;background:#25d366;color:#fff;box-shadow:0 14px 34px -10px rgba(0,0,0,.55)}
.wa svg{width:30px;height:30px}
.rate{display:inline-flex;gap:8px;align-items:center;font-weight:700}
@media(max-width:560px){body{font-size:16px}.badge{left:8px}.btn{width:100%}.hero .cta{flex-direction:column}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*{transition:none!important}}
`;
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------
const WIDTHS = [480, 800, 1280];
function img(image: DemoImage, sizes: string, eager = false, alt = '', h?: number) {
  const url = (w: number) => `${esc(image.src)}${image.src.includes('?') ? '&' : '?'}auto=format&fit=crop&q=72&w=${w}`;
  const width = Math.min(1280, image.width);
  const height = Math.round(width * image.height / image.width);
  return `<img src="${url(800)}" srcset="${WIDTHS.map((w) => `${url(w)} ${w}w`).join(', ')}" sizes="${sizes}" width="${width}" height="${h || height}" alt="${esc(alt || image.alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
}
const art = (iconId: IconId) => `<div class="art" role="img" aria-hidden="true">${icon(iconId)}</div>`;

const HOURS_MAP: Array<[RegExp, string]> = [
  [/\bMo\b/g, 'Seg'], [/\bTu\b/g, 'Ter'], [/\bWe\b/g, 'Qua'], [/\bTh\b/g, 'Qui'], [/\bFr\b/g, 'Sex'],
  [/\bSa\b/g, 'Sáb'], [/\bSu\b/g, 'Dom'], [/\bPH\b/g, 'feriados'], [/\boff\b/gi, 'fechado'], [/\bopen\b/gi, 'aberto'], [/\s*;\s*/g, ' · '],
];
const humanHours = (raw: string) => HOURS_MAP.reduce((text, [pattern, to]) => text.replace(pattern, to), raw);

const WHATSAPP_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.600 15.100L2 22l5-1.300A10 10 0 1 0 12 2zm0 18.200a8.200 8.200 0 0 1-4.200-1.200l-.3-.2-3 .8.8-2.900-.2-.3A8.200 8.200 0 1 1 12 20.200zm4.500-6.100c-.2-.1-1.500-.7-1.700-.8-.2-.1-.4-.1-.6.100l-.8 1c-.1.200-.3.200-.5.100a6.700 6.700 0 0 1-3.300-2.900c-.2-.4.200-.4.700-1.300.1-.2 0-.3 0-.5l-.8-1.800c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.300c-.2.300-.9.900-.9 2.200s.9 2.500 1 2.700c.1.200 1.900 2.900 4.600 4.100 1.700.7 2.400.8 3.200.7.500-.1 1.500-.6 1.700-1.200.2-.6.200-1.100.2-1.200-.1-.1-.3-.2-.5-.3z"/></svg>';

function waNumber(digits: string) {
  if (!digits) return '';
  return digits.length <= 11 ? `55${digits}` : digits;
}

export function renderDemoSite(data: DemoSiteData, style: StyleId, options: { preview?: boolean } = {}): string {
  const { business: b, copy, images, brand } = data;
  const theme = THEMES[style] || THEMES.clean;
  const accent = theme.accents[copy.variant] || theme.accents[0];
  const wa = waNumber(b.phoneDigits);
  const waLink = wa ? `https://wa.me/${wa}?text=${encodeURIComponent(`Olá! Vi o site da ${b.name} e gostaria de mais informações.`)}` : '';
  const primaryHref = waLink || '#contato';
  const where = [b.neighborhood, b.city].filter(Boolean).join(', ');
  const mapsHref = b.mapsUrl || (b.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${b.name} ${b.address}`)}` : '');
  const mainIcon: IconId = copy.services[0]?.icon || 'sparkle';
  const initials = esc(b.name.trim().charAt(0).toUpperCase() || 'S');
  const hasRating = b.rating && b.reviewCount;

  // Hero
  const heroText = `
    <p class="eyebrow">${esc(copy.eyebrow || [b.category, where].filter(Boolean).join(' · '))}</p>
    <h1>${esc(copy.headline)}</h1>
    <p class="lead">${esc(copy.subheadline)}</p>
    <div class="cta"><a class="btn" href="${esc(primaryHref)}"${waLink ? ' rel="noopener"' : ''}>${esc(copy.primaryCta)}</a><a class="btn ghost" href="#servicos">${esc(copy.secondaryCta)}</a></div>`;
  const heroMedia = images.hero ? img(images.hero, '(min-width:900px) 520px, 92vw', true, `${b.name}: ${b.category}`) : art(mainIcon);
  const badge = hasRating
    ? `<div class="badge">${icon('star')}<div><b>${esc(String(b.rating).replace('.', ','))}</b>${esc(b.reviewCount)} avaliações no Google</div></div>`
    : `<div class="badge">${icon('pin')}<div><b>${esc(b.neighborhood || b.city || 'Local')}</b>Atendimento na região</div></div>`;

  let hero = '';
  if (theme.hero === 'split') {
    hero = `<section class="hero"><div class="wrap split"><div>${heroText}</div><div class="frame">${heroMedia}${badge}</div></div></section>`;
  } else if (theme.hero === 'full') {
    hero = `<section class="hero full">${images.hero ? img(images.hero, '100vw', true, `${b.name}: ${b.category}`, undefined) : art(mainIcon)}<div class="wrap">${heroText}</div></section>`;
  } else {
    const mosaic = images.hero
      ? `<div class="mosaic">${[images.hero, ...images.gallery.slice(0, 2)].map((image, i) => img(image, i === 0 ? '(min-width:760px) 50vw, 92vw' : '(min-width:760px) 25vw, 92vw', i === 0)).join('')}</div>`
      : `<div class="mosaic">${[0, 1, 2].map((i) => art(copy.services[i]?.icon || mainIcon)).join('')}</div>`;
    hero = `<section class="hero center"><div class="wrap">${heroText}${mosaic}</div></section>`;
  }

  // Trust strip (only real information)
  const strip = [
    hasRating ? `<div>${icon('star')}<span class="rate">${esc(String(b.rating).replace('.', ','))} · ${esc(b.reviewCount)} avaliações no Google</span></div>` : '',
    where ? `<div>${icon('pin')}<span>${esc(where)}</span></div>` : '',
    b.hours ? `<div>${icon('clock')}<span>${esc(humanHours(b.hours))}</span></div>` : '',
    wa ? `<div>${icon('phone')}<span>Atendimento pelo WhatsApp</span></div>` : '',
  ].filter(Boolean).join('');

  const services = copy.services.map((service) =>
    `<article class="card"><div class="ico">${icon(service.icon)}</div><h3>${esc(service.title)}</h3><p>${esc(service.text)}</p></article>`).join('');

  const aboutMedia = images.about ? img(images.about, '(min-width:900px) 46vw, 92vw') : art(copy.services[1]?.icon || mainIcon);
  const highlights = copy.highlights.map((item) =>
    `<div>${icon('check')}<p style="margin:0"><b>${esc(item.title)}</b><span>${esc(item.text)}</span></p></div>`).join('');

  const gallery = images.gallery.length >= 2
    ? `<section class="sec" id="galeria"><div class="wrap"><div class="head"><p class="eyebrow">Galeria</p><h2>${esc(b.name)} em imagens</h2></div><div class="gallery">${images.gallery.map((image) => img(image, '(min-width:720px) 38vw, 92vw')).join('')}</div></div></section>`
    : '';

  const steps = copy.process.map((step) => `<div class="step"><h3>${esc(step.title)}</h3><p>${esc(step.text)}</p></div>`).join('');
  const faq = copy.faq.map((item) => `<details><summary>${esc(item.q)}</summary><p>${esc(item.a)}</p></details>`).join('');

  const contactCards = [
    b.address ? `<div class="card">${icon('pin')}<div><b>Endereço</b>${esc(b.address)}${mapsHref ? `<br><a href="${esc(mapsHref)}" rel="noopener" style="color:var(--accent);font-weight:700">Como chegar →</a>` : ''}</div></div>` : '',
    wa ? `<div class="card">${icon('phone')}<div><b>WhatsApp</b><a href="${esc(waLink)}" rel="noopener">Chamar agora →</a></div></div>` : '',
    b.hours ? `<div class="card">${icon('clock')}<div><b>Horários</b>${esc(humanHours(b.hours))}</div></div>` : '',
  ].filter(Boolean).join('') || `<div class="card">${icon('phone')}<div><b>Contato</b>Informações de contato em breve.</div></div>`;

  const credits = [...new Map([images.hero, images.about, ...images.gallery]
    .filter((image): image is DemoImage => Boolean(image && image.credit))
    .map((image) => [image.credit, image.creditUrl || 'https://unsplash.com?utm_source=scoutly&utm_medium=referral'])).entries()].slice(0, 5);
  const brandPhone = String(brand.contactPhone || '').replace(/\D/g, '');
  const brandCta = brandPhone.length >= 10
    ? `https://wa.me/${waNumber(brandPhone)}?text=${encodeURIComponent(`Olá! Vi a proposta de site que você preparou para a ${b.name}.`)}`
    : brand.contactEmail ? `mailto:${brand.contactEmail}`
    : /^https?:\/\//.test(brand.contactWebsite) ? brand.contactWebsite : brand.contactWebsite ? `https://${brand.contactWebsite}` : '';
  const demoBar = `<div class="demo"><div class="wrap"><span>${options.preview ? '<b>Prévia</b> · ' : ''}Proposta de site para <b>${esc(b.name)}</b>${brand.name ? ` · preparada por <b>${esc(brand.name)}</b>` : ''}</span>${brandCta ? `<a href="${esc(brandCta)}" rel="noopener">Gostou? Fale comigo →</a>` : ''}</div></div>`;

  const fontHref = `https://fonts.googleapis.com/css2?family=${theme.fonts}&display=swap`;
  const title = `${b.name} — ${copy.headline}`.slice(0, 70);

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(copy.subheadline.slice(0, 155))}">
<meta name="robots" content="noindex,nofollow,noarchive"><meta name="theme-color" content="${theme.bg}">
<meta property="og:title" content="${esc(b.name)} — proposta de site"><meta property="og:description" content="${esc(copy.subheadline.slice(0, 155))}">${images.hero ? `<meta property="og:image" content="${esc(images.hero.src)}${images.hero.src.includes('?') ? '&' : '?'}auto=format&fit=crop&q=72&w=1200">` : ''}
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>${images.hero ? '<link rel="preconnect" href="https://images.unsplash.com">' : ''}
<link rel="stylesheet" href="${fontHref}"><style>${css(theme, accent)}</style></head><body>
${demoBar}
<header class="top"><div class="wrap"><a class="brand" href="#topo"><i>${initials}</i>${esc(b.name)}</a>
<nav class="links" aria-label="Principal"><a href="#servicos">Serviços</a><a href="#sobre">Sobre</a><a href="#como-funciona">Como funciona</a><a href="#perguntas">Perguntas</a><a href="#contato">Contato</a></nav>
<a class="btn" href="${esc(primaryHref)}"${waLink ? ' rel="noopener"' : ''}>${esc(copy.primaryCta)}</a></div></header>
<main id="topo">
${hero}
${strip ? `<div class="strip"><div class="wrap">${strip}</div></div>` : ''}
<section class="sec" id="servicos"><div class="wrap"><div class="head"><p class="eyebrow">Serviços</p><h2>O que fazemos por você</h2></div><div class="grid">${services}</div></div></section>
<section class="sec alt" id="sobre"><div class="wrap about"><div>${aboutMedia}</div><div><p class="eyebrow">Sobre</p><h2>${esc(copy.aboutTitle)}</h2>${copy.aboutParagraphs.map((p) => `<p>${esc(p)}</p>`).join('')}<div class="hl">${highlights}</div></div></div></section>
${gallery}
<section class="sec ${gallery ? 'alt' : ''}" id="como-funciona"><div class="wrap"><div class="head"><p class="eyebrow">Como funciona</p><h2>Simples do primeiro contato ao atendimento</h2></div><div class="steps">${steps}</div></div></section>
<section class="sec ${gallery ? '' : 'alt'}" id="perguntas"><div class="wrap"><div class="head"><p class="eyebrow">Perguntas frequentes</p><h2>Tire suas dúvidas</h2></div><div class="faq">${faq}</div></div></section>
<section class="sec"><div class="wrap"><div class="cta-band"><h2>${esc(copy.ctaTitle)}</h2><p>${esc(copy.ctaText)}</p><a class="btn" href="${esc(primaryHref)}"${waLink ? ' rel="noopener"' : ''}>${esc(copy.primaryCta)}</a></div></div></section>
<section class="sec alt" id="contato"><div class="wrap"><div class="head"><p class="eyebrow">Contato</p><h2>Onde estamos</h2></div><div class="contact">${contactCards}</div></div></section>
</main>
<footer><div class="wrap"><span>© ${esc(b.name)} · ${esc(b.category)}${where ? ` · ${esc(where)}` : ''}</span><span>Rascunho de site${brand.name ? ` criado por ${esc(brand.name)}` : ''}${credits.length ? ` · Fotos: ${credits.map(([name, href]) => `<a href="${esc(href)}" rel="noopener" target="_blank" style="text-decoration:underline">${esc(name)}</a>`).join(', ')} / <a href="https://unsplash.com/?utm_source=scoutly&utm_medium=referral" rel="noopener" target="_blank" style="text-decoration:underline">Unsplash</a>` : ''}</span></div></footer>
${waLink ? `<a class="wa" href="${esc(waLink)}" rel="noopener" aria-label="Chamar no WhatsApp">${WHATSAPP_SVG}</a>` : ''}
</body></html>`;
}

export const DEMO_CSP = [
  "default-src 'none'",
  "img-src https: data:",
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'self'",
].join('; ');
