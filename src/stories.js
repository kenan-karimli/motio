// Share images and recap slides: one style system. Every card is laid out in HTML at 360 px wide; share images
// are 360×640 rendered ×3 (1080×1920), recap slides use the same markup at the phone's height.
// A card = kind (what is shared) + data (the screen's numbers) + look (theme, colour, what shows, photo).
import { toCanvas, getFontEmbedCSS } from 'html-to-image';

const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const br = (s) => esc(s).replace(/\n/g, '<br>');
// Data labels arrive in caps ("MOST STEPS IN A DAY"); cards set them in sentence case.
const cap = (s) => { s = String(s ?? ''); if (/^[^a-z]+$/.test(s)) s = s.toLowerCase().replace(/\bpr\b/g, 'PR'); return s.charAt(0).toUpperCase() + s.slice(1); };
const SANS = "'Inter Tight', system-ui, sans-serif";

const rgb = (hex) => { let h = hex.replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const alpha = (hex, a) => `rgba(${rgb(hex).join(',')},${a})`;

// The five share styles of board 08. Colour only where it means something (a mode, the goal).
export const THEMES = {
  mono: { name: 'Mono', hint: 'White and quiet', bg: '#FFFFFF', fg: '#0F0F0F', mute: '#6E6E6A', ink2: '#3A3A38' },
  glow: { name: 'Glow', hint: 'One number, lit', bg: '#141414', fg: '#FFFFFF', mute: '#A8A8A4', ink2: '#CFCFCB' },
  poster: { name: 'Poster', hint: 'Black, the figure huge', bg: '#0F0F0F', fg: '#FFFFFF', mute: '#A8A8A4', ink2: '#CFCFCB' },
  ticket: { name: 'Ticket', hint: 'A ride ticket', bg: '#ECECEA', fg: '#0F0F0F', mute: '#6E6E6A', ink2: '#3A3A38' },
  editorial: { name: 'Editorial', hint: 'The Motio Daily', bg: '#F5F5F3', fg: '#0F0F0F', mute: '#6E6E6A', ink2: '#3A3A38' }
};
const IDS = Object.keys(THEMES);
const GOAL = '#F6C343';

// Routes as art: GPS lines fitted into a w×h box. `color` paints them all one colour (else each keeps its
// movement colour); `fluid` stretches the drawing to its box; `trail` draws them as light trails.
export function routeArt(routes, w, h, { width = 5, glow = true, color = null, fluid = false, trail = false, dot = '#FFFFFF' } = {}) {
  const pts = routes.flatMap((r) => r.points);
  if (pts.length < 2) return '';
  const lat0 = pts.reduce((a, p) => a + p[0], 0) / pts.length, k = Math.cos((lat0 * Math.PI) / 180);
  const xy = (p) => [p[1] * k, -p[0]];
  const xs = pts.map((p) => xy(p)[0]), ys = pts.map((p) => xy(p)[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const pad = 14, s = Math.min((w - pad * 2) / Math.max(1e-9, maxX - minX), (h - pad * 2) / Math.max(1e-9, maxY - minY));
  const ox = (w - (maxX - minX) * s) / 2, oy = (h - (maxY - minY) * s) / 2;
  const path = (r) => r.points.map((p, i) => { const [x, y] = xy(p); return (i ? 'L' : 'M') + ((x - minX) * s + ox).toFixed(1) + ' ' + ((y - minY) * s + oy).toFixed(1); }).join(' ');
  const end = (r) => { const [x, y] = xy(r.points[r.points.length - 1]); return [((x - minX) * s + ox).toFixed(1), ((y - minY) * s + oy).toFixed(1)]; };
  const c = (r) => color || r.color;
  const line = (r, sw, op, col = c(r)) => `<path d="${path(r)}" fill="none" stroke="${col}" stroke-opacity="${op}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const body = trail
    ? routes.map((r) => line(r, width * 5, 0.07) + line(r, width * 2.4, 0.18) + line(r, width, 1) + line(r, Math.max(1, width * 0.3), 0.9, '#FFFFFF')).join('')
    : (glow ? routes.map((r) => line(r, width * 3, 0.25)).join('') : '') + routes.map((r) => line(r, width, 1)).join('');
  const size = fluid ? 'width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style="position:absolute;inset:0;display:block;overflow:visible"' : `width="${w}" height="${h}" style="display:block;overflow:visible"`;
  return `<svg ${size} viewBox="0 0 ${w} ${h}">${body}
    ${routes.slice(-1).map((r) => { const [x, y] = end(r); return `<circle cx="${x}" cy="${y}" r="${width + 2}" fill="${dot}" stroke="${c(r)}" stroke-width="3"/>`; }).join('')}
  </svg>`;
}

// ---------------------------------------------------------------- content: every kind becomes the same shape
const split = (v) => { const s = String(v ?? ''); const m = /^([\d.,:]+)\s?([A-Za-z/%]+)$/.exec(s); return m ? { v: m[1], u: m[2] } : { v: s, u: '' }; };
const word = (v) => ({ v: String(v ?? ''), u: '', word: true });
function content(kind, d) {
  const m = { eyebrow: d.kicker || '', lead: '', title: '', hero: null, line: '', sub: '', stats: [], chart: null, routes: d.routes || [], foot: '' };
  const C = {
    today: () => ({ lead: d.lead, hero: split(d.big), line: d.goal, stats: d.stats, chart: d.modes && d.modes.length ? { type: 'modes', modes: d.modes } : null }),
    cover: () => ({ title: d.title, line: d.sub, lead: cap(d.bigLabel), hero: split(d.big) }),
    distance: () => ({ lead: d.lead, hero: d.unit ? { v: d.num, u: d.unit } : split(d.num), line: d.line, chart: d.bars && d.bars.length ? { type: 'bars', bars: d.bars } : null }),
    time: () => ({ lead: d.lead, hero: split(d.big), line: d.line, foot: d.peak, chart: d.hourly ? { type: 'hourly', hourly: d.hourly } : null }),
    highlights: () => ({ title: d.title, stats: (d.tiles || []).slice(0, 4).map((t) => ({ v: t.v, k: t.k, s: t.s })) }),
    wrap: () => ({ lead: d.lead, hero: word(d.name), line: d.stat, stats: d.grid, foot: d.end }),
    persona: () => ({ eyebrow: d.month, lead: 'My movement personality', hero: word(d.name), line: d.tagline, sub: d.desc, foot: d.stat, chart: d.traits ? { type: 'traits', traits: d.traits } : null }),
    challenge: () => ({ lead: 'Challenge', hero: word(d.big), line: d.leadLine, foot: 'Race me on Motio', chart: d.racers ? { type: 'race', racers: d.racers } : null }),
    trip: () => ({ lead: d.lead, hero: split(d.big), stats: d.stats })
  };
  Object.assign(m, (C[kind] || C.trip)());
  m.stats = (m.stats || []).filter((s) => s && s.v !== '' && s.v != null);
  return m;
}
// What the share editor can switch off for this card: its stats by label, and its chart.
export function storyParts(kind, data) {
  const m = content(kind, data);
  return [...m.stats.map((s) => ({ key: s.k, label: cap(s.k) })), ...(m.chart ? [{ key: 'chart', label: 'Chart' }] : [])];
}

// ---------------------------------------------------------------- colour for one card
function palette(id, o) {
  const t = THEMES[id], photo = o.photo || null, veiled = !!photo && id !== 'ticket';
  const fg = veiled ? '#FFFFFF' : t.fg;
  return { id, t, bg: t.bg, fg, photo, veiled, mute: veiled ? 'rgba(255,255,255,0.72)' : t.mute, ink2: veiled ? 'rgba(255,255,255,0.86)' : t.ink2, line: alpha(fg, 0.16), soft: alpha(fg, 0.2) };
}
const veil = 'linear-gradient(180deg, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.08) 32%, rgba(0,0,0,0.25) 55%, rgba(0,0,0,0.82) 100%)';
const BACK = { glow: () => 'radial-gradient(90% 60% at 50% 30%, #3A3A38 0, #141414 70%)' };
const backdrop = (P) => (P.veiled ? `${veil}, url(${P.photo}) center/cover no-repeat, #111` : BACK[P.id] ? BACK[P.id](P) : P.bg);

// ---------------------------------------------------------------- shared pieces
const fit = (s, w, max, k = 0.6) => Math.max(14, Math.min(max, Math.floor(w / Math.max(1, String(s).length * k))));
const hero = (h, P, { w = 300, max = 86, lh = 1, align = 'flex-start', unitBelow = false } = {}) => {
  if (!h || !h.v) return '';
  const size = h.word ? Math.min(Math.round(max * 0.5), fit(h.v, w * 1.8, 60, 0.55)) : fit(h.v + (unitBelow ? '' : h.u), w, max, 0.56);
  const unit = h.u ? (unitBelow ? `<div style="font:600 20px ${SANS};letter-spacing:.9px;text-transform:uppercase;color:${P.mute};margin-top:10px">${esc(h.u.length <= 2 ? { km: 'kilometres', mi: 'miles', h: 'hours', m: 'minutes' }[h.u] || h.u : h.u)}</div>`
    : `<span style="font-size:${Math.max(18, Math.round(size * 0.34))}px;letter-spacing:-.5px;margin-left:${Math.round(size * 0.06)}px">${esc(h.u)}</span>`) : '';
  return `<div style="display:flex;flex-direction:column;align-items:${align}"><div style="font:600 ${size}px/${lh} ${SANS};letter-spacing:${h.word ? -0.03 : -0.045}em;font-variant-numeric:tabular-nums;${h.word ? '' : 'white-space:nowrap'}">${esc(h.v)}${unitBelow ? '' : unit}</div>${unitBelow ? unit : ''}</div>`;
};
const label = (t, P, extra = '') => (t ? `<span style="font:600 18px ${SANS};letter-spacing:.9px;text-transform:uppercase;color:${P.mute};${extra}">${esc(t)}</span>` : '');
// The wordmark, with your first name when it's shown. No link: a picture can't be tapped.
const mark = (M, P) => `<span style="font:600 22px ${SANS};white-space:nowrap">${M.who ? `<span style="font-weight:500;color:${P.mute}">${esc(M.who)} · </span>` : ''}motio.</span>`;
const sentence = (M, P) => (M.line ? `<div style="font:500 23px/1.35 ${SANS};color:${P.ink2}">${esc(M.line)}</div>` : '');
const statsLine = (M, P) => (M.stats.length ? `<div style="font:500 20px/1.45 ${SANS};color:${P.ink2}">${M.stats.slice(0, 3).map((x) => `<b style="font-weight:700;color:${P.fg}">${esc(x.v)}</b> ${esc(cap(x.k).toLowerCase())}`).join(' · ')}</div>` : '');
function chartHTML(c, P, h = 62) {
  if (!c) return '';
  const vals = c.type === 'hourly' ? c.hourly.map((v) => ({ v })) : c.type === 'bars' ? c.bars.map((b) => ({ v: b.pct, color: b.color })) : c.type === 'modes' ? c.modes.map((m) => ({ v: m.pct, color: m.color }))
    : c.type === 'race' ? c.racers.map((r) => ({ v: r.f * 100 })) : c.type === 'traits' ? c.traits.map((t) => ({ v: parseFloat(t.w) || 0 })) : [];
  if (!vals.length) return '';
  const max = Math.max(1, ...vals.map((x) => x.v));
  // The best bar in ink; a mode keeps its colour (that's meaning, not decoration).
  return `<div style="display:flex;gap:${vals.length > 12 ? 3 : 7}px;height:${h}px;align-items:flex-end">${vals.map((x) => `<i style="flex:1;height:${Math.max(6, Math.round(x.v / max * 100))}%;border-radius:${vals.length > 12 ? 3 : 7}px;background:${x.color && c.type !== 'hourly' ? x.color : x.v === max ? P.fg : P.soft}"></i>`).join('')}</div>`;
}
const box = (F, pad) => `position:absolute;left:0;right:0;top:${F.top}px;bottom:${F.bottom}px;padding:${pad};display:flex;flex-direction:column;box-sizing:border-box`;
const routeBox = (M, P, h, color) => (M.routes.length ? `<div style="flex:0 0 ${h}px;position:relative">${routeArt(M.routes, 300, h, { width: 4, glow: false, color, dot: P.bg, fluid: true })}</div>` : '');
const ifs = (v, html) => (v ? html : '');
const num = (M) => (M.hero && M.hero.v ? M.hero.v + (M.hero.u ? ' ' + M.hero.u : '') : '');

// ---------------------------------------------------------------- the five layouts (360 px wide, board 08 × 1.8)
const LAYOUT = {
  // Mono: white, the figure in ink, one sentence, the wordmark.
  mono: (M, P, F) => `<div style="${box(F, '18px 36px 22px')};justify-content:space-between">
    ${label(M.eyebrow || M.lead, P)}
    ${routeBox(M, P, 200, P.fg)}
    <div>${ifs(M.title && !M.hero, `<div style="font:600 46px/1.02 ${SANS};letter-spacing:-1.6px">${br(M.title)}</div>`)}${hero(M.hero, P, { max: 86 })}
      <div style="margin-top:18px;display:flex;flex-direction:column;gap:10px">${sentence(M, P)}${statsLine(M, P)}</div>
      ${ifs(M.chart, `<div style="margin-top:24px">${chartHTML(M.chart, P, 56)}</div>`)}</div>
    ${mark(M, P)}</div>`,

  // Glow: centred, one lit number with its unit spelled out below.
  glow: (M, P, F) => `<div style="${box(F, '18px 36px 22px')};align-items:center;justify-content:space-between;text-align:center">
    ${label(M.eyebrow || M.lead, P)}
    <div style="display:flex;flex-direction:column;align-items:center;gap:18px">${ifs(M.title && !M.hero, `<div style="font:600 44px/1.04 ${SANS};letter-spacing:-1.5px">${br(M.title)}</div>`)}${hero(M.hero, P, { max: 97, align: 'center', unitBelow: true })}
      ${ifs(M.line, `<div style="font:500 20px/1.4 ${SANS};color:${P.mute};max-width:270px">${esc(M.line)}</div>`)}${statsLine(M, P)}</div>
    ${mark(M, P)}</div>`,

  // Poster: black, the figure huge across two lines, place and dates at the foot.
  poster: (M, P, F) => {
    const h = M.hero && M.hero.v && !M.hero.word ? (M.hero.u ? { v: M.hero.v, u: M.hero.u } : M.hero) : null;
    const parts = h ? (/^(\d+h) (\d+m)$/.exec(h.v) || null) : null;
    const big = parts ? `<div style="font:600 126px/.88 ${SANS};letter-spacing:-7px;font-variant-numeric:tabular-nums">${esc(parts[1])}<br>${esc(parts[2])}</div>`
      : h ? `<div style="font:600 ${fit(h.v, 300, 126, 0.56)}px/.88 ${SANS};letter-spacing:-6px;font-variant-numeric:tabular-nums;white-space:nowrap">${esc(h.v)}</div>${ifs(h.u, `<div style="font:600 34px ${SANS};letter-spacing:-1px;margin-top:10px">${esc(h.u)}</div>`)}`
        : `<div style="font:600 58px/.95 ${SANS};letter-spacing:-2.5px">${br(M.title || (M.hero && M.hero.v) || M.lead)}</div>`;
    return `<div style="${box(F, '18px 36px 22px')};justify-content:space-between">
    ${label(M.eyebrow || M.lead, P)}
    <div>${big}${ifs(M.line, `<div style="font:500 22px/1.35 ${SANS};color:${P.ink2};margin-top:20px">${esc(M.line)}</div>`)}
      ${ifs(M.chart, `<div style="margin-top:28px">${chartHTML(M.chart, P, 62)}</div>`)}${ifs(!M.chart && M.stats.length, `<div style="margin-top:20px">${statsLine(M, P)}</div>`)}</div>
    <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px"><span style="font:500 21px/1.3 ${SANS};color:${P.ink2}">${esc(M.lead && M.eyebrow ? M.lead : 'Baku')}${ifs(M.foot, '<br>' + esc(M.foot))}</span>${mark(M, P)}</div></div>`;
  },

  // Ticket: a white ride ticket on grey, a dashed tear line, three stubs.
  ticket: (M, P, F) => {
    const stubs = [...(num(M) ? [{ k: M.lead || 'Covered', v: num(M) }] : []), ...M.stats].slice(0, 3);
    return `<div style="${box(F, '18px 29px 22px')};justify-content:center;gap:22px">
    <div style="border-radius:32px;background:#FFFFFF;color:#0F0F0F;overflow:hidden;box-shadow:0 18px 40px rgba(0,0,0,0.08)">
      <div style="padding:29px;display:flex;flex-direction:column;gap:7px">
        <span style="font:600 16px ${SANS};letter-spacing:.9px;text-transform:uppercase;color:#6E6E6A">${esc(M.eyebrow || 'Motio')} · Admit one</span>
        <b style="font:700 31px/1.15 ${SANS};letter-spacing:-.7px">${br(M.title || M.line || M.lead || 'My moves')}</b>
        ${ifs(M.title && M.line, `<span style="font:500 20px/1.35 ${SANS};color:#6E6E6A">${esc(M.line)}</span>`)}
      </div>
      ${ifs(M.routes.length, `<div style="position:relative;height:150px;margin:0 29px 22px;border-radius:18px;background:#F5F5F3"><div style="position:absolute;inset:12px">${routeArt(M.routes, 240, 126, { width: 3.5, glow: false, fluid: true, dot: '#FFFFFF' })}</div></div>`)}
      <div style="border-top:3.5px dashed #E1E1DE;margin:0 18px"></div>
      <div style="padding:25px 29px;display:flex;justify-content:space-between;gap:12px">${stubs.map((x) => `<div style="min-width:0"><div style="font:600 16px ${SANS};letter-spacing:.6px;text-transform:uppercase;color:#6E6E6A">${esc(cap(x.k))}</div><b style="display:block;font:700 ${fit(x.v, 90, 26, 0.58)}px/1.3 ${SANS};white-space:nowrap">${esc(x.v)}</b></div>`).join('')}</div>
    </div>
    <div style="text-align:center;color:${P.fg}">${mark(M, P)}</div></div>`;
  },

  // Editorial: The Motio Daily. A headline made from the numbers, a rule, one paragraph.
  editorial: (M, P, F) => {
    const head = M.title ? M.title.replace(/\n/g, ' ') : [M.who || 'Local mover', M.lead ? M.lead.toLowerCase() : 'moves', num(M) || (M.hero && M.hero.v) || ''].filter(Boolean).join(' ').replace(/\s+/g, ' ') + '.';
    const body = [M.line, M.sub, M.stats.length ? 'Also reported: ' + M.stats.slice(0, 3).map((x) => x.v + ' ' + cap(x.k).toLowerCase()).join(', ') + '.' : '', M.foot].filter(Boolean).join(' ');
    return `<div style="${box(F, '18px 36px 22px')};gap:25px">
    ${label('The Motio Daily' + (M.eyebrow ? ' · ' + M.eyebrow : ''), P)}
    <div style="font:600 ${head.length > 60 ? 40 : 47}px/1.05 ${SANS};letter-spacing:-1.8px">${esc(head)}</div>
    <div style="height:2px;background:${P.fg}"></div>
    ${ifs(body, `<div style="font:500 22px/1.45 ${SANS};color:${P.ink2}">${esc(body)}</div>`)}
    ${ifs(M.routes.length, `<div style="flex:1 1 0;min-height:80px;position:relative">${routeArt(M.routes, 288, 200, { width: 3, glow: false, color: P.fg, dot: P.bg, fluid: true })}</div>`)}
    ${ifs(M.chart && !M.routes.length, chartHTML(M.chart, P, 56))}
    <div style="margin-top:auto">${mark(M, P)}</div></div>`;
  }
};

// ---------------------------------------------------------------- the look: saved choices, recap style
const LOOK = 'motio.shareLook';
// Styles before 5.0 map to the closest of the five.
const OLD = { bold: 'poster', playful: 'glow', gradient: 'glow', map: 'glow', night: 'glow', numbers: 'poster', film: 'poster', minimal: 'mono' };
export function loadLook() { let l = {}; try { l = JSON.parse(window.localStorage.getItem(LOOK)) || {}; } catch { /* storage blocked */ } if (l.theme && !THEMES[l.theme]) l.theme = OLD[l.theme] || null; return l; }
export function saveLook(l) { try { window.localStorage.setItem(LOOK, JSON.stringify({ theme: l.theme, square: !!l.square, showName: l.showName !== false, showMap: l.showMap !== false, hide: l.hide || [] })); } catch { /* storage blocked */ } }
// Settings › Recap style: a theme id, or 'mix' (each story its own theme).
export function recapStyle() { let s = null; try { s = window.localStorage.getItem('motio.recapStyle'); } catch { /* storage blocked */ } s = OLD[s] || s; return THEMES[s] ? s : 'mix'; }
export const pickTheme = (t, i = Math.floor(Math.random() * IDS.length)) => (THEMES[t] ? t : THEMES[OLD[t]] ? OLD[t] : IDS[((i % IDS.length) + IDS.length) % IDS.length]);
const who = () => { try { const u = window.Motio && window.Motio.auth.user(); return u && u.name ? u.name.split(' ')[0] : ''; } catch { return ''; } };

// The card's markup. o: theme, photo (data URL), showName, showMap, hide (stat labels / 'chart'),
// h (height in card px, default 640), inApp (no wordmark or credit; room for the recap's own bars and buttons).
export function storyHTML(kind, data, o = {}) {
  const id = pickTheme(o.theme);
  const P = palette(id, o);
  const M = content(kind, data || {});
  const hide = new Set(o.hide || []);
  M.stats = M.stats.filter((s) => !hide.has(s.k));
  if (hide.has('chart')) M.chart = null;
  if (o.showMap === false) M.routes = [];
  M.who = o.showName === false ? '' : o.name ?? who();
  if (o.inApp || hide.has('date')) M.eyebrow = ''; // the recap's own chip already says which period this is
  M.link = ''; // a picture can't be tapped, so no link is printed on it
  const H = o.h || 640;
  // Shared images keep clear of Instagram's own bars (name row at the top, reply bar at the bottom).
  // A 1:1 post has no Instagram bars to keep clear of.
  const F = { W: 360, H, top: o.inApp ? 74 : H < 640 ? 0 : 64, bottom: o.inApp ? 78 : H < 640 ? 0 : 64, chrome: !o.inApp };
  return `<div style="width:360px;height:${H}px;position:relative;overflow:hidden;box-sizing:border-box;background:${backdrop(P)};color:${P.fg};font-family:${SANS};text-align:left;-webkit-font-smoothing:antialiased">${LAYOUT[id](M, P, F)}</div>`;
}
// Colours for app chrome laid over a card (recap bars, chips, buttons), as rgba() so the dark-mode
// palette swap in dc-runtime (which rewrites hex colours) leaves them alone.
export function storyChrome(o = {}) {
  const P = palette(pickTheme(o.theme), o), c = (hex, a = 1) => `rgba(${rgb(hex).join(',')},${a})`;
  return { fg: c(P.fg), bg: c(P.veiled ? '#111111' : P.bg), chip: c(P.fg, 0.12), on: c(P.fg), off: c(P.fg, 0.28) };
}
// Recap slides: the theme from Settings › Recap style ('mix' deals each slide its own), the rest of the saved look.
export function slideLook(i, seed = 0) {
  const s = recapStyle();
  return { ...loadLook(), photo: null, theme: s === 'mix' ? IDS[(seed + i) % IDS.length] : s };
}
// Paints a card into `el` so it fills el's parent: 360 card px across, as tall as the parent is.
export function paintStory(el, kind, data, o = {}) {
  const box = el.parentElement, w = box.clientWidth || 390, k = w / 360;
  const html = storyHTML(kind, data, { ...o, inApp: true, h: Math.round((box.clientHeight || 844) / k) });
  if (el.__card !== html) { el.innerHTML = html; el.__card = html; }
  el.style.transform = `scale(${k})`;
}

let fontCSS = null;
// The 1080×1920 PNG. Without a theme in `o`, the saved look (or the recap style) decides.
export async function renderStory(kind, data, o = {}) {
  const look = loadLook();
  const opts = { ...look, theme: look.theme || recapStyle(), ...o };
  const H = opts.square ? 360 : 640; // Story 9:16 (1080×1920) or Post 1:1 (1080×1080)
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:360px;height:' + H + 'px;pointer-events:none';
  host.innerHTML = storyHTML(kind, data, { ...opts, h: H });
  document.body.appendChild(host);
  try {
    try { await document.fonts.load("600 40px 'Inter Tight'"); await document.fonts.load("500 14px 'Inter Tight'"); } catch { /* system font is fine */ }
    const imgs = Array.from(host.querySelectorAll('img'));
    await Promise.all(imgs.map((i) => (i.complete ? null : new Promise((ok) => { i.onload = i.onerror = ok; }))));
    const node = host.firstElementChild;
    if (fontCSS == null) fontCSS = await getFontEmbedCSS(document.body).catch(() => '');
    const c = await toCanvas(node, { width: 360, height: H, pixelRatio: 3, fontEmbedCSS: fontCSS });
    return c.toDataURL('image/png');
  } finally { host.remove(); }
}
export const STORY_KINDS = ['today', 'cover', 'distance', 'time', 'highlights', 'wrap', 'persona', 'challenge', 'trip'];
// Screens only see window.Motio, whose storyImage is renderStory: the style kit rides along on it.
// shortcut: until motio.js exports these itself (Motio.storyKit), screens reach them as Motio.storyImage.kit.
renderStory.kit = { THEMES, storyHTML, storyChrome, storyParts, slideLook, paintStory, loadLook, saveLook, recapStyle, pickTheme };
