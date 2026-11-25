// The recap story (board 08): light pages, one sentence with one bold phrase, a big number, a real map card.
// Year in Motion uses the same slides on the dark theme (the page sets .m-dark-theme, these follow the variables).
// Mounted by design/Recap.dc.html; show(slide, R, dir) plays a slide, R being that page's recap numbers.
import L from 'leaflet';

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const CSS = `
.rs{position:absolute;inset:0;z-index:0;overflow:hidden;font-family:var(--m-font);color:var(--m-ink);-webkit-font-smoothing:antialiased}
.rs-layer{position:absolute;inset:130px 22px 120px;display:flex;flex-direction:column;justify-content:center;gap:24px}
.rs-layer.c{align-items:center;text-align:center}
.rs-layer .m-say{margin:0;text-align:left}
.rs-layer.c .m-say{text-align:center}
.rs-big{font:600 96px/1 var(--m-font);letter-spacing:-5px;white-space:nowrap;font-variant-numeric:tabular-nums;margin-top:-14px}
.rs-big small{font-size:32px;letter-spacing:-1px;margin-left:6px}
.rs-map{position:relative;height:230px;border-radius:28px;overflow:hidden;background:var(--m-soft);flex-shrink:0}
.rs-map .leaflet-container{background:var(--m-soft);font:inherit}
.rs-tiles{filter:grayscale(1) brightness(1.06) contrast(.88)}
.m-dark-theme .rs-tiles{filter:grayscale(1) invert(1) brightness(.78) contrast(.9)}
.rs-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.rs-grid b{display:block;font-size:20px;font-weight:600;letter-spacing:-.4px;white-space:nowrap;font-variant-numeric:tabular-nums}
.rs-bars{display:flex;align-items:flex-end;height:110px}
.rs-bars i{flex:1;transform-origin:bottom}
.rs-row{display:grid;grid-template-columns:70px 1fr auto;align-items:center;gap:12px;font-size:14px;font-weight:500}
.rs-row b{font-weight:600;font-variant-numeric:tabular-nums}
.rs-track{height:6px;border-radius:3px;background:var(--m-line);overflow:hidden}
.rs-track i{display:block;height:100%;border-radius:3px;transform-origin:left}
.rs-list{display:flex;flex-direction:column;gap:6px}
.rs-list>div{display:flex;align-items:center;gap:12px;min-height:44px;padding:12px 16px;border-radius:18px;background:var(--m-card)}
.rs-list b{display:block;font-size:20px;font-weight:600;letter-spacing:-.4px}
.rs-list em{margin-left:auto;font-style:normal;font-size:12px;color:var(--m-mute);text-align:right;max-width:130px;line-height:1.35}
.rs-heat{display:grid;grid-template-columns:30px repeat(24,1fr);gap:2px;align-items:center}
.rs-heat span{font-size:10.5px;font-weight:600;color:var(--m-mute)}
.rs-heat i{display:block;aspect-ratio:1;border-radius:3px}
.rs-axis{display:grid;grid-template-columns:30px repeat(4,1fr);margin-top:8px;font-size:10.5px;font-weight:600;color:var(--m-faint)}
`;

function countUp(el, ms) {
  const text = el.dataset.count, hm = /^(\d+)h (\d+)m$/.exec(text), num = /^([\d,]*\.?\d+)(.*)$/.exec(text);
  if (reduced() || (!hm && !num)) { el.textContent = text; return; }
  const to = hm ? +hm[1] * 60 + +hm[2] : parseFloat(num[1].replace(/,/g, '')), dec = !hm && num[1].includes('.') ? num[1].split('.')[1].length : 0;
  const fmt = (v) => (hm ? Math.floor(v / 60) + 'h ' + String(Math.round(v % 60)).padStart(2, '0') + 'm' : (dec ? v.toFixed(dec) : Math.round(v).toLocaleString('en-US')) + num[2]);
  const t0 = performance.now();
  const step = (t) => { const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 4); el.textContent = fmt(to * e); if (k < 1) requestAnimationFrame(step); };
  el.textContent = fmt(0); requestAnimationFrame(step);
}
const count = (v) => `<span data-count="${esc(v)}">${esc(v)}</span>`;
// One sentence with one bold phrase: [before, bold, after].
const say = (s, n, size = 24) => (s ? `<p class="m-say" data-in="${n}" style="font-size:${size}px">${esc(s[0])}<b>${esc(s[1])}</b>${esc(s[2])}</p>` : '');
const bigSize = (n) => (n <= 6 ? 96 : n <= 7 ? 84 : n <= 9 ? 68 : 56);
const big = (v, n, unit = '') => `<span class="rs-big" data-in="${n}" style="font-size:${bigSize(String(v).length + unit.length * 0.4)}px">${count(v)}${unit ? `<small>${esc(unit)}</small>` : ''}</span>`;
const label = (t, n) => `<span class="m-label" data-in="${n}">${esc(t)}</span>`;
const map = (n, focus) => `<div class="rs-map" data-in="${n}" data-map="${focus ? 'focus' : 'all'}"></div>`;
const grid = (items, n) => `<div class="rs-grid" data-in="${n}">${items.map(([k, v]) => `<div><div class="m-label">${esc(k)}</div><b>${esc(v)}</b></div>`).join('')}</div>`;
const bars = (list, n) => {
  const max = Math.max(1, ...list.map((b) => b.v)), gap = list.length > 10 ? 3 : 8, r = list.length > 10 ? 4 : 10;
  return `<div class="rs-bars" data-in="${n}" style="gap:${gap}px">${list.map((b) => `<i data-up style="height:${Math.max(4, Math.round(b.v / max * 100))}%;border-radius:${r}px;background:${b.top ? 'var(--m-ink)' : b.goal ? 'var(--m-goal)' : 'var(--m-line)'}"></i>`).join('')}</div>`;
};

// Each slide: its markup, and whether it centres (the personality scene).
const SLIDES = [
  (R) => (R.kind === 'year'
    ? { html: `<div data-in="0" style="margin-top:20px"><span class="m-label">${esc(R.fullName)}</span><h1 class="m-title" style="font-size:72px;letter-spacing:-3.5px;line-height:.92;margin-top:14px">${esc(R.span)}<br>in motion.</h1></div>
        <div data-in="2" style="flex:1;display:flex;align-items:center"><tuli-fox pose="run" size="220"></tuli-fox></div>
        ${say(R.coverSay, 3, 22)}`, top: true }
    : R.kind === 'day'
      ? { html: say(R.coverSay, 0, 30).replace('font-size:30px', 'font-size:30px;line-height:1.2') + (R.routes && R.routes.length ? map(1) : '') + grid([['Moved', R.time], ['Steps', R.steps], ['Top', R.top]], 2) }
      : { html: label('Active time', 0) + big(R.time, 1) + say(R.coverSay, 2) + bars(R.dayBars || [], 3), tight: true }),
  (R) => ({ html: label('Distance', 0) + big(R.distNum, 1, ' ' + R.unit) + `<p class="m-say" data-in="2" style="font-size:20px">${esc(R.compareLong)}</p>
      <div style="display:flex;flex-direction:column;gap:12px">${(R.byDistNum || []).slice(0, 4).map((b, i) => `<div class="rs-row" data-in="${3 + i}"><span>${esc(b.label)}</span><span class="rs-track"><i data-grow style="width:${Math.max(3, b.pct)}%;background:${b.color}"></i></span><b>${esc(b.value)}</b></div>`).join('')}</div>`, tight: true }),
  (R) => {
    const week = (R.heat || []).slice(0, 7), max = Math.max(1, ...week.flatMap((d) => d.hours));
    const cell = (v) => (v > 0 ? `color-mix(in srgb,var(--m-ink) ${Math.round(18 + 82 * (v / max))}%,transparent)` : 'var(--m-line)');
    return { html: label('Busiest hour', 0) + big(R.peak === '—' ? '—' : R.peak, 1) + say(R.peakSay, 2) + `<div data-in="3">
        <div class="rs-heat">${week.map((d) => `<span>${esc(d.label)}</span>` + d.hours.map((v) => `<i style="background:${cell(v)}"></i>`).join('')).join('')}</div>
        <div class="rs-axis"><span></span><span>12 AM</span><span>6 AM</span><span>Noon</span><span>6 PM</span></div></div>`, tight: true };
  },
  (R) => (R.kind === 'year'
    ? { html: label('Your big day', 0) + big(R.bigDay, 1) + say(R.bigDaySay, 2) + (R.routes && R.routes.length ? map(3, true) : ''), tight: true, mapH: 170 }
    : { html: `<h1 class="m-title" data-in="0" style="font-size:40px">highlights.</h1><div class="rs-list">${[[R.PRTAG === 'NEW PR' ? 'New personal record' : 'Longest trip', R.prValue, R.prSub], ['Busiest day', R.wildDay, R.wildSub], ['Earliest start', R.early, R.earlyDay], ['Most steps', R.bestSteps, R.bestStepsDay]]
        .filter(([, v]) => v && v !== '0' && v !== '—' && v !== 'No trips yet').map(([k, v, s], i) => `<div data-in="${1 + i}"><div><span class="m-label">${esc(k)}</span><b>${esc(v)}</b></div><em>${esc(s)}</em></div>`).join('')}</div>` }),
  (R) => ({ c: true, html: `<div data-in="0"><m-scene name="${esc(R.scene || 'wanderer')}" size="300"></m-scene></div>
      <p class="m-say" data-in="1" style="font-size:26px">${esc(R.This)} you were<br><b>${esc(R.pers)}</b>.</p>
      <span class="m-sub" data-in="2" style="font-size:14px;max-width:270px">${esc(R.wrapSub)}</span>` })
];

// A small grey map with the period's real routes (README › Maps): mode colour over a card-coloured casing.
function lightMap(el, routes, focusId) {
  const m = L.map(el, { zoomControl: false, attributionControl: false, dragging: false, touchZoom: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false, zoomSnap: 0.1 });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, className: 'rs-tiles' }).addTo(m);
  const card = getComputedStyle(el).getPropertyValue('--m-card').trim() || '#FFFFFF', ink = getComputedStyle(el).getPropertyValue('--m-ink').trim() || '#0F0F0F';
  const pick = focusId ? routes.filter((r) => r.id === focusId) : routes, all = [];
  for (const r of routes) {
    const ll = r.points.map((p) => [p[0], p[1]]), on = !focusId || r.id === focusId;
    L.polyline(ll, { color: card, weight: 9, opacity: on ? 1 : 0.4, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(m);
    L.polyline(ll, { color: r.color, weight: 5, opacity: on ? 1 : 0.3, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(m);
  }
  for (const r of pick.length ? pick : routes) all.push(...r.points.map((p) => [p[0], p[1]]));
  const last = (pick.length ? pick : routes).slice(-1)[0];
  if (last) L.circleMarker(last.points[last.points.length - 1], { radius: 6, color: ink, weight: 2.5, fillColor: card, fillOpacity: 1, interactive: false }).addTo(m);
  const fit = () => { m.invalidateSize(); if (all.length) m.fitBounds(L.latLngBounds(all).pad(0.15), { animate: false, maxZoom: 15 }); else m.setView([40.4093, 49.8671], 12); };
  fit(); setTimeout(fit, 400);
  return m;
}

export function mountRecap(root) {
  if (!document.getElementById('rs-css')) { const st = document.createElement('style'); st.id = 'rs-css'; st.textContent = CSS; document.head.appendChild(st); }
  root.innerHTML = '<div class="rs"></div>';
  const stage = root.firstChild;
  let cur = null, maps = [];
  const timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));

  return {
    show(k, R, dir = 1) {
      timers.splice(0).forEach(clearTimeout);
      const rm = reduced(), S = SLIDES[k](R);
      // The old slide recedes; the new one builds up in order (label, number, sentence, picture).
      if (cur) {
        const old = cur, oldMaps = maps;
        old.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-24 * dir}px)` }], { duration: rm ? 1 : 280, easing: EASE, fill: 'forwards' }).onfinish = () => { oldMaps.forEach((m) => m.remove()); old.remove(); };
      }
      maps = [];
      const el = document.createElement('div');
      el.className = 'rs-layer' + (S.c ? ' c' : '');
      if (S.tight) el.style.gap = '22px';
      if (S.top) el.style.cssText = 'inset:150px 26px 130px;justify-content:space-between;gap:0';
      el.innerHTML = S.html; stage.appendChild(el); cur = el;
      let mapOn = true; try { mapOn = localStorage.getItem('motio.recapMap') !== 'off'; } catch { /* storage blocked */ }
      el.querySelectorAll('[data-map]').forEach((n) => {
        if (S.mapH) n.style.height = S.mapH + 'px';
        if (!mapOn || !(R.routes || []).length) { n.remove(); return; }
        maps.push(lightMap(n, R.routes, n.dataset.map === 'focus' ? R.longestId : null));
      });
      const d0 = rm ? 0 : 120, A = (n, kf, ms, delay) => n.animate(kf, { duration: rm ? 1 : ms, delay: rm ? 0 : delay, easing: EASE, fill: 'backwards' });
      el.querySelectorAll('[data-in]').forEach((n) => A(n, [{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], 640, d0 + +n.dataset.in * 70));
      el.querySelectorAll('[data-up]').forEach((n, i) => A(n, [{ transform: 'scaleY(0)' }, { transform: 'none' }], 700, d0 + 320 + i * 40));
      el.querySelectorAll('[data-grow]').forEach((n, i) => A(n, [{ transform: 'scaleX(0)' }, { transform: 'none' }], 900, d0 + 420 + i * 90));
      el.querySelectorAll('.rs-heat').forEach((g) => A(g, [{ opacity: 0, clipPath: 'inset(0 100% 0 0)' }, { opacity: 1, clipPath: 'inset(0 0 0 0)' }], 1000, d0 + 320));
      el.querySelectorAll('[data-count]').forEach((n) => later(() => countUp(n, 1200), d0 + 120));
    },
    destroy() { timers.splice(0).forEach(clearTimeout); maps.forEach((m) => m.remove()); root.innerHTML = ''; }
  };
}

window.MotioRecap = { mount: mountRecap };
