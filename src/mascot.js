// Motio's mascot, a folded-paper fox (moods: idle, cheer, sleep), and the Trail: the Motio arc drawing itself,
// used for loading, celebrating and empty states. Screens paint them into an element through a ref:
// ref="{{ fox }}" with fox = window.MotioMascot.fox('cheer', 110), or window.MotioMascot.trail('loop', 120).
const CSS = `
.mfx,.mtr{display:inline-block;line-height:0}
.mfx svg,.mtr svg{overflow:visible}
.mfx *{transform-box:fill-box}
.mfx .tail{transform-origin:0% 100%;animation:mfxTail 2.2s ease-in-out infinite}
.mfx .ear{transform-origin:50% 100%;animation:mfxFlick 5s ease-in-out infinite}
.mfx .ear.b{animation-delay:2.1s}
.mfx.cheer .ear{animation:mfxEar .55s ease-in-out infinite}
.mfx .ear.b{animation-delay:.35s}
.mfx .eye{transform-origin:50% 50%;animation:mfxBlink 4.5s infinite}
.mfw{cursor:pointer;-webkit-tap-highlight-color:transparent}
.mfx{position:relative;cursor:pointer;-webkit-tap-highlight-color:transparent}
.mfx .whole{transform-origin:50% 100%;animation:mfxIdle 9s ease-in-out infinite}
.mfw .say,.mfx .say{position:absolute;right:88%;top:8%;white-space:nowrap;padding:8px 14px;border-radius:16px;background:#fff;color:#0F0F0F;font:600 12.5px 'Inter Tight',system-ui,sans-serif;line-height:1.2;box-shadow:0 10px 30px rgba(0,0,0,.14),0 0 0 1px rgba(0,0,0,.05);animation:mfxSay 2.4s cubic-bezier(.22,1,.36,1) forwards;pointer-events:none;z-index:5}
.mfw .say::after,.mfx .say::after{content:'';position:absolute;left:100%;top:50%;margin-top:-5px;border:5px solid transparent;border-left-color:#fff}
.mfx.cheer .whole{animation:mfxLeap 1.1s cubic-bezier(.34,1.4,.64,1) infinite}
.mfx.cheer .tail{animation-duration:.5s}
.mfx.cheer .shadow{transform-origin:50% 50%;animation:mfxShadow 1.1s cubic-bezier(.34,1.4,.64,1) infinite}
.mfx .closed,.mfx .z{display:none}
.mfx.sleep .eye{display:none}
.mfx.sleep .closed{display:inline}
.mfx.sleep .tail{animation:mfxTail 5s ease-in-out infinite}
.mfx.sleep .z{display:inline;animation:mfxZ 2.6s ease-in-out infinite}
.mfx .in{animation:mfxIn .7s cubic-bezier(.34,1.4,.64,1) backwards}
@keyframes mfxTail{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(10deg)}}
@keyframes mfxEar{0%,100%{transform:rotate(0)}50%{transform:rotate(-14deg)}}
@keyframes mfxBlink{0%,93%,100%{transform:scaleY(1)}96%{transform:scaleY(.1)}}
/* One loop for resting: a slow breath and, now and then, a look around. */
@keyframes mfxIdle{0%,26%,52%,100%{transform:none}13%,39%{transform:scale(1.02,.98)}60%{transform:rotate(-6deg)}66%{transform:rotate(5deg)}72%{transform:none}84%{transform:translateY(0) scale(1.05,.94)}89%{transform:translateY(-10%) scale(.97,1.04)}94%{transform:translateY(0) scale(1.03,.97)}}
@keyframes mfxFlick{0%,80%,100%{transform:rotate(0)}85%{transform:rotate(-14deg)}90%{transform:rotate(6deg)}}
@keyframes mfxLeap{0%,100%{transform:translateY(0) rotate(0)}40%{transform:translateY(-20%) rotate(-6deg)}}
@keyframes mfxShadow{0%,100%{transform:scale(1);opacity:.2}40%{transform:scale(.6);opacity:.08}}
@keyframes mfxZ{0%{transform:translate(0,0);opacity:0}30%{opacity:1}100%{transform:translate(10px,-20px);opacity:0}}
@keyframes mfxSay{0%{opacity:0;transform:translateX(10px) scale(.86);filter:blur(4px)}14%{opacity:1;transform:translateX(0) scale(1.03);filter:blur(0)}22%,84%{opacity:1;transform:none}100%{opacity:0;transform:translateX(-6px) scale(.96);filter:blur(3px)}}
@keyframes mfxIn{from{opacity:0;transform:translateY(12px) scale(.9)}to{opacity:1;transform:none}}
.mtr .ribbon{stroke-dasharray:1;stroke-dashoffset:1;animation:mtrDraw 3.2s cubic-bezier(.65,0,.35,1) infinite}
.mtr .head{offset-rotate:0deg;animation:mtrMove 3.2s cubic-bezier(.65,0,.35,1) infinite}
.mtr .glow{animation:mtrGlow 1.6s ease-in-out infinite}
.mtr.once .ribbon{animation:mtrOnce 1.6s cubic-bezier(.65,0,.35,1) forwards}
.mtr.once .head{animation:mtrMoveOnce 1.6s cubic-bezier(.65,0,.35,1) forwards}
@keyframes mtrDraw{0%{stroke-dashoffset:1}55%,80%{stroke-dashoffset:0}100%{stroke-dashoffset:-1}}
@keyframes mtrMove{0%{offset-distance:0%;opacity:1}55%,80%{offset-distance:100%;opacity:1}100%{offset-distance:100%;opacity:0}}
@keyframes mtrOnce{to{stroke-dashoffset:0}}
@keyframes mtrMoveOnce{from{offset-distance:0%}to{offset-distance:100%}}
@keyframes mtrGlow{0%,100%{r:10;opacity:.35}50%{r:16;opacity:.15}}
@media (prefers-reduced-motion: reduce){.mfx *,.mtr *{animation:none!important;stroke-dashoffset:0!important;offset-distance:100%!important}}
`;
const FOX = `<ellipse class="shadow" cx="66" cy="124" rx="40" ry="5" fill="#1F1D47" opacity=".2"/>
<g class="whole">
  <g class="tail"><path d="M96 92 L132 60 L128 96 Z" fill="#4B3FD8"/><path d="M118 72 L132 60 L128 82 Z" fill="#F6C343"/></g>
  <path d="M40 120 L56 74 L96 72 L102 120 Z" fill="#5B4FE0"/><path d="M56 74 L76 96 L96 72 Z" fill="#8C7CF0"/>
  <path d="M54 120 L58 102 M88 120 L86 102" stroke="#1F1D47" stroke-width="6" stroke-linecap="round"/>
  <g class="ear"><path d="M38 34 L46 8 L58 30 Z" fill="#4B3FD8"/><path d="M42 28 L46 14 L52 28 Z" fill="#1F1D47"/></g>
  <g class="ear b"><path d="M70 30 L84 8 L88 34 Z" fill="#4B3FD8"/><path d="M75 28 L83 15 L84 30 Z" fill="#1F1D47"/></g>
  <path d="M30 40 L62 24 L94 40 L80 70 L62 80 L44 70 Z" fill="#5B4FE0"/>
  <path d="M30 40 L62 54 L44 70 Z" fill="#7B6EF5"/><path d="M94 40 L62 54 L80 70 Z" fill="#4B3FD8"/>
  <path d="M44 70 L62 54 L80 70 L62 80 Z" fill="#FFFFFF"/><path d="M57 74 L62 70 L67 74 L62 78 Z" fill="#1F1D47"/>
  <ellipse class="eye" cx="50" cy="50" rx="3.4" ry="4.2" fill="#1F1D47"/><ellipse class="eye" cx="74" cy="50" rx="3.4" ry="4.2" fill="#1F1D47"/>
  <g class="closed" fill="none" stroke="#1F1D47" stroke-width="2.6" stroke-linecap="round"><path d="M46 50 q4 3 8 0"/><path d="M70 50 q4 3 8 0"/></g>
</g>
<g class="z" fill="#8C7CF0" font-family="Poppins, sans-serif" font-weight="700"><text x="100" y="26" font-size="15">z</text><text x="112" y="12" font-size="11">z</text></g>`;
const PATHS = {
  wave: 'M10 90 C 30 90, 30 40, 60 40 S 90 90, 110 90',
  loop: 'M8 96 C 40 96, 30 30, 60 30 C 86 30, 86 66, 62 66 C 40 66, 44 24, 72 18 C 92 14, 104 30, 112 20',
  rise: 'M8 100 C 30 96, 40 70, 60 66 S 92 40, 112 12'
};
// 5.0: the fox is Tuli (src/tuli.js); the old folded-paper fox below stays only as a fallback.
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// 5.0: every fox is the kit's <tuli-fox>, so a tap always plays the same crouch, spring, soft landing and speech card.
const foxNew = (mood = 'idle', size = 110) => `<tuli-fox pose="${mood}" size="${size}" say="${esc(line())}"></tuli-fox>`;
const fox = (mood = 'idle', size = 110) => (customElements.get('tuli-fox') ? foxNew(mood, size) : window.Tuli ? `<span class="mfw" style="position:relative;display:inline-block">${window.Tuli(mood, size)}</span>` : `<span class="mfx ${mood}" role="img" aria-label="Motio's fox"><svg class="in" width="${size}" height="${Math.round(size * 164 / 140)}" viewBox="0 -34 140 164">${FOX}</svg></span>`);
const trail = (shape = 'wave', size = 120, { once = false, color = null } = {}) => {
  const d = PATHS[shape] || PATHS.wave;
  return `<span class="mtr${once ? ' once' : ''}" aria-hidden="true"><svg width="${size}" height="${Math.round(size * 110 / 120)}" viewBox="0 0 120 110">
    <defs><linearGradient id="mtrG-${shape}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0F0F0F"/><stop offset="1" stop-color="#F6C343"/></linearGradient></defs>
    <path class="ribbon" pathLength="1" d="${d}" fill="none" stroke="${color || `url(#mtrG-${shape})`}" stroke-width="9" stroke-linecap="round"/>
    <g class="head" style="offset-path: path('${d}')"><circle class="glow" r="12" fill="#F6C343" opacity=".3"/><circle r="7" fill="#F6C343"/></g></svg></span>`;
};
if (!document.getElementById('mfx-css')) { const st = document.createElement('style'); st.id = 'mfx-css'; st.textContent = CSS; document.head.appendChild(st); }
const painter = (key, html, tap) => (el) => { if (el && el.__m !== key) { el.innerHTML = html(); el.__m = key; if (tap) el.onclick = () => tap(el); } };
// A tap: the fox jumps and says one thing worth knowing about your day.
function line() {
  const M = window.Motio;
  if (!M) return 'Let’s move!';
  const t = M.today(), g = M.goals(), left = Math.round(g.goal - t.min), opts = [];
  if (t.min < 1) opts.push('Ready when you are!', 'A short walk counts too');
  else if (left > 0) opts.push(left + ' min to your goal');
  else opts.push('Goal done today!');
  if (t.steps) opts.push(M.fmtNum(t.steps) + ' steps today');
  if (g.active > 1) opts.push(g.active + ' days in a row!');
  return opts[Math.floor(Math.random() * opts.length)];
}
function tapFox(el) {
  const f = el.querySelector('.tl') || el.querySelector('.mfx');
  if (!f || f.__busy) return;
  f.__busy = true;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const was = f.className;
  if (f.classList.contains('tl')) f.className = 'tl curious';
  const host = f.parentNode.classList.contains('mfw') ? f.parentNode : f;
  // Anticipate, spring up with a stretch, settle with a small squash and a softer second bounce.
  if (!reduce && f.animate) f.animate([
    { transform: 'translateY(0) scale(1,1)', offset: 0 },
    { transform: 'translateY(3px) scale(1.1,.88)', offset: .16, easing: 'cubic-bezier(.2,.9,.3,1)' },
    { transform: 'translateY(-22px) scale(.93,1.1)', offset: .42, easing: 'cubic-bezier(.4,0,.6,1)' },
    { transform: 'translateY(0) scale(1.07,.93)', offset: .68, easing: 'cubic-bezier(.2,.9,.3,1)' },
    { transform: 'translateY(-6px) scale(.98,1.03)', offset: .84 },
    { transform: 'translateY(0) scale(1,1)', offset: 1 }
  ], { duration: 950, easing: 'ease-out' });
  // A ring that spreads from his feet.
  const ring = document.createElement('span');
  ring.style.cssText = 'position:absolute;left:50%;bottom:6%;width:60%;aspect-ratio:1;margin-left:-30%;border-radius:50%;border:2px solid currentColor;opacity:.0;pointer-events:none;transform:scale(.2)';
  host.style.position = 'relative'; host.appendChild(ring);
  if (!reduce && ring.animate) ring.animate([{ opacity: .35, transform: 'scale(.2)' }, { opacity: 0, transform: 'scale(1.5)' }], { duration: 900, easing: 'cubic-bezier(.2,.8,.2,1)' });
  const b = document.createElement('span'); b.className = 'say'; b.textContent = line(); host.appendChild(b);
  try { const H = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics; if (H) H.impact({ style: 'LIGHT' }); } catch { /* no haptics */ }
  setTimeout(() => { f.className = was; ring.remove(); b.remove(); f.__busy = false; }, 2400);
}
window.MotioMascot = {
  foxHTML: fox, trailHTML: trail,
  fox: (mood = 'idle', size = 110) => painter('fox' + mood + size, () => fox(mood, size), customElements.get('tuli-fox') ? null : tapFox),
  trail: (shape = 'wave', size = 120, o = {}) => painter('tr' + shape + size + !!o.once + (o.color || ''), () => trail(shape, size, o))
};
