// The recap: one dark map of your period's routes stays behind every slide and the camera moves with the
// story (everything, your longest trip, your city dimmed under the numbers). Editorial type, one accent,
// real data visuals (a 7 × 24 activity heatmap), numbers that count and routes that draw themselves.
// Mounted by design/Recap.dc.html; show(slide, R, dir) plays a slide, R being that page's recap numbers.

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const ACCENT = '#F6C343';
const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const CSS = `
.rs{position:absolute;inset:0;z-index:0;overflow:hidden;background:#0D0C16;font-family:Poppins,system-ui,sans-serif;color:#fff;-webkit-font-smoothing:antialiased}
.rs-map{position:absolute;inset:0;background:#0D0C16;z-index:0;isolation:isolate}
.rs-shade,.rs-top,.rs-bot,.rs-stage{z-index:1}
.rs-map .leaflet-container{background:#0D0C16}
.motio-tiles-night{filter:invert(1) hue-rotate(195deg) brightness(.55) contrast(1.15) saturate(.3)}
.rs-shade{position:absolute;inset:0;pointer-events:none;transition:background 900ms ${EASE}}
.rs-top{position:absolute;left:0;right:0;top:0;height:300px;background:linear-gradient(#0D0C16 18%,rgba(13,12,22,.75) 55%,transparent);pointer-events:none}
.rs-bot{position:absolute;left:0;right:0;bottom:0;height:420px;background:linear-gradient(transparent,rgba(13,12,22,.82) 40%,#0D0C16 75%);pointer-events:none}
.rs-stage,.rs-layer{position:absolute;inset:0}
.rs-pad{position:absolute;left:28px;right:28px}
.rs-k{font-size:13px;font-weight:500;color:rgba(255,255,255,.6)}
.rs-lead{font-size:17px;font-weight:500;color:rgba(255,255,255,.78)}
.rs-title{margin:0;font-size:46px;font-weight:700;line-height:1.02;letter-spacing:-1.6px}
.rs-w{display:inline-block;overflow:hidden;vertical-align:bottom;padding-bottom:.1em;margin-bottom:-.1em}
.rs-w>span{display:inline-block}
.rs-hero{font-size:104px;font-weight:700;line-height:.92;letter-spacing:-4.5px;font-variant-numeric:tabular-nums;white-space:nowrap}
.rs-hero small{font-size:30px;font-weight:700;letter-spacing:-.5px;margin-left:8px;color:rgba(255,255,255,.75)}
.rs-line{font-size:15px;line-height:1.5;color:rgba(255,255,255,.75);max-width:310px}
.rs-chip{display:inline-flex;align-items:center;gap:8px;padding:7px 12px;border-radius:12px;background:rgba(246,195,67,.14);color:${ACCENT};font-size:12.5px;font-weight:700}
.rs-chip i{width:6px;height:6px;border-radius:3px;background:${ACCENT}}
.rs-stats{display:grid;grid-template-columns:repeat(3,1fr)}
.rs-stats div{padding:0 12px;border-left:1px solid rgba(255,255,255,.16)}
.rs-stats div:first-child{padding-left:0;border-left:0}
.rs-stats b{display:block;font-size:22px;font-weight:700;letter-spacing:-.5px;font-variant-numeric:tabular-nums;white-space:nowrap}
.rs-stats span{font-size:12px;color:rgba(255,255,255,.6)}
.rs-row{display:grid;grid-template-columns:64px 1fr auto;align-items:center;gap:12px;font-size:13px}
.rs-row span:first-child{color:rgba(255,255,255,.7)}
.rs-row b{font-weight:700;font-variant-numeric:tabular-nums}
.rs-track{height:4px;border-radius:2px;background:rgba(255,255,255,.1);overflow:hidden}
.rs-track i{display:block;height:100%;border-radius:2px;transform-origin:left}
.rs-list>div{display:grid;grid-template-columns:1fr auto;align-items:end;gap:12px;padding:16px 0;border-top:1px solid rgba(255,255,255,.14)}
.rs-list>div:last-child{border-bottom:1px solid rgba(255,255,255,.14)}
.rs-list span{display:block;font-size:12.5px;color:rgba(255,255,255,.6)}
.rs-list b{display:block;font-size:26px;font-weight:700;letter-spacing:-.6px;margin-top:2px}
.rs-list em{font-style:normal;font-size:12px;color:rgba(255,255,255,.6);text-align:right;max-width:130px;line-height:1.35}
.rs-list .pr b{color:${ACCENT}}
.rs-heat{display:grid;grid-template-columns:30px repeat(24,11px);gap:2px;align-items:center}
.rs-heat span{font-size:10.5px;color:rgba(255,255,255,.55)}
.rs-heat i{display:block;width:11px;height:11px;border-radius:3px}
.rs-axis{display:grid;grid-template-columns:30px repeat(4,1fr);margin-top:8px;font-size:10.5px;color:rgba(255,255,255,.45)}
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
const words = (t) => String(t).split(/(\n| )/).map((w) => (w === '\n' ? '<br>' : w === ' ' ? ' ' : `<span class="rs-w"><span data-word>${esc(w)}</span></span>`)).join('');
const count = (v) => `<span data-count="${esc(v)}">${esc(v)}</span>`;

// Each slide: what's on top of the map, how dark the map is, and where the camera goes.
const SLIDES = [
  (R) => ({ shade: 'rgba(13,12,22,0)', cam: 'overview', draw: true, html: `
      <div class="rs-pad" style="bottom:116px">
        <div class="rs-k" data-in="0">${R.Kind === 'Week' ? 'Week ' + esc(R.no) + ', ' : ''}${esc(R.span)}</div>
        <h1 class="rs-title" style="margin-top:8px">${words(R.Your + ',\nwrapped')}</h1>
        <div class="rs-stats" style="margin-top:26px">${[[R.dist, 'travelled'], [R.time, 'on the move'], [R.steps, 'steps']].map(([v, k], i) => `<div data-in="${3 + i}"><b>${count(v)}</b><span>${k}</span></div>`).join('')}</div>
      </div>` }),
  (R) => ({ shade: 'rgba(13,12,22,0.1)', cam: R.longestId ? 'focus' : 'overview', box: [330, 330], html: `
      <div class="rs-pad" style="top:112px">
        <div class="rs-lead" data-in="0">${esc(R.This)} you covered</div>
        <div class="rs-hero" data-in="1" style="font-size:${String(R.distNum).length > 4 ? 82 : 104}px">${count(R.distNum)}<small>${esc(R.unit)}</small></div>
        <div class="rs-line" data-in="2" style="margin-top:12px">${esc(R.compareLong)}</div>
      </div>
      <div class="rs-pad" style="bottom:118px;display:flex;flex-direction:column;gap:12px">
        ${R.longestId ? `<div data-in="3"><span class="rs-chip"><i></i>${esc(R.PRTAG === 'NEW PR' ? 'New record' : 'Longest trip')}: ${esc(R.prValue)}${R.prSub && R.prSub.includes(' · ') ? ', ' + esc(R.prSub.split(' · ')[0]) : ''}</span></div>` : ''}
        ${(R.byDistNum || []).slice(0, 4).map((b, i) => `<div class="rs-row" data-in="${4 + i}"><span>${esc(b.label)}</span><span class="rs-track"><i data-grow style="width:${Math.max(3, b.pct)}%;background:${b.color}"></i></span><b>${esc(b.value)}</b></div>`).join('')}
      </div>` }),
  (R) => {
    const week = (R.heat || []).slice(0, 7), max = Math.max(1, ...week.flatMap((d) => d.hours));
    const cell = (v) => (v > 0 ? `rgba(246,195,67,${(0.22 + 0.78 * (v / max)).toFixed(2)})` : 'rgba(255,255,255,0.06)');
    return { shade: 'rgba(13,12,22,0.86)', cam: 'overview', html: `
      <div class="rs-pad" style="top:112px">
        <div class="rs-lead" data-in="0">You spent</div>
        <div class="rs-hero" data-in="1" style="font-size:${String(R.time).length > 5 ? 82 : 104}px">${count(R.time)}</div>
        <div class="rs-line" data-in="2" style="margin-top:12px">${esc(R.timeVsLine)}</div>
      </div>
      <div class="rs-pad" style="bottom:118px">
        <div class="rs-k" data-in="3" style="margin-bottom:12px">When you moved</div>
        <div class="rs-heat">${week.map((d, r) => `<span>${esc(d.label)}</span>` + d.hours.map((v, h) => `<i data-cell="${h + r}" style="background:${cell(v)}"></i>`).join('')).join('')}</div>
        <div class="rs-axis"><span></span><span>12 AM</span><span>6 AM</span><span>Noon</span><span>6 PM</span></div>
        <div data-in="6" style="margin-top:18px"><span class="rs-chip"><i></i>${R.peak === '—' ? 'No moves yet' : 'Busiest at ' + esc(R.peak) + (R.second && R.second !== '—' ? ', again at ' + esc(R.second) : '')}</span></div>
      </div>` };
  },
  (R) => ({ shade: 'rgba(13,12,22,0.62)', cam: R.longestId ? 'focus' : 'overview', box: [140, 470], html: `
      <div class="rs-pad" style="top:112px"><h1 class="rs-title" style="font-size:40px">${words('The highlights')}</h1></div>
      <div class="rs-pad rs-list" style="bottom:112px">
        ${[[R.PRTAG === 'NEW PR' ? 'New personal record' : 'Longest trip', R.prValue, R.prSub, true], ['Busiest day', R.wildDay, R.wildSub], ['Earliest start', R.early, R.earlyDay], ['Most steps', R.bestSteps, R.bestStepsDay]]
          .filter(([, v]) => v && v !== '0' && v !== '—' && v !== 'No trips yet').map(([k, v, s, pr], i) => `<div data-slide="${i}" class="${pr ? 'pr' : ''}"><div><span>${esc(k)}</span><b>${esc(v)}</b></div><em>${esc(s)}</em></div>`).join('')}
      </div>` }),
  (R) => ({ shade: 'rgba(13,12,22,0.5)', cam: 'wide', html: `
      <div class="rs-pad" style="top:112px">
        <div class="rs-lead" data-in="0">${esc(R.This)} you were</div>
        <h1 class="rs-title" style="margin-top:8px">${words((R.persA ? R.persA + '\n' : '') + R.persB)}</h1>
        <div data-in="4" style="margin-top:16px"><span class="rs-chip"><i></i>${esc(R.rareB)} of your time ${esc(R.rareT || '')}</span></div>
      </div>
      <div class="rs-pad" style="bottom:116px">
        <div class="rs-stats">${[[R.dist, 'travelled'], [R.time, 'on the move'], [R.steps, 'steps']].map(([v, k], i) => `<div data-in="${5 + i}"><b>${esc(v)}</b><span>${k}</span></div>`).join('')}</div>
        <div class="rs-line" data-in="8" style="margin-top:22px">${esc(R.nextLine)}</div>
      </div>` })
];

export function mountRecap(root) {
  if (!document.getElementById('rs-css')) { const st = document.createElement('style'); st.id = 'rs-css'; st.textContent = CSS; document.head.appendChild(st); }
  root.innerHTML = '<div class="rs"><div class="rs-map"></div><div class="rs-shade"></div><div class="rs-top"></div><div class="rs-bot"></div><div class="rs-stage"></div></div>';
  const mapEl = root.querySelector('.rs-map'), shade = root.querySelector('.rs-shade'), stage = root.querySelector('.rs-stage');
  let map = null, mapKey = null, cur = null, drawn = false;
  const timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));

  return {
    show(k, R, dir = 1) {
      timers.splice(0).forEach(clearTimeout);
      const rm = reduced(), S = SLIDES[k](R);
      // The map is made once per recap and then only steered.
      const key = (R.routes || []).map((r) => r.id).join(',');
      // Settings › Recaps › Map background (on by default).
      let mapOn = true; try { mapOn = localStorage.getItem('motio.recapMap') !== 'off'; } catch { /* storage blocked */ }
      mapEl.style.display = mapOn ? '' : 'none';
      if (mapOn && window.MotioMap && window.MotioMap.mountRecap && key !== mapKey) { if (map) map.destroy(); map = window.MotioMap.mountRecap(mapEl, R.routes || []); mapKey = key; drawn = false; }
      shade.style.background = S.shade;
      if (map) {
        if (S.cam === 'focus') map.focus(R.longestId, S.box); else { map.all(); later(() => map.overview(!rm), 60); }
        if (S.draw && !drawn) { drawn = true; later(() => map.draw(rm ? 1 : 2200), 350); }
      }
      // The old slide recedes (a little blur and depth); the new one builds up in order.
      if (cur) {
        const old = cur;
        old.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateY(${-10 * dir}px) scale(0.985)` }], { duration: rm ? 1 : 340, easing: EASE, fill: 'forwards' }).onfinish = () => old.remove();
      }
      const el = document.createElement('div'); el.className = 'rs-layer'; el.innerHTML = S.html; stage.appendChild(el); cur = el;
      const d0 = rm ? 0 : 180, A = (n, kf, ms, delay, easing = EASE) => n.animate(kf, { duration: rm ? 1 : ms, delay: rm ? 0 : delay, easing, fill: 'backwards' });
      el.querySelectorAll('[data-word]').forEach((w, i) => A(w, [{ transform: 'translateY(108%)' }, { transform: 'none' }], 900, d0 + i * 80));
      el.querySelectorAll('[data-in]').forEach((n) => A(n, [{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }], 760, d0 + 120 + +n.dataset.in * 100));
      el.querySelectorAll('[data-grow]').forEach((n, i) => A(n, [{ transform: 'scaleX(0)' }, { transform: 'none' }], 1100, d0 + 700 + i * 110));
      el.querySelectorAll('[data-slide]').forEach((n) => A(n, [{ opacity: 0, transform: 'translateX(28px)' }, { opacity: 1, transform: 'none' }], 760, d0 + 260 + +n.dataset.slide * 120));
      // One animation per heatmap row, not per cell: the same sweep at a fraction of the work.
      el.querySelectorAll('.rs-heat').forEach((g) => A(g, [{ opacity: 0, clipPath: 'inset(0 100% 0 0)' }, { opacity: 1, clipPath: 'inset(0 0 0 0)' }], 1100, d0 + 450, 'cubic-bezier(0.65, 0, 0.35, 1)'));
      el.querySelectorAll('[data-count]').forEach((n) => later(() => countUp(n, 1400), d0 + 200));
    },
    destroy() { timers.splice(0).forEach(clearTimeout); if (map) map.destroy(); root.innerHTML = ''; }
  };
}

window.MotioRecap = { mount: mountRecap };
