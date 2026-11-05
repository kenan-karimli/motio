// Share images: designed 1080×1920 story cards (not screenshots). Each card is laid out in HTML at 360×640,
// rendered off screen and scaled ×3. One template per thing you can share; screens pass their own numbers.
import { toCanvas, getFontEmbedCSS } from 'html-to-image';

const INK = '#16142F';
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// Routes as art: GPS lines fitted into a box, each in its movement colour.
export function routeArt(routes, w, h, { width = 5, glow = true } = {}) {
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
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block;overflow:visible">
    ${glow ? routes.map((r) => `<path d="${path(r)}" fill="none" stroke="${r.color}" stroke-opacity="0.25" stroke-width="${width * 3}" stroke-linecap="round" stroke-linejoin="round"/>`).join('') : ''}
    ${routes.map((r) => `<path d="${path(r)}" fill="none" stroke="${r.color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}
    ${routes.slice(-1).map((r) => { const [x, y] = end(r); return `<circle cx="${x}" cy="${y}" r="${width + 2}" fill="#FFFFFF" stroke="${r.color}" stroke-width="3"/>`; }).join('')}
  </svg>`;
}

// Shared frame: background, wordmark, kicker and credit line.
const frame = (bg, fg, kicker, body, foot = 'Tracked with Motio') => `
<div style="width:360px;height:640px;position:relative;overflow:hidden;background:${bg};color:${fg};font-family:Poppins,sans-serif;box-sizing:border-box">
  ${body}
  <div style="position:absolute;left:28px;top:26px;display:flex;align-items:center;gap:6px;font-weight:700;font-size:15px">
    <svg width="18" height="18" viewBox="0 0 30 30"><path d="M3 22c5 0 5-14 12-14s5 14 12 14" fill="none" stroke="${fg === INK ? INK : '#F6C343'}" stroke-width="4.5" stroke-linecap="round"/></svg>motio</div>
  <div style="position:absolute;right:28px;top:30px;font-size:9.5px;font-weight:600;letter-spacing:1.6px;opacity:.7">${esc(kicker).toUpperCase()}</div>
  <div style="position:absolute;left:28px;right:28px;bottom:24px;display:flex;justify-content:space-between;font-size:9.5px;font-weight:500;opacity:.6"><span>${esc(foot)}</span><span>motio</span></div>
</div>`;

const statRow = (stats, fg) => `<div style="display:flex;gap:10px">${stats.map((s) => `
  <div style="flex:1;padding:12px 12px 10px;border-radius:16px;background:${fg === INK ? 'rgba(22,20,47,0.08)' : 'rgba(255,255,255,0.09)'}">
    <div style="font-size:19px;font-weight:700;line-height:1.1;white-space:nowrap">${esc(s.v)}</div>
    <div style="font-size:10px;opacity:.7;margin-top:3px">${esc(s.k)}</div></div>`).join('')}</div>`;

const modeBar = (modes) => modes.length ? `
  <div style="display:flex;height:10px;gap:3px;border-radius:5px;overflow:hidden">${modes.map((m) => `<span style="flex:${Math.max(2, m.pct)};background:${m.color}"></span>`).join('')}</div>
  <div style="display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:8px;font-size:10.5px;font-weight:500">${modes.map((m) => `<span style="display:flex;align-items:center;gap:5px"><span style="width:7px;height:7px;border-radius:4px;background:${m.color}"></span>${esc(m.label)} ${m.pct}%</span>`).join('')}</div>` : '';

const T = {
  // Today: your real routes, time on the move, mix of movement, three stats.
  today: (d) => frame(INK, '#FFFFFF', d.kicker, `
    <div style="position:absolute;left:28px;top:84px;right:28px">
      <div style="font-size:13px;opacity:.75">${esc(d.lead)}</div>
      <div style="font-size:66px;font-weight:700;line-height:1;letter-spacing:-1.5px;margin-top:4px">${esc(d.big)}</div>
      <div style="font-size:13px;margin-top:8px;color:#F6C343;font-weight:600">${esc(d.goal)}</div>
    </div>
    <div style="position:absolute;left:28px;top:228px;width:304px;height:220px;border-radius:22px;background:rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:center">
      ${routeArt(d.routes, 304, 220) || `<div style="font-size:12px;opacity:.6;text-align:center">No routes yet today</div>`}</div>
    <div style="position:absolute;left:28px;right:28px;top:466px">${modeBar(d.modes)}</div>
    <div style="position:absolute;left:28px;right:28px;bottom:54px">${statRow(d.stats, '#FFF')}</div>`),

  // Recap cover: the period, wrapped, over a faint drawing of all its routes.
  cover: (d) => frame(d.bg || '#4B3FD8', '#FFFFFF', d.kicker, `
    <div style="position:absolute;left:28px;top:236px;width:304px;height:250px;opacity:.85">${routeArt(d.routes, 304, 250, { width: 4 })}</div>
    <div style="position:absolute;left:28px;right:28px;top:96px">
      <div style="font-size:44px;font-weight:700;line-height:1.02;letter-spacing:-1px">${esc(d.title).replace('\n', '<br>')}</div>
      <div style="font-size:13px;opacity:.8;margin-top:10px">${esc(d.sub)}</div></div>
    <div style="position:absolute;left:28px;right:28px;bottom:58px">
      <div style="font-size:11px;font-weight:600;letter-spacing:1.4px;opacity:.75">${esc(d.bigLabel).toUpperCase()}</div>
      <div style="font-size:60px;font-weight:700;line-height:1;letter-spacing:-1.5px">${esc(d.big)}</div></div>`),

  // Distance: the number, a comparison, and bars per way of moving.
  distance: (d) => frame(d.bg || '#3DBF5C', INK, d.kicker, `
    <div style="position:absolute;left:28px;right:28px;top:96px">
      <div style="font-size:15px;font-weight:500">${esc(d.lead)}</div>
      <div style="display:flex;align-items:baseline;gap:8px;margin-top:2px"><span style="font-size:96px;font-weight:700;line-height:.95;letter-spacing:-3px">${esc(d.num)}</span><span style="font-size:26px;font-weight:700">${esc(d.unit)}</span></div>
      <div style="font-size:13.5px;line-height:1.45;margin-top:10px;max-width:290px">${esc(d.line)}</div></div>
    <div style="position:absolute;left:28px;right:28px;bottom:60px;display:flex;flex-direction:column;gap:11px">
      ${d.bars.map((b) => `<div><div style="display:flex;justify-content:space-between;font-size:11.5px;font-weight:600;margin-bottom:4px"><span>${esc(b.label)}</span><span>${esc(b.value)}</span></div>
        <div style="height:12px;border-radius:6px;background:rgba(22,20,47,0.12)"><div style="width:${Math.max(3, b.pct)}%;height:12px;border-radius:6px;background:${b.color || INK}"></div></div></div>`).join('')}</div>`),

  // Time: big duration, a 24-hour chart with the peak picked out.
  time: (d) => { const max = Math.max(1, ...d.hourly); return frame(d.bg || '#F6C343', INK, d.kicker, `
    <div style="position:absolute;left:28px;right:28px;top:96px">
      <div style="font-size:15px;font-weight:500">${esc(d.lead)}</div>
      <div style="font-size:78px;font-weight:700;line-height:1;letter-spacing:-2.5px;margin-top:2px">${esc(d.big)}</div>
      <div style="font-size:13.5px;line-height:1.45;margin-top:8px">${esc(d.line)}</div></div>
    <div style="position:absolute;left:28px;right:28px;bottom:112px">
      <div style="display:flex;align-items:flex-end;gap:3px;height:150px">${d.hourly.map((v, h) => `<span style="flex:1;height:${Math.max(3, Math.round(v / max * 150))}px;border-radius:3px;background:${v === max && v ? INK : 'rgba(22,20,47,0.28)'}"></span>`).join('')}</div>
      <div style="display:flex;justify-content:space-between;font-size:9.5px;font-weight:600;margin-top:6px;opacity:.7"><span>12 AM</span><span>6 AM</span><span>NOON</span><span>6 PM</span><span>11 PM</span></div></div>
    <div style="position:absolute;left:28px;right:28px;bottom:58px;font-size:13px;font-weight:600">${esc(d.peak)}</div>`); },

  // Highlights / records: up to four tiles.
  highlights: (d) => frame(d.bg || '#F2766B', INK, d.kicker, `
    <div style="position:absolute;left:28px;right:28px;top:96px;font-size:38px;font-weight:700;line-height:1.05;letter-spacing:-.8px">${esc(d.title).replace('\n', '<br>')}</div>
    <div style="position:absolute;left:28px;right:28px;bottom:58px;display:grid;grid-template-columns:1fr 1fr;gap:10px">
      ${d.tiles.slice(0, 4).map((t) => `<div style="padding:14px 14px 12px;border-radius:18px;background:rgba(255,255,255,0.78);min-height:108px;box-sizing:border-box;display:flex;flex-direction:column">
        <span style="font-size:9px;font-weight:700;letter-spacing:1.2px;opacity:.65">${esc(t.k).toUpperCase()}</span>
        <span style="font-size:22px;font-weight:700;line-height:1.1;margin-top:auto">${esc(t.v)}</span>
        <span style="font-size:10.5px;opacity:.75;margin-top:3px;line-height:1.3">${esc(t.s)}</span></div>`).join('')}</div>`),

  // Wrap-up: the personality, then the totals.
  wrap: (d) => frame(INK, '#FFFFFF', d.kicker, `
    <div style="position:absolute;left:28px;right:28px;top:104px">
      <div style="font-size:14px;opacity:.75">${esc(d.lead)}</div>
      <div style="font-size:46px;font-weight:700;line-height:1.02;letter-spacing:-1px;margin-top:8px;color:${d.color || '#F6C343'}">${esc(d.name)}</div>
      <div style="font-size:13px;opacity:.8;margin-top:12px">${esc(d.stat)}</div></div>
    <div style="position:absolute;left:28px;right:28px;bottom:96px">${statRow(d.grid, '#FFF')}</div>
    <div style="position:absolute;left:28px;right:28px;bottom:58px;font-size:12px;opacity:.8">${esc(d.end)}</div>`),

  // Movement personality card.
  persona: (d) => frame(d.color || '#F2766B', d.dark ? '#FFFFFF' : INK, 'My movement personality', `
    <div style="position:absolute;left:28px;right:28px;top:112px">
      <div style="font-size:12px;font-weight:600;letter-spacing:1.4px;opacity:.7">${esc(d.month).toUpperCase()}</div>
      <div style="font-size:46px;font-weight:700;line-height:1;letter-spacing:-1px;margin-top:8px">${esc(d.name).replace(/^The /, 'The<br>')}</div>
      <div style="font-size:15px;font-weight:600;margin-top:14px">${esc(d.tagline)}</div>
      <div style="font-size:12.5px;line-height:1.5;opacity:.8;margin-top:6px;max-width:290px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(d.desc)}</div></div>
    <div style="position:absolute;left:28px;right:28px;bottom:54px;display:flex;flex-direction:column;gap:10px">
      ${d.traits.map((t) => `<div><div style="display:flex;justify-content:space-between;font-size:10.5px;font-weight:600;margin-bottom:4px;opacity:.85"><span>${esc(t.left)}</span><span>${esc(t.name)}</span><span>${esc(t.right)}</span></div>
        <div style="height:8px;border-radius:4px;background:${d.dark ? 'rgba(255,255,255,0.2)' : 'rgba(22,20,47,0.15)'}"><div style="width:${t.w};height:8px;border-radius:4px;background:${d.dark ? '#FFFFFF' : INK}"></div></div></div>`).join('')}
      <div style="font-size:12px;font-weight:600;margin-top:4px">${esc(d.stat)}</div></div>`),

  // One trip: its route, distance and pace.
  trip: (d) => frame(INK, '#FFFFFF', d.kicker, `
    <div style="position:absolute;left:28px;right:28px;top:88px">
      <div style="font-size:13px;font-weight:600;color:${d.color}">${esc(d.lead)}</div>
      <div style="font-size:72px;font-weight:700;line-height:1;letter-spacing:-2px;margin-top:4px">${esc(d.big)}</div></div>
    <div style="position:absolute;left:28px;top:210px;width:304px;height:260px">${routeArt(d.routes, 304, 260, { width: 6 }) || ''}</div>
    <div style="position:absolute;left:28px;right:28px;bottom:58px">${statRow(d.stats, '#FFF')}</div>`)
};

let fontCSS = null;
export async function renderStory(kind, data) {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:360px;height:640px;pointer-events:none';
  host.innerHTML = T[kind](data);
  document.body.appendChild(host);
  try {
    try { await document.fonts.load('700 40px Poppins'); await document.fonts.load('500 14px Poppins'); } catch { /* system font is fine */ }
    const node = host.firstElementChild;
    if (fontCSS == null) fontCSS = await getFontEmbedCSS(document.body).catch(() => '');
    const c = await toCanvas(node, { width: 360, height: 640, pixelRatio: 3, fontEmbedCSS: fontCSS });
    return c.toDataURL('image/png');
  } finally { host.remove(); }
}
export const STORY_KINDS = Object.keys(T);
