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

// Every share gets a random look, so no two cards are the same: a background (for light-on-dark cards) and a decoration.
const PAIRS = [['#5B4FE0', '#F2766B'], ['#3DBF5C', '#6E8CF7'], ['#B57BE0', '#F6C343'], ['#6E8CF7', '#B57BE0'], ['#F2766B', '#F6C343']];
const GRADS = [['#4B3FD8', '#B57BE0'], ['#4B3FD8', '#F2766B'], ['#1E7A36', '#6E8CF7'], ['#6E8CF7', '#5B4FE0'], ['#16142F', '#5B4FE0']];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const BACKS = [
  (bg) => bg,
  () => { const [a, b] = pick(PAIRS); return `radial-gradient(70% 45% at 10% 12%, ${a}99, transparent 70%), radial-gradient(60% 45% at 95% 92%, ${b}88, transparent 70%), ${INK}`; },
  () => { const [a, b] = pick(GRADS); return `linear-gradient(160deg, ${a} 0%, ${b} 100%)`; }
];
const DECOR = [
  () => '',
  (light) => `<div style="position:absolute;width:420px;height:420px;border-radius:50%;right:-210px;top:-160px;background:${light ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.07)'}"></div><div style="position:absolute;width:300px;height:300px;border-radius:50%;left:-150px;bottom:-120px;background:${light ? 'rgba(22,20,47,0.06)' : 'rgba(255,255,255,0.05)'}"></div>`,
  (light) => `<div style="position:absolute;inset:0;background:repeating-linear-gradient(135deg,${light ? 'rgba(22,20,47,0.05)' : 'rgba(255,255,255,0.045)'} 0 14px,transparent 14px 42px)"></div>`,
  (light) => `<div style="position:absolute;width:520px;height:520px;border-radius:50%;left:50%;top:55%;margin:-260px 0 0 -260px;box-sizing:border-box;border:60px solid ${light ? 'rgba(255,255,255,0.24)' : 'rgba(255,255,255,0.05)'}"></div>`
];
let look = { back: 0, decor: 0 };

// Shared frame: background, wordmark, kicker and credit line.
const frame = (bg, fg, kicker, body, foot = 'Tracked with Motio') => `
<div style="width:360px;height:640px;position:relative;overflow:hidden;background:${fg === INK ? bg : BACKS[look.back](bg)};color:${fg};font-family:Poppins,sans-serif;box-sizing:border-box">
  ${DECOR[look.decor](fg === INK)}
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

  // A challenge, drawn like the race card on the Challenge screen: the winding road with everyone's marker
  // at their real progress, who leads, and the standings.
  challenge: (d) => {
    const ROAD = 'M30 230 C 90 230, 90 150, 150 150 S 220 210, 270 160 S 300 60, 340 50';
    const probe = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    probe.setAttribute('d', ROAD);
    const len = probe.getTotalLength(), at = (f) => probe.getPointAtLength(Math.max(0, Math.min(1, f)) * len);
    const lead = Math.max(0, ...d.racers.map((r) => r.f));
    // Markers close together step up off the road so none hides another.
    const placed = [];
    const markers = d.racers.slice().sort((a, b) => a.f - b.f).map((r, i) => {
      const p = at(r.f); let x = p.x, y = p.y;
      while (placed.some((q) => Math.hypot(q[0] - x, q[1] - y) < 42)) y -= 30;
      placed.push([x, y]);
      const face = r.photo ? `<clipPath id="c${i}"><circle r="18"/></clipPath><image href="${r.photo}" x="-18" y="-18" width="36" height="36" preserveAspectRatio="xMidYMid slice" clip-path="url(#c${i})"/>`
        : `<text y="5" text-anchor="middle" font-family="Poppins,sans-serif" font-size="13" font-weight="700" fill="${INK}">${esc(r.ini)}</text>`;
      return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><circle r="20" fill="${r.color}" stroke="${INK}" stroke-width="4"/>${face}</g>`;
    }).join('');
    const rows = d.racers.map((r, i) => `
      <div style="display:flex;align-items:center;gap:12px">
        <span style="width:16px;font-size:14px;font-weight:700;color:${i === 0 ? '#F6C343' : 'rgba(255,255,255,0.6)'}">${i + 1}</span>
        ${r.photo ? `<img src="${r.photo}" style="width:34px;height:34px;border-radius:17px;object-fit:cover;box-shadow:0 0 0 2px ${r.color}">` : `<span style="width:34px;height:34px;border-radius:17px;background:${r.color};color:${INK};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700">${esc(r.ini)}</span>`}
        <span style="flex:1;display:flex;flex-direction:column;gap:5px"><span style="display:flex;justify-content:space-between;font-size:13px;font-weight:600"><span>${esc(r.name)}</span><span>${esc(r.value)}</span></span>
          <span style="height:6px;border-radius:3px;background:rgba(255,255,255,0.12)"><span style="display:block;height:6px;width:${Math.max(3, r.f * 100).toFixed(0)}%;border-radius:3px;background:${r.color}"></span></span></span>
      </div>`).join('');
    return frame(INK, '#FFFFFF', d.kicker, `
    <div style="position:absolute;inset:0;background:radial-gradient(90% 45% at 50% 0%, #2D2A6E 0%, ${INK} 70%)"></div>
    <div style="position:absolute;left:24px;right:24px;top:70px">
      <div style="font-size:12px;font-weight:600;letter-spacing:1.4px;color:#F2766B">CHALLENGE</div>
      <div style="font-size:32px;font-weight:700;line-height:1.05;letter-spacing:-0.5px;margin-top:6px">${esc(d.big)}</div></div>
    <div style="position:absolute;left:20px;right:20px;top:158px;height:250px;border-radius:28px;background:#F2766B;overflow:hidden">
      <svg width="320" height="250" viewBox="0 0 350 274" style="position:absolute;left:0;top:0">
        <circle cx="300" cy="260" r="120" fill="#FFFFFF" fill-opacity="0.12"/>
        <path d="${ROAD}" fill="none" stroke="#FFFFFF" stroke-opacity="0.35" stroke-width="26" stroke-linecap="round"/>
        <path d="${ROAD}" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-dasharray="7 9"/>
        <path d="${ROAD}" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round" pathLength="1000" stroke-dasharray="${Math.round(lead * 1000)} 1000"/>
        <g transform="translate(318 22)"><rect width="3" height="34" rx="1.5" fill="${INK}"/><path d="M3 2 h18 l-5 6 l5 6 h-18z" fill="#FFFFFF"/></g>
        ${markers}
      </svg>
      <div style="position:absolute;left:16px;top:16px;padding:6px 12px;border-radius:12px;background:${INK};color:#FFFFFF;font-size:12px;font-weight:600">${esc(d.leadLine)}</div>
    </div>
    <div style="position:absolute;left:24px;right:24px;top:428px;display:flex;flex-direction:column;gap:10px">${rows}</div>
    <div style="position:absolute;left:24px;right:24px;bottom:50px;text-align:center;font-size:12px;font-weight:600;color:#F6C343">Race me on Motio</div>`);
  },

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
  look = { back: Math.floor(Math.random() * BACKS.length), decor: Math.floor(Math.random() * DECOR.length) };
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
