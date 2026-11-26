// Motio 5.0 board kit: loads the design system + Tuli, adds the phone frame and a few web components.
// <m-status> <m-nav active="today"> <m-ic n="bell"> <tuli-fox pose="idle" size="64" say="…"> <m-map kind="day">
import './ds.js';
import { tuli, FOX } from './tuli.js';

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
.tl.tap .hop{animation:tlTap .9s cubic-bezier(.34,1.2,.64,1) both}
.tl.tap:not(.cheer) .sh{animation:tlTapSh .9s cubic-bezier(.34,1.2,.64,1) both}
@keyframes tlTap{0%{transform:none}18%{transform:translateY(1px) scale(1.04,.96)}45%{transform:translateY(-8px) scale(.99,1.02)}72%{transform:translateY(0) scale(1.02,.98)}100%{transform:none}}
@keyframes tlTapSh{0%,100%{transform:scale(1);opacity:1}16%{transform:scale(1.12)}50%{transform:scale(.55);opacity:.35}76%{transform:scale(1.1);opacity:1}}
.say{position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);width:max-content;max-width:200px;padding:10px 14px;border-radius:18px;background:var(--m-card);color:var(--m-ink);box-shadow:0 10px 30px rgba(0,0,0,.12);font:500 13px/1.35 'Inter Tight';text-align:center;line-height:1.35;pointer-events:none;opacity:0;z-index:4}
.say b{font-weight:700}
.say::after{content:'';position:absolute;top:100%;left:50%;margin-left:-7px;border:7px solid transparent;border-top-color:var(--m-card)}
.say.on{animation:tlSay 2.8s cubic-bezier(.22,1,.36,1) .42s both}
.say.pin{opacity:1;animation:none}
.say.dn{bottom:auto;top:calc(100% + 8px)}.say.dn::after{top:auto;bottom:100%;border-top-color:transparent;border-bottom-color:var(--m-card)}.say.r{left:auto;right:-6px;transform:none}.say.r::after{left:auto;right:24px}
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
      if (r.top < 8) s.classList.add('dn'); if (r.left < 12) s.style.marginLeft = (12 - r.left) / k + 'px'; else if (r.right > W - 12) s.style.marginLeft = (W - 12 - r.right) / k + 'px'; } }
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
// Everything but the shadow goes in .hop, so a tap hops the fox without resetting the pose's own loop.
const hopWrap = (s) => { const i = s.indexOf('<g class="whole"'); return s.includes('class="hop"') || i < 0 ? s : s.slice(0, i) + '<g class="hop">' + s.slice(i) + '</g>'; };
const tuliAny = (pose, size) => { const base = pose.split(' ')[0]; const x = XP[base]; if (!x) return tuli(pose, size);
  const [, , w, h] = x.vb.split(' ').map(Number); return '<span class="tl ' + (x.cls ? x.cls + ' ' : '') + 'x-' + pose + '" role="img" aria-label="Tuli, Motio\'s fox"><svg width="' + size + '" height="' + Math.round(size * h / w) + '" viewBox="' + x.vb + '" style="overflow:visible">' + hopWrap(x.svg) + '</svg></span>'; };

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
// ---- 5.0 illustration set: ink line drawings, one gold accent, drawn in piece by piece, then a small idle loop. ----
// Each piece's motion is a class on its own group (see ACSS3), so nothing resets mid-loop.
const GD = 'var(--m-goal)', SO = 'var(--m-soft)';
const sc = (d, c = K, w = 2.6, x = '') => '<path d="' + d + '" fill="none" stroke="' + c + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round" ' + x + '/>';
const cir = (x, y, r, f = P, x2 = '') => '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + f + '" stroke="' + K + '" stroke-width="2.6" ' + x2 + '/>';
const grp = (cls, inner, s = '') => '<g class="' + cls + '"' + (s ? ' style="' + s + '"' : '') + '>' + inner + '</g>';
const star4 = (x, y, r, f = K, x2 = '') => '<path d="M' + x + ' ' + (y - r) + 'Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y + 'Q' + x + ' ' + y + ' ' + x + ' ' + (y + r) + 'Q' + x + ' ' + y + ' ' + (x - r) + ' ' + y + 'Q' + x + ' ' + y + ' ' + x + ' ' + (y - r) + 'Z" fill="' + f + '" ' + x2 + '/>';
const star5 = (cx, cy, R, r, f) => '<path d="M' + Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r : R; return (cx + q * Math.cos(a)).toFixed(1) + ' ' + (cy + q * Math.sin(a)).toFixed(1); }).join('L') + 'Z" fill="' + f + '" stroke="' + K + '" stroke-width="2.2" stroke-linejoin="round"/>';
const FLAME = 'M12 21c-4 0-6.5-2.7-6.5-6.3 0-3.4 2.5-5.3 3.5-8.7 2 1.4 2.6 3.2 2.6 4.6 1-1 1.6-2.4 1.6-4.1 3 2 5.3 5 5.3 8.2 0 3.6-2.5 6.3-6.5 6.3z';
const flameAt = (cx, cy, s, f) => '<g transform="translate(' + (cx - 12 * s) + ' ' + (cy - 13.5 * s) + ') scale(' + s + ')" style="transform-box:view-box"><path d="' + FLAME + '" fill="' + f + '" stroke="' + K + '" stroke-width="' + (2.6 / s).toFixed(2) + '" stroke-linejoin="round"/></g>';
const pinAt = (x, y, r, f) => '<path d="M' + x + ' ' + y + 'C' + (x - r * .4) + ' ' + (y - r * .6) + ' ' + (x - r) + ' ' + (y - r * 1.2) + ' ' + (x - r) + ' ' + (y - r * 1.9) + 'a' + r + ' ' + r + ' 0 0 1 ' + 2 * r + ' 0C' + (x + r) + ' ' + (y - r * 1.2) + ' ' + (x + r * .4) + ' ' + (y - r * .6) + ' ' + x + ' ' + y + 'Z" fill="' + f + '" stroke="' + K + '" stroke-width="2.6" stroke-linejoin="round"/><circle cx="' + x + '" cy="' + (y - r * 1.9) + '" r="' + (r * .38).toFixed(1) + '" fill="' + K + '"/>';
const waveD = (x, y, n) => 'M' + x + ' ' + y + 'q6 -5 12 0' + ' t12 0'.repeat(n - 1);
const wheel = (x, y, r) => grp('spin', '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="none" stroke="' + K + '" stroke-width="2.6"/>' + sc('M' + (x - r) + ' ' + y + 'h' + 2 * r + 'M' + x + ' ' + (y - r) + 'v' + 2 * r + 'M' + (x - r * .7) + ' ' + (y - r * .7) + 'l' + r * 1.4 + ' ' + r * 1.4 + 'M' + (x + r * .7) + ' ' + (y - r * .7) + 'l' + (-r * 1.4) + ' ' + r * 1.4, K, 1.3, 'class="sp"') + '<circle cx="' + x + '" cy="' + y + '" r="3.5" fill="' + K + '"/>');
const CRES = (x1, y1, x2, y2, R, r, f) => '<path d="M' + x1 + ' ' + y1 + 'A' + R + ' ' + R + ' 0 1 0 ' + x2 + ' ' + y2 + 'A' + r + ' ' + r + ' 0 0 1 ' + x1 + ' ' + y1 + 'Z" fill="' + f + '" stroke="' + K + '" stroke-width="2.6" stroke-linejoin="round"/>';
const heartD = (x, y, s) => 'M' + x + ' ' + (y + 9 * s) + 'c' + (-6 * s) + ' ' + (-4 * s) + ' ' + (-10 * s) + ' ' + (-7 * s) + ' ' + (-10 * s) + ' ' + (-11 * s) + 'a' + 5 * s + ' ' + 5 * s + ' 0 0 1 ' + 10 * s + ' ' + (-2 * s) + 'a' + 5 * s + ' ' + 5 * s + ' 0 0 1 ' + 10 * s + ' ' + 2 * s + 'c0 ' + 4 * s + ' ' + (-4 * s) + ' ' + 7 * s + ' ' + (-10 * s) + ' ' + 11 * s + 'z';
const person = (x, f, arm, d) => cir(x, 56, 15) + '<circle cx="' + (x - 5) + '" cy="55" r="1.8" fill="' + K + '"/><circle cx="' + (x + 5) + '" cy="55" r="1.8" fill="' + K + '"/>' + sc('M' + (x - 4) + ' 62q4 3 8 0', K, 2) + sh('M' + (x - 26) + ' 132C' + (x - 26) + ' 104 ' + (x - 16) + ' 86 ' + x + ' 86C' + (x + 16) + ' 86 ' + (x + 26) + ' 104 ' + (x + 26) + ' 132Z', f) +
  grp('wave', sc('M' + (x + arm * 18) + ' 100C' + (x + arm * 30) + ' 88 ' + (x + arm * 34) + ' 76 ' + (x + arm * 32) + ' 64', K, 2.6, 'class="arm"') + cir(x + arm * 32, 60, 5), 'transform-origin:' + (x + arm * 18) + 'px 100px;animation-delay:' + d + 's');
const hand = (cx, rot) => '<g transform="rotate(' + rot + ' ' + cx + ' 134)" style="transform-box:view-box">' + sh('M' + (cx - 15) + ' 106h30l4 28H' + (cx - 19) + 'z') + '<rect x="' + (cx - 16) + '" y="96" width="32" height="12" rx="3" fill="' + K + '"/>' + '<rect x="' + (cx - 17) + '" y="44" width="34" height="54" rx="15" fill="' + P + '" stroke="' + K + '" stroke-width="2.6"/>' + '<rect x="' + (cx + (rot > 0 ? -27 : 13)) + '" y="66" width="14" height="26" rx="7" fill="' + P + '" stroke="' + K + '" stroke-width="2.6"/>' + sc('M' + (cx - 5) + ' 46v16M' + (cx + 5) + ' 46v16', K, 1.8, 'class="fn"') + '</g>';
const CONF = [[30, 30, 'r', K, 160], [56, 18, 'c', GD, 0], [92, 22, 'r', GD, -120], [128, 16, 'q', K, 90], [150, 40, 'c', K, 0], [168, 26, 'r', GD, 200], [176, 62, 'q', GD, -80], [140, 70, 'r', K, 140], [116, 46, 'c', GD, 0], [70, 44, 'q', K, 120], [44, 64, 'c', K, 0], [160, 92, 'c', GD, 0]];
const confetti = CONF.map(([x, y, t, c, r], i) => '<g class="cf" style="--dx:' + (84 - x) + 'px;--dy:' + (100 - y) + 'px;--r:' + r + 'deg;animation-delay:' + (i * .17).toFixed(2) + 's">' + (t === 'r' ? '<rect x="' + (x - 5) + '" y="' + (y - 2.5) + '" width="10" height="5" rx="1.5" fill="' + c + '"/>' : t === 'c' ? '<circle cx="' + x + '" cy="' + y + '" r="3.4" fill="' + c + '"/>' : sc('M' + (x - 7) + ' ' + y + 'q3.5-5 7 0t7 0', c, 2.4, 'class="sq"')) + '</g>').join('');
const steps = [[38, 124], [64, 106], [92, 88], [120, 68], [148, 50]].map(([x, y], i) => { const o = i % 2 ? 1 : -1; return '<g class="fp" style="animation-delay:' + (i * .32).toFixed(2) + 's"><g transform="translate(' + (x + o * 5) + ' ' + (y + o * 7) + ') rotate(55)" style="transform-box:view-box"><ellipse cx="0" cy="-4" rx="5.5" ry="8" fill="' + K + '"/><ellipse cx="0" cy="8.5" rx="4.2" ry="4.6" fill="' + K + '"/></g></g>'; }).join('');
const rays = Array.from({ length: 9 }, (_, i) => { const a = (-170 + i * 20) * Math.PI / 180; return 'M' + (100 + 50 * Math.cos(a)).toFixed(1) + ' ' + (108 + 50 * Math.sin(a)).toFixed(1) + 'L' + (100 + 64 * Math.cos(a)).toFixed(1) + ' ' + (108 + 64 * Math.sin(a)).toFixed(1); }).join('');
const ticks = Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6; return 'M' + (100 + 39 * Math.cos(a)).toFixed(1) + ' ' + (84 + 39 * Math.sin(a)).toFixed(1) + 'L' + (100 + 43 * Math.cos(a)).toFixed(1) + ' ' + (84 + 43 * Math.sin(a)).toFixed(1); }).join('');
const twk = (s, d) => s.replace('/>', ' class="tw1" style="animation-delay:' + d + 's"/>');
Object.assign(ART, {
 walk: BL + '<path d="M24 134C64 122 120 100 166 56" fill="none" stroke="' + K + '" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="1 7" class="march" opacity=".35"/>' + steps + st('M168 56V18') + '<path d="M168 18L188 25L168 32Z" fill="' + GD + '" stroke="' + K + '" stroke-width="2.2" stroke-linejoin="round" class="flg"/>' + spark(36, 40),
 shoe: BL + '<path d="M18 136C70 128 130 138 186 130" fill="none" stroke="' + K + '" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="1 7" class="march"/>' + grp('step', sh('M48 104L52 74C64 72 74 66 80 58L100 60C104 74 122 82 150 86C162 88 166 96 164 104Z') + sh('M48 104H164V110C164 115 160 118 155 118H53C50 118 48 115 48 112Z', K) + st('M72 64L82 72M78 59L88 67M58 88H118')) + '<g class="tw1">' + st('M12 78H30M8 92H26M18 64H30') + '</g>' + cir(152, 42, 7, GD),
 bike: BL + st('M18 136H184') + wheel(56, 108, 26) + wheel(146, 108, 26) + st('M56 108L82 70H130L146 108M82 70L100 108H56M130 70L100 108M72 62H92M130 70L126 56H142') + cir(100, 108, 6, GD) + '<g class="tw1">' + st('M6 82H24M12 96H28') + '</g>',
 busstop: BL + st('M10 136H190') + grp('drive', grp('bob2', sh('M28 58h106a12 12 0 0 1 12 12v50H18V68a10 10 0 0 1 10-10z') + st('M28 70h20v20H28zM56 70h22v20H56zM86 70h20v20H86zM114 70h18v38h-18zM123 70v38M18 100H114') + '<circle cx="138" cy="110" r="3" fill="' + P + '" stroke="' + K + '" stroke-width="2"/>' + '<circle cx="44" cy="122" r="11" fill="' + K + '"/><circle cx="44" cy="122" r="4" fill="' + P + '"/><circle cx="104" cy="122" r="11" fill="' + K + '"/><circle cx="104" cy="122" r="4" fill="' + P + '"/>') + '<circle cx="10" cy="112" r="5" fill="' + K + '" opacity=".25" class="puff"/>') + st('M170 136V56') + '<rect x="162" y="70" width="16" height="22" rx="3" fill="' + P + '" stroke="' + K + '" stroke-width="2.4"/>' + cir(170, 42, 15, GD) + '<text x="170" y="47" text-anchor="middle" font-family="Inter Tight" font-weight="700" font-size="13" fill="' + K + '">88</text>',
 carkeys: BL + grp('sw', '<circle cx="96" cy="36" r="14" fill="none" stroke="' + K + '" stroke-width="2.6"/>' + st('M86 46L78 58M106 46L118 58') + sh('M60 58h34a10 10 0 0 1 10 10v36a10 10 0 0 1-10 10H60a10 10 0 0 1-10-10V68a10 10 0 0 1 10-10z') + cir(77, 74, 7, GD) + '<circle cx="68" cy="96" r="4" fill="' + K + '"/><circle cx="86" cy="96" r="4" fill="' + K + '"/>' + cir(126, 70, 13) + '<circle cx="126" cy="70" r="4" fill="' + K + '"/>' + st('M126 83V130M126 108h9M126 120h7'), 'transform-origin:96px 22px') + spark(160, 40) + spark(36, 120),
 metro: BL + '<path d="M34 138V92a66 66 0 0 1 132 0v46" fill="' + SO + '" stroke="' + K + '" stroke-width="2.6" stroke-linejoin="round"/>' + grp('apr', sh('M84 60h32a14 14 0 0 1 14 14v56H70V74a14 14 0 0 1 14-14z') + '<rect x="78" y="70" width="44" height="24" rx="7" fill="' + K + '"/>' + '<circle cx="84" cy="112" r="5" fill="' + P + '" stroke="' + K + '" stroke-width="2.4" class="bl"/><circle cx="116" cy="112" r="5" fill="' + P + '" stroke="' + K + '" stroke-width="2.4" class="bl"/>' + st('M92 122h16')) + st('M88 130L76 146M112 130L124 146M80 140H120') + cir(160, 28, 15, GD) + '<text x="160" y="34" text-anchor="middle" font-family="Inter Tight" font-weight="700" font-size="16" fill="' + K + '">M</text>',
 track: BL + '<ellipse cx="100" cy="94" rx="88" ry="42" fill="' + SO + '" stroke="' + K + '" stroke-width="2.6"/><ellipse cx="100" cy="94" rx="72" ry="31" fill="none" stroke="' + K + '" stroke-width="1.6" stroke-dasharray="4 7" opacity=".5"/><ellipse cx="100" cy="94" rx="56" ry="20" fill="' + P + '" stroke="' + K + '" stroke-width="2.6"/>' + st('M100 114V136') + st('M100 74V52') + '<path d="M100 52L116 58L100 64Z" fill="' + K + '" class="flg"/>' + '<circle r="6.5" fill="' + GD + '" stroke="' + K + '" stroke-width="2.2"><animateMotion dur="5s" repeatCount="indefinite" path="M100 125a72 31 0 0 0 0 -62a72 31 0 0 0 0 62"/></circle>',
 map: BL + sh('M16 124L54 72H186L148 124Z') + st('M98 72L84 124M142 72L124 124', 'opacity=".45"') + '<path d="M54 108C74 100 86 96 104 92S136 100 150 104" fill="none" stroke="' + K + '" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="1 7" class="march"/>' + '<ellipse cx="54" cy="109" rx="7" ry="2.5" fill="' + K + '" opacity=".15"/><ellipse cx="104" cy="93" rx="7" ry="2.5" fill="' + K + '" opacity=".15"/><ellipse cx="150" cy="105" rx="9" ry="3" fill="' + K + '" opacity=".15"/>' + grp('drop', pinAt(54, 108, 10, P), 'animation-delay:.5s') + grp('drop', pinAt(104, 92, 10, P), 'animation-delay:.75s') + grp('drop', grp('bob', pinAt(150, 104, 13, GD)), 'animation-delay:1s'),
 compass: BL + cir(100, 82, 48) + '<circle cx="100" cy="82" r="38" fill="none" stroke="' + K + '" stroke-width="1.4" opacity=".4"/>' + st('M100 38v8M100 118v8M56 82h8M136 82h8') + '<text x="100" y="27" text-anchor="middle" font-family="Inter Tight" font-weight="700" font-size="13" fill="' + K + '">N</text>' + grp('needle', '<path d="M100 50L110 82H90Z" fill="' + GD + '" stroke="' + K + '" stroke-width="2.2" stroke-linejoin="round"/><path d="M100 114L110 82H90Z" fill="' + K + '" stroke="' + K + '" stroke-width="2.2" stroke-linejoin="round"/>', 'transform-origin:100px 82px') + '<circle cx="100" cy="82" r="4" fill="' + P + '" stroke="' + K + '" stroke-width="2"/>',
 mountains: BL + sh('M10 134L68 56L96 92L130 38L192 134Z') + st('M118 56L130 38L142 56L136 52L130 58L124 52') + st('M130 38V14') + '<path d="M130 14L148 20L130 26Z" fill="' + GD + '" stroke="' + K + '" stroke-width="2.2" stroke-linejoin="round" class="flg"/>' + '<path d="M52 134L74 118L62 110L86 100L78 90" fill="none" stroke="' + K + '" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="1 7" class="march"/>' + grp('fl', sh('M34 54a9 9 0 0 1 1-18 13 13 0 0 1 24-4 10 10 0 0 1 10 22z')),
 boulevard: BL + st('M12 100H188') + st('M30 78H82M32 70H80M36 78V100M76 78V100') + st('M164 100V30M164 30C164 22 172 20 178 24') + sh('M172 24h14l-3 9h-8z') + cir(179, 40, 5, GD, 'class="glow"') + st(waveD(20, 116, 14), 'class="wv"') + st(waveD(32, 128, 12), 'class="wv" style="animation-delay:-1.2s"') + st(waveD(50, 140, 8), 'class="wv" style="animation-delay:-2.4s"') + st('M104 42q6-6 12 0q6-6 12 0', 'class="fl"'),
 flames: BL + st('M12 136C60 126 140 126 188 136') + sh('M46 132C42 108 48 82 70 58C76 84 78 110 74 132Z') + sh('M84 132C78 100 84 62 108 24C118 62 122 100 114 132Z') + '<path d="M92 128C88 104 94 74 108 46C114 74 116 104 110 128Z" fill="' + GD + '" opacity=".75" class="rise"/>' + st('M84 132C78 100 84 62 108 24C118 62 122 100 114 132') + sh('M126 132C122 106 128 80 148 54C156 82 158 108 152 132Z') + st('M52 114h18M55 96h14M60 78h10M132 114h17M135 96h15M140 78h10', 'opacity=".5"') + spark(36, 36) + twk(star4(170, 30, 6), .8),
 maiden: BL + st('M12 134H188') + st('M20 134V118h8v5h8v-5h8v5h8v-5h8v5h4V134M140 134V118h8v5h8v-5h8v5h8v-5h8v16') + sh('M72 134V50C72 44 76 40 82 40H118C124 40 128 44 128 50V134Z') + sh('M128 72H142V134H128Z') + st('M76 40V34h8v6h8v-6h8v6h8v-6h8v6h8v-6V40') + '<path d="M72 66H128M72 90H142M72 114H142" fill="none" stroke="' + K + '" stroke-width="1.6" stroke-dasharray="7 6" opacity=".5"/>' + '<rect x="88" y="50" width="7" height="11" rx="3.5" fill="' + K + '"/><rect x="106" y="74" width="7" height="11" rx="3.5" fill="' + K + '"/><rect x="92" y="98" width="7" height="11" rx="3.5" fill="' + K + '"/>' + st('M100 34V14') + '<path d="M100 14L118 20L100 26Z" fill="' + GD + '" stroke="' + K + '" stroke-width="2.2" stroke-linejoin="round" class="flg"/>' + st('M146 42q5-5 10 0q5-5 10 0', 'class="fl"'),
 coffee: BL + '<ellipse cx="98" cy="128" rx="54" ry="8" fill="' + P + '" stroke="' + K + '" stroke-width="2.6"/>' + st('M132 84C152 82 152 108 130 108') + sh('M64 74H132V100C132 118 118 128 98 128C78 128 64 118 64 100Z') + '<ellipse cx="98" cy="74" rx="34" ry="7" fill="' + P + '" stroke="' + K + '" stroke-width="2.6"/><ellipse cx="98" cy="75" rx="27" ry="4.5" fill="' + K + '"/>' + '<path d="' + heartD(98, 98, 1) + '" fill="' + GD + '" stroke="' + K + '" stroke-width="2" stroke-linejoin="round"/>' + st('M84 60C78 50 90 44 84 34', 'class="stm"') + st('M98 58C92 48 104 42 98 30', 'class="stm" style="animation-delay:.8s"') + st('M112 60C106 50 118 44 112 34', 'class="stm" style="animation-delay:1.6s"'),
 sunrise: BL + grp('rays', st(rays), 'transform-origin:100px 108px') + '<path d="M60 108a40 40 0 0 1 80 0Z" fill="' + GD + '" stroke="' + K + '" stroke-width="2.6" stroke-linejoin="round"/>' + st('M14 108H186') + st('M44 122H86M104 122H156', 'class="wv"') + st('M66 136H132', 'class="wv" style="animation-delay:-1.8s"') + st('M146 40q5-5 10 0q5-5 10 0', 'class="fl"'),
 night: BL + grp('rock', CRES(112, 28, 150, 104, 46, 62, P)) + twk(star4(44, 44, 7), 0) + twk(star4(62, 22, 4), .7) + twk(star4(166, 70, 5), 1.3) + twk(star4(32, 100, 4), 1.9) + twk(star4(160, 32, 8, GD, 'stroke="' + K + '" stroke-width="1.6"'), .4) + grp('fl', sh('M112 132a10 10 0 0 1 2-20 14 14 0 0 1 26-2 10 10 0 0 1 8 22z')),
 sleep: BL + grp('rock', CRES(104, 30, 140, 110, 46, 70, P) + sc('M70 70q6 5 12 0', K, 2.6, 'class="eyec"') + '<circle cx="72" cy="86" r="4.5" fill="' + K + '" opacity=".12"/>') + twk(star4(150, 92, 8, GD, 'stroke="' + K + '" stroke-width="1.6"'), .3) + twk(star4(40, 40, 5), 1) + '<g class="zz2"><text x="146" y="62" font-family="Inter Tight" font-weight="700" font-size="18" fill="' + K + '">z</text><text x="162" y="42" font-family="Inter Tight" font-weight="700" font-size="13" fill="' + K + '">z</text></g>',
 calendar: BL + sh('M44 34h112a12 12 0 0 1 12 12v74a12 12 0 0 1-12 12H44a12 12 0 0 1-12-12V46a12 12 0 0 1 12-12z') + '<path d="M32 58V46a12 12 0 0 1 12-12h112a12 12 0 0 1 12 12v12Z" fill="' + K + '"/>' + '<rect x="64" y="24" width="8" height="18" rx="4" fill="' + P + '" stroke="' + K + '" stroke-width="2.4"/><rect x="128" y="24" width="8" height="18" rx="4" fill="' + P + '" stroke="' + K + '" stroke-width="2.4"/>' + [46, 76, 106, 136].flatMap((x) => [66, 98].map((y) => [x, y])).sort((a, b) => a[1] - b[1]).map(([x, y], i) => '<rect x="' + x + '" y="' + y + '" width="22" height="22" rx="7" fill="' + SO + '" stroke="' + K + '" stroke-width="2"/>' + (i < 6 ? st('M' + (x + 6) + ' ' + (y + 11) + 'l4 4 7-8') : '')).join('') + grp('flk', flameAt(117, 108, 1.05, GD)),
 flame: BL + grp('flk', flameAt(100, 84, 5, P)) + grp('flk2', flameAt(100, 101, 2.6, GD)) + '<circle cx="84" cy="56" r="2.6" fill="' + K + '" class="emb"/><circle cx="114" cy="50" r="2" fill="' + GD + '" class="emb" style="animation-delay:.8s"/><circle cx="100" cy="40" r="2.4" fill="' + K + '" class="emb" style="animation-delay:1.6s"/>' + st('M56 132H144') + spark(160, 44, GD),
 trophy: BL + st('M72 42C50 42 52 70 76 72M128 42C150 42 148 70 124 72') + sh('M70 32H130V60C130 78 116 90 100 90C84 90 70 78 70 60Z', GD) + '<path d="M82 42V60C82 68 86 74 92 77" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" opacity=".75" class="glint"/>' + st('M100 90V108') + sh('M80 108h40v10H80z') + sh('M72 118h56a4 4 0 0 1 4 4v12H68v-12a4 4 0 0 1 4-4z') + spark(46, 34) + spark(158, 96) + twk(star4(160, 30, 6), .9),
 medal: BL + grp('sw', sh('M74 14H94L110 66H90Z') + sh('M126 14H106L90 66H110Z') + cir(100, 94, 30, GD) + '<circle cx="100" cy="94" r="21" fill="none" stroke="' + K + '" stroke-width="2"/>' + star5(100, 95, 11, 4.6, K), 'transform-origin:100px 14px') + spark(152, 42) + spark(46, 114),
 podium: BL + st('M24 134H176') + grp('grow', sh('M40 92h40v42H40z') + '<text x="60" y="120" text-anchor="middle" font-family="Inter Tight" font-weight="700" font-size="18" fill="' + K + '">2</text>', 'animation-delay:.35s') + grp('grow', sh('M80 66h40v68H80z') + '<text x="100" y="94" text-anchor="middle" font-family="Inter Tight" font-weight="700" font-size="20" fill="' + K + '">1</text>', 'animation-delay:.15s') + grp('grow', sh('M120 106h40v28h-40z') + '<text x="140" y="127" text-anchor="middle" font-family="Inter Tight" font-weight="700" font-size="16" fill="' + K + '">3</text>', 'animation-delay:.55s') + grp('bob', star5(100, 40, 14, 6, GD)) + twk(star4(50, 60, 5), .3) + twk(star4(152, 74, 5), 1.1),
 stopwatch: BL + sh('M92 22h16v10H92z') + st('M100 32V38M138 48l7-7') + cir(100, 84, 46) + st(ticks, 'stroke-width="2" opacity=".45"') + '<circle cx="100" cy="84" r="31" fill="none" stroke="' + GD + '" stroke-width="7" stroke-linecap="round" pathLength="100" stroke-dasharray="30 70" class="arc" transform="rotate(-90 100 84)" style="transform-box:view-box"/>' + grp('tick', st('M100 84V52'), 'transform-origin:100px 84px') + '<circle cx="100" cy="84" r="5" fill="' + K + '"/>',
 pulse: BL + sh('M80 18h40v24H80z') + sh('M80 110h40v24H80z') + '<rect x="60" y="38" width="80" height="76" rx="22" fill="' + P + '" stroke="' + K + '" stroke-width="2.6"/><rect x="70" y="48" width="60" height="56" rx="14" fill="' + K + '"/>' + st('M140 70h6') + '<path d="M74 84H88L94 72L102 98L108 80L112 84H126" fill="none" stroke="' + P + '" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray=".6 1" class="ecg"/>' + '<path d="' + heartD(118, 58, .55) + '" fill="' + GD + '" class="beat"/>' + '<text x="78" y="66" font-family="Inter Tight" font-weight="700" font-size="12" fill="' + P + '">72</text>',
 bottle: BL + sh('M88 20h24v14H88z', GD) + sh('M90 34h20v10H90z') + sh('M80 54C80 48 86 44 90 44H110C114 44 120 48 120 54V124a10 10 0 0 1-10 10H90a10 10 0 0 1-10-10Z') + '<path d="M83 80h34V124a8 8 0 0 1-8 8H91a8 8 0 0 1-8-8Z" fill="' + K + '" opacity=".1"/>' + st('M83 80q8.5-5 17 0t17 0', 'class="wv"') + '<circle cx="94" cy="118" r="2.6" fill="none" stroke="' + K + '" stroke-width="1.8" class="bub"/><circle cx="106" cy="122" r="2" fill="none" stroke="' + K + '" stroke-width="1.8" class="bub" style="animation-delay:.9s"/><circle cx="100" cy="112" r="1.6" fill="none" stroke="' + K + '" stroke-width="1.6" class="bub" style="animation-delay:1.7s"/>' + spark(148, 50) + twk(star4(52, 96, 5), .6),
 sync: BL + sh('M62 114a22 22 0 0 1-2-44 32 32 0 0 1 62-6 24 24 0 0 1 20 50z') + grp('syn', sc('M82 86a16 16 0 0 1 28-10.6', GD, 4) + sc('M112 66l-1 10-10-1', GD, 4) + sc('M114 86a16 16 0 0 1-28 10.6', K, 3.4) + sc('M84 106l1-10 10 1', K, 3.4)),
 phone: BL + sh('M80 18h40a16 16 0 0 1 16 16v86a16 16 0 0 1-16 16H80a16 16 0 0 1-16-16V34a16 16 0 0 1 16-16z') + '<rect x="72" y="30" width="56" height="94" rx="9" fill="' + SO + '"/>' + st('M72 56L128 76M92 30L108 124M72 104L128 92', 'stroke-width="1.6" opacity=".35"') + st('M92 24h16') + '<ellipse cx="100" cy="88" rx="10" ry="3.4" fill="none" stroke="' + K + '" stroke-width="1.8" class="rip"/>' + grp('bob', pinAt(100, 86, 11, GD)) + st('M146 36a14 14 0 0 1 0 20M154 30a24 24 0 0 1 0 32', 'class="tw1"'),
 mailbox: BL + st('M58 136H142') + sh('M92 104h16v32H92z') + sh('M48 66C48 50 58 42 72 42H128C142 42 152 52 152 66V104H48Z') + st('M72 42C86 42 96 52 96 66V104') + grp('fl', sh('M56 72h32v22H56z') + st('M56 72l16 12 16-12')) + grp('flagup', st('M140 98V60') + sh('M140 60h18v12h-18z', GD), 'transform-origin:140px 98px'),
 friends: BL + person(66, P, -1, 0) + person(134, GD, 1, .45) + grp('fl', '<path d="' + heartD(100, 34, .9) + '" fill="' + K + '"/>'),
 highfive: BL + grp('hfl', hand(66, 16)) + grp('hfr', hand(134, -16)) + sc('M100 26V12M84 30l-7-8M116 30l7-8M76 44H64M124 44h12', GD, 3.2, 'class="burst"'),
 bubbles: BL + sh('M30 32h86a12 12 0 0 1 12 12v30a12 12 0 0 1-12 12H62l-16 14V86H30a12 12 0 0 1-12-12V44a12 12 0 0 1 12-12z') + st('M34 52h64M34 66h44') + grp('pop', '<path d="' + heartD(124, 32, .8) + '" fill="' + GD + '" stroke="' + K + '" stroke-width="2" stroke-linejoin="round"/>') + sh('M92 80h78a12 12 0 0 1 12 12v24a12 12 0 0 1-12 12h-6v14l-16-14H92a12 12 0 0 1-12-12V92a12 12 0 0 1 12-12z', K) + '<circle cx="114" cy="104" r="4" fill="' + P + '" class="dt"/><circle cx="130" cy="104" r="4" fill="' + P + '" class="dt" style="animation-delay:.15s"/><circle cx="146" cy="104" r="4" fill="' + P + '" class="dt" style="animation-delay:.3s"/>',
 confetti: BL + confetti + '<path d="M40 140L64 84L98 118Z" fill="' + GD + '" stroke="' + K + '" stroke-width="2.6" stroke-linejoin="round"/>' + st('M54 110L74 126M60 96L86 114', 'stroke-width="2"') + '<ellipse cx="81" cy="101" rx="5" ry="24" transform="rotate(-45 81 101)" style="transform-box:view-box" fill="' + P + '" stroke="' + K + '" stroke-width="2.6"/>',
 camera: BL + sh('M42 54h26l10-14h44l10 14h26a10 10 0 0 1 10 10v58a10 10 0 0 1-10 10H42a10 10 0 0 1-10-10V64a10 10 0 0 1 10-10z') + '<rect x="134" y="62" width="16" height="10" rx="3" fill="' + GD + '" stroke="' + K + '" stroke-width="2"/>' + sc('M142 54v-8M152 58l6-6M132 58l-6-6', K, 2.4, 'class="flash"') + cir(100, 92, 28) + grp('shut', '<circle cx="100" cy="92" r="18" fill="' + K + '"/><circle cx="94" cy="86" r="5" fill="' + P + '"/>') + st('M44 66h14'),
 share: BL + st('M64 78H52a10 10 0 0 0-10 10v32a12 12 0 0 0 12 12h92a12 12 0 0 0 12-12V88a10 10 0 0 0-10-10h-12') + grp('lift', sc('M100 108V28M80 48L100 28L120 48', K, 4)) + '<circle cx="138" cy="52" r="4" fill="' + GD + '" class="emb"/><circle cx="60" cy="58" r="3" fill="' + GD + '" class="emb" style="animation-delay:1s"/><circle cx="150" cy="30" r="2.6" fill="' + K + '" class="emb" style="animation-delay:1.7s"/>',
 shield: BL + '<circle cx="100" cy="80" r="62" fill="none" stroke="' + K + '" stroke-width="1.6" stroke-dasharray="2 10" opacity=".45" class="orbit"/>' + grp('fl', sh('M100 22L148 38V76C148 108 128 126 100 134C72 126 52 108 52 76V38Z') + '<path d="M100 38L134 50V78C134 100 120 114 100 120C80 114 66 100 66 78V50Z" fill="' + K + '"/>' + sc('M84 80l11 11 22-24', GD, 6)),
 charge: BL + '<rect x="88" y="24" width="24" height="12" rx="4" fill="' + K + '"/><rect x="68" y="34" width="64" height="102" rx="16" fill="' + P + '" stroke="' + K + '" stroke-width="2.6"/>' + '<rect x="76" y="42" width="48" height="86" rx="9" fill="' + K + '" opacity=".1" class="lvl"/>' + grp('beat', sh('M106 54L82 92H98L92 120L120 80H104L112 54Z', GD)) + spark(158, 52) + spark(42, 108),
 rain: BL + sh('M60 66a17 17 0 0 1-1-34 25 25 0 0 1 47-6 19 19 0 0 1 16 40z') + [[66, 0], [82, .5], [98, 1.1], [114, .3], [74, 1.4], [106, .8]].map(([x, d], i) => sc('M' + x + ' ' + (78 + (i % 3) * 8) + 'v8', K, 2.6, 'class="rn" style="animation-delay:' + d + 's"')).join('') + '<path d="M100 120a36 30 0 0 1 72 0q-9-6-18 0q-9-6-18 0q-9-6-18 0q-9-6-18 0z" fill="' + GD + '" stroke="' + K + '" stroke-width="2.6" stroke-linejoin="round"/>' + st('M136 90V86M136 120V140q0 6-6 6') + '<ellipse cx="62" cy="136" rx="16" ry="3.4" fill="none" stroke="' + K + '" stroke-width="1.8" class="rip"/><ellipse cx="62" cy="136" rx="16" ry="3.4" fill="none" stroke="' + K + '" stroke-width="1.8" class="rip" style="animation-delay:1.1s"/>',
 road: BL + st('M10 66H190') + st('M10 66C34 50 60 48 84 62M120 60C142 44 172 46 190 66') + '<path d="M138 66a14 14 0 0 1 28 0Z" fill="' + GD + '" stroke="' + K + '" stroke-width="2.6" stroke-linejoin="round"/>' + sh('M28 148L94 66H106L172 148Z') + '<path d="M100 72V148" stroke="' + K + '" stroke-width="3.4" stroke-dasharray="8 10" class="mv"/>' + st('M180 124V100') + cir(180, 92, 10) + grp('fl', sh('M34 34a8 8 0 0 1 1-16 12 12 0 0 1 22-4 9 9 0 0 1 8 20z')),
});
ART.notify = ART.bell; ART.heartrate = ART.pulse; ART.trophycup = ART.trophy; ART.moon = ART.night;
const ACSS3 = '.ma .fp{animation:maStep 3.2s ease-in-out infinite both}.ma .flg{animation:maFlag 1.8s ease-in-out infinite;transform-origin:0 50%}.ma .step{animation:maShoe 1.6s cubic-bezier(.45,0,.55,1) infinite;transform-origin:85% 100%}'+
 '.ma .spin{animation:maSpin 1.4s linear infinite;transform-origin:center}.ma .drive{animation:maDrive 1.4s cubic-bezier(.22,1,.36,1) .2s both}.ma .bob2{animation:maBob2 .7s ease-in-out infinite alternate}.ma .puff{animation:maPuff 1.8s ease-out infinite;transform-origin:center}'+
 '.ma .apr{animation:maApr 3.4s ease-in-out infinite alternate;transform-origin:50% 100%}.ma .drop{animation:maDrop .9s cubic-bezier(.34,1.5,.64,1) both}.ma .needle{animation:maNeedle 5s ease-in-out infinite;transform-box:view-box}'+
 '.ma .wv{animation:maWave 3.6s ease-in-out infinite alternate}.ma .glow{animation:maGlow 2.8s ease-in-out infinite;transform-origin:center}.ma .rise{animation:maRise 3.6s ease-in-out infinite alternate;transform-origin:50% 100%}'+
 '.ma .stm{animation:maSteam 2.4s ease-in-out infinite;opacity:0}.ma .rays{animation:maRays 7s ease-in-out infinite alternate;transform-box:view-box}.ma .rock{animation:maRock 6s ease-in-out infinite alternate;transform-origin:center}'+
 '.ma .flk{animation:maFlk 1.6s ease-in-out infinite;transform-origin:50% 100%}.ma .flk2{animation:maFlk 1.3s ease-in-out -.4s infinite;transform-origin:50% 100%}.ma .emb{animation:maEmb 2.4s ease-out infinite;opacity:0}'+
 '.ma .grow{animation:maGrow .9s cubic-bezier(.34,1.3,.64,1) both;transform-origin:50% 100%}.ma .arc{animation:maArc 6s linear infinite}.ma .tick{animation:maTick 6s linear infinite;transform-box:view-box}.ma .ecg{animation:maEcg 1.8s linear infinite}'+
 '.ma .beat{animation:maBeat 1.2s ease-in-out infinite;transform-origin:center}.ma .bub{animation:maBub 2.6s ease-in infinite;opacity:0}.ma .syn{animation:maSync 3s cubic-bezier(.65,0,.35,1) infinite;transform-origin:center}'+
 '.ma .rip{animation:maRip 2.2s ease-out infinite;transform-origin:center;opacity:0}.ma .flagup{animation:maFlagUp 4.4s ease-in-out infinite;transform-box:view-box}.ma .wave{animation:maArm .9s ease-in-out infinite alternate;transform-box:view-box}'+
 '.ma .hfl{animation:maHfL 2.6s cubic-bezier(.65,0,.35,1) infinite}.ma .hfr{animation:maHfR 2.6s cubic-bezier(.65,0,.35,1) infinite}.ma .burst{animation:maBurst 2.6s ease-out infinite;transform-origin:50% 100%;opacity:0}'+
 '.ma .pop{animation:maPop .7s cubic-bezier(.34,1.8,.64,1) 1.1s both;transform-origin:center}.ma .dt{animation:maDot 1.2s ease-in-out infinite}.ma .cf{animation:maCf 3.2s cubic-bezier(.2,.7,.3,1) infinite;opacity:0;transform-origin:center}'+
 '.ma .flash{animation:maFlash 3s ease-out infinite;opacity:0;transform-origin:50% 100%}.ma .shut{animation:maShut 3s ease-in-out infinite;transform-origin:center}.ma .lift{animation:maLift 1.8s ease-in-out infinite alternate}'+
 '.ma .orbit{animation:maSpin 30s linear infinite;transform-origin:center}.ma .lvl{animation:maLvl 3.4s cubic-bezier(.65,0,.35,1) infinite alternate;transform-origin:50% 100%}.ma .mv{animation:maMv .9s linear infinite}.ma .glint{animation:maBlink 2.4s ease-in-out infinite}'+
 '@keyframes maStep{0%,100%{opacity:.16}18%,62%{opacity:1}}@keyframes maFlag{0%,100%{transform:none}50%{transform:scaleX(.86) skewY(5deg)}}@keyframes maShoe{0%,100%{transform:none}40%{transform:translateY(-8px) rotate(-7deg)}70%{transform:translateY(0) rotate(1deg)}}'+
 '@keyframes maSpin{to{transform:rotate(360deg)}}@keyframes maDrive{from{transform:translateX(-28px);opacity:0}to{transform:none;opacity:1}}@keyframes maBob2{to{transform:translateY(-1.5px)}}@keyframes maPuff{0%{opacity:0;transform:scale(.4)}25%{opacity:.5}100%{opacity:0;transform:translate(-14px,-8px) scale(1.3)}}'+
 '@keyframes maApr{from{transform:scale(.96)}to{transform:scale(1.03)}}@keyframes maDrop{from{opacity:0;transform:translateY(-26px)}to{opacity:1;transform:none}}@keyframes maNeedle{0%,70%,100%{transform:rotate(0)}12%{transform:rotate(-16deg)}26%{transform:rotate(11deg)}40%{transform:rotate(-5deg)}54%{transform:rotate(2deg)}}'+
 '@keyframes maWave{from{transform:translateX(-5px)}to{transform:translateX(5px)}}@keyframes maGlow{0%,100%{transform:none;opacity:1}50%{transform:scale(1.25);opacity:.7}}@keyframes maRise{from{transform:scaleY(.35)}to{transform:none}}'+
 '@keyframes maSteam{0%{opacity:0;transform:translateY(8px)}35%{opacity:.9}100%{opacity:0;transform:translateY(-12px)}}@keyframes maRays{from{transform:rotate(-5deg) scale(.98)}to{transform:rotate(5deg) scale(1.04)}}@keyframes maRock{from{transform:rotate(-5deg)}to{transform:rotate(5deg)}}'+
 '@keyframes maFlk{0%,100%{transform:none}30%{transform:scale(.96,1.05) skewX(-2deg)}65%{transform:scale(1.03,.97) skewX(2deg)}}@keyframes maEmb{0%{opacity:0;transform:none}20%{opacity:1}100%{opacity:0;transform:translate(6px,-36px)}}@keyframes maGrow{from{transform:scaleY(0)}to{transform:none}}'+
 '@keyframes maArc{to{stroke-dashoffset:-100}}@keyframes maTick{from{transform:rotate(108deg)}to{transform:rotate(468deg)}}@keyframes maEcg{from{stroke-dashoffset:.6}to{stroke-dashoffset:-1}}@keyframes maBeat{0%,100%{transform:none}15%{transform:scale(1.2)}30%{transform:none}45%{transform:scale(1.12)}60%{transform:none}}'+
 '@keyframes maBub{0%{opacity:0;transform:none}20%{opacity:.8}100%{opacity:0;transform:translateY(-34px)}}@keyframes maSync{0%{transform:rotate(0)}55%,100%{transform:rotate(360deg)}}@keyframes maRip{from{transform:scale(.5);opacity:.7}to{transform:scale(2.2);opacity:0}}'+
 '@keyframes maFlagUp{0%,50%,100%{transform:rotate(0)}62%,70%{transform:rotate(76deg)}84%{transform:rotate(-6deg)}92%{transform:rotate(2deg)}}@keyframes maArm{from{transform:rotate(-12deg)}to{transform:rotate(14deg)}}'+
 '@keyframes maHfL{0%,100%{transform:translate(-10px,6px)}40%,58%{transform:none}46%{transform:translate(-2px,1px)}}@keyframes maHfR{0%,100%{transform:translate(10px,6px)}40%,58%{transform:none}46%{transform:translate(2px,1px)}}'+
 '@keyframes maBurst{0%,38%{opacity:0;transform:scale(.5)}46%{opacity:1;transform:none}70%,100%{opacity:0;transform:scale(1.15)}}@keyframes maPop{from{transform:scale(0)}to{transform:none}}@keyframes maDot{0%,60%,100%{transform:none}30%{transform:translateY(-5px)}}'+
 '@keyframes maCf{0%{opacity:0;transform:translate(var(--dx),var(--dy)) scale(.3)}12%{opacity:1}45%{transform:rotate(var(--r))}85%{opacity:1}100%{opacity:0;transform:translateY(16px) rotate(calc(var(--r) * 2))}}'+
 '@keyframes maFlash{0%,66%{opacity:0;transform:scale(.6)}72%{opacity:1;transform:scale(1.1)}90%,100%{opacity:0;transform:scale(1.2)}}@keyframes maShut{0%,62%,82%,100%{transform:none}68%{transform:scale(.86)}}@keyframes maLift{to{transform:translateY(-7px)}}'+
 '@keyframes maLvl{from{transform:scaleY(.2)}to{transform:none}}@keyframes maMv{to{stroke-dashoffset:-18}}@media (prefers-reduced-motion:reduce){.ma *{animation:none!important}}';
document.getElementById('m-kit').textContent += ACSS3;

// ---- Tuli, many more ways: walking, cycling, on the bus, curled asleep, stretching, waving, reading the map, a trophy,
// coffee, the night sky, confetti, thinking, peeking in from the edge. Same ink silhouette, white chest, tail tip and socks.
const GL = 'var(--m-goal,#F6C343)', TS = (d, w = 2, c = 'currentColor', x = '') => '<path d="' + d + '" fill="none" stroke="' + c + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round" ' + x + '/>';
const HEAD = (o) => '<g class="head" style="transform-origin:' + o + '"><path class="ear" d="M108 34L111 14L119 30Z" fill="currentColor"/><path class="ear b" d="M116 31L124 15L127 33Z" fill="currentColor"/><path d="M96 56C97 42 104 34 112 32L120 29L128 33C135 36 141 39 148 44C141 48 133 50 125 50C120 56 108 60 96 56Z" fill="currentColor"/><path d="M100 56C103 64 107 70 112 72C111 64 110 58 108 54Z" fill="' + WH + '"/><circle class="eye" cx="123" cy="39" r="2.4" fill="' + WH + '"/><path class="closed" d="M120 39Q123 42 126 39" fill="none" stroke="' + WH + '" stroke-width="1.8" stroke-linecap="round"/><circle cx="148" cy="44" r="2" fill="currentColor"/></g>';
const STAIL = '<g class="tail" style="transform-origin:40px 56px"><path d="M40 50C18 50 0 66 4 90C12 74 24 68 42 64Z" fill="currentColor"/><path d="M4 90C2 82 4 75 10 70C12 77 10 84 4 90Z" fill="' + WH + '" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></g>';
const LEG = (x, c) => '<g class="leg ' + c + '" style="transform-origin:' + (x + 4.5) + 'px 70px"><path d="M' + x + ' 66h9v42h-9z" fill="currentColor"/><path d="M' + x + ' 98h9v10h-9z" fill="' + WH + '"/></g>';
const SBODY = '<path d="M34 52C38 40 60 38 86 40C100 41 110 48 110 58C110 72 100 80 88 80L50 80C40 80 32 68 34 52Z" fill="currentColor"/>';
const shd = (cx, cy, rx) => '<ellipse class="sh" cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="3" fill="currentColor" opacity=".12"/>';
const FRONT = XP.front.svg, frontWith = (before, after) => FRONT.replace('<g class="head"', before + '<g class="head"').slice(0, -4) + after + '</g>';
// Cycling legs: two-bone IK sampled into CSS path keyframes, so the knee bends naturally round the crank.
const PED = (() => { const H = [70, 58], L1 = 27, L2 = 28, C = [84, 98], R = 10, k = (t) => { const p = [C[0] + R * Math.cos(t), C[1] + R * Math.sin(t)], dx = p[0] - H[0], dy = p[1] - H[1], d = Math.hypot(dx, dy), a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - a * a)), m = [H[0] + a * dx / d, H[1] + a * dy / d], kn = [m[0] - h * dy / d, m[1] + h * dx / d], kn2 = [m[0] + h * dy / d, m[1] - h * dx / d], K2 = kn[0] > kn2[0] ? kn : kn2, sl = Math.hypot(p[0] - K2[0], p[1] - K2[1]), s = [p[0] + 7 * (K2[0] - p[0]) / sl, p[1] + 7 * (K2[1] - p[1]) / sl], f = (v) => v.map((n) => n.toFixed(1)).join(' ');
  return ['M' + f(H) + 'L' + f(K2) + 'L' + f(p), 'M' + f(s) + 'L' + f(p)]; };
  const fr = Array.from({ length: 13 }, (_, i) => k(i * Math.PI / 6)), kf = (j) => fr.map((v, i) => (i * 100 / 12).toFixed(2) + '%{d:path("' + v[j] + '")}').join('');
  return { leg: fr[0][0], sock: fr[0][1], css: '@keyframes tlPedal{' + kf(0) + '}@keyframes tlSock{' + kf(1) + '}' }; })();
const CYLEG = (c) => '<g class="' + c + '"><path class="pl" d="' + PED.leg + '" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path class="ps" d="' + PED.sock + '" fill="none" stroke="' + WH + '" stroke-width="4" stroke-linecap="round"/></g>';
const FW = (x, y, r) => '<g class="wh" style="transform-origin:' + x + 'px ' + y + 'px"><circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="none" stroke="currentColor" stroke-width="2.4"/>' + TS('M' + (x - r) + ' ' + y + 'h' + 2 * r + 'M' + x + ' ' + (y - r) + 'v' + 2 * r + 'M' + (x - r * .7) + ' ' + (y - r * .7) + 'l' + r * 1.4 + ' ' + r * 1.4 + 'M' + (x + r * .7) + ' ' + (y - r * .7) + 'l' + (-r * 1.4) + ' ' + r * 1.4, 1.1) + '</g>';
const PROFILE = FOX;
Object.assign(XP, {
 walk: { vb: '0 0 160 118', svg: shd(78, 110, 50) + '<g class="whole">' + STAIL + LEG(43, 'la') + LEG(84, 'lb') + SBODY + LEG(56, 'lb') + LEG(97, 'la') + HEAD('104px 54px') + '</g>' },
 stretch: { vb: '0 0 170 118', svg: shd(88, 110, 62) + '<g class="whole"><g class="tail" style="transform-origin:34px 46px"><path d="M34 44C20 30 18 12 30 0C28 16 34 28 42 36Z" fill="currentColor"/><path d="M30 0C24 5 23 12 26 18C29 12 31 6 30 0Z" fill="' + WH + '" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></g>' +
  '<path d="M38 60h9v48h-9zM52 64h9v44h-9z" fill="currentColor"/><path d="M38 98h9v10h-9zM52 98h9v10h-9z" fill="' + WH + '"/>' +
  '<g class="body" style="transform-origin:44px 60px"><path d="M30 52C30 40 46 36 58 42C76 50 96 66 112 78C120 86 114 98 102 98L86 97C66 92 46 80 36 70C32 64 30 58 30 52Z" fill="currentColor"/><path d="M90 92H146a4 4 0 0 1 0 8H90ZM96 100H152a4 4 0 0 1 0 8H96Z" fill="currentColor"/><path d="M140 92h6a4 4 0 0 1 0 8h-6zM146 100h6a4 4 0 0 1 0 8h-6z" fill="' + WH + '"/></g>' +
  '<g style="transform:translate(20px,18px)">' + HEAD('104px 54px') + '</g></g>' },
 curl: { vb: '0 0 170 120', svg: shd(84, 112, 62) + '<g class="whole"><g class="body" style="transform-origin:80px 110px"><path d="M30 108C26 82 48 62 82 62C114 62 132 80 130 108Z" fill="currentColor"/></g>' +
  '<g style="transform:translate(-2px,14px)"><g class="head" style="transform-origin:112px 90px"><path class="ear" d="M114 72L118 54L126 69Z" fill="currentColor"/><path class="ear b" d="M123 69L131 56L134 72Z" fill="currentColor"/><path d="M106 92C106 80 112 72 120 70L128 68L136 72C142 75 150 80 156 86C150 90 140 92 130 91C124 96 112 97 106 92Z" fill="currentColor"/><path class="closed" d="M128 79Q131 82 134 79" fill="none" stroke="' + WH + '" stroke-width="1.8" stroke-linecap="round"/><circle cx="156" cy="86" r="2" fill="currentColor"/></g></g>' +
  '<g class="tail" style="transform-origin:40px 100px"><path d="M38 84C18 100 44 116 86 115C106 114 118 111 126 104C110 106 96 106 84 105C62 104 46 98 38 84Z" fill="currentColor" stroke="' + WH + '" stroke-width="1.6" stroke-linejoin="round"/><g class="tip" style="transform-origin:112px 108px"><path d="M126 104C120 110 110 113 100 113C106 108 116 105 126 104Z" fill="' + WH + '" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></g></g></g>' +
  '<g class="zz" fill="currentColor" font-family="Inter Tight,sans-serif" font-weight="700"><text x="146" y="62" font-size="13">z</text><text x="156" y="48" font-size="10">z</text></g>' },
 cycle: { vb: '0 0 172 124', svg: shd(86, 121, 70) + '<g class="whole">' + CYLEG('far') + FW(36, 98, 22) + FW(134, 98, 22) +
  TS('M36 98L80 66M80 66L84 98M84 98H36M80 66H122L84 98M122 66L134 98M122 66L126 52M118 52h14', 2.6) + TS('M66 60h18', 4.5) +
  '<g class="crank" style="transform-origin:84px 98px">' + TS('M74 98H94', 2.6) + '</g><circle cx="84" cy="98" r="5" fill="' + GL + '" stroke="currentColor" stroke-width="2"/>' +
  '<g class="tail" style="transform-origin:58px 50px"><path d="M58 48C40 50 24 46 12 36C24 42 40 42 58 42Z" fill="currentColor"/><path d="M12 36C15 42 20 45 26 45C23 41 18 38 12 36Z" fill="' + WH + '" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></g>' +
  '<g class="torso"><path d="M54 52C56 40 76 34 98 38C110 40 118 46 118 54C116 60 106 62 96 62L70 62C60 62 52 60 54 52Z" fill="currentColor"/>' + TS('M106 54L124 54', 7) + TS('M120 54h5', 4, WH) + '<path class="scarf" d="M106 42C94 40 84 44 74 38C82 48 96 52 110 50Z" fill="' + GL + '" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" style="transform-origin:108px 46px"/></g>' +
  CYLEG('near') + '<g style="transform:translate(8px,2px)">' + HEAD('112px 50px').replace('class="head"', 'class="head cy"') + '</g></g>' +
  '<g class="spd">' + TS('M4 66H16M0 80H12M6 94H14', 2, 'currentColor', 'opacity=".4"') + '</g>' },
 bus: { vb: '0 0 180 122', svg: shd(90, 116, 80) + '<g class="road">' + TS('M0 118H180', 2, 'currentColor', 'stroke-dasharray="14 12" opacity=".35"') + '</g><g class="whole">' +
  '<path d="M12 26h146a14 14 0 0 1 14 14v58H4V34a8 8 0 0 1 8-8z" fill="' + WH + '" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>' +
  '<rect x="138" y="30" width="26" height="10" rx="3" fill="' + GL + '" stroke="currentColor" stroke-width="1.6"/><text x="151" y="38.5" text-anchor="middle" font-family="Inter Tight,sans-serif" font-weight="700" font-size="8" fill="currentColor">88</text>' +
  '<path d="M14 44h28v24H14zM118 44h16v24h-16zM142 44h22v24h-22z" fill="currentColor" opacity=".12" stroke="currentColor" stroke-width="2"/><path d="M50 42h60v30H50z" fill="currentColor" opacity=".06"/>' +
  '<g style="transform:translate(32px,21px) scale(.8)">' + FRONT.split('<g class="head"')[1].replace(/^/, '<g class="head"').replace(/<\/g><\/g>$/, '</g>') + '</g>' +
  '<path d="M50 72h60" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M50 42h60v30H50z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>' +
  '<ellipse cx="68" cy="72" rx="6" ry="3.4" fill="currentColor"/><ellipse cx="92" cy="72" rx="6" ry="3.4" fill="currentColor"/><path d="M64 72h8M88 72h8" stroke="' + WH + '" stroke-width="2" stroke-linecap="round"/>' +
  TS('M4 84H172', 2) + '<g class="wb" style="transform-origin:36px 98px"><circle cx="36" cy="98" r="12" fill="currentColor"/><path d="M30 98h12" stroke="' + WH + '" stroke-width="3" stroke-linecap="round"/></g><g class="wb" style="transform-origin:140px 98px"><circle cx="140" cy="98" r="12" fill="currentColor"/><path d="M134 98h12" stroke="' + WH + '" stroke-width="3" stroke-linecap="round"/></g></g>' },
 hello: { vb: '0 0 120 118', svg: frontWith('<g class="arm" style="transform-origin:76px 70px">' + TS('M76 72L96 40', 10) + TS('M93 45L96 40', 6, WH) + '</g>', '') },
 map: { vb: '0 0 120 118', svg: frontWith('', '<g class="mapg" style="transform-origin:60px 100px"><path d="M26 76L44 70L62 76L94 70V100L62 106L44 100L26 106Z" fill="' + WH + '" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>' + TS('M44 70V100M62 76V106', 1.4, 'currentColor', 'opacity=".5"') + TS('M32 98C42 90 52 96 60 88S78 84 86 80', 2, 'currentColor', 'stroke-dasharray="1 5" class="rt"') + '<path d="M86 80c-2-3-5-5-5-8a5 5 0 0 1 10 0c0 3-3 5-5 8z" fill="' + GL + '" stroke="currentColor" stroke-width="1.4" class="pn"/><circle cx="30" cy="77" r="6" fill="currentColor"/><circle cx="90" cy="71" r="6" fill="currentColor"/><path d="M27 74h6M87 68h6" stroke="' + WH + '" stroke-width="2" stroke-linecap="round"/></g>') },
 trophy: { vb: '0 0 120 118', svg: frontWith('', '<g class="cup" style="transform-origin:60px 100px">' + TS('M44 76C34 76 34 90 46 90M76 76C86 76 86 90 74 90', 2.4) + '<path d="M44 70H76V82C76 92 69 98 60 98C51 98 44 92 44 82Z" fill="' + GL + '" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>' + TS('M52 76V84', 2.4, '#fff', 'opacity=".7"') + TS('M60 98V104', 2.4) + '<rect x="49" y="104" width="22" height="6" rx="2" fill="currentColor"/><circle cx="40" cy="84" r="6" fill="currentColor"/><circle cx="80" cy="84" r="6" fill="currentColor"/></g>') + '<g class="spk"><path d="M18 40v10M13 45h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M104 28v8M100 32h8" stroke="' + GL + '" stroke-width="2.4" stroke-linecap="round"/><path d="M106 70v6M103 73h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></g>' },
 coffee: { vb: '28 6 104 110', svg: PROFILE + '<g class="cof"><path d="M100 94H118V102C118 107 114 110 109 110C104 110 100 107 100 102Z" fill="' + WH + '" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' + TS('M118 96C124 96 124 104 118 104', 1.8) + '<ellipse cx="109" cy="94.5" rx="8" ry="1.8" fill="currentColor"/>' + TS('M95 111.5H123', 3, GL) +
  TS('M104 88C101 83 107 80 104 74', 1.6, 'currentColor', 'class="st1" opacity="0"') + TS('M112 88C109 83 115 80 112 74', 1.6, 'currentColor', 'class="st1" opacity="0" style="animation-delay:1.1s"') + '</g>' },
 stargaze: { vb: '28 -20 112 136', cls: 'lookup', svg: PROFILE + '<g class="sky"><path d="M122 -14A13 13 0 1 0 136 6A11.5 11.5 0 0 1 122 -14Z" fill="' + GL + '" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" class="mn"/>' + [[92, -8, 4, 0], [112, 22, 3, .8], [76, 6, 3, 1.5], [134, 30, 2.6, 2.1]].map(([x, y, r, d]) => '<path d="M' + x + ' ' + (y - r) + 'Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y + 'Q' + x + ' ' + y + ' ' + x + ' ' + (y + r) + 'Q' + x + ' ' + y + ' ' + (x - r) + ' ' + y + 'Q' + x + ' ' + y + ' ' + x + ' ' + (y - r) + 'Z" fill="currentColor" class="twk" style="animation-delay:' + d + 's;transform-origin:' + x + 'px ' + y + 'px"/>').join('') + '</g>' },
 party: { vb: '18 -24 124 140', cls: 'cheer', svg: '<g class="pty">' + [[30, -14, GL, 'r', 0], [50, -20, 'currentColor', 'c', .4], [72, -10, GL, 'q', .9], [96, -22, 'currentColor', 'r', .2], [118, -12, GL, 'c', 1.2], [134, -18, 'currentColor', 'q', .7], [40, -4, 'currentColor', 'q', 1.6], [86, -6, GL, 'r', 1.9], [126, 0, 'currentColor', 'r', 2.3], [60, -16, GL, 'c', 2.1]].map(([x, y, c, t, d], i) => '<g class="pc" style="animation-delay:' + d + 's;--r:' + (i % 2 ? 300 : -260) + 'deg;transform-origin:' + x + 'px ' + y + 'px">' + (t === 'r' ? '<rect x="' + (x - 4) + '" y="' + (y - 2) + '" width="8" height="4" rx="1" fill="' + c + '"/>' : t === 'c' ? '<circle cx="' + x + '" cy="' + y + '" r="2.6" fill="' + c + '"/>' : TS('M' + (x - 5) + ' ' + y + 'q2.5-4 5 0t5 0', 1.8, c)) + '</g>').join('') + '</g>' + PROFILE },
 think: { vb: '28 -26 128 142', svg: PROFILE + '<g class="tb"><circle cx="104" cy="28" r="2.6" fill="currentColor" class="b1"/><circle cx="112" cy="16" r="4" fill="currentColor" class="b2"/><g class="b3"><rect x="110" y="-22" width="42" height="26" rx="13" fill="' + WH + '" stroke="currentColor" stroke-width="2"/><circle cx="122" cy="-9" r="2.4" fill="currentColor" class="d1"/><circle cx="131" cy="-9" r="2.4" fill="currentColor" class="d1" style="animation-delay:.15s"/><circle cx="140" cy="-9" r="2.4" fill="' + GL + '" class="d1" style="animation-delay:.3s"/></g></g>' },
 peek: { vb: '0 0 104 84', svg: '<g class="whole"><path d="M-40 34C-16 30 6 32 18 42L22 84H-40Z" fill="currentColor"/>' + '<g style="transform:translate(-84px,10px)">' + HEAD('104px 54px') + '</g>' + '</g>' },
});
const XCSS2 = '.tl[class*="x-"] .ear{transform-box:fill-box;transform-origin:50% 100%}.tl[class*="x-"] .eye{transform-box:fill-box;transform-origin:center}.tl[class*="x-"] .sh{transform-box:fill-box;transform-origin:center}.tl[class*="x-"] .closed,.tl[class*="x-"] .zz{display:none}'+
 '.tl.x-walk .whole{animation:tlStep .8s ease-in-out infinite;transform-origin:80px 108px}.tl.x-walk .leg{animation:tlStride .8s cubic-bezier(.45,0,.55,1) infinite alternate}.tl.x-walk .lb{animation-delay:-.8s}.tl.x-walk .head{animation:tlNod .8s ease-in-out infinite}.tl.x-walk .tail{animation:tlTail 1.6s ease-in-out infinite}.tl.x-walk .body{animation:none}'+
 '.tl.x-stretch .whole{animation:tlBow 5s cubic-bezier(.45,0,.55,1) infinite;transform-origin:140px 108px}.tl.x-stretch .tail{animation:tlWag .5s ease-in-out infinite alternate}.tl.x-stretch .body{animation:none}.tl.x-stretch .head{animation:tlYawn 5s ease-in-out infinite}'+
 '.tl.x-curl .body{animation:tlCurl 4.6s ease-in-out infinite}.tl.x-curl .head{animation:tlCurlH 4.6s ease-in-out infinite}.tl.x-curl .closed,.tl.x-curl .zz{display:inline}.tl.x-curl .zz{animation:tlZ 3.4s ease-in-out infinite}.tl.x-curl .tail{animation:none}.tl.x-curl .tip{animation:tlTipFlick 7s ease-in-out infinite}.tl.x-curl .ear.b{animation:tlEarTwitch 6s ease-in-out infinite}.tl.x-curl .ear:not(.b){animation:none}'+
 '.tl.x-cycle .whole{animation:tlTrot .55s ease-in-out infinite}.tl.x-cycle .wh,.tl.x-cycle .crank{animation:tlTurn 1.1s linear infinite}.tl.x-cycle .pl{animation:tlPedal 1.1s linear infinite}.tl.x-cycle .ps{animation:tlSock 1.1s linear infinite}.tl.x-cycle .far .pl,.tl.x-cycle .far .ps{animation-delay:-.55s}.tl.x-cycle .far{opacity:.55}'+
 '.tl.x-cycle .tail{animation:tlWag .3s ease-in-out infinite alternate}.tl.x-cycle .head{animation:tlNod 1.1s ease-in-out infinite}.tl.x-cycle .ear{animation:none;transform:rotate(-18deg)}.tl.x-cycle .scarf{animation:tlScarf .45s ease-in-out infinite alternate;transform-box:view-box}.tl.x-cycle .spd{animation:tlSpd .9s linear infinite}'+
 '.tl.x-bus .whole{animation:tlBus .5s ease-in-out infinite alternate}.tl.x-bus .wb{animation:tlTurn .9s linear infinite}.tl.x-bus .road path{animation:tlRoad .6s linear infinite}.tl.x-bus .head{animation:tlFront 6s ease-in-out infinite}.tl.x-bus .ear{animation:tlEarTwitch 2.2s ease-in-out infinite}.tl.x-bus .ear.b{animation-delay:-1s}.tl.x-bus .eye{animation:tlBlink 4.6s infinite}'+
 '.tl.x-hello .arm{animation:tlHi 3.2s ease-in-out infinite;transform-box:view-box}.tl.x-hello .head{animation:tlHiH 3.2s ease-in-out infinite}'+
 '.tl.x-map .head{animation:tlRead 7s ease-in-out infinite}.tl.x-map .mapg{animation:tlRustle 3.5s ease-in-out infinite alternate;transform-box:view-box}.tl.x-map .rt{animation:maMarch 1.4s linear infinite}.tl.x-map .pn{animation:tlPin 1.8s cubic-bezier(.45,0,.55,1) infinite;transform-box:fill-box;transform-origin:50% 100%}'+
 '.tl.x-trophy .cup{animation:tlLift 3.6s cubic-bezier(.45,0,.55,1) infinite;transform-box:view-box}.tl.x-trophy .head{animation:tlProudF 3.6s ease-in-out infinite}.tl.x-trophy .tail{animation:tlWag .4s ease-in-out infinite alternate}.tl.x-trophy .spk path{animation:maTw 1.8s ease-in-out infinite;transform-box:fill-box;transform-origin:center}.tl.x-trophy .spk path:nth-child(2){animation-delay:.6s}.tl.x-trophy .spk path:nth-child(3){animation-delay:1.2s}'+
 '.tl.x-coffee .head{animation:tlSniff 5.4s ease-in-out infinite}.tl.x-coffee .st1{animation:tlSteam 2.2s ease-out infinite;transform-box:fill-box}.tl.x-coffee .tail{animation:tlTail 5s ease-in-out infinite}'+
 '.tl.x-stargaze .twk{animation:tlTwk 2.6s ease-in-out infinite;transform-box:view-box}.tl.x-stargaze .mn{animation:tlMoon 6s ease-in-out infinite alternate;transform-box:fill-box;transform-origin:center}.tl.x-stargaze .tail{animation:tlTail 6s ease-in-out infinite}'+
 '.tl.x-party .pc{animation:tlFall 2.8s cubic-bezier(.3,.2,.6,1) infinite;opacity:0;transform-box:view-box}'+
 '.tl.x-think .head{animation:tlThink 5s ease-in-out infinite}.tl.x-think .tb>*{transform-box:fill-box;transform-origin:0 100%;animation:tlBub 5s cubic-bezier(.34,1.4,.64,1) infinite}.tl.x-think .b2{animation-delay:.25s}.tl.x-think .b3{animation-delay:.5s}.tl.x-think .d1{animation:maDot 1.2s ease-in-out infinite;transform-box:fill-box}.tl.x-think .tail{animation:tlTail 4.6s ease-in-out infinite}'+
 '.tl.x-peek{clip-path:inset(-80px -80px -80px 0)}.tl.x-peek .whole{animation:tlPeek 8s cubic-bezier(.65,0,.35,1) infinite;transform-origin:0 0}.tl.x-peek svg{animation:tlPeekIn 1.1s cubic-bezier(.22,1,.36,1) both}.tl.x-peek .head{animation:tlPeekH 8s ease-in-out infinite}.tl.x-peek .ear.b{animation:tlEarTwitch 3s ease-in-out infinite}'+
 '@keyframes tlStep{0%,100%{transform:none}50%{transform:translateY(-1.6px)}}@keyframes tlStride{from{transform:rotate(17deg)}to{transform:rotate(-17deg)}}'+
 '@keyframes tlBow{0%,100%{transform:none}35%,60%{transform:rotate(-3deg) scaleX(1.03)}}@keyframes tlYawn{0%,100%{transform:none}35%,60%{transform:rotate(-12deg)}}'+
 '@keyframes tlCurl{0%,100%{transform:none}50%{transform:scale(1.015,1.04)}}@keyframes tlCurlH{0%,100%{transform:none}50%{transform:translateY(-1.2px)}}@keyframes tlTipFlick{0%,80%,100%{transform:none}86%{transform:rotate(-14deg)}92%{transform:rotate(4deg)}}'+
 '@keyframes tlTurn{to{transform:rotate(360deg)}}@keyframes tlScarf{from{transform:scaleY(1) skewX(0)}to{transform:scaleY(.8) skewX(-8deg)}}@keyframes tlSpd{from{transform:translateX(6px);opacity:.9}to{transform:translateX(-8px);opacity:0}}'+
 '@keyframes tlBus{to{transform:translateY(-1.4px)}}@keyframes tlRoad{to{stroke-dashoffset:26}}'+
 '@keyframes tlHi{0%,62%,100%{transform:rotate(0)}10%,34%{transform:rotate(16deg)}22%,46%{transform:rotate(-10deg)}}@keyframes tlHiH{0%,100%{transform:rotate(0)}20%,50%{transform:rotate(7deg)}}'+
 '@keyframes tlRead{0%,100%{transform:translateY(3px) rotate(-5deg)}40%{transform:translateY(3px) rotate(6deg)}62%,78%{transform:translateY(-1px) rotate(0)}}@keyframes tlRustle{from{transform:rotate(-1.5deg)}to{transform:rotate(1.5deg)}}@keyframes tlPin{0%,100%{transform:none}50%{transform:translateY(-4px)}}'+
 '@keyframes tlLift{0%,20%,100%{transform:none}45%,70%{transform:translateY(-7px) rotate(-3deg)}}@keyframes tlProudF{0%,20%,100%{transform:none}45%,70%{transform:rotate(-6deg) translateY(-2px)}}'+
 '@keyframes tlSniff{0%,100%{transform:none}35%,62%{transform:rotate(9deg)}}@keyframes tlSteam{0%{opacity:0;transform:translateY(6px)}30%{opacity:.7}100%{opacity:0;transform:translateY(-14px)}}'+
 '@keyframes tlTwk{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(.6)}}@keyframes tlMoon{from{transform:rotate(-6deg)}to{transform:rotate(6deg)}}'+
 '@keyframes tlFall{0%{opacity:0;transform:translateY(-6px) rotate(0)}12%{opacity:1}80%{opacity:1}100%{opacity:0;transform:translateY(96px) rotate(var(--r))}}'+
 '@keyframes tlThink{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(-12deg)}}@keyframes tlBub{0%{transform:scale(0);opacity:0}12%,82%{transform:none;opacity:1}94%,100%{transform:scale(.6);opacity:0}}'+
 '@keyframes tlPeek{0%,100%{transform:translateX(-18px)}14%,72%{transform:none}}@keyframes tlPeekIn{from{transform:translateX(-70px)}to{transform:none}}@keyframes tlPeekH{0%,14%,100%{transform:none}30%,55%{transform:rotate(-10deg)}}' + PED.css;
document.getElementById('m-kit').textContent += XCSS2;

// Scenes with Tuli: each pairs a pose with the place or object that tells the moment.
Object.assign(SC, {
 streak: { art: G() + '<g class="flk">' + flameAt(78, 98, 4.4, P) + '</g><g class="flk2">' + flameAt(78, 112, 2.3, GD) + '</g>' + st('M40 140L116 128M40 128L116 140') + '<circle cx="66" cy="58" r="2.4" fill="' + K + '" class="emb"/><circle cx="92" cy="50" r="2" fill="' + GD + '" class="emb" style="animation-delay:1s"/>', fox: ['idle', 72, 140, 20] },
 summit: { art: G() + sh('M6 140L76 58H108L132 92L168 64L234 140Z') + st('M168 64V40') + '<path d="M168 40L186 46L168 52Z" fill="' + GD + '" stroke="' + K + '" stroke-width="2.2" stroke-linejoin="round" class="flg"/>' + grp('fl', sh('M24 40a8 8 0 0 1 1-16 12 12 0 0 1 22-4 9 9 0 0 1 8 20z')), fox: ['stand', 62, 61, 99] },
 boulevard: { art: G(112) + st('M196 112V36M196 36C196 28 204 26 210 30') + sh('M204 30h14l-3 9h-8z') + cir(211, 46, 5, GD, 'class="glow"') + st(waveD(8, 126, 18), 'class="wv"') + st(waveD(20, 140, 16), 'class="wv" style="animation-delay:-1.4s"') + st(waveD(40, 154, 12), 'class="wv" style="animation-delay:-2.6s"') + st('M30 50q6-6 12 0q6-6 12 0', 'class="fl"'), fox: ['walk', 100, 60, 46] },
 city: { art: G() + sh('M150 140C146 116 152 90 174 66C180 92 182 118 178 140Z') + sh('M182 140C176 108 182 70 206 34C216 70 220 108 212 140Z') + '<path d="M190 136C186 112 192 82 206 54C212 82 214 112 208 136Z" fill="' + GD + '" opacity=".7" class="rise"/>' + st('M182 140C176 108 182 70 206 34C216 70 220 108 212 140') + sh('M216 140C214 118 218 98 232 80C238 100 238 120 236 140Z') + CRES(70, 14, 96, 56, 26, 23, P) + twk(star4(120, 26, 5), .3) + twk(star4(30, 50, 4), 1.2) + twk(star4(138, 60, 3.4), 2), fox: ['stargaze', 84, 20, 20] },
 champion: { art: G() + grp('grow', sh('M40 96h52v44H40z') + '<text x="66" y="125" text-anchor="middle" font-family="Inter Tight" font-weight="700" font-size="18" fill="' + K + '">2</text>', 'animation-delay:.3s') + grp('grow', sh('M92 80h56v60H92z'), 'animation-delay:.1s') + grp('grow', sh('M148 108h52v32h-52z') + '<text x="174" y="131" text-anchor="middle" font-family="Inter Tight" font-weight="700" font-size="16" fill="' + K + '">3</text>', 'animation-delay:.5s') + twk(star4(34, 60, 5), .4) + twk(star4(208, 70, 6), 1.1), fox: ['trophy', 62, 89, 77] },
 rainy: { art: G() + sh('M48 52a15 15 0 0 1-1-30 22 22 0 0 1 41-6 17 17 0 0 1 14 36z') + [[56, 0], [70, .6], [84, 1.2], [62, 1.5], [78, .3]].map(([x, d], i) => sc('M' + x + ' ' + (62 + (i % 2) * 10) + 'v8', K, 2.6, 'class="rn" style="animation-delay:' + d + 's"')).join('') + '<path d="M112 92a50 40 0 0 1 100 0q-12.5-8-25 0q-12.5-8-25 0q-12.5-8-25 0q-12.5-8-25 0z" fill="' + GD + '" stroke="' + K + '" stroke-width="2.6" stroke-linejoin="round"/>' + st('M162 92V52M162 92V140') + '<ellipse cx="60" cy="140" rx="18" ry="3.4" fill="none" stroke="' + K + '" stroke-width="1.8" class="rip"/>', fox: ['curl', 96, 116, 18] },
});
class MScene extends HTMLElement { static get observedAttributes(){return ['name','size']} connectedCallback(){this.r()} attributeChangedCallback(){ if (this.isConnected) this.r(); }
  r(){ const c = SC[this.getAttribute('name')] || SC.wanderer, w = +(this.getAttribute('size') || 240), k = w / 240, [pose, fs, fx, fb] = c.fox;
    this.style.display = 'inline-block';
    sr(this).innerHTML = '<span style="position:relative;display:block;width:' + w + 'px;height:' + Math.round(160 * k) + 'px"><span class="ma" style="position:absolute;inset:0;z-index:' + (c.behind ? 2 : 1) + '"><svg width="' + w + '" height="' + Math.round(160 * k) + '" viewBox="0 0 240 160" style="overflow:visible">' + c.art + '</svg></span><span style="position:absolute;left:' + fx * k + 'px;bottom:' + fb * k + 'px;z-index:' + (c.behind ? 1 : 2) + '">' + tuliAny(pose, Math.round(fs * k)) + '</span></span>'; animateArt(this.shadowRoot.querySelector('svg'), ''); } }
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
