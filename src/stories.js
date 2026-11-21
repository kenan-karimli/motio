// Share images and recap slides: one style system. Every card is laid out in HTML at 360 px wide; share images
// are 360×640 rendered ×3 (1080×1920), recap slides use the same markup at the phone's height.
// A card = kind (what is shared) + data (the screen's numbers) + look (theme, colour, what shows, photo).
import { toCanvas, getFontEmbedCSS } from 'html-to-image';

const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const br = (s) => esc(s).replace(/\n/g, '<br>');
// Data labels arrive in caps ("MOST STEPS IN A DAY"); cards set them in sentence case.
const cap = (s) => { s = String(s ?? ''); if (/^[^a-z]+$/.test(s)) s = s.toLowerCase().replace(/\bpr\b/g, 'PR'); return s.charAt(0).toUpperCase() + s.slice(1); };
const SANS = 'Poppins, system-ui, sans-serif';
// The one face besides Poppins: the phone's own serif (Noto Serif on Android), so it needs no embedding.
const SERIF = "'Noto Serif', Georgia, 'Times New Roman', serif";

const rgb = (hex) => { let h = hex.replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const lum = (hex) => { const [r, g, b] = rgb(hex).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const alpha = (hex, a) => `rgba(${rgb(hex).join(',')},${a})`;

export const THEMES = {
  glow: { name: 'Glow', hint: 'Your routes at night', bg: '#0C0B1C', fg: '#FFFFFF', accent: '#F6C343', multi: true },
  poster: { name: 'Poster', hint: 'Loud and purple', bg: '#4B3FD8', fg: '#FFFFFF', accent: '#F6C343', multi: true },
  ticket: { name: 'Ticket', hint: 'A travel ticket', bg: '#F6C343', fg: '#1F1D47', accent: '#1F1D47', multi: true },
  editorial: { name: 'Editorial', hint: 'A magazine cover', bg: '#E8E9EC', fg: '#121419', accent: '#2B44D6' },
  mono: { name: 'Mono', hint: 'Black and white', bg: '#000000', fg: '#FFFFFF', accent: '#FFFFFF' },
  gradient: { name: 'Gradient', hint: 'Dusk light', bg: '#1A1240', fg: '#FFFFFF', accent: '#FF8A5B', multi: true },
  map: { name: 'Map', hint: 'Your routes, large', bg: '#0E1A1B', fg: '#E6F0EC', accent: '#5CE1B9' },
  numbers: { name: 'Big numbers', hint: 'The figure, huge', bg: '#F6C343', fg: '#111111', accent: '#F6C343' },
  film: { name: 'Film', hint: 'One frame', bg: '#15130F', fg: '#F1ECE2', accent: '#E8A33D' },
  minimal: { name: 'Minimal', hint: 'Light and quiet', bg: '#F5F5F3', fg: '#1A1A1A', accent: '#E5484D' },
  night: { name: 'Night', hint: 'Light trails', bg: '#060A17', fg: '#EAF0FF', accent: '#8FB4FF' }
};
const IDS = Object.keys(THEMES);
export const ACCENTS = ['#F6C343', '#FF8A5B', '#E5484D', '#F06595', '#8B7CF6', '#4C6FFF', '#5CE1B9', '#3DBF5C', '#FFFFFF'];

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
  const t = THEMES[id];
  const accent = o.accent || t.accent;
  const photo = o.photo || null, veiled = !!photo && id !== 'film';
  let bg = t.bg, fg = t.fg;
  if (id === 'numbers') { bg = accent; fg = lum(accent) > 0.3 ? '#111111' : '#FFFFFF'; }
  if (veiled) fg = '#FFFFFF';
  const under = veiled ? '#5A5A5A' : bg; // a photo under a veil reads as mid grey
  // The accent marks things where it reads against the background; otherwise the ink does.
  const mark = contrast(accent, under) >= 1.7 ? accent : fg;
  return { id, t, bg, fg, accent, mark, photo, veiled, multi: !!t.multi, mute: alpha(fg, 0.64), soft: alpha(fg, 0.24), line: alpha(fg, 0.18) };
}
const veil = 'linear-gradient(180deg, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.08) 32%, rgba(0,0,0,0.25) 55%, rgba(0,0,0,0.82) 100%)';
const BACK = {
  glow: (P) => `radial-gradient(80% 55% at 50% 36%, rgba(91,79,224,0.34) 0%, rgba(91,79,224,0) 70%), linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px) 0 0/26px 26px, linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px) 0 0/26px 26px, ${P.bg}`,
  poster: (P) => `radial-gradient(90% 50% at 100% 0%, #8C7CF0 0%, rgba(140,124,240,0) 60%), radial-gradient(80% 45% at 0% 100%, #F2766B 0%, rgba(242,118,107,0) 62%), ${P.bg}`,
  ticket: (P) => `linear-gradient(160deg, ${P.bg} 0%, #F2766B 100%)`,
  editorial: (P) => P.bg,
  mono: (P) => P.bg,
  gradient: (P) => `radial-gradient(110% 60% at 90% 0%, ${alpha(P.accent, 0.95)} 0%, ${alpha(P.accent, 0)} 62%), radial-gradient(90% 55% at 0% 100%, rgba(66,72,255,0.75) 0%, rgba(66,72,255,0) 68%), linear-gradient(170deg, #2A1255 0%, #170F3B 55%, #0C0A26 100%)`,
  map: (P) => `radial-gradient(120% 80% at 50% 40%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.45) 100%), linear-gradient(${P.line} 1px, transparent 1px) 0 0/30px 30px, linear-gradient(90deg, ${P.line} 1px, transparent 1px) 0 0/30px 30px, ${P.bg}`,
  numbers: (P) => P.bg,
  film: (P) => P.bg,
  minimal: (P) => P.bg,
  night: (P) => `radial-gradient(90% 45% at 50% 0%, ${alpha(P.accent, 0.26)} 0%, ${alpha(P.accent, 0)} 70%), linear-gradient(180deg, #060A17 0%, #0A1230 100%)`
};
const backdrop = (P) => (P.veiled ? `${veil}, url(${P.photo}) center/cover no-repeat, #111` : BACK[P.id](P));

// ---------------------------------------------------------------- shared pieces, styled per theme
const fit = (s, w, max, k = 0.6) => Math.max(14, Math.min(max, Math.floor(w / Math.max(1, String(s).length * k))));
function heroHTML(h, P, { w = 308, max = 120, font = SANS, weight = 700, track = -0.045, k = 0.6, unit = 0.28, color = P.fg, glow = '', lh = 0.9, align = 'flex-start' } = {}) {
  if (!h || !h.v) return '';
  if (h.word) {
    const longest = Math.max(...h.v.split(/\s+/).map((x) => x.length));
    const size = Math.max(20, Math.min(Math.round(max * 0.46), Math.floor(w / (longest * k * 1.15)), Math.floor((w * 2.2) / (h.v.length * k))));
    return `<div style="font-family:${font};font-size:${size}px;font-weight:${weight};line-height:1.02;letter-spacing:${track / 2}em;color:${color};${glow}">${esc(h.v)}</div>`;
  }
  const size = fit(h.v + (h.u ? 'x'.repeat(Math.ceil(h.u.length * unit * 1.2)) : ''), w, max, k);
  return `<div style="display:flex;align-items:baseline;justify-content:${align};gap:${Math.round(size * 0.07)}px;font-family:${font};line-height:${lh};color:${color};white-space:nowrap">
    <span style="font-size:${size}px;font-weight:${weight};letter-spacing:${track}em;${glow}">${esc(h.v)}</span>${h.u ? `<span style="font-size:${Math.max(15, Math.round(size * unit))}px;font-weight:600;letter-spacing:0">${esc(h.u)}</span>` : ''}</div>`;
}
const barColor = (P, item, top) => (P.multi && item.color ? item.color : top ? P.mark : alpha(P.fg, 0.42));
function chartHTML(c, P, { h = 84, round = 3, size = 11 } = {}) {
  if (!c) return '';
  if (c.type === 'hourly') {
    const max = Math.max(1, ...c.hourly);
    return `<div style="display:flex;align-items:flex-end;gap:2px;height:${h}px">${c.hourly.map((v) => `<span style="flex:1;height:${Math.max(2, Math.round((v / max) * h))}px;border-radius:${round}px ${round}px 0 0;background:${v === max && v ? P.mark : P.soft}"></span>`).join('')}</div>
      <div style="display:flex;justify-content:space-between;font-size:9px;font-weight:500;color:${P.mute};margin-top:6px;font-variant-numeric:tabular-nums"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>`;
  }
  if (c.type === 'bars') {
    const max = Math.max(1, ...c.bars.map((b) => b.pct));
    return `<div style="display:flex;flex-direction:column;gap:9px">${c.bars.slice(0, 5).map((b, i) => `<div>
      <div style="display:flex;justify-content:space-between;font-size:${size}px;font-weight:500;margin-bottom:4px"><span>${esc(b.label)}</span><span style="color:${P.mute};font-variant-numeric:tabular-nums">${esc(b.value)}</span></div>
      <div style="height:5px;border-radius:${round}px;background:${P.line}"><div style="width:${Math.max(2, (b.pct / max) * 100)}%;height:5px;border-radius:${round}px;background:${barColor(P, b, i === 0)}"></div></div></div>`).join('')}</div>`;
  }
  if (c.type === 'modes') {
    const ms = c.modes.slice().sort((a, b) => b.pct - a.pct);
    const tint = (m, i) => (P.multi ? m.color : i === 0 ? P.mark : alpha(P.fg, Math.max(0.18, 0.62 - i * 0.14)));
    return `<div style="display:flex;height:6px;gap:3px">${ms.map((m, i) => `<span style="flex:${Math.max(2, m.pct)};border-radius:${round}px;background:${tint(m, i)}"></span>`).join('')}</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:8px;font-size:${size - 0.5}px;font-weight:500">${ms.map((m, i) => `<span style="display:flex;align-items:center;gap:6px"><span style="width:7px;height:7px;border-radius:4px;background:${tint(m, i)}"></span>${esc(m.label)} <span style="color:${P.mute}">${m.pct}%</span></span>`).join('')}</div>`;
  }
  if (c.type === 'traits') {
    return `<div style="display:flex;flex-direction:column;gap:10px">${c.traits.map((t) => `<div>
      <div style="display:flex;justify-content:space-between;font-size:${size - 1}px;font-weight:500;margin-bottom:5px;color:${P.mute}"><span>${esc(t.left)}</span><span style="color:${P.fg}">${esc(t.name)}</span><span>${esc(t.right)}</span></div>
      <div style="position:relative;height:3px;background:${P.line}"><span style="position:absolute;left:${esc(t.w)};top:-4px;width:11px;height:11px;margin-left:-5px;border-radius:6px;background:${P.mark}"></span></div></div>`).join('')}</div>`;
  }
  if (c.type === 'race') {
    return `<div style="display:flex;flex-direction:column;gap:10px">${c.racers.slice(0, 5).map((r, i) => `<div style="display:flex;align-items:center;gap:10px">
      <span style="width:12px;font-size:12px;font-weight:600;color:${i ? P.mute : P.mark};font-variant-numeric:tabular-nums">${i + 1}</span>
      ${r.photo ? `<img src="${r.photo}" style="width:28px;height:28px;border-radius:14px;object-fit:cover">` : `<span style="width:28px;height:28px;border-radius:14px;background:${P.line};display:flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:600">${esc(r.ini)}</span>`}
      <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:5px"><span style="display:flex;justify-content:space-between;font-size:12.5px;font-weight:500"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.name)}</span><span style="color:${P.mute};font-variant-numeric:tabular-nums">${esc(r.value)}</span></span>
        <span style="height:3px;background:${P.line}"><span style="display:block;height:3px;width:${Math.max(3, r.f * 100).toFixed(0)}%;background:${i ? alpha(P.fg, 0.55) : P.mark}"></span></span></span></div>`).join('')}</div>`;
  }
  return '';
}
// Stats as a table (label left, value right) or as cells (value over label).
const rows = (stats, P, { vf = `600 15px ${SANS}`, rule = true, pad = 9 } = {}) => stats.map((s) => `
  <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:${pad}px 0;${rule ? `border-top:1px solid ${P.line}` : ''}">
    <span style="font:500 11.5px/1.3 ${SANS};color:${P.mute}">${esc(cap(s.k))}${s.s ? `<br><span style="font-size:10px;opacity:.85">${esc(s.s)}</span>` : ''}</span>
    <span style="font:${vf};white-space:nowrap;font-variant-numeric:tabular-nums">${esc(s.v)}</span></div>`).join('');
const cells = (stats, P, { cols = 0, vs = 19, vw = 700, gap = '16px 12px', cell = () => '' } = {}) => {
  const n = cols || Math.min(3, stats.length), cw = 300 / n - 24;
  return `<div style="display:grid;grid-template-columns:repeat(${n},minmax(0,1fr));gap:${gap}">${stats.map((s, i) => `
    <div style="min-width:0;${cell(i)}"><div style="font:${vw} ${Math.min(vs, fit(s.v, cw, vs, 0.58))}px/1.15 ${SANS};white-space:nowrap;font-variant-numeric:tabular-nums">${esc(s.v)}</div>
    <div style="font:500 10.5px/1.35 ${SANS};color:${P.mute};margin-top:3px">${esc(cap(s.k))}${s.s ? `<br>${esc(s.s)}` : ''}</div></div>`).join('')}</div>`;
};
const logo = (P, size = 14, color = P.fg, stroke = P.mark) => `<div style="display:flex;align-items:center;gap:6px;font:600 ${size}px/1 ${SANS};color:${color}">
  <svg width="${size + 4}" height="${size + 4}" viewBox="0 0 30 30"><path d="M3 22c5 0 5-14 12-14s5 14 12 14" fill="none" stroke="${stroke}" stroke-width="4.5" stroke-linecap="round"/></svg>motio</div>`;
const byline = (M) => (M.who ? esc(M.who) + ' on Motio' : 'Tracked with Motio');
const box = (F, pad) => `position:absolute;left:0;right:0;top:${F.top}px;bottom:${F.bottom}px;padding:${pad};display:flex;flex-direction:column;box-sizing:border-box`;
// The flexible middle of a card: the route if there is one, else empty space that pushes the rest down.
const figure = (M, P, o = {}) => (M.routes.length
  ? `<div style="flex:1 1 0;min-height:${o.min ?? 70}px;position:relative;margin:${o.m || '14px 0'}">${routeArt(M.routes, o.w || 308, o.h || 260, { width: o.lw || 4, glow: !!o.glow, trail: !!o.trail, color: P.multi && !o.color ? null : o.color || P.mark, dot: o.dot || '#FFFFFF', fluid: true })}</div>`
  : M.chart && !o.noChart ? (M.chartTop = true, `<div style="flex:1 1 0;min-height:0;align-self:stretch;text-align:left;display:flex;flex-direction:column;justify-content:center;margin:${o.m || '14px 0'}">${chartHTML(M.chart, P, { h: 150, round: o.round ?? 3 })}</div>`)
    : `<div style="flex:1 1 0;min-height:${o.empty ?? 12}px"></div>`);
const ifs = (v, html) => (v ? html : '');

// ---------------------------------------------------------------- the eight layouts
// "Open in Motio": the link people add as a sticker in their story points to motio-api.onrender.com.
const openPill = (bg, fg, dot, dotFg) => `<span style="display:inline-flex;align-items:center;gap:8px;height:32px;padding:0 13px 0 5px;border-radius:16px;background:${bg};color:${fg};font:600 11.5px ${SANS}"><span style="width:22px;height:22px;border-radius:11px;background:${dot};display:flex;align-items:center;justify-content:center"><svg width="11" height="11" viewBox="0 0 24 24"><path d="M7 17L17 7M9 7h8v8" fill="none" stroke="${dotFg}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></span>Open in Motio</span>`;
// The three 4.2 styles keep Instagram's own bars (top and bottom ~74 card px) clear of anything that matters.
const SAFE = (F) => (F.chrome ? '88px 24px 88px' : '8px 24px 14px');
const LAYOUT = {
  glow: (M, P, F) => `<div style="${box(F, SAFE(F))}">
    <div style="display:flex;justify-content:space-between;align-items:center">${F.chrome ? logo(P, 14) : '<span></span>'}<span style="font:500 11px ${SANS};color:${P.mute}">${esc(M.eyebrow)}</span></div>
    ${figure(M, P, { lw: 4, glow: true, dot: '#FFFFFF', m: '16px -8px' })}
    ${ifs(M.title && !M.routes.length, `<div style="font:700 30px/1.05 ${SANS};letter-spacing:-0.03em;margin-bottom:12px">${br(M.title)}</div>`)}
    ${ifs(M.lead || M.who, `<div style="font:500 12.5px ${SANS};color:${P.mute}">${esc(M.lead || (M.who + ' moved'))}</div>`)}
    ${heroHTML(M.hero, P, { w: 300, max: 96, unit: 0.3 }).replace(/(<span style="font-size:\d+px;font-weight:600;letter-spacing:0)/, '$1;color:' + P.accent)}
    ${ifs(M.line, `<div style="font:400 12px/1.5 ${SANS};color:${P.mute};margin-top:8px">${esc(M.line)}</div>`)}
    ${ifs(M.stats.length, `<div style="margin-top:16px">${cells(M.stats.slice(0, 3), P, { vs: 17, vw: 700, gap: '0', cell: (i) => (i ? `padding-left:12px;border-left:1px solid ${P.line}` : '') })}</div>`)}
    ${ifs(F.chrome, `<div style="margin-top:16px">${openPill('rgba(255,255,255,0.12)', '#FFFFFF', P.accent, '#1F1D47')}</div>`)}
  </div>`,

  poster: (M, P, F) => `<div style="${box(F, SAFE(F))}">
    <div style="display:flex;justify-content:space-between;align-items:center">${F.chrome ? logo(P, 14) : '<span></span>'}${ifs(M.eyebrow, `<span style="padding:5px 11px;border-radius:12px;background:rgba(255,255,255,0.16);font:600 11px ${SANS}">${esc(M.eyebrow)}</span>`)}</div>
    ${ifs(M.title || M.lead, `<div style="font:700 ${M.title ? 40 : 22}px/1 ${SANS};letter-spacing:-0.04em;margin-top:22px">${br(M.title || M.lead)}</div>`)}
    <div style="position:relative;flex:1 1 0;min-height:60px">${M.routes.length ? `<div style="position:absolute;right:-14px;top:6px;width:170px;height:130px">${routeArt(M.routes, 170, 130, { width: 3.5, glow: false, color: null, fluid: true })}</div>` : ''}</div>
    ${heroHTML(M.hero, P, { w: 320, max: 168, track: -0.06, color: P.accent, lh: 0.82 })}
    ${ifs(M.line, `<div style="font:600 13px/1.45 ${SANS};margin-top:10px">${esc(M.line)}</div>`)}
    ${ifs(M.chart, `<div style="margin-top:16px">${chartHTML(M.chart, P, { h: 60, round: 4 })}</div>`)}
    ${ifs(!M.chart && M.stats.length, `<div style="margin-top:16px">${cells(M.stats.slice(0, 3), P, { vs: 18 })}</div>`)}
    ${ifs(F.chrome, `<div style="margin-top:16px">${openPill('#FFFFFF', '#1F1D47', '#1F1D47', '#F6C343')}</div>`)}
  </div>`,

  ticket: (M, P, F) => {
    const st = [...(M.hero && M.hero.v ? [{ k: M.lead || 'Covered', v: M.hero.v + (M.hero.u ? ' ' + M.hero.u : '') }] : []), ...M.stats].slice(0, 4);
    return `<div style="${box(F, F.chrome ? '88px 22px 88px' : '8px 22px 14px')}">
    <div style="flex:1;display:flex;flex-direction:column;border-radius:22px;background:#FFFDF7;color:#1F1D47;overflow:hidden;box-shadow:0 18px 40px rgba(120,40,20,0.25)">
      <div style="padding:16px 18px 14px;background:#1F1D47;color:#FFFFFF;display:flex;justify-content:space-between;align-items:flex-end;gap:10px">
        <div style="min-width:0"><div style="font:500 10px ${SANS};color:#C9C5EC">Motio · ${esc(M.eyebrow || 'ticket')}</div><div style="font:700 19px/1.15 ${SANS};letter-spacing:-0.02em;margin-top:2px">${br(M.title || M.lead || 'My moves')}</div></div>
        ${ifs(M.who, `<div style="text-align:right;flex-shrink:0"><div style="font:500 10px ${SANS};color:#C9C5EC">Passenger</div><div style="font:700 14px ${SANS}">${esc(M.who)}</div></div>`)}
      </div>
      <div style="position:relative;flex:1 1 0;min-height:110px;margin:14px 14px 0;border-radius:14px;background:#F3F2FA;overflow:hidden">${M.routes.length ? `<div style="position:absolute;inset:12px">${routeArt(M.routes, 280, 200, { width: 3.5, glow: false, color: null, fluid: true })}</div>` : ''}</div>
      <div style="position:relative;height:0;margin:16px 0;border-top:2px dashed #E3E1F3"><span style="position:absolute;left:-12px;top:-13px;width:24px;height:24px;border-radius:12px;background:#F4A15A"></span><span style="position:absolute;right:-12px;top:-13px;width:24px;height:24px;border-radius:12px;background:#F4A15A"></span></div>
      <div style="padding:0 18px;display:grid;grid-template-columns:1fr 1fr;gap:12px 10px">${st.map((x) => `<div style="min-width:0"><div style="font:500 10.5px ${SANS};color:#6B6890">${esc(cap(x.k))}</div><div style="font:700 ${fit(x.v, 130, 18, 0.58)}px/1.2 ${SANS};white-space:nowrap">${esc(x.v)}</div></div>`).join('')}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px 16px">
        <div style="display:flex;gap:2px;height:28px">${Array.from({ length: 22 }, (_, i) => `<span style="width:${i % 3 ? 2 : 4}px;background:#1F1D47"></span>`).join('')}</div>
        ${F.chrome ? openPill('#1F1D47', '#FFFFFF', '#F6C343', '#1F1D47') : ''}
      </div>
    </div>
  </div>`;
  },
  // Editorial: a masthead, a serif headline and numeral, stats set as a table.
  editorial: (M, P, F) => `<div style="${box(F, F.chrome ? '20px 24px 20px' : '6px 24px 12px')}">
    ${F.chrome ? `<div style="display:flex;align-items:flex-end;justify-content:space-between;gap:12px;border-bottom:2px solid ${P.fg};padding-bottom:9px">
      <span style="font:700 42px/0.82 ${SERIF};letter-spacing:-0.03em">Motio</span>
      <span style="font:500 10px/1.35 ${SANS};text-align:right;color:${P.mute};max-width:160px">${esc(M.eyebrow)}</span></div>`
      : `<div style="font:500 11px/1.3 ${SANS};color:${P.mute};border-bottom:2px solid ${P.fg};padding-bottom:9px">${esc(M.eyebrow)}</div>`}
    ${ifs(M.title, `<div style="font:400 36px/1.04 ${SERIF};letter-spacing:-0.02em;margin-top:18px">${br(M.title)}</div>`)}
    ${figure(M, P, { lw: 3, color: P.mark, dot: P.bg })}
    ${ifs(M.lead, `<div style="font:500 12px/1.3 ${SANS};color:${P.mute};margin-bottom:6px">${esc(M.lead)}</div>`)}
    ${heroHTML(M.hero, P, { font: SERIF, weight: 400, max: 128, k: 0.58, track: -0.04, unit: 0.24 })}
    ${ifs(M.line, `<div style="font:italic 400 15px/1.45 ${SERIF};margin-top:10px">${esc(M.line)}</div>`)}
    ${ifs(M.sub, `<div style="font:400 12px/1.5 ${SANS};color:${P.mute};margin-top:6px">${esc(M.sub)}</div>`)}
    ${ifs(M.chart && !M.chartTop, `<div style="margin-top:16px;padding-top:12px;border-top:1px solid ${P.line}">${chartHTML(M.chart, P, { h: 70, round: 0 })}</div>`)}
    ${ifs(M.stats.length, `<div style="margin-top:14px">${rows(M.stats, P, { vf: `400 17px ${SERIF}` })}</div>`)}
    ${ifs(M.foot, `<div style="font:italic 400 13px/1.4 ${SERIF};margin-top:10px">${esc(M.foot)}</div>`)}
    ${ifs(F.chrome, `<div style="display:flex;justify-content:space-between;font:500 9.5px ${SANS};color:${P.mute};border-top:2px solid ${P.fg};padding-top:8px;margin-top:14px"><span>${byline(M)}</span><span>motio.app</span></div>`)}
  </div>`,

  // Mono: black and white, a Swiss grid, heavy figures; one colour, rules above each stat.
  mono: (M, P, F) => `<div style="${box(F, F.chrome ? '26px 26px 22px' : '8px 26px 14px')}">
    ${ifs(F.chrome, `<div style="display:flex;justify-content:space-between;align-items:center">${logo(P, 14, P.fg, P.fg)}<span style="font:500 10px ${SANS};color:${P.mute}">${esc(M.eyebrow)}</span></div>`)}
    ${ifs(!F.chrome, `<div style="font:500 11px ${SANS};color:${P.mute}">${esc(M.eyebrow)}</div>`)}
    ${ifs(M.title, `<div style="font:700 40px/0.98 ${SANS};letter-spacing:-0.045em;margin-top:28px">${br(M.title)}</div>`)}
    ${figure(M, P, { lw: 2.5, color: P.mark, dot: P.bg, m: '20px 0' })}
    ${ifs(M.lead, `<div style="font:500 13px ${SANS};margin-bottom:4px">${esc(M.lead)}</div>`)}
    ${heroHTML(M.hero, P, { max: 132, weight: 700, track: -0.065, k: 0.6, lh: 0.86 })}
    ${ifs(M.line, `<div style="font:400 12.5px/1.5 ${SANS};color:${P.mute};margin-top:12px;max-width:290px">${esc(M.line)}</div>`)}
    ${ifs(M.sub, `<div style="font:400 11.5px/1.5 ${SANS};color:${P.mute};margin-top:6px">${esc(M.sub)}</div>`)}
    ${ifs(M.chart && !M.chartTop, `<div style="margin-top:18px">${chartHTML(M.chart, P, { h: 72, round: 0 })}</div>`)}
    ${ifs(M.stats.length, `<div style="margin-top:20px">${cells(M.stats, P, { cols: M.stats.length === 4 ? 2 : 0, vs: 18, cell: () => `border-top:2px solid ${P.fg};padding-top:8px` })}</div>`)}
    ${ifs(M.foot, `<div style="font:500 12px ${SANS};margin-top:14px">${esc(M.foot)}</div>`)}
    ${ifs(F.chrome, `<div style="display:flex;justify-content:space-between;font:500 9.5px ${SANS};color:${P.mute};margin-top:18px"><span>${byline(M)}</span><span>motio</span></div>`)}
  </div>`,

  // Gradient: dusk light behind centred type; stats sit on frosted glass.
  gradient: (M, P, F) => `<div style="${box(F, F.chrome ? '26px 24px 22px' : '8px 24px 14px')};align-items:center;text-align:center">
    ${ifs(F.chrome, logo(P, 14, '#FFFFFF', '#FFFFFF'))}
    <div style="font:500 11px ${SANS};color:${P.mute};margin-top:${F.chrome ? 10 : 0}px">${esc(M.eyebrow)}</div>
    ${ifs(M.title, `<div style="font:600 34px/1.05 ${SANS};letter-spacing:-0.035em;margin-top:22px">${br(M.title)}</div>`)}
    ${figure(M, P, { lw: 4, glow: true, color: '#FFFFFF', dot: P.accent })}
    ${ifs(M.lead, `<div style="font:500 13px ${SANS};color:${P.mute};margin-bottom:6px">${esc(M.lead)}</div>`)}
    ${heroHTML(M.hero, P, { max: 116, weight: 600, track: -0.05, align: 'center' })}
    ${ifs(M.line, `<div style="font:400 13px/1.5 ${SANS};margin-top:12px;max-width:290px;opacity:.88">${esc(M.line)}</div>`)}
    ${ifs(M.sub, `<div style="font:400 11.5px/1.5 ${SANS};color:${P.mute};margin-top:6px;max-width:290px">${esc(M.sub)}</div>`)}
    ${ifs(M.chart && !M.chartTop, `<div style="align-self:stretch;text-align:left;margin-top:18px;padding:14px 14px 12px;border-radius:20px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.16)">${chartHTML(M.chart, P, { h: 64 })}</div>`)}
    ${ifs(M.stats.length, `<div style="align-self:stretch;margin-top:16px">${cells(M.stats, P, { cols: M.stats.length === 4 ? 2 : 0, gap: '8px', vs: 17, vw: 600, cell: () => 'padding:12px 10px;border-radius:18px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.16)' })}</div>`)}
    ${ifs(M.foot, `<div style="font:500 12px ${SANS};margin-top:14px">${esc(M.foot)}</div>`)}
    ${ifs(F.chrome, `<div style="font:500 9.5px ${SANS};color:${P.mute};margin-top:16px">${byline(M)}</div>`)}
  </div>`,

  // Map: the route is the picture, on a survey grid; the numbers sit in a panel at the foot.
  map: (M, P, F) => {
    const p = M.routes.length && M.routes[0].points[0];
    const where = p ? `${Math.abs(p[0]).toFixed(3)}° ${p[0] >= 0 ? 'N' : 'S'}  ${Math.abs(p[1]).toFixed(3)}° ${p[1] >= 0 ? 'E' : 'W'}` : '';
    return `<div style="${box(F, F.chrome ? '24px 20px 20px' : '6px 20px 12px')}">
    <div style="display:flex;justify-content:space-between;align-items:center;padding:0 4px">${F.chrome ? logo(P, 14) : `<span style="font:500 11px ${SANS};color:${P.mute}">${esc(M.eyebrow)}</span>`}<span style="font:500 9.5px ${SANS};color:${P.mute};font-variant-numeric:tabular-nums;white-space:pre">${where}</span></div>
    ${ifs(M.title, `<div style="font:600 30px/1.05 ${SANS};letter-spacing:-0.03em;margin-top:18px;padding:0 4px">${br(M.title)}</div>`)}
    ${figure(M, P, { lw: 5, glow: true, dot: P.bg, w: 320, h: 360, m: '10px -6px' })}
    <div style="padding:16px 18px 14px;border-radius:22px;background:${alpha(P.veiled ? '#000000' : P.bg, 0.86)};border:1px solid ${P.line}">
      ${ifs(F.chrome && M.eyebrow, `<div style="font:500 10px ${SANS};color:${P.mute};margin-bottom:8px">${esc(M.eyebrow)}</div>`)}
      ${ifs(M.lead, `<div style="font:500 12px ${SANS};color:${P.mark};margin-bottom:4px">${esc(M.lead)}</div>`)}
      ${heroHTML(M.hero, P, { w: 284, max: 70, weight: 600, track: -0.04 })}
      ${ifs(M.line, `<div style="font:400 12px/1.5 ${SANS};color:${P.mute};margin-top:8px">${esc(M.line)}</div>`)}
      ${ifs(M.chart && !M.chartTop, `<div style="margin-top:14px">${chartHTML(M.chart, P, { h: 56 })}</div>`)}
      ${ifs(M.stats.length, `<div style="margin-top:14px">${cells(M.stats, P, { cols: M.stats.length === 4 ? 2 : 0, vs: 16, vw: 600, cell: (i) => (i % (M.stats.length === 4 ? 2 : 3) ? `border-left:1px solid ${P.line};padding-left:12px` : '') })}</div>`)}
      ${ifs(M.foot, `<div style="font:500 11.5px ${SANS};margin-top:12px">${esc(M.foot)}</div>`)}
    </div>
    ${ifs(F.chrome, `<div style="display:flex;justify-content:space-between;font:500 9.5px ${SANS};color:${P.mute};margin-top:12px;padding:0 4px"><span>${byline(M)}</span><span>motio</span></div>`)}
  </div>`;
  },

  // Big numbers: one colour field and the figure as large as it fits; the route is a faint watermark.
  numbers: (M, P, F) => `<div style="${box(F, F.chrome ? '26px 24px 22px' : '8px 24px 14px')}">
    ${ifs(M.routes.length, `<div style="position:absolute;inset:0;opacity:.16">${routeArt(M.routes, 360, 640, { width: 9, glow: false, color: P.fg, dot: P.bg, fluid: true })}</div>`)}
    <div style="position:relative;display:flex;justify-content:space-between;align-items:center">${F.chrome ? logo(P, 14, P.fg, P.fg) : ''}<span style="font:600 10.5px ${SANS}">${esc(M.eyebrow)}</span></div>
    ${ifs(M.title, `<div style="position:relative;font:700 44px/0.95 ${SANS};letter-spacing:-0.05em;margin-top:26px">${br(M.title)}</div>`)}
    <div style="flex:1"></div>
    <div style="position:relative">
    ${ifs(M.lead, `<div style="font:600 15px ${SANS};margin-bottom:2px">${esc(M.lead)}</div>`)}
    ${heroHTML(M.hero, P, { w: 316, max: 210, weight: 700, track: -0.07, k: 0.56, unit: 0.2, lh: 0.8 })}
    ${ifs(M.line, `<div style="font:500 13.5px/1.45 ${SANS};margin-top:12px;max-width:300px">${esc(M.line)}</div>`)}
    ${ifs(M.sub, `<div style="font:400 12px/1.5 ${SANS};margin-top:6px;opacity:.75">${esc(M.sub)}</div>`)}
    ${ifs(M.chart && !M.chartTop, `<div style="margin-top:18px">${chartHTML(M.chart, P, { h: 70, round: 2 })}</div>`)}
    ${ifs(M.stats.length, `<div style="margin-top:16px">${M.stats.map((s) => `<div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;border-top:2px solid ${P.fg};padding:6px 0 4px">
      <span style="font:700 ${M.stats.length > 3 ? 26 : 34}px/1 ${SANS};letter-spacing:-0.04em;white-space:nowrap">${esc(s.v)}</span><span style="font:500 11px/1.3 ${SANS};text-align:right">${esc(cap(s.k))}${s.s ? `<br><span style="opacity:.7">${esc(s.s)}</span>` : ''}</span></div>`).join('')}</div>`)}
    ${ifs(M.foot, `<div style="font:600 12px ${SANS};margin-top:12px">${esc(M.foot)}</div>`)}
    ${ifs(F.chrome, `<div style="font:500 9.5px ${SANS};margin-top:16px;opacity:.7">${byline(M)}</div>`)}
    </div>
  </div>`,

  // Film: a strip of film; the route or your photo is the frame, the numbers are the caption.
  film: (M, P, F) => {
    const holes = Array.from({ length: Math.ceil(F.H / 26) }, (_, i) => `<span style="position:absolute;top:${i * 26 + 8}px;width:9px;height:14px;border-radius:2.5px;background:${alpha(P.fg, 0.13)}"></span>`).join('');
    const edge = `MOTIO 400   \u25B8 ${(/\d+/.exec(M.eyebrow) || ['1'])[0]}A`;
    const inner = P.photo ? `<div style="position:absolute;inset:0;background:url(${P.photo}) center/cover"></div>`
      : M.routes.length ? `<div style="position:absolute;inset:18px">${routeArt(M.routes, 260, 300, { width: 3.5, glow: true, color: P.mark, dot: '#1F1C17', fluid: true })}</div>`
        : `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:20px">${M.hero ? heroHTML(M.hero, P, { w: 220, max: 92, weight: 600, color: P.fg, align: 'center' }) : `<div style="font:600 28px/1.1 ${SANS};letter-spacing:-0.03em">${br(M.title)}</div>`}</div>`;
    const framed = !!(P.photo || M.routes.length);
    return `<div style="position:absolute;inset:0">
      <div style="position:absolute;left:9px;top:0;bottom:0">${holes}</div><div style="position:absolute;right:18px;top:0;bottom:0">${holes}</div>
      <div style="position:absolute;left:26px;top:50%;transform:translate(-50%,-50%) rotate(-90deg);white-space:pre;font:600 8px ${SANS};letter-spacing:.24em;color:${P.mark}">${edge}</div>
      <div style="${box(F, F.chrome ? '26px 40px 20px 40px' : '8px 40px 14px 40px')}">
        ${ifs(F.chrome, `<div style="display:flex;justify-content:space-between;align-items:center">${logo(P, 13)}<span style="font:500 10px ${SANS};color:${P.mute}">${esc(M.eyebrow)}</span></div>`)}
        ${ifs(M.title && (framed || M.hero), `<div style="font:600 26px/1.08 ${SANS};letter-spacing:-0.025em;margin-top:18px">${br(M.title)}</div>`)}
        <div style="flex:1 1 0;min-height:110px;position:relative;margin:16px 0 14px;border-radius:3px;overflow:hidden;${framed ? `background:#1F1C17;box-shadow:inset 0 0 0 1px ${alpha(P.fg, 0.08)}` : ''}">${inner}</div>
        <div style="display:flex;justify-content:space-between;font:500 10px ${SANS};color:${P.mark};margin-bottom:8px"><span>${esc(M.lead)}</span><span>${F.chrome ? '' : esc(M.eyebrow)}</span></div>
        ${ifs(framed, heroHTML(M.hero, P, { w: 280, max: 64, weight: 600, track: -0.04 }))}
        ${ifs(M.line, `<div style="font:400 12px/1.5 ${SANS};color:${P.mute};margin-top:8px">${esc(M.line)}</div>`)}
        ${ifs(M.sub, `<div style="font:400 11px/1.5 ${SANS};color:${P.mute};margin-top:4px">${esc(M.sub)}</div>`)}
        ${ifs(M.chart && !M.chartTop, `<div style="margin-top:14px">${chartHTML(M.chart, P, { h: 50, round: 1, size: 10.5 })}</div>`)}
        ${ifs(M.stats.length, `<div style="margin-top:14px">${cells(M.stats, P, { cols: M.stats.length === 4 ? 2 : 0, vs: 15, vw: 600, gap: '10px 12px' })}</div>`)}
        ${ifs(M.foot, `<div style="font:500 11.5px ${SANS};margin-top:10px">${esc(M.foot)}</div>`)}
        ${ifs(F.chrome, `<div style="font:500 9px ${SANS};color:${P.mute};margin-top:14px">${byline(M)}</div>`)}
      </div></div>`;
  },

  // Minimal: light and quiet, a hairline route, one accent dot, figures in a lighter weight.
  minimal: (M, P, F) => `<div style="${box(F, F.chrome ? '30px 30px 26px' : '10px 30px 16px')}">
    <div style="display:flex;justify-content:space-between;align-items:center">${F.chrome ? `<span style="display:flex;align-items:center;gap:7px;font:600 12px ${SANS}"><span style="width:7px;height:7px;border-radius:4px;background:${P.mark}"></span>motio</span>` : '<span></span>'}<span style="font:400 10.5px ${SANS};color:${P.mute}">${esc(M.eyebrow)}</span></div>
    ${ifs(M.title, `<div style="font:500 28px/1.12 ${SANS};letter-spacing:-0.03em;margin-top:34px">${br(M.title)}</div>`)}
    ${figure(M, P, { lw: 1.6, color: P.fg, dot: P.mark, m: '26px 0' })}
    ${ifs(M.lead, `<div style="font:400 12px ${SANS};color:${P.mute};margin-bottom:6px">${esc(M.lead)}</div>`)}
    ${heroHTML(M.hero, P, { w: 300, max: 84, weight: 500, track: -0.045, unit: 0.3 })}
    ${ifs(M.line, `<div style="font:400 12.5px/1.6 ${SANS};color:${P.mute};margin-top:12px;max-width:280px">${esc(M.line)}</div>`)}
    ${ifs(M.sub, `<div style="font:400 11.5px/1.6 ${SANS};color:${P.mute};margin-top:4px">${esc(M.sub)}</div>`)}
    ${ifs(M.chart && !M.chartTop, `<div style="margin-top:22px">${chartHTML(M.chart, P, { h: 54, round: 1 })}</div>`)}
    ${ifs(M.stats.length, `<div style="margin-top:20px">${rows(M.stats, P, { vf: `500 14px ${SANS}`, pad: 7 })}</div>`)}
    ${ifs(M.foot, `<div style="font:400 12px ${SANS};margin-top:12px">${esc(M.foot)}</div>`)}
    ${ifs(F.chrome, `<div style="font:400 9.5px ${SANS};color:${P.mute};margin-top:20px">${byline(M)}</div>`)}
  </div>`,

  // Night: deep blue, routes as light trails, a lit figure.
  night: (M, P, F) => `<div style="${box(F, F.chrome ? '26px 26px 22px' : '8px 26px 14px')}">
    <div style="display:flex;justify-content:space-between;align-items:center">${F.chrome ? logo(P, 14) : '<span></span>'}<span style="font:500 10px ${SANS};color:${P.mute}">${esc(M.eyebrow)}</span></div>
    ${ifs(M.title, `<div style="font:600 34px/1.04 ${SANS};letter-spacing:-0.035em;margin-top:26px">${br(M.title)}</div>`)}
    ${figure(M, P, { lw: 3.5, trail: true, color: P.accent, dot: P.accent, m: '18px 0' })}
    ${ifs(M.lead, `<div style="font:500 12.5px ${SANS};color:${P.accent};margin-bottom:6px">${esc(M.lead)}</div>`)}
    ${heroHTML(M.hero, P, { max: 112, weight: 600, track: -0.05, color: '#FFFFFF', glow: `text-shadow:0 0 28px ${alpha(P.accent, 0.65)}` })}
    ${ifs(M.line, `<div style="font:400 12.5px/1.55 ${SANS};color:${P.mute};margin-top:12px;max-width:290px">${esc(M.line)}</div>`)}
    ${ifs(M.sub, `<div style="font:400 11.5px/1.5 ${SANS};color:${P.mute};margin-top:6px">${esc(M.sub)}</div>`)}
    ${ifs(M.chart && !M.chartTop, `<div style="margin-top:18px">${chartHTML(M.chart, { ...P, mark: P.accent }, { h: 64, round: 2 })}</div>`)}
    ${ifs(M.stats.length, `<div style="margin-top:18px">${cells(M.stats, P, { cols: M.stats.length === 4 ? 2 : 0, vs: 17, vw: 600, cell: () => `padding-left:10px;border-left:2px solid ${alpha(P.accent, 0.7)}` })}</div>`)}
    ${ifs(M.foot, `<div style="font:500 12px ${SANS};color:${P.accent};margin-top:14px">${esc(M.foot)}</div>`)}
    ${ifs(F.chrome, `<div style="font:500 9.5px ${SANS};color:${P.mute};margin-top:16px">${byline(M)}</div>`)}
  </div>`
};

// ---------------------------------------------------------------- the look: saved choices, recap style
const LOOK = 'motio.shareLook';
const OLD = { bold: 'numbers', poster: 'night', playful: 'gradient' }; // styles before 4.0
export function loadLook() { try { return JSON.parse(window.localStorage.getItem(LOOK)) || {}; } catch { return {}; } }
export function saveLook(l) { try { window.localStorage.setItem(LOOK, JSON.stringify({ theme: l.theme, accent: l.accent || null, showName: l.showName !== false, showMap: l.showMap !== false, hide: l.hide || [] })); } catch { /* storage blocked */ } }
// Settings › Recap style: a theme id, or 'mix' (each story its own theme).
export function recapStyle() { let s = null; try { s = window.localStorage.getItem('motio.recapStyle'); } catch { /* storage blocked */ } s = OLD[s] || s; return THEMES[s] ? s : 'mix'; }
export const pickTheme = (t, i = Math.floor(Math.random() * IDS.length)) => (THEMES[t] ? t : IDS[((i % IDS.length) + IDS.length) % IDS.length]);
const who = () => { try { const u = window.Motio && window.Motio.auth.user(); return u && u.name ? u.name.split(' ')[0] : ''; } catch { return ''; } };

// The card's markup. o: theme, accent, photo (data URL), showName, showMap, hide (stat labels / 'chart'),
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
  if (o.inApp) M.eyebrow = ''; // the recap's own chip already says which period this is
  const H = o.h || 640;
  const F = { W: 360, H, top: o.inApp ? 74 : 0, bottom: o.inApp ? 78 : 0, chrome: !o.inApp };
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
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:360px;height:640px;pointer-events:none';
  host.innerHTML = storyHTML(kind, data, opts);
  document.body.appendChild(host);
  try {
    try { await document.fonts.load('700 40px Poppins'); await document.fonts.load('500 14px Poppins'); } catch { /* system font is fine */ }
    const imgs = Array.from(host.querySelectorAll('img'));
    await Promise.all(imgs.map((i) => (i.complete ? null : new Promise((ok) => { i.onload = i.onerror = ok; }))));
    const node = host.firstElementChild;
    if (fontCSS == null) fontCSS = await getFontEmbedCSS(document.body).catch(() => '');
    const c = await toCanvas(node, { width: 360, height: 640, pixelRatio: 3, fontEmbedCSS: fontCSS });
    return c.toDataURL('image/png');
  } finally { host.remove(); }
}
export const STORY_KINDS = ['today', 'cover', 'distance', 'time', 'highlights', 'wrap', 'persona', 'challenge', 'trip'];
// Screens only see window.Motio, whose storyImage is renderStory: the style kit rides along on it.
// shortcut: until motio.js exports these itself (Motio.storyKit), screens reach them as Motio.storyImage.kit.
renderStory.kit = { THEMES, ACCENTS, storyHTML, storyChrome, storyParts, slideLook, paintStory, loadLook, saveLook, recapStyle, pickTheme };
