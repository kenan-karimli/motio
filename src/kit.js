// Motio 5.0 board kit: loads the design system + Tuli, adds the phone frame and a few web components.
// <m-status> <m-nav active="today"> <m-ic n="bell"> <tuli-fox pose="idle" size="64" say="…"> <m-map kind="day">
import './ds.js';
import { tuli } from './tuli.js';

const CSS = `
.scr{position:absolute;inset:0;padding:54px 20px 110px;display:flex;flex-direction:column;gap:10px;overflow:hidden;box-sizing:border-box}
.scr.nt{padding-bottom:28px}
.m-btn,.m-chip,.m-option,.input,.m-row{box-sizing:border-box}
.scr>*{flex-shrink:0}.scr>.sp{flex-shrink:1}
m-status{position:absolute;top:14px;left:30px;right:26px;display:flex;justify-content:space-between;font:600 13px 'Inter Tight';z-index:5}
.head{display:flex;align-items:flex-end;gap:8px;margin-bottom:4px}
.head .t{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.top{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:44px}
.top .m-h3{flex:1;text-align:center}
.ic{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:2.1;stroke-linecap:round;stroke-linejoin:round;display:block}
m-ic{display:inline-flex;line-height:0}
m-map{display:block;isolation:isolate;z-index:0}
m-art{display:inline-block;line-height:0}
m-scene{display:inline-block;line-height:0}
.m-card.dark m-scene,.m-card.dark m-art{color:var(--m-on-dark);--m-ink:var(--m-on-dark);--m-card:var(--m-dark-2);--m-bg-hi:var(--m-dark-2)}
.m-card.dark tuli-fox{color:var(--m-on-dark);--m-bg-hi:var(--m-dark-2)}
m-nav.m-tabbar{z-index:6;touch-action:none;user-select:none;cursor:grab}
.lq{position:absolute;left:0;top:6px;bottom:6px;border-radius:26px;background:var(--m-soft);transform-origin:50% 50%;pointer-events:none;z-index:0}
.lq.lens{background:color-mix(in srgb,var(--m-card) 55%,transparent);box-shadow:0 6px 22px rgba(0,0,0,.14),inset 0 0 0 1px rgba(255,255,255,.7),inset 0 -6px 12px rgba(0,0,0,.04);backdrop-filter:blur(4px) saturate(1.6)}
.lt{position:relative;z-index:1;background:transparent!important;transition:color .25s}
.lt .ic{transition:transform .35s cubic-bezier(.3,1.6,.5,1)}.lt.on .ic{transform:scale(1.08)}
.nd{position:absolute;top:8px;left:calc(50% + 6px);width:8px;height:8px;border-radius:4px;background:var(--m-accent);box-shadow:0 0 0 2px var(--m-card)}
.spin1{animation:mSpin1 1.3s cubic-bezier(.2,.9,.25,1.15) both}
@keyframes mSpin1{from{transform:rotate(-540deg)}to{transform:rotate(0)}}
.grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.av{width:38px;height:38px;border-radius:19px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font:600 13px 'Inter Tight';color:#fff}
.bar{height:10px;border-radius:5px;background:var(--m-soft);overflow:hidden}.bar>i{display:block;height:100%;border-radius:5px}
.rl{display:flex;gap:12px;align-items:stretch}
.rl-t{width:40px;font:600 12px 'Inter Tight';color:var(--m-mute);padding-top:12px;flex-shrink:0}
.rl-l{display:flex;flex-direction:column;align-items:center;width:14px;flex-shrink:0}
.rl-l>i:nth-child(1){width:2px;height:10px;background:var(--m-line)}
.rl-l>i:nth-child(2){width:12px;height:12px;border-radius:6px}
.rl-l>i:nth-child(3){width:2px;flex:1;background:var(--m-line)}
.rl-l.stay>i:nth-child(2){background:var(--m-card);box-shadow:inset 0 0 0 2.5px var(--m-ink)}
.rl-b{flex:1;min-width:0;padding:6px 0 12px}
.rl-b b{font-size:14px}
.rl-b .m-sub{font-size:12px}
.tw{background:color-mix(in srgb,var(--m-walk) 16%,var(--m-card))}
.tr{background:color-mix(in srgb,var(--m-run) 16%,var(--m-card))}
.tb{background:color-mix(in srgb,var(--m-bike) 16%,var(--m-card))}
.tt{background:color-mix(in srgb,var(--m-transit) 16%,var(--m-card))}
.td{background:color-mix(in srgb,var(--m-drive) 18%,var(--m-card))}
.tg{background:color-mix(in srgb,var(--m-goal) 26%,var(--m-card))}
.tx{background:color-mix(in srgb,var(--m-warn) 12%,var(--m-card))}
.field{display:flex;flex-direction:column;gap:6px}
.input{height:54px;border-radius:18px;background:var(--m-card);display:flex;align-items:center;gap:10px;padding:0 18px;font:500 15px 'Inter Tight';color:var(--m-ink)}
.input.ph-t{color:var(--m-faint)}
.input.focus{box-shadow:inset 0 0 0 2px var(--m-ink)}
.lnk{font:600 14px 'Inter Tight';color:var(--m-ink);text-decoration:underline;text-underline-offset:3px;text-decoration-color:var(--m-line)}
.sp{flex:1}
.mapbox{border-radius:22px;overflow:hidden;display:block}
/* Tuli: extra poses */
tuli-fox{display:inline-block;position:relative;line-height:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
.tl.droop .head{animation:tlDroop 5s ease-in-out infinite}
.tl.droop .ear{animation:none;transform:rotate(-22deg)}
.tl.droop .ear.b{transform:rotate(-14deg)}
.tl.droop .tail{animation:none;transform:rotate(22deg)}
.tl.droop .tip{animation:none}
.tl.lookup .head{animation:tlLookUp 4.4s ease-in-out infinite}
.tl.lookup .ear{animation:tlEar 2.4s ease-in-out infinite}
.tl.proud .whole{transform:translateY(-2px) scale(1.03)}
.tl.proud .head{animation:tlProud 5s ease-in-out infinite}
.tl.proud .tail{animation:tlTailHi 2.6s ease-in-out infinite}
.tl.trot .whole{animation:tlTrot .52s ease-in-out infinite}
.tl.trot .tail{animation:tlWag .52s ease-in-out infinite alternate}
.tl.trot .head{animation:tlNod .52s ease-in-out infinite}
.tl.listen .head{animation:tlTilt 3.2s ease-in-out infinite}
.tl.listen .ear.b{animation:tlEarTwitch 1.4s ease-in-out infinite}
.tl.wave .tail{animation:tlWave 1.1s ease-in-out infinite alternate}
.tl.wave .tip{animation:tlTip 1.1s ease-in-out infinite alternate}
.tl.wait .head{animation:tlLook 4s ease-in-out infinite}
.tl.wait .tail{animation:tlTail 1.6s ease-in-out infinite}
@keyframes tlDroop{0%,100%{transform:rotate(24deg) translate(0,3px)}50%{transform:rotate(27deg) translate(0,4px)}}
@keyframes tlLookUp{0%,100%{transform:rotate(-22deg)}50%{transform:rotate(-17deg)}}
@keyframes tlProud{0%,100%{transform:rotate(-7deg)}50%{transform:rotate(-4deg)}}
@keyframes tlTailHi{0%,100%{transform:rotate(-14deg)}50%{transform:rotate(-4deg)}}
@keyframes tlTrot{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
@keyframes tlNod{0%,100%{transform:rotate(0)}50%{transform:rotate(3deg)}}
@keyframes tlEarTwitch{0%,70%,100%{transform:rotate(0)}78%{transform:rotate(-20deg)}88%{transform:rotate(6deg)}}
@keyframes tlWave{from{transform:rotate(-12deg)}to{transform:rotate(20deg)}}
/* Tap: crouch, spring, soft land, then a speech card */
.tl.tap .whole{animation:tlTap .95s cubic-bezier(.34,1.25,.64,1) both!important}
.tl.tap .sh{animation:tlTapSh .95s cubic-bezier(.34,1.25,.64,1) both!important}
.tl.tap .tail{animation:tlWag .24s ease-in-out 4 alternate!important}
@keyframes tlTap{0%{transform:none}18%{transform:translateY(1px) scale(1.05,.94)}45%{transform:translateY(-10px) scale(.98,1.03)}72%{transform:translateY(0) scale(1.03,.97)}100%{transform:none}}
@keyframes tlTapSh{0%,100%{transform:scale(1);opacity:1}16%{transform:scale(1.12)}50%{transform:scale(.55);opacity:.35}76%{transform:scale(1.1);opacity:1}}
.say{position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);width:max-content;max-width:200px;padding:10px 14px;border-radius:18px;background:var(--m-card);color:var(--m-ink);box-shadow:0 10px 30px rgba(0,0,0,.12);font:500 13px/1.35 'Inter Tight';text-align:center;line-height:1.35;pointer-events:none;opacity:0;z-index:4}
.say b{font-weight:700}
.say::after{content:'';position:absolute;top:100%;left:50%;margin-left:-7px;border:7px solid transparent;border-top-color:var(--m-card)}
.say.on{animation:tlSay 2.8s cubic-bezier(.22,1,.36,1) .42s both}
.say.pin{opacity:1;animation:none}
.say.r{left:auto;right:-6px;transform:none}.say.r::after{left:auto;right:24px}
@keyframes tlSay{0%{opacity:0;transform:translateX(-50%) translateY(8px) scale(.92)}14%{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}84%{opacity:1;transform:translateX(-50%)}100%{opacity:0;transform:translateX(-50%) translateY(-4px)}}
@keyframes mPulse{0%{r:7;opacity:.5}100%{r:22;opacity:0}}
`;
if (!document.getElementById('m-kit')) { const st = document.createElement('style'); st.id = 'm-kit'; st.textContent = CSS; document.head.appendChild(st); }

const I = {
  home:'M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z',
  bars:'M5 20V11M12 20V5M19 20v-6',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  users:'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7M22 21v-1a6 6 0 0 0-4-5.6',
  useradd:'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M19 8v6M16 11h6',
  bell:'M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5h4',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  play:'F<path d="M7 4v16l13-8z"/>', pause:'F<path d="M6 4h4.5v16H6zM13.5 4H18v16h-4.5z"/>', stop:'F<rect x="5" y="5" width="14" height="14" rx="3"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>', plus:'M12 5v14M5 12h14', minus:'M5 12h14',
  chev:'M9 6l6 6-6 6', back:'M15 6l-6 6 6 6', down:'M6 9l6 6 6-6', x:'M6 6l12 12M18 6L6 18', check:'M5 12.5l4.5 4.5L19 7',
  pin:'<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  map:'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14',
  share:'M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5',
  edit:'M4 20h4L19 9l-4-4L4 16zM13 7l4 4', trash:'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  lock:'<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  mail:'<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 7.5l9 6 9-6"/>',
  eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff:'M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.7 8.4 2 12 2 12s3.5 7 10 7a10 10 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2',
  shield:'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', shieldok:'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM8.5 12l2.5 2.5 4.5-4.5',
  battery:'<rect x="2.5" y="7.5" width="17" height="9" rx="2.5"/><path d="M22 11v2M6 10.5v3M9.5 10.5v3"/>',
  heart:'M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z',
  flame:'M12 21c-4 0-6.5-2.7-6.5-6.3 0-3.4 2.5-5.3 3.5-8.7 2 1.4 2.6 3.2 2.6 4.6 1-1 1.6-2.4 1.6-4.1 3 2 5.3 5 5.3 8.2 0 3.6-2.5 6.3-6.5 6.3z',
  trophy:'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4',
  star:'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z',
  wifioff:'M2 8.5a15 15 0 0 1 5-3M10.5 4.6A15 15 0 0 1 22 8.5M5 12a10 10 0 0 1 4-2.3M15 10a10 10 0 0 1 4 2M8.5 15.5a5 5 0 0 1 7 0M12 19.5h.01M3 3l18 18',
  refresh:'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7', download:'M12 4v11M7 10l5 5 5-5M5 20h14',
  globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
  moon:'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  msg:'M4 5h16v11H9l-5 4z', link:'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  copy:'<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  more:'F<circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/>',
  cal:'<rect x="4" y="5" width="16" height="16" rx="2.5"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', flag:'M5 21V4M5 4h11l-2 4 2 4H5',
  route:'<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5"/>',
  bus:'<rect x="5" y="3" width="14" height="15" rx="3"/><path d="M5 11h14M8 21v-3M16 21v-3M8.5 14.5h.01M15.5 14.5h.01"/>',
  bike:'<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16l4-7h5l3 7M10 9l-1-3H7M12 16l3-7"/>',
  car:'M5 16v-5l2-5h10l2 5v5zM5 16v3M19 16v3M5 11h14M8 13.5h.01M16 13.5h.01',
  walk:'<circle cx="13" cy="4.5" r="1.8"/><path d="M9 21l2.5-6.5L9.5 11l1.5-4 3.5 2.5 2.5.5M9.5 7.5L6.5 10v3M13 14.5l2.5 6.5"/>',
  run:'<circle cx="15" cy="4.5" r="1.8"/><path d="M5 20l4-1 2-4-2.5-3 2-4 3 2 3 .5M10.5 8L7 9l-1.5 3M12.5 15l3 2 1 4"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.7M12 17h.01"/>',
  logout:'M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10', compass:'<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  camera:'<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  grid:'<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
  sliders:'<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  layers:'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5', phone:'<rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M11 18h2"/>',
  activity:'M3 12h4l3-7 4 14 3-7h4', key:'<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3"/>',
  alert:'M12 3.5l9.5 17h-19zM12 10v4.5M12 17.5h.01', info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  qr:'<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h3v3M20 14v6h-6"/>',
  send:'M4 12l16-8-6 16-3-7z', image:'<rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 8"/>',
  steps:'M7 3c2 0 3 2 3 5s-1 5-3 5-3-2-3-5 1-5 3-5zM5 16h4M17 8c2 0 3 2 3 5s-1 5-3 5-3-2-3-5 1-5 3-5zM15 21h4',
  zap:'M13 3L5 14h6l-1 7 8-11h-6z', pinoff:'M3 3l18 18M9.2 4.2A7 7 0 0 1 19 9.5c0 1.9-.9 3.9-2 5.6M14.5 17.7C13.2 19.6 12 21 12 21s-7-6.2-7-11.5c0-.9.2-1.8.5-2.6',
  hand:'M8 13V6a1.5 1.5 0 0 1 3 0v5M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v7c0 4-2.5 7-6 7-2.5 0-4-1.2-5.5-3.5L3.8 13a1.5 1.5 0 0 1 2.4-1.8L8 13',
  sync:'M4 12a8 8 0 0 1 14-5.3M20 4v4h-4M20 12a8 8 0 0 1-14 5.3M4 20v-4h4', box:'M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9',
  apps:'<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 12h6M12 9v6"/>', target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
  badge:'<circle cx="12" cy="9" r="6"/><path d="M8.5 13.5L7 21l5-2.5 5 2.5-1.5-7.5"/>',
  cloud:'M7 18a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 9.5a4.3 4.3 0 0 1-.5 8.5z', file:'M6 3h8l4 4v14H6zM14 3v4h4',
};
const icon = (n, s = 19) => { const v = I[n] || ''; const fill = v[0] === 'F'; const body = fill ? v.slice(1) : (v[0] === '<' ? v : `<path d="${v}"/>`);
  return `<svg class="ic" viewBox="0 0 24 24" style="width:${s}px;height:${s}px${fill ? ';fill:currentColor;stroke:none' : ''}">${body}</svg>`; };
window.MIcon = icon;
// Components render into shadow roots (the DC runtime owns light-DOM children). CSS variables still flow in.
let SHEET;
const sr = (el) => { if (!el.shadowRoot) { if (!SHEET) { SHEET = new CSSStyleSheet(); SHEET.replaceSync(['m-ds','tl-css','m-kit'].map((id) => document.getElementById(id)?.textContent || '').join('\n') + ':host{color:inherit}.tl{color:inherit}'); }
  el.attachShadow({ mode: 'open' }).adoptedStyleSheets = [SHEET]; } return el.shadowRoot; };

class MIc extends HTMLElement { static get observedAttributes(){return ['n','s']} connectedCallback(){this.r(); const n = this.getAttribute('n'); if ((n === 'refresh' || n === 'sync') && !this._sp) { this._sp = 1; const spin = () => { const s = this.shadowRoot.querySelector('svg'); if (!s) return; s.classList.remove('spin1'); void s.getBoundingClientRect(); s.classList.add('spin1'); }; setTimeout(spin, 500); (this.closest('.m-icon,.m-chip') || this).addEventListener('click', spin); } } attributeChangedCallback(){this.r()} r(){ sr(this).innerHTML = icon(this.getAttribute('n'), +(this.getAttribute('s') || 19)); } }
class MStatus extends HTMLElement { connectedCallback(){ sr(this).innerHTML = `<span>${this.getAttribute('time') || '9:41'}</span><span style="display:flex;align-items:center;gap:6px"><svg width="16" height="11" viewBox="0 0 16 11" fill="currentColor"><rect x="0" y="7" width="3" height="4" rx="1"/><rect x="4.3" y="5" width="3" height="6" rx="1"/><rect x="8.6" y="2.5" width="3" height="8.5" rx="1"/><rect x="12.9" y="0" width="3" height="11" rx="1"/></svg><span>82%</span></span>`; } }
class MNav extends HTMLElement {
  connectedCallback(){ if (this._on) return; this._on = 1; this.classList.add('m-tabbar');
    const T = [['today','home','Today'],['moves','bars','Moves'],['you','user','You'],['social','users','Social']];
    const dots = (this.getAttribute('dot') || '').split(' ');
    this._i = Math.max(0, T.findIndex(t => t[0] === (this.getAttribute('active') || 'today')));
    const R = sr(this);
    R.innerHTML = '<span class="lq"></span>' + T.map(([k,i,l], n) => '<span class="m-tab lt" data-n="' + n + '">' + icon(i) + l + (dots.includes(k) ? '<i class="nd"></i>' : '') + '</span>').join('');
    this._T = T; this._lq = R.querySelector('.lq'); this._tabs = [...R.querySelectorAll('.lt')];
    const place = () => this.go(this._i, false); requestAnimationFrame(place); new ResizeObserver(place).observe(this);
    let drag = null;
    this.addEventListener('pointerdown', (e) => { const s = this.getBoundingClientRect().width / this.offsetWidth || 1; drag = { s, x0: e.clientX, last: e.clientX, t: performance.now() }; this.setPointerCapture(e.pointerId); this._lq.style.transition = 'transform .18s ease-out'; this.lens(true); this.follow(e.clientX, drag, 0); });
    this.addEventListener('pointermove', (e) => { if (!drag) return; const now = performance.now(), v = (e.clientX - drag.last) / Math.max(1, now - drag.t); drag.last = e.clientX; drag.t = now; this._lq.style.transition = 'none'; this.follow(e.clientX, drag, v); });
    const end = (e) => { if (!drag) return; const d = drag; drag = null; const r = this.getBoundingClientRect(); const x = (e.clientX - r.left) / d.s; const n = this._tabs.reduce((b, t, i) => Math.abs(t.offsetLeft + t.offsetWidth / 2 - x) < Math.abs(this._tabs[b].offsetLeft + this._tabs[b].offsetWidth / 2 - x) ? i : b, 0); this.lens(false); this.go(n, true); };
    this.addEventListener('pointerup', end); this.addEventListener('pointercancel', end);
  }
  lens(on){ this._lq.classList.toggle('lens', on); }
  follow(cx, d, v){ const r = this.getBoundingClientRect(), t = this._tabs[0], w = t.offsetWidth; let x = (cx - r.left) / d.s - w / 2; x = Math.max(t.offsetLeft - 4, Math.min(this._tabs[3].offsetLeft + 4, x));
    const st = Math.min(.45, Math.abs(v) * .5); this._lq.style.transform = 'translateX(' + x + 'px) scale(' + (1.08 + st) + ',' + (1.08 - st * .45) + ')';
    const c = this._tabs.reduce((b, tt, i) => Math.abs(tt.offsetLeft - x) < Math.abs(this._tabs[b].offsetLeft - x) ? i : b, 0); this._tabs.forEach((tt, i) => tt.classList.toggle('on', i === c));
    if (c !== this._pv) { const from = this._pv == null ? this._i : this._pv; this._pv = c; if (c !== from) this.dispatchEvent(new CustomEvent('m-tab', { detail: this._T[c][0], bubbles: true, composed: true })); } }
  setProgress(f){ const a = Math.max(0, Math.min(3, Math.floor(f))), b = Math.min(3, a + 1), t = Math.max(0, Math.min(1, f - a)); const ta = this._tabs[a], tb = this._tabs[b]; const x = ta.offsetLeft + (tb.offsetLeft - ta.offsetLeft) * t; const st = Math.sin(t * Math.PI) * .22;
    this._lq.style.transition = 'none'; this._lq.style.transform = 'translateX(' + x + 'px) scale(' + (1 + st) + ',' + (1 - st * .4) + ')'; const c = Math.round(f); this._tabs.forEach((tt, i) => tt.classList.toggle('on', i === c)); }
  go(n, anim, silent){ this._pv = null; const t = this._tabs[n]; if (!t || !t.offsetWidth) return; this._lq.style.width = t.offsetWidth + 'px';
    this._lq.style.transition = anim ? 'transform .62s cubic-bezier(.3,1.6,.5,1)' : 'none'; this._lq.style.transform = 'translateX(' + t.offsetLeft + 'px) scale(1)';
    this._tabs.forEach((tt, i) => tt.classList.toggle('on', i === n));
    if (anim && n !== this._i && !silent) { this._i = n; this.dispatchEvent(new CustomEvent('m-tab', { detail: this._T[n][0], bubbles: true, composed: true })); } this._i = n; }
}

class TuliFox extends HTMLElement {
  static get observedAttributes(){return ['pose','size','say']}
  connectedCallback(){ this.r(); if (!this._b) { this._b = 1; this.addEventListener('click', () => this.tap()); } }
  attributeChangedCallback(){ if (this.isConnected) this.r(); }
  r(){ const say = this.getAttribute('say'); const pin = this.hasAttribute('pin');
    sr(this).innerHTML = tuliAny(this.getAttribute('pose') || 'idle', +(this.getAttribute('size') || 96)) + (say ? `<span class="say${pin ? ' pin' : ''}${this.hasAttribute('say-r') ? ' r' : ''}">${say}</span>` : ''); }
  tap(){ const R = this.shadowRoot; if (!R) return; const t = R.querySelector('.tl'), s = R.querySelector('.say'); if (!t) return;
    t.classList.remove('tap'); void t.offsetWidth; t.classList.add('tap'); clearTimeout(this._t); this._t = setTimeout(() => t.classList.remove('tap'), 1000);
    if (s && !this.hasAttribute('pin')) { s.style.marginLeft = '0px'; s.classList.remove('on'); void s.offsetWidth; s.classList.add('on');
      const r = s.getBoundingClientRect(), W = document.documentElement.clientWidth, k = r.width / (s.offsetWidth || r.width) || 1;
      if (r.left < 12) s.style.marginLeft = (12 - r.left) / k + 'px'; else if (r.right > W - 12) s.style.marginLeft = (W - 12 - r.right) / k + 'px'; } }
}


// ---- More Tuli: new silhouettes (stand, run, rest, front) so he isn't always the same sitting profile. ----
const WH = 'var(--m-bg-hi,#fff)';
const XP = {
 stand: { vb: '0 0 160 118', svg: '<ellipse class="sh" cx="80" cy="110" rx="54" ry="3" fill="currentColor" opacity=".12"/><g class="whole"><g class="tail" style="transform-origin:40px 56px"><path d="M40 50C18 50 0 66 4 90C12 74 24 68 42 64Z" fill="currentColor"/><path d="M4 90C2 82 4 75 10 70C12 77 10 84 4 90Z" fill="'+WH+'" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></g><g class="body"><path d="M34 52C38 40 60 38 86 40C100 41 110 48 110 58C110 72 100 80 88 80L50 80C40 80 32 68 34 52Z" fill="currentColor"/><path d="M43 70h9v38h-9zM56 70h9v38h-9zM84 70h9v38h-9zM97 70h9v38h-9z" fill="currentColor"/><path d="M43 98h9v10h-9zM56 98h9v10h-9zM84 98h9v10h-9zM97 98h9v10h-9z" fill="'+WH+'"/></g><g class="head" style="transform-origin:104px 54px"><path class="ear" d="M108 34L111 14L119 30Z" fill="currentColor"/><path class="ear b" d="M116 31L124 15L127 33Z" fill="currentColor"/><path d="M96 56C97 42 104 34 112 32L120 29L128 33C135 36 141 39 148 44C141 48 133 50 125 50C120 56 108 60 96 56Z" fill="currentColor"/><path d="M100 56C103 64 107 70 112 72C111 64 110 58 108 54Z" fill="'+WH+'"/><circle class="eye" cx="123" cy="39" r="2.4" fill="'+WH+'"/><circle cx="148" cy="44" r="2" fill="currentColor"/></g></g>' },
 run: { vb: '0 0 170 118', svg: '<ellipse class="sh" cx="86" cy="110" rx="52" ry="3" fill="currentColor" opacity=".12"/><g class="whole"><g class="tail" style="transform-origin:44px 52px"><path d="M44 50C26 54 10 50 0 40C12 44 28 42 44 42Z" fill="currentColor"/><path d="M0 40C3 46 8 49 14 49C11 45 6 42 0 40Z" fill="'+WH+'" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></g><g class="body"><path d="M40 50C46 40 70 38 94 42C106 44 114 50 114 58C112 68 104 72 92 72L56 72C46 72 38 62 40 50Z" fill="currentColor"/><g class="lf" style="transform-origin:98px 66px"><path d="M96 64L120 86" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><path d="M114 81L121 87" stroke="'+WH+'" stroke-width="4" stroke-linecap="round"/><path d="M90 66L102 96" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><path d="M99 89L102 96" stroke="'+WH+'" stroke-width="4" stroke-linecap="round"/></g><g class="lb" style="transform-origin:54px 64px"><path d="M56 64L30 84" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><path d="M35 80L30 84" stroke="'+WH+'" stroke-width="4" stroke-linecap="round"/><path d="M50 64L42 96" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><path d="M44 89L42 96" stroke="'+WH+'" stroke-width="4" stroke-linecap="round"/></g></g><g class="head" style="transform-origin:108px 52px"><path d="M108 36L114 16L120 34Z" fill="currentColor"/><path d="M116 34L126 20L127 38Z" fill="currentColor"/><path d="M102 54C104 42 110 36 118 35L126 34L134 38C142 41 150 44 156 48C150 52 140 54 132 54C126 58 112 60 102 54Z" fill="currentColor"/><circle class="eye" cx="129" cy="43" r="2.4" fill="'+WH+'"/><circle cx="156" cy="48" r="2" fill="currentColor"/></g></g>' },
 rest: { vb: '0 0 164 112', svg: '<ellipse class="sh" cx="84" cy="104" rx="66" ry="3" fill="currentColor" opacity=".12"/><g class="whole"><g class="body"><path d="M28 100C26 84 46 76 80 76C104 76 118 84 118 98V101H28Z" fill="currentColor"/><path d="M110 99H150" stroke="'+WH+'" stroke-width="4" stroke-linecap="round"/><path d="M110 99H150" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity=".0"/></g><g class="tail" style="transform-origin:34px 96px"><path d="M34 100C14 104 4 92 10 76C14 88 24 92 38 90Z" fill="currentColor"/><path d="M10 76C7 83 8 90 13 94C14 88 13 82 10 76Z" fill="'+WH+'" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></g><g class="head" style="transform-origin:112px 90px"><path class="ear" d="M114 72L118 54L126 69Z" fill="currentColor"/><path class="ear b" d="M123 69L131 56L134 72Z" fill="currentColor"/><path d="M106 92C106 80 112 72 120 70L128 68L136 72C142 75 150 80 156 86C150 90 140 92 130 91C124 96 112 97 106 92Z" fill="currentColor"/><circle class="eye" cx="131" cy="79" r="2.4" fill="'+WH+'"/><path class="closed" d="M128 79Q131 82 134 79" fill="none" stroke="'+WH+'" stroke-width="1.8" stroke-linecap="round"/><circle cx="156" cy="86" r="2" fill="currentColor"/></g></g><g class="zz" fill="currentColor" font-family="Inter Tight,sans-serif" font-weight="700"><text x="142" y="56" font-size="13">z</text><text x="152" y="42" font-size="10">z</text></g>' },
 front: { vb: '0 0 120 118', svg: '<ellipse class="sh" cx="64" cy="111" rx="38" ry="3" fill="currentColor" opacity=".12"/><g class="whole"><g class="tail" style="transform-origin:84px 104px"><path d="M82 108C102 110 112 96 106 80C102 92 94 98 82 98Z" fill="currentColor"/><path d="M106 80C110 87 109 94 104 99C102 92 103 86 106 80Z" fill="'+WH+'" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></g><g class="body"><path d="M44 58C34 70 32 92 36 110H84C88 92 86 70 76 58Z" fill="currentColor"/><path d="M52 62L60 94L68 62Z" fill="'+WH+'"/><path d="M53 110V94M67 110V94" stroke="'+WH+'" stroke-width="2.6" stroke-linecap="round"/></g><g class="head" style="transform-origin:60px 50px"><path class="ear" style="transform-origin:46px 28px" d="M36 30L40 4L54 24Z" fill="currentColor"/><path class="ear b" style="transform-origin:74px 28px" d="M84 30L80 4L66 24Z" fill="currentColor"/><path d="M32 26C40 20 80 20 88 26L86 42C82 52 70 60 60 66C50 60 38 52 34 42Z" fill="currentColor"/><path d="M44 42C50 46 70 46 76 42L60 62Z" fill="'+WH+'"/><circle class="eye" style="transform-origin:48px 35px" cx="48" cy="35" r="2.6" fill="'+WH+'"/><circle class="eye" style="transform-origin:72px 35px" cx="72" cy="35" r="2.6" fill="'+WH+'"/><circle cx="60" cy="59" r="2.6" fill="currentColor"/></g></g>' },
};
const XCSS = '.tl.x-stand .head{animation:tlLook 8s ease-in-out infinite}.tl.x-stand .body{animation:tlBreathe 3.8s ease-in-out infinite;transform-origin:72px 76px}.tl.x-stand .tail{animation:tlTail 3s ease-in-out infinite}'+
 '.tl.x-run .whole{animation:tlTrot .42s ease-in-out infinite}.tl.x-run .lf{animation:tlLegF .42s ease-in-out infinite alternate}.tl.x-run .lb{animation:tlLegB .42s ease-in-out infinite alternate}.tl.x-run .tail{animation:tlTail .84s ease-in-out infinite}.tl.x-run .head{animation:tlNod .42s ease-in-out infinite}'+
 '.tl.x-rest .body{animation:tlBreathe 5s ease-in-out infinite;transform-origin:72px 100px}.tl.x-rest .eye{display:none}.tl.x-rest .closed,.tl.x-rest .zz{display:inline}.tl.x-rest .zz{animation:tlZ 3s ease-in-out infinite}.tl.x-rest .ear.b{animation:tlEarTwitch 5s ease-in-out infinite;transform-origin:128px 70px}.tl.x-rest .tail{animation:tlTail 7s ease-in-out infinite}'+
 '.tl.x-rest.awake .eye{display:inline}.tl.x-rest.awake .closed,.tl.x-rest.awake .zz{display:none}'+
 '.tl.x-front .head{animation:tlFront 6s ease-in-out infinite}.tl.x-front .eye{animation:tlBlink 4.6s infinite}.tl.x-front .tail{animation:tlTail 3.4s ease-in-out infinite}.tl.x-front .ear{animation:tlEar 6s ease-in-out infinite}'+
 '@keyframes tlLegF{from{transform:rotate(-16deg)}to{transform:rotate(14deg)}}@keyframes tlLegB{from{transform:rotate(16deg)}to{transform:rotate(-14deg)}}@keyframes tlFront{0%,100%{transform:rotate(0)}30%,45%{transform:rotate(-8deg)}70%,85%{transform:rotate(5deg)}}';
document.getElementById('m-kit').textContent += XCSS;
const tuliAny = (pose, size) => { const base = pose.split(' ')[0]; const x = XP[base]; if (!x) return tuli(pose, size);
  const [, , w, h] = x.vb.split(' ').map(Number); return '<span class="tl x-' + pose + '" role="img" aria-label="Tuli, Motio\'s fox"><svg width="' + size + '" height="' + Math.round(size * h / w) + '" viewBox="' + x.vb + '" style="overflow:visible">' + x.svg + '</svg></span>'; };

// ---- Object scenes: calm ink line drawings with one colour accent, for screens that don't need Tuli. ----
const K = 'var(--m-ink)', P = 'var(--m-card)', BL = '<path d="M34 46C58 14 146 10 172 46C196 80 170 134 106 136C46 138 12 86 34 46Z" fill="currentColor" opacity=".05"/>';
const st = (d, extra = '') => '<path d="' + d + '" fill="none" stroke="' + K + '" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" ' + extra + '/>';
const sh = (d, f = P) => '<path d="' + d + '" fill="' + f + '" stroke="' + K + '" stroke-width="2.6" stroke-linejoin="round"/>';
const spark = (x, y, c = K) => '<path d="M' + x + ' ' + (y - 7) + 'v14M' + (x - 7) + ' ' + y + 'h14M' + (x - 4.5) + ' ' + (y - 4.5) + 'l9 9M' + (x + 4.5) + ' ' + (y - 4.5) + 'l-9 9" stroke="' + c + '" stroke-width="2" stroke-linecap="round" class="tw1"/>';
const ART = {
 location: BL + sh('M44 56L80 44L118 58L156 46V114L118 126L80 112L44 124Z') + st('M80 44V112M118 58V126') + '<path d="M58 106C72 94 88 104 102 90S128 80 140 72" fill="none" stroke="var(--m-walk)" stroke-width="3.4" stroke-linecap="round" stroke-dasharray="1 7"/>' + '<g class="fl"><path d="M140 20c-11 0-19 8-19 18 0 13 19 30 19 30s19-17 19-30c0-10-8-18-19-18z" fill="' + K + '"/><circle cx="140" cy="38" r="6" fill="' + P + '"/></g>' + spark(40, 30),
 activity: BL + sh('M42 100L46 70C58 68 68 62 74 54L94 56C98 70 118 78 152 82C164 84 168 92 166 100Z') + sh('M42 100H166V106C166 111 162 114 157 114H47C44 114 42 111 42 108Z', K) + st('M76 62L86 70M82 57L92 65M60 86H120') + '<g class="tw1">' + st('M14 74H30M8 88H28M18 60H30') + '</g><circle cx="146" cy="40" r="7" fill="var(--m-walk)"/><circle cx="166" cy="56" r="4" fill="var(--m-bike)"/><circle cx="126" cy="28" r="4" fill="var(--m-transit)"/>',
 battery: BL + '<rect x="46" y="48" width="100" height="58" rx="14" fill="' + P + '" stroke="' + K + '" stroke-width="2.6"/><rect x="146" y="66" width="10" height="22" rx="4" fill="' + K + '"/><rect x="58" y="60" width="22" height="34" rx="6" fill="var(--m-walk)"/><rect x="86" y="60" width="22" height="34" rx="6" fill="var(--m-walk)"/><rect x="114" y="60" width="20" height="34" rx="6" fill="var(--m-walk)" class="bl"/>' + st('M100 118v10M86 124l-4 7M114 124l4 7') + spark(40, 34),
 bell: BL + '<g class="sw" style="transform-origin:100px 32px">' + sh('M100 34c-22 0-34 17-34 38v20l-10 15h88l-10-15V72c0-21-12-38-34-38z') + st('M90 114a10 10 0 0 0 20 0') + '</g><circle cx="132" cy="44" r="10" fill="var(--m-goal)" stroke="' + K + '" stroke-width="2.6"/>' + '<g class="tw1">' + st('M38 58c-6 8-6 20 0 28M162 58c6 8 6 20 0 28') + '</g>',
 heart: BL + '<g class="pu" style="transform-origin:100px 80px">' + sh('M100 124S48 96 48 62a24 24 0 0 1 52-14 24 24 0 0 1 52 14c0 34-52 62-52 62z') + '</g>' + st('M24 84H66L76 64L90 106L102 74L110 84H176', 'stroke-dasharray="300" class="dr"') + '<circle cx="132" cy="50" r="6" fill="var(--m-run)"/>',
 mail: BL + '<g class="fl">' + sh('M62 30h76a6 6 0 0 1 6 6v56H56V36a6 6 0 0 1 6-6z') + '<circle cx="80" cy="56" r="4" fill="' + K + '"/><circle cx="94" cy="56" r="4" fill="' + K + '"/><circle cx="108" cy="56" r="4" fill="' + K + '"/><circle cx="122" cy="56" r="4" fill="var(--m-goal)" stroke="' + K + '" stroke-width="2"/></g>' + sh('M44 66L100 100L156 66V122a8 8 0 0 1-8 8H52a8 8 0 0 1-8-8z') + st('M44 128L88 96M156 128L112 96'),
 key: BL + '<g class="sw" style="transform-origin:72px 80px">' + '<circle cx="72" cy="80" r="24" fill="' + P + '" stroke="' + K + '" stroke-width="2.6"/><circle cx="72" cy="80" r="8" fill="none" stroke="' + K + '" stroke-width="2.6"/>' + st('M96 80H164M144 80v15M156 80v11') + '</g>' + spark(150, 40, 'var(--m-goal)') + spark(40, 120),
 lock: BL + st('M78 64V48a22 22 0 0 1 44 0v16') + '<rect x="62" y="64" width="76" height="62" rx="16" fill="' + P + '" stroke="' + K + '" stroke-width="2.6"/><circle cx="100" cy="90" r="7" fill="' + K + '"/>' + st('M100 96v12') + '<g class="zz2">' + '<text x="146" y="50" font-family="Inter Tight" font-weight="700" font-size="16" fill="' + K + '">z</text><text x="158" y="34" font-family="Inter Tight" font-weight="700" font-size="12" fill="' + K + '">z</text></g>',
 cloud: BL + sh('M62 112a22 22 0 0 1-2-44 32 32 0 0 1 62-6 24 24 0 0 1 20 50z') + st('M54 40L150 128', 'stroke-width="3"') + '<g class="rn">' + st('M70 124v8M96 126v8M122 124v8') + '</g>',
 plug: BL + st('M10 108C46 108 46 80 72 80') + sh('M72 66h26a6 6 0 0 1 6 6v16a6 6 0 0 1-6 6H72z') + st('M104 74h12M104 86h12') + '<rect x="132" y="58" width="40" height="44" rx="10" fill="' + P + '" stroke="' + K + '" stroke-width="2.6"/>' + st('M146 72v8M158 72v8') + '<g class="tw1">' + st('M120 60l4-8M124 98l5 6M118 50l-2-8', 'stroke="var(--m-warn)"') + '</g>',
 sign: BL + st('M100 36V132') + sh('M62 46H132L144 58L132 70H62Z') + sh('M138 82H72L60 94L72 106H138Z') + st('M74 58h40M84 94h40') + '<circle cx="100" cy="30" r="5" fill="' + K + '"/>' + st('M70 132h60'),
 pinoff: BL + sh('M100 26c-20 0-34 15-34 33 0 24 34 56 34 56s34-32 34-56c0-18-14-33-34-33z') + '<circle cx="100" cy="58" r="11" fill="none" stroke="' + K + '" stroke-width="2.6"/>' + st('M58 26L142 122', 'stroke="var(--m-warn)" stroke-width="3"') + st('M76 132h48'),
 gift: BL + sh('M58 76h84v50a6 6 0 0 1-6 6H64a6 6 0 0 1-6-6z') + sh('M52 60h96v16H52z') + st('M100 60v72') + st('M100 60c-8-16-30-20-30-6 0 8 18 8 30 6zM100 60c8-16 30-20 30-6 0 8-18 8-30 6z') + spark(160, 34, 'var(--m-goal)') + spark(40, 44),
 update: BL + '<rect x="70" y="24" width="60" height="108" rx="14" fill="' + P + '" stroke="' + K + '" stroke-width="2.6"/>' + '<g class="fl">' + st('M100 52v30M88 72l12 12 12-12') + '</g><rect x="84" y="100" width="32" height="6" rx="3" fill="' + K + '" opacity=".12"/><rect x="84" y="100" width="20" height="6" rx="3" fill="' + K + '"/>' + spark(152, 44, 'var(--m-goal)'),
 box: BL + sh('M100 40L150 62V112L100 134L50 112V62Z') + st('M50 62L100 84L150 62M100 84V134') + '<g class="fl">' + st('M100 14v30M88 32l12 12 12-12') + '</g>',
 ticket: BL + sh('M40 54h120v18a10 10 0 0 0 0 20v18H40V92a10 10 0 0 0 0-20z') + st('M118 58v48', 'stroke-dasharray="2 7"') + '<text x="58" y="88" font-family="Inter Tight" font-weight="700" font-size="20" letter-spacing="2" fill="' + K + '">TULI-7K</text>' + spark(160, 34, 'var(--m-goal)'),
 trash: BL + sh('M66 52h68l-6 76a6 6 0 0 1-6 6H78a6 6 0 0 1-6-6z') + '<g class="lidt">' + st('M56 52h88M86 52V40h28v12') + '</g>' + st('M90 70v46M110 70v46'),
 chat: BL + sh('M40 40h80a10 10 0 0 1 10 10v34a10 10 0 0 1-10 10H70l-18 16V94H40a10 10 0 0 1-10-10V50a10 10 0 0 1 10-10z') + '<g class="fl">' + sh('M110 70h50a10 10 0 0 1 10 10v24a10 10 0 0 1-10 10h-4v12l-14-12h-32a10 10 0 0 1-10-10z', 'var(--m-soft)') + '</g>' + st('M52 62h52M52 76h34'),
 shoe: '', 
};
const ACSS = '.ma{display:inline-block;line-height:0;color:var(--m-ink)}.ma svg{overflow:visible}.ma *{transform-box:fill-box}.ma .fl{animation:maFloat 3.6s ease-in-out infinite}.ma .tw1{animation:maTw 2.6s ease-in-out infinite;transform-origin:center}.ma .sw{animation:maSwing 3s ease-in-out infinite;transform-box:view-box}.ma .pu{animation:maPulse 1.6s ease-in-out infinite;transform-box:view-box}.ma .bl{animation:maBlink 1.6s ease-in-out infinite}.ma .rn{animation:maRain 1.8s linear infinite}.ma .dr{stroke-dashoffset:300;animation:maDraw 2.4s cubic-bezier(.22,1,.36,1) forwards}'+
 '@keyframes maFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}@keyframes maTw{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.8)}}@keyframes maSwing{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg)}}@keyframes maPulse{0%,100%{transform:scale(1)}15%{transform:scale(1.06)}30%{transform:scale(1)}}@keyframes maBlink{0%,100%{opacity:1}50%{opacity:.25}}@keyframes maRain{from{transform:translateY(-4px);opacity:1}to{transform:translateY(8px);opacity:0}}@keyframes maDraw{to{stroke-dashoffset:0}}';
document.getElementById('m-kit').textContent += ACSS;
const IDLE = {
  gift: [[['[d^="M52 60h96"]', '[d^="M100 60c-8"]'], 'lid'], [['[d^="M58 76h84"]', '[d^="M100 60v72"]'], 'wob']],
  update: [[['rect[y="100"][width="20"]'], 'pg']],
  sign: [[['[d^="M62 46H132"]', '[d^="M138 82H72"]', '[d^="M74 58h40"]'], 'sway']],
  cloud: [[['[d^="M62 112a22"]'], 'fl']],
  plug: [[['[d^="M10 108C46"]', '[d^="M72 66h26"]', '[d^="M104 74h12"]'], 'plg']],
  pinoff: [[['[d^="M100 26c-20"]', 'circle[cx="100"][cy="58"]'], 'bob']],
  location: [[['[stroke-dasharray="1 7"]'], 'march']],
  activity: [[['[d^="M42 100L46 70"]', '[d^="M42 100H166"]', '[d^="M76 62L86"]'], 'tap']],
  lock: [[['[d^="M78 64V48"]'], 'shk']],
  chat: [[['[d^="M40 40h80"]', '[d^="M52 62h52"]'], 'fl2']],
  ticket: [[['[d^="M40 54h120"]', '[d^="M118 58v48"]', 'text'], 'tilt']],
  mail: [[['[d^="M44 66L100"]', '[d^="M44 128L88"]'], 'env']],
};
const ACSS2 = '.ma .in{animation:maIn .8s cubic-bezier(.34,1.4,.64,1) both;transform-origin:50% 100%}.ma .drw{animation:maDrawIn 1s cubic-bezier(.65,0,.35,1) both}'+
 '.ma .lid{animation:maLid 3.4s cubic-bezier(.34,1.5,.64,1) 1s infinite;transform-origin:50% 100%}.ma .wob{animation:maWob 3.4s ease-in-out 1s infinite;transform-origin:50% 100%}'+
 '.ma .pg{animation:maPg 2.6s cubic-bezier(.65,0,.35,1) infinite;transform-origin:0 50%}'+
 '.ma .sway{animation:maSway 4s ease-in-out infinite;transform-box:view-box;transform-origin:100px 36px}'+
 '.ma .plg{animation:maPlug 2.8s cubic-bezier(.34,1.5,.64,1) infinite}'+
 '.ma .bob{animation:maBob 2.4s cubic-bezier(.45,0,.55,1) infinite;transform-origin:50% 100%}'+
 '.ma .march{animation:maMarch 1.2s linear infinite}'+
 '.ma .tap{animation:maTap 1.6s cubic-bezier(.34,1.4,.64,1) infinite;transform-box:view-box;transform-origin:160px 108px}'+
 '.ma .shk{animation:maShk 3.2s cubic-bezier(.34,1.6,.64,1) infinite}.ma .zz2{animation:maZ 3s ease-in-out infinite}'+
 '.ma .fl2{animation:maFloat 3.6s ease-in-out 1.8s infinite}'+
 '.ma .tilt{animation:maTilt 5s ease-in-out infinite;transform-origin:50% 50%}'+
 '.ma .env{animation:none}.ma .lidt{animation:maLidT 3s cubic-bezier(.34,1.6,.64,1) infinite;transform-origin:20% 100%}'+
 '.ma rect[fill="var(--m-walk)"]{animation:maCell 2.4s ease-in-out infinite}.ma rect[fill="var(--m-walk)"]+rect[fill="var(--m-walk)"]{animation-delay:.3s}.ma rect[fill="var(--m-walk)"]+rect[fill="var(--m-walk)"]+rect[fill="var(--m-walk)"]{animation-delay:.6s}'+
 '@keyframes maIn{from{opacity:0;transform:translateY(10px) scale(.92)}to{opacity:1;transform:none}}@keyframes maDrawIn{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}'+
 '@keyframes maLid{0%,62%,100%{transform:none}70%{transform:translateY(-16px) rotate(-7deg)}80%{transform:translateY(-10px) rotate(4deg)}90%{transform:translateY(-2px)}}@keyframes maWob{0%,62%,100%{transform:none}68%{transform:scale(1.05,.93)}78%{transform:scale(.97,1.04)}88%{transform:none}}'+
 '@keyframes maPg{0%{transform:scaleX(.15)}70%,100%{transform:scaleX(1.6)}}@keyframes maSway{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg)}}'+
 '@keyframes maPlug{0%,100%{transform:none}35%{transform:translateX(14px)}45%{transform:translateX(9px)}55%{transform:translateX(12px)}75%{transform:none}}'+
 '@keyframes maBob{0%,100%{transform:translateY(0)}45%{transform:translateY(-12px) scale(.98,1.03)}60%{transform:translateY(0) scale(1.06,.94)}70%{transform:none}}'+
 '@keyframes maMarch{to{stroke-dashoffset:-16}}@keyframes maTap{0%,60%,100%{transform:none}20%{transform:rotate(-9deg)}35%{transform:rotate(1.5deg)}}'+
 '@keyframes maShk{0%,55%,100%{transform:none}65%{transform:translateY(-9px)}75%{transform:translateY(-6px)}85%{transform:none}}@keyframes maTilt{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg) translateY(-3px)}}'+
 '@keyframes maLidT{0%,55%,100%{transform:none}65%{transform:translateY(-10px) rotate(-14deg)}78%{transform:translateY(-6px) rotate(-8deg)}90%{transform:none}}'+
 '@keyframes maCell{0%,20%{opacity:.15}35%,80%{opacity:1}100%{opacity:.15}}@keyframes maZ{0%,100%{opacity:.25;transform:translateY(4px)}50%{opacity:1;transform:translateY(-4px)}}';
document.getElementById('m-kit').textContent += ACSS2;
const animateArt = (svg, name) => {
  (IDLE[name] || []).forEach(([sels, cls]) => { const els = sels.map((q) => svg.querySelector(q)).filter((e) => e && e.parentNode === svg); if (!els.length) return; const g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.setAttribute('class', cls); svg.insertBefore(g, els[0]); els.forEach((e) => g.appendChild(e)); });
  if (name === 'box') svg.querySelectorAll('g.fl').forEach((g) => g.setAttribute('class', 'bob'));
  if (name === 'location') svg.querySelectorAll('g.fl').forEach((g) => g.setAttribute('class', 'bob'));
  svg.querySelectorAll('path').forEach((p, i) => { if (p.getAttribute('fill') === 'none' && !p.hasAttribute('stroke-dasharray') && !p.getAttribute('class')) { p.setAttribute('pathLength', '1'); p.style.strokeDasharray = '1'; p.classList.add('drw'); p.style.animationDelay = (.15 + i * .06) + 's'; } });
  [...svg.children].forEach((c, i) => { if (i === 0) return; const g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.setAttribute('class', 'in'); g.style.animationDelay = (i * .07) + 's'; svg.insertBefore(g, c); g.appendChild(c); });
};
class MArt extends HTMLElement { static get observedAttributes(){return ['name','size']} connectedCallback(){this.r(); if (!this._c) { this._c = 1; this.addEventListener('click', () => this.r()); } } attributeChangedCallback(){ if (this.isConnected) this.r(); }
  r(){ const s = +(this.getAttribute('size') || 200); sr(this).innerHTML = '<span class="ma"><svg width="' + s + '" height="' + Math.round(s * .76) + '" viewBox="0 0 200 152">' + (ART[this.getAttribute('name')] || '') + '</svg></span>'; animateArt(this.shadowRoot.querySelector('svg'), this.getAttribute('name')); } }

// ---- Personality scenes: Tuli + an object that tells the type. ----
const G = (y = 140) => '<path d="M6 ' + y + 'H234" stroke="' + K + '" stroke-width="2.6" stroke-linecap="round"/>';
const SC = {
 wanderer: { art: G() + st('M44 140V36M44 36C44 26 56 24 64 28') + sh('M58 28h16l-3 10h-10z') + '<circle cx="66" cy="46" r="5" fill="var(--m-goal)" class="bl"/>' + st('M200 140V74') + '<rect x="170" y="58" width="60" height="20" rx="5" fill="' + P + '" stroke="' + K + '" stroke-width="2.6"/><text x="200" y="72" text-anchor="middle" font-family="Inter Tight" font-weight="700" font-size="10" fill="' + K + '">NIZAMI</text>' + '<path d="M70 150C110 146 150 152 196 148" fill="none" stroke="var(--m-walk)" stroke-width="3" stroke-linecap="round" stroke-dasharray="1 7"/>', fox: ['stand', 116, 72, 20] },
 commuter: { art: G() + st('M196 140V44') + '<circle cx="196" cy="34" r="17" fill="' + P + '" stroke="' + K + '" stroke-width="2.6"/><text x="196" y="39" text-anchor="middle" font-family="Inter Tight" font-weight="700" font-size="13" fill="var(--m-transit)">88</text><rect x="186" y="66" width="20" height="28" rx="3" fill="' + P + '" stroke="' + K + '" stroke-width="2.2"/>' + st('M34 108H140M42 108V140M132 108V140M34 96H140'), fox: ['idle', 62, 58, 52] },
 wheeler: { art: G() + '<circle cx="64" cy="112" r="26" fill="none" stroke="' + K + '" stroke-width="2.6"/><circle cx="160" cy="112" r="26" fill="none" stroke="' + K + '" stroke-width="2.6"/>' + st('M64 112L98 74H142L160 112M98 74L114 112H64M142 74L114 112M92 66H108M142 74L138 60H152', 'stroke="var(--m-bike)"') + '<circle cx="114" cy="112" r="5" fill="' + K + '"/>', fox: ['idle', 52, 188, 20] },
 runner: { art: G() + '<path d="M70 140A50 50 0 0 1 170 140Z" fill="color-mix(in srgb,var(--m-goal) 35%,var(--m-card))" stroke="' + K + '" stroke-width="2.6"/>' + '<g class="tw1">' + st('M120 74V60M80 92L70 82M160 92L170 82M58 122H44M182 122H196') + '</g>', fox: ['run', 140, 58, 20] },
 explorer: { art: G() + sh('M16 140L74 62L102 98L142 40L228 140Z') + st('M128 58L142 40L156 58L148 54L142 60L136 54Z') + st('M142 40V18') + '<path d="M142 18L158 24L142 30Z" fill="var(--m-goal)" stroke="' + K + '" stroke-width="2.2" stroke-linejoin="round"/>', fox: ['curious', 58, 24, 20] },
 tripper: { behind: true, art: '<g stroke-dasharray="14 12">' + st('M6 150H234') + '</g>' + st('M86 86L100 66H150L172 86') + sh('M26 120V102C26 94 32 90 40 90L86 86H172L204 92C212 94 216 100 216 108V120Z') + st('M124 66V86') + '<circle cx="66" cy="120" r="15" fill="' + K + '"/><circle cx="66" cy="120" r="5" fill="' + P + '"/><circle cx="176" cy="120" r="15" fill="' + K + '"/><circle cx="176" cy="120" r="5" fill="' + P + '"/><rect x="200" y="98" width="10" height="6" rx="2" fill="var(--m-drive)"/>', fox: ['front', 36, 94, 70] },
};
class MScene extends HTMLElement { static get observedAttributes(){return ['name','size']} connectedCallback(){this.r()} attributeChangedCallback(){ if (this.isConnected) this.r(); }
  r(){ const c = SC[this.getAttribute('name')] || SC.wanderer, w = +(this.getAttribute('size') || 240), k = w / 240, [pose, fs, fx, fb] = c.fox;
    this.style.display = 'inline-block';
    sr(this).innerHTML = '<span style="position:relative;display:block;width:' + w + 'px;height:' + Math.round(160 * k) + 'px"><span class="ma" style="position:absolute;inset:0;z-index:' + (c.behind ? 2 : 1) + '"><svg width="' + w + '" height="' + Math.round(160 * k) + '" viewBox="0 0 240 160" style="overflow:visible">' + c.art + '</svg></span><span style="position:absolute;left:' + fx * k + 'px;bottom:' + fb * k + 'px;z-index:' + (c.behind ? 1 : 2) + '">' + tuliAny(pose, Math.round(fs * k)) + '</span></span>'; } }
customElements.get('m-scene') || customElements.define('m-scene', MScene);

// Stylised Baku map: soft land, white streets, the Caspian and the Boulevard along the bottom.
const C = { walk:'var(--m-walk)', run:'var(--m-run)', bike:'var(--m-bike)', bus:'var(--m-transit)', drive:'var(--m-drive)', ink:'var(--m-ink)' };
const ln = (d, c, w = 5, extra = '') => `<path d="${d}" fill="none" stroke="var(--m-card)" stroke-width="${w + 4}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
const dot = (x, y, c = 'var(--m-ink)', r = 6) => `<circle cx="${x}" cy="${y}" r="${r + 3}" fill="var(--m-card)"/><circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;
const stay = (x, y) => `<circle cx="${x}" cy="${y}" r="8" fill="var(--m-card)" stroke="var(--m-ink)" stroke-width="3"/>`;
const label = (x, y, t) => `<text x="${x}" y="${y}" font-family="Inter Tight" font-weight="600" font-size="10" fill="var(--m-mute)">${t}</text>`;
function base() {
  return `<rect x="-60" y="-520" width="470" height="1400" fill="var(--m-soft)"/>
  <path d="M-60 236C0 240 70 226 150 252 230 240S320 214 410 222V900H-60Z" fill="color-mix(in srgb,var(--m-bike) 11%,var(--m-soft))"/>
  <path d="M0 230C70 218 150 244 230 232S320 206 350 214" fill="none" stroke="color-mix(in srgb,var(--m-walk) 18%,var(--m-soft))" stroke-width="10"/>
  <rect x="40" y="-150" width="90" height="60" rx="12" fill="color-mix(in srgb,var(--m-walk) 12%,var(--m-soft))"/><rect x="236" y="40" width="70" height="46" rx="10" fill="color-mix(in srgb,var(--m-walk) 12%,var(--m-soft))"/>
  <g fill="none" stroke="var(--m-card)" stroke-linecap="round">
   <path d="M-60 220C-10 214 90 200 200 216 360 196L420 190" stroke-width="8"/><path d="M20 -410L92 310" stroke-width="7"/><path d="M204 -410L200 -10C188 100 232 160 248 310" stroke-width="7"/><path d="M-60 -60L420 -36M-60 -330L420 -310" stroke-width="7"/><path d="M-60 -200L420 -176" stroke-width="5"/>
   <path d="M-60 88L420 122" stroke-width="7"/><path d="M-60 162L420 148" stroke-width="5"/>
   <path d="M128 -410L150 220M290 -410L310 210M50 -410L20 220M-60 38L420 60M100 120L230 190M-60 -120L420 -100M-60 -260L420 -246M120 -60L260 -176" stroke-width="3"/></g>
  ${label(10, 254, 'Caspian Sea')}`;
}
const MAPS = {
  day: () => base() + ln('M70 62L84 124L150 130', C.walk) + ln('M150 130C200 140 236 186 300 184', C.bike) + ln('M300 184L314 150', C.walk) + stay(70, 62) + stay(150, 130) + dot(314, 150) + label(44, 50, 'Home') + label(118, 148, 'Port Baku') + label(262, 140, 'Nizami St'),
  trip: () => base() + ln('M40 100L122 108C178 114 198 150 210 200L330 194', C.bus, 6) + [[80,104],[160,116],[204,170],[268,197]].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="4" fill="var(--m-card)" stroke="var(--m-transit)" stroke-width="2.5"/>`).join('') + stay(40, 100) + dot(330, 194) + label(22, 88, '28 May') + label(286, 182, 'Sahil'),
  walk: () => base() + ln('M70 62L84 124L150 130L156 176', C.walk) + stay(70, 62) + dot(156, 176) + label(44, 50, 'Home') + label(166, 180, 'Port Baku Mall'),
  run: () => base() + ln('M52 216C120 204 200 222 290 206C326 200 324 186 290 190C200 202 120 190 52 204C40 206 40 214 52 216Z', C.run) + dot(52, 210, 'var(--m-ink)', 5) + label(150, 180, 'Seaside Boulevard'),
  live: () => base() + ln('M70 62L84 124L150 130L190 150', C.walk) + `<path d="M190 150L240 176" fill="none" stroke="var(--m-faint)" stroke-width="3" stroke-dasharray="2 7" stroke-linecap="round"/><circle cx="190" cy="150" r="7" fill="var(--m-walk)" style="animation:mPulse 1.8s ease-out infinite"/>` + stay(70, 62) + dot(190, 150, 'var(--m-walk)', 7) + label(44, 50, 'Home'),
  drive: () => base() + ln('M20 160L360 150', C.drive) + ln('M200 154C190 110 194 60 200 -10', C.drive) + dot(20, 160) + dot(200, 20),
  friend: () => base() + ln('M40 180C90 176 120 140 150 128L226 124', C.walk) + ln('M226 124C250 110 270 80 300 72', C.bike) + stay(40, 180) + `<circle cx="300" cy="72" r="18" fill="var(--m-run)" opacity=".18"/><circle cx="300" cy="72" r="13" fill="var(--m-run)" stroke="var(--m-card)" stroke-width="3"/><text x="300" y="76.5" text-anchor="middle" font-family="Inter Tight" font-weight="700" font-size="12" fill="#fff">L</text>` + `<circle cx="96" cy="120" r="13" fill="var(--m-ink)" stroke="var(--m-card)" stroke-width="3"/><text x="96" y="124.5" text-anchor="middle" font-family="Inter Tight" font-weight="700" font-size="10" fill="var(--m-bg-hi)">AM</text>`,
  segment: () => base() + ln('M40 214C110 202 200 218 300 202', C.bike, 5) + `<path d="M120 208C170 206 210 214 260 208" fill="none" stroke="var(--m-ink)" stroke-width="7" stroke-linecap="round"/>` + dot(120, 208, 'var(--m-ink)', 5) + `<circle cx="260" cy="208" r="8" fill="var(--m-card)" stroke="var(--m-ink)" stroke-width="3"/>` + label(130, 192, 'Boulevard sprint · 1.4 km'),
  city: () => { let g = ''; const on = (c, r) => { const dx = c - 7, dy = r - 5.5; const d = Math.sqrt(dx*dx*.8 + dy*dy*1.4) + Math.sin(c*1.7 + r*2.3) * 1.4; return d < 4.6; };
    for (let r = 0; r < 12; r++) for (let c = 0; c < 14; c++) { const x = c * 25, y = r * 25; if (y > 225) continue; if (on(c, r)) g += `<rect x="${x+2}" y="${y+2}" width="21" height="21" rx="6" fill="var(--m-ink)" opacity="${.55 + ((c*7+r*3)%5)*.08}"/>`; else g += `<rect x="${x+2}" y="${y+2}" width="21" height="21" rx="6" fill="none" stroke="var(--m-line)" stroke-width="1"/>`; }
    return base() + g; },
  all: () => base() + ln('M70 62L84 124L150 130', C.walk) + ln('M150 130C200 140 236 186 300 184', C.bike) + ln('M40 100L122 108C178 114 198 150 210 200', C.bus) + ln('M20 160L120 156', C.drive) + ln('M52 216C120 204 200 222 290 206', C.run) + stay(70, 62) + stay(150, 130) + stay(300, 184),
};
class MMap extends HTMLElement { static get observedAttributes(){return ['kind']} connectedCallback(){this.r()} attributeChangedCallback(){ if (this.isConnected) this.r(); }
  r(){ const k = this.getAttribute('kind') || 'day'; this.style.display = 'block'; sr(this).innerHTML = `<svg width="100%" height="100%" viewBox="0 0 350 300" preserveAspectRatio="xMidYMid slice" style="display:block">${(MAPS[k] || MAPS.day)()}</svg>`;
    if (!this._ro) { this._ro = new ResizeObserver(() => this.fit()); this._ro.observe(this); } this.fit(); if (!this.hasAttribute('sketch')) this.real(); }
  fit(){ const svg = this.shadowRoot && this.shadowRoot.querySelector('svg'); const w = this.clientWidth, h = this.clientHeight; if (!svg || !w || !h) return;
    if (h / w > 300 / 350) { const H = 350 * h / w, y0 = 150 - H * (+(this.getAttribute('focus') || .42)); svg.setAttribute('viewBox', `0 ${y0} 350 ${H}`); } else { const H = 350 * h / w, fy = +(this.getAttribute('fy') || (this.getAttribute('kind') === 'run' || this.getAttribute('kind') === 'segment' ? 205 : 150)); const y0 = Math.max(0, Math.min(300 - H, fy - H / 2)); svg.setAttribute('viewBox', `0 ${y0} 350 ${H}`); } } }


// ---- Real maps: Leaflet + CARTO tiles of Baku, drawn over the SVG sketch once loaded. ----
let LP;
const leaflet = () => LP || (LP = new Promise((res, rej) => { if (window.L) return res(window.L); const s = document.createElement('script'); s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; s.onload = () => res(window.L); s.onerror = rej; document.head.appendChild(s); }));
const CV = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const MC = { walk: '#2FB457', run: '#E5604F', bike: '#4F7BF0', bus: '#8E6BE0', drive: '#E7A82A' };
const PT = { home: [40.3836, 49.8150], port: [40.3747, 49.8597], blvd: [40.3628, 49.8342], niz: [40.3772, 49.8425], ganj: [40.4006, 49.8513], sahil: [40.3718, 49.8445] };
const RT = {
  walk1: [PT.home, [40.3812, 49.8235], [40.3790, 49.8330], [40.3772, 49.8440], [40.3760, 49.8530], PT.port],
  bike1: [PT.port, [40.3722, 49.8572], [40.3695, 49.8525], [40.3668, 49.8462], [40.3646, 49.8398], PT.blvd],
  walk2: [PT.blvd, [40.3668, 49.8362], [40.3712, 49.8384], [40.3745, 49.8405], PT.niz],
  bus: [PT.ganj, [40.3958, 49.8508], [40.3902, 49.8497], [40.3846, 49.8489], [40.3797, 49.8487], [40.3762, 49.8470], PT.sahil],
  run: [[40.3598, 49.8296], [40.3618, 49.8335], [40.3640, 49.8388], [40.3662, 49.8446], [40.3688, 49.8504], [40.3712, 49.8556], [40.3735, 49.8590]],
  seg: [[40.3640, 49.8388], [40.3662, 49.8446], [40.3688, 49.8504]],
  drive: [[40.3700, 49.8400], [40.3590, 49.8240], [40.3460, 49.8110], [40.3330, 49.8020], [40.3200, 49.7960], [40.3110, 49.7890]],
  fwalk: [[40.3700, 49.8300], [40.3725, 49.8360], [40.3752, 49.8400], PT.niz],
  fbike: [[40.3650, 49.8480], [40.3690, 49.8520], [40.3730, 49.8555]],
};
MMap.prototype.real = function () {
  const kind = this.getAttribute('kind') || 'day'; const tok = (this._tok = (this._tok || 0) + 1);
  leaflet().then((L) => { if (tok !== this._tok || !this.isConnected) return;
    const dark = !!this.closest('.m-dark-theme');
    const R = this.shadowRoot; R.innerHTML = '<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><style>.leaflet-container{background:' + (dark ? '#1b1b1b' : '#EEEEEC') + ';font:500 9px Inter Tight,sans-serif}.leaflet-control-attribution{background:transparent!important;color:#999;font-size:8px;padding:0 6px}.leaflet-control-attribution a{color:#999}.leaflet-tile-pane{filter:' + (dark ? 'none' : 'saturate(0)') + '}.av-pin{width:30px;height:30px;border-radius:15px;display:flex;align-items:center;justify-content:center;font:700 11px Inter Tight;box-shadow:0 4px 14px rgba(0,0,0,.18)}</style><div class="mp" style="position:absolute;inset:0"></div>';
    this.style.position = this.style.position || 'relative'; if (getComputedStyle(this).position === 'static') this.style.position = 'relative';
    const el = R.querySelector('.mp');
    const m = L.map(el, { zoomControl: false, attributionControl: true, scrollWheelZoom: false, dragging: true, doubleClickZoom: false, boxZoom: false, keyboard: false, zoomSnap: .25 });
    m.attributionControl.setPrefix(false);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/' + (dark ? 'World_Dark_Gray_Base' : 'World_Light_Gray_Base') + '/MapServer/tile/{z}/{y}/{x}', { attribution: 'Esri, HERE, OpenStreetMap', maxZoom: 16, crossOrigin: true }).addTo(m);
    const ink = dark ? '#F2F2F0' : '#0F0F0F', card = dark ? '#1A1A1A' : '#FFFFFF';
    const all = [];
    const line = (pts, c, w = 5) => { all.push(...pts); L.polyline(pts, { color: card, weight: w + 4, opacity: 1, lineCap: 'round', lineJoin: 'round' }).addTo(m); return L.polyline(pts, { color: c, weight: w, opacity: 1, lineCap: 'round', lineJoin: 'round' }).addTo(m); };
    const stay = (p) => { all.push(p); L.circleMarker(p, { radius: 7, color: ink, weight: 3, fillColor: card, fillOpacity: 1 }).addTo(m); };
    const end = (p, c = ink, r = 6) => { all.push(p); L.circleMarker(p, { radius: r + 3, stroke: false, fillColor: card, fillOpacity: 1 }).addTo(m); L.circleMarker(p, { radius: r, stroke: false, fillColor: c, fillOpacity: 1 }).addTo(m); };
    const pin = (p, t, bg, fg) => { all.push(p); L.marker(p, { icon: L.divIcon({ className: '', iconSize: [30, 30], iconAnchor: [15, 15], html: '<div class="av-pin" style="background:' + bg + ';color:' + fg + ';border:3px solid ' + card + '">' + t + '</div>' }) }).addTo(m); };
    const K = {
      day: () => { line(RT.walk1, MC.walk); line(RT.bike1, MC.bike); line(RT.walk2, MC.walk); stay(PT.home); stay(PT.port); stay(PT.blvd); end(PT.niz); },
      walk: () => { line(RT.walk1, MC.walk); stay(PT.home); end(PT.port); },
      trip: () => { line(RT.bus, MC.bus, 6); RT.bus.slice(1, -1).forEach((p) => L.circleMarker(p, { radius: 4, color: MC.bus, weight: 2.5, fillColor: card, fillOpacity: 1 }).addTo(m)); stay(PT.ganj); end(PT.sahil); },
      run: () => { line(RT.run, MC.run); end(RT.run[0], ink, 5); },
      live: () => { line(RT.walk1.slice(0, 4), MC.walk); L.polyline(RT.walk1.slice(3), { color: dark ? '#5E5E5A' : '#A3A39F', weight: 3, dashArray: '2 8', lineCap: 'round' }).addTo(m); all.push(...RT.walk1); stay(PT.home); L.circleMarker(RT.walk1[3], { radius: 16, stroke: false, fillColor: MC.walk, fillOpacity: .18 }).addTo(m); end(RT.walk1[3], MC.walk, 7); },
      drive: () => { line(RT.drive, MC.drive); end(RT.drive[0]); stay(RT.drive[RT.drive.length - 1]); },
      friend: () => { line(RT.fwalk, MC.walk); line(RT.fbike, MC.bike); pin(PT.niz, 'L', card, ink); pin(RT.fbike[2], 'M', card, ink); pin(PT.home, 'AM', ink, card); },
      segment: () => { line(RT.run, MC.bike, 5); L.polyline(RT.seg, { color: ink, weight: 7, lineCap: 'round' }).addTo(m); end(RT.seg[0], ink, 5); stay(RT.seg[2]); },
      city: () => { const S = .006, la0 = 40.352, lo0 = 49.795; for (let r = 0; r < 10; r++) for (let c = 0; c < 15; c++) { const la = la0 + r * S, lo = lo0 + c * S * 1.3; const d = Math.hypot((r - 4.5) * 1.2, (c - 7.5) * .8) + Math.sin(c * 1.7 + r * 2.3) * 1.2; const on = d < 4.2;
          L.rectangle([[la + .0004, lo + .0005], [la + S - .0004, lo + S * 1.3 - .0005]], { stroke: !on, color: dark ? '#3A3A38' : '#C9C9C5', weight: 1, fillColor: ink, fillOpacity: on ? .5 + ((c * 7 + r * 3) % 5) * .07 : 0 }).addTo(m); all.push([la, lo], [la + S, lo + S * 1.3]); } },
      all: () => { line(RT.walk1, MC.walk); line(RT.bike1, MC.bike); line(RT.walk2, MC.walk); line(RT.bus, MC.bus); line(RT.run, MC.run); line(RT.drive.slice(0, 3), MC.drive); stay(PT.home); stay(PT.port); stay(PT.niz); },
    };
    (K[kind] || K.day)();
    const fitB = () => { m.invalidateSize(); if (all.length) m.fitBounds(L.latLngBounds(all), { padding: [24, 24], maxZoom: 16 }); };
    fitB(); this._lm = m; if (!this._ro2) { this._ro2 = new ResizeObserver(() => this._lm && fitB()); this._ro2.observe(this); }
  }).catch(() => {});
};


// ---- Tap the dimmed background to close a sheet or menu (smooth). Tap the phone again to reopen it. ----
if (!window.__mScrim) { window.__mScrim = 1;
  const isScrim = (el) => el && el.tagName === 'DIV' && /inset:\s*0/.test(el.getAttribute('style') || '') && /rgba\(15,\s*15,\s*15/.test(el.getAttribute('style') || '');
  const panelsOf = (sc) => { const out = []; let n = sc.nextElementSibling; while (n) { if (n.matches('.m-sheet,.m-card') && getComputedStyle(n).position === 'absolute') out.push(n); n = n.nextElementSibling; } return out; };
  const EASE = 'cubic-bezier(.22,1,.36,1)';
  const outFx = (p) => p.classList.contains('m-sheet') ? [{ transform: 'none' }, { transform: 'translateY(105%)' }] : [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.92) translateY(-6px)' }];
  const close = (sc) => { if (sc._closed) return; sc._closed = 1; const ps = panelsOf(sc);
    sc.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320, easing: EASE, fill: 'forwards' });
    ps.forEach((p) => { p.style.transformOrigin = 'top right'; p.animate(outFx(p), { duration: p.classList.contains('m-sheet') ? 420 : 240, easing: EASE, fill: 'forwards' }); });
    setTimeout(() => { sc.style.visibility = 'hidden'; ps.forEach((p) => (p.style.visibility = 'hidden')); }, 430); sc.closest('.ph')._scrim = sc; };
  const open = (sc) => { sc._closed = 0; const ps = panelsOf(sc); sc.style.visibility = ''; ps.forEach((p) => (p.style.visibility = ''));
    sc.getAnimations().forEach((a) => a.cancel()); sc.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: EASE });
    ps.forEach((p) => { p.getAnimations().forEach((a) => a.cancel()); p.animate(outFx(p).reverse(), { duration: p.classList.contains('m-sheet') ? 460 : 300, easing: p.classList.contains('m-sheet') ? EASE : 'cubic-bezier(.34,1.4,.64,1)' }); }); };
  document.addEventListener('click', (e) => { const t = e.target; if (isScrim(t)) { close(t); return; }
    const ph = t.closest && t.closest('.ph'); if (ph && ph._scrim && ph._scrim._closed) { open(ph._scrim); ph._scrim = null; } }, true);
  const mark = () => document.querySelectorAll('.ph div[style*="inset:0"]').forEach((d) => { if (isScrim(d)) d.style.cursor = 'pointer'; });
  setTimeout(mark, 800);
}


// ---- Glass effect (Settings → Glass effect). Saved on this device; on by default. ----
const GCSS = '.m-glass .m-tabbar{background:color-mix(in srgb,var(--m-card) 42%,transparent)!important;-webkit-backdrop-filter:blur(26px) saturate(1.9);backdrop-filter:blur(26px) saturate(1.9);box-shadow:inset 0 1px 0 rgba(255,255,255,.85),inset 0 -1px 0 rgba(255,255,255,.3),inset 0 0 0 1px rgba(255,255,255,.35),0 12px 34px rgba(0,0,0,.14)!important}'+
 ':host-context(.m-glass) .lq{background:linear-gradient(180deg,rgba(255,255,255,.75),rgba(255,255,255,.35));box-shadow:inset 0 1px 0 #fff,inset 0 -2px 6px rgba(0,0,0,.05),0 2px 8px rgba(0,0,0,.08)}'+
 ':host-context(.m-glass) .lq.lens{background:rgba(255,255,255,.22);box-shadow:inset 0 1px 1px #fff,inset 0 -3px 10px rgba(255,255,255,.5),inset 0 0 0 1px rgba(255,255,255,.8),0 10px 28px rgba(0,0,0,.16);backdrop-filter:blur(2px) saturate(2) brightness(1.08)}'+
 ':host-context(.m-glass.m-dark-theme) .lq,:host-context(.m-dark-theme .m-glass) .lq,:host-context(.m-glass .m-dark-theme) .lq{background:linear-gradient(180deg,rgba(255,255,255,.18),rgba(255,255,255,.06));box-shadow:inset 0 1px 0 rgba(255,255,255,.25)}'+
 '.m-glass .m-sheet{background:color-mix(in srgb,var(--m-card) 66%,transparent)!important;-webkit-backdrop-filter:blur(30px) saturate(1.7);backdrop-filter:blur(30px) saturate(1.7);box-shadow:inset 0 1px 0 rgba(255,255,255,.8),0 -10px 40px rgba(0,0,0,.1)}'+
 '.m-glass .ph>.m-card[style*="position:absolute"],.m-glass .ph>div>.m-card[style*="position:absolute"]{background:color-mix(in srgb,var(--m-card) 62%,transparent)!important;-webkit-backdrop-filter:blur(26px) saturate(1.8);backdrop-filter:blur(26px) saturate(1.8);box-shadow:inset 0 1px 0 rgba(255,255,255,.8),inset 0 0 0 1px rgba(255,255,255,.4),0 18px 50px rgba(0,0,0,.16)!important}'+
 '.m-glass .ph>div[style*="position:absolute"] .m-icon,.m-glass .ph>div[style*="position:absolute"] .m-chip:not(.on){background:color-mix(in srgb,var(--m-card) 55%,transparent);-webkit-backdrop-filter:blur(18px) saturate(1.8);backdrop-filter:blur(18px) saturate(1.8);box-shadow:inset 0 1px 0 rgba(255,255,255,.8),0 4px 16px rgba(0,0,0,.08)!important}'+
 '.m-glass .ph div[style*="rgba(15,15,15"]{-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}'+
 '.m-dark-theme.m-glass .m-tabbar,.m-glass .m-dark-theme .m-tabbar,.m-dark-theme .m-glass .m-tabbar{box-shadow:inset 0 1px 0 rgba(255,255,255,.14),inset 0 0 0 1px rgba(255,255,255,.08),0 12px 34px rgba(0,0,0,.4)!important}'+
 '.m-toggle[data-glass]{background:var(--m-line)!important}.m-toggle[data-glass]::after{transform:none!important}:root.m-glass .m-toggle[data-glass]{background:var(--m-accent)!important}:root.m-glass .m-toggle[data-glass]::after{transform:translateX(20px)!important}';
document.getElementById('m-kit').textContent += GCSS; if (typeof SHEET !== 'undefined' && SHEET) SHEET.replaceSync(['m-ds','tl-css','m-kit'].map((id) => document.getElementById(id)?.textContent || '').join('\n') + ':host{color:inherit}.tl{color:inherit}');
const setGlass = (on) => { document.documentElement.classList.toggle('m-glass', on); try { localStorage.setItem('motio-glass', on ? '1' : '0'); } catch (_) {} document.querySelectorAll('[data-glass]').forEach((t) => t.classList.toggle('on', on)); };
let gOn = true; try { gOn = localStorage.getItem('motio-glass') !== '0'; } catch (_) {}
document.documentElement.classList.toggle('m-glass', gOn);
setTimeout(() => document.querySelectorAll('[data-glass]').forEach((t) => t.classList.toggle('on', gOn)), 300);
if (!window.__mTog) { window.__mTog = 1; document.addEventListener('click', (e) => { const t = e.target.closest && e.target.closest('.m-toggle'); if (!t || !(t.hasAttribute('data-glass') || t.closest('.ph'))) return; /* app switches handle their own taps */ e.stopPropagation(); if (t.hasAttribute('data-glass')) setGlass(!document.documentElement.classList.contains('m-glass')); else t.classList.toggle('on'); }, true);
  window.addEventListener('storage', (e) => { if (e.key === 'motio-glass') setGlass(e.newValue !== '0'); }); }


// ---- Tab bar hides when you scroll down, comes back when you scroll up. ----
document.getElementById('m-kit').textContent += '.ph>.scr{overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none}.ph>.scr::-webkit-scrollbar{display:none}.mbar{position:absolute;left:0;right:0;top:0;height:96px;z-index:7;display:flex;align-items:flex-end;justify-content:center;padding-bottom:14px;box-sizing:border-box;pointer-events:none;background:color-mix(in srgb,var(--m-bg) 72%,transparent);-webkit-backdrop-filter:blur(22px) saturate(1.8);backdrop-filter:blur(22px) saturate(1.8);box-shadow:0 1px 0 color-mix(in srgb,var(--m-ink) 7%,transparent);opacity:0;transform:translateY(-8px);transition:opacity .35s cubic-bezier(.22,1,.36,1),transform .45s cubic-bezier(.22,1,.36,1)}.mbar b{font:600 16px "Inter Tight";letter-spacing:-.3px;color:var(--m-ink);transform:translateY(6px);transition:transform .45s cubic-bezier(.22,1,.36,1)}.mbar.on{opacity:1;transform:none}.mbar.on b{transform:none}.m-title{transition:opacity .3s ease,transform .45s cubic-bezier(.22,1,.36,1);transform-origin:0 100%}.scr.sc .m-title{opacity:0;transform:scale(.94) translateY(-4px)}.mfloat{transition:transform .55s cubic-bezier(.3,1.35,.5,1),opacity .35s cubic-bezier(.22,1,.36,1)}.mfloat.hid{transform:translateY(calc(100% + 30px)) scale(.96)!important;opacity:0;transition:transform .42s cubic-bezier(.4,0,.2,1),opacity .3s ease}status-shade{display:none}m-nav.m-tabbar{transition:transform .55s cubic-bezier(.3,1.35,.5,1),opacity .35s cubic-bezier(.22,1,.36,1)}m-nav.m-tabbar.hid{transform:translateY(calc(100% + 30px)) scale(.96);opacity:0;transition:transform .42s cubic-bezier(.4,0,.2,1),opacity .3s ease}';
if (!window.__mHide) { window.__mHide = 1;
  document.addEventListener('scroll', (e) => { const s = e.target; if (!s.classList || !s.classList.contains('scr')) return; const ph = s.parentElement; if (!ph || !ph.classList.contains('ph')) return;
    if (!ph._fl) { ph._fl = [...ph.querySelectorAll(':scope > m-nav, :scope > div[style*="position:absolute"]')].filter((d) => { const st = d.getAttribute('style') || ''; return d.tagName === 'M-NAV' || (/bottom:\s*(1[0-9]|2[0-9]|3[0-9])px/.test(st) && !/inset/.test(st) && !/top:/.test(st)); }); ph._fl.forEach((d) => d.classList.add('mfloat'));
      const t = s.querySelector('.m-title') || s.querySelector('.top .m-h3'); const bar = document.createElement('div'); bar.className = 'mbar'; bar.innerHTML = '<b></b>'; bar.firstChild.textContent = t ? t.textContent.replace(/\.$/, '').replace(/^./, (c) => c.toUpperCase()) : ''; ph.appendChild(bar); ph._bar = bar; ph._big = !!s.querySelector('.m-title'); }
    const y = s.scrollTop, last = s._y || 0, d = y - last; s._y = y;
    const hide = (on) => ph._fl.forEach((f) => f.classList.toggle('hid', on));
    if (y < 24) hide(false); else if (d > 4) hide(true); else if (d < -4) hide(false);
    const past = y > (ph._big ? 70 : 20); ph._bar.classList.toggle('on', past); s.classList.toggle('sc', past && ph._big);
    clearTimeout(s._t); s._t = setTimeout(() => { if (s.scrollHeight - s.clientHeight - s.scrollTop < 4) hide(false); }, 600); }, true);
  document.addEventListener('m-tab', (e) => { const n = e.target.closest && e.target.closest('m-nav'); if (n) n.classList.remove('hid'); });
}

[['m-art', MArt], ['m-ic', MIc], ['m-status', MStatus], ['m-nav', MNav], ['tuli-fox', TuliFox], ['m-map', MMap]].forEach(([n, c]) => customElements.get(n) || customElements.define(n, c));
