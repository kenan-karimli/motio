// Tuli ("tulki" is fox in Azerbaijani): Motio's fox, a sitting ink silhouette with a white chest and tail tip.
// tuli('idle', 120) returns an animated inline SVG. Poses: idle, curious, cheer, sleep (kit.js adds many more).
// Everything but the shadow sits in .hop, so a tap can hop the fox without resetting the pose's own motion.
// Colours come from the design system (currentColor = ink, --m-bg-hi = white parts).
const CSS = `
.tl{display:inline-block;line-height:0;color:var(--m-ink,#0F0F0F)}
.tl svg{overflow:visible}
.tl *{transform-box:view-box}
.tl .whole{transform-origin:64px 110px}
.tl .hop{transform-box:fill-box;transform-origin:50% 100%}
.tl .sh{transform-origin:64px 111px}
.tl .body{transform-origin:64px 110px;animation:tlBreathe 3.8s ease-in-out infinite}
.tl .tail{transform-origin:83px 102px;animation:tlTail 3.2s ease-in-out infinite}
.tl .tip{transform-origin:108px 80px;animation:tlTip 3.2s ease-in-out -.5s infinite}
.tl .head{transform-origin:64px 60px;animation:tlLook 9s ease-in-out infinite}
.tl .ear{transform-origin:64px 34px;animation:tlEar 6s ease-in-out infinite}
.tl .ear.b{transform-origin:73px 34px;animation-delay:-2.7s}
.tl .eye{transform-origin:74px 44px;animation:tlBlink 4.6s infinite}
.tl .closed,.tl .zz,.tl .conf{display:none}
/* curious: head tilted, ears flicking, tail slow */
.tl.curious .head{animation:tlTilt 2.4s ease-in-out infinite}
.tl.curious .ear{animation-duration:1.6s}
/* cheer: crouch, spring up, land; the tail wags fast */
.tl.cheer .whole{animation:tlJump 1.3s cubic-bezier(.34,1.3,.64,1) infinite}
.tl.cheer .sh{animation:tlShadowJump 1.3s cubic-bezier(.34,1.3,.64,1) infinite}
.tl.cheer .tail{animation:tlWag .32s ease-in-out infinite alternate}
.tl.cheer .tip{animation:tlTip .32s ease-in-out -.1s infinite alternate}
.tl.cheer .head{animation:tlUp 1.3s ease-in-out infinite}
.tl.cheer .conf{display:inline;animation:tlConf 1.3s ease-out infinite}
/* sleep: head down, eyes closed, slow breath */
.tl.sleep .eye{display:none}.tl.sleep .closed,.tl.sleep .zz{display:inline}
.tl.sleep .head{animation:none;transform:rotate(18deg)}
.tl.sleep .ear{animation:none;transform:rotate(-10deg)}
.tl.sleep .body{animation-duration:5s}
.tl.sleep .tail{animation:tlTail 7s ease-in-out infinite}
.tl.sleep .zz{animation:tlZ 3s ease-in-out infinite}
@keyframes tlBreathe{0%,100%{transform:scale(1)}50%{transform:scale(1.015,1.03)}}
@keyframes tlTail{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(8deg)}}
@keyframes tlTip{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(10deg)}}
@keyframes tlWag{from{transform:rotate(-14deg)}to{transform:rotate(16deg)}}
@keyframes tlLook{0%,22%,100%{transform:rotate(0)}30%,42%{transform:rotate(-9deg)}50%,58%{transform:rotate(0)}66%,78%{transform:rotate(7deg)}86%{transform:rotate(0)}}
@keyframes tlTilt{0%,100%{transform:rotate(-12deg)}50%{transform:rotate(-6deg)}}
@keyframes tlUp{0%,100%{transform:rotate(0)}38%,62%{transform:rotate(-10deg)}}
@keyframes tlEar{0%,84%,100%{transform:rotate(0)}88%{transform:rotate(-16deg)}93%{transform:rotate(5deg)}}
@keyframes tlBlink{0%,93%,100%{transform:scaleY(1)}96%{transform:scaleY(.1)}}
@keyframes tlJump{0%{transform:none}14%{transform:translateY(2px) scale(1.1,.88)}40%{transform:translateY(-22px) scale(.94,1.08)}62%{transform:translateY(-16px) scale(.98,1.02)}84%{transform:translateY(0) scale(1.08,.92)}94%{transform:scale(.98,1.03)}100%{transform:none}}
@keyframes tlShadowJump{0%,100%{transform:scale(1);opacity:1}40%{transform:scale(.55);opacity:.4}}
@keyframes tlConf{0%{opacity:0;transform:translateY(6px) scale(.4)}30%{opacity:1}100%{opacity:0;transform:translateY(-14px) scale(1.1)}}
@keyframes tlZ{0%{opacity:0;transform:translate(0,0)}30%{opacity:1}100%{opacity:0;transform:translate(8px,-14px)}}
@media (prefers-reduced-motion: reduce){.tl *{animation:none!important}}
`;
const W = 'var(--m-bg-hi,#fff)', G = 'var(--m-goal,#F6C343)';
export const FOX = `
 <ellipse class="sh" cx="66" cy="111" rx="40" ry="3" fill="currentColor" opacity=".12"/>
 <g class="hop"><g class="whole">
  <g class="tail"><path d="M82 104C104 106 117 92 110 70C106 84 96 92 82 94Z" fill="currentColor"/>
   <g class="tip"><path d="M110 70C115 79 114 88 108 95C105 86 105 78 110 70Z" fill="${W}" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></g></g>
  <g class="body"><path d="M44 109C40 86 44 66 58 58C66 54 76 58 80 68C86 82 86 98 82 109Z" fill="currentColor"/>
   <path d="M58 62C55 75 58 87 64 93C66 80 68 68 70 62Z" fill="${W}"/>
   <path d="M60 109V94M72 109V94" stroke="${W}" stroke-width="2.5" stroke-linecap="round"/></g>
  <g class="head">
   <path class="ear" d="M58 38L61 18L70 32Z" fill="currentColor"/>
   <path class="ear b" d="M67 33L75 19L78 37Z" fill="currentColor"/>
   <path d="M52 61C48 49 52 39 60 35L69 31L77 36C85 40 93 44 99 50C93 55 85 57 77 57C71 63 61 65 52 61Z" fill="currentColor"/>
   <circle class="eye" cx="74" cy="44" r="2.6" fill="var(--tl-eye,${W})"/>
   <path class="closed" d="M71 44Q74 47 77 44" fill="none" stroke="var(--tl-eye,${W})" stroke-width="1.8" stroke-linecap="round"/>
   <circle cx="99" cy="50" r="2.2" fill="currentColor"/></g>
 </g>
 <g class="zz" fill="currentColor" font-family="Inter Tight,sans-serif" font-weight="700"><text x="90" y="30" font-size="13">z</text><text x="100" y="18" font-size="10">z</text></g>
 <g class="conf"><circle cx="36" cy="30" r="2.6" fill="${G}"/><circle cx="96" cy="16" r="2.6" fill="currentColor"/><path d="M48 10l4 4M52 10l-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="112" cy="40" r="2.6" fill="${G}"/></g></g>`;
export function tuli(pose = 'idle', size = 120) {
  return `<span class="tl ${pose}" role="img" aria-label="Tuli, Motio's fox"><svg width="${size}" height="${Math.round(size * 110 / 96)}" viewBox="28 6 96 110">${FOX}</svg></span>`;
}
if (typeof document !== 'undefined' && !document.getElementById('tl-css')) {
  const st = document.createElement('style'); st.id = 'tl-css'; st.textContent = CSS; document.head.appendChild(st);
}
if (typeof window !== 'undefined') window.Tuli = tuli;
