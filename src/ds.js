// Motio 5.0 design system: tokens, components and motion in one stylesheet, injected once.
// Calm and nearly colourless; colour only carries meaning (a mode, the goal, a warning).
// Screens use the classes (class="m-card") or the variables (background: var(--m-card)).
export const MODE_COLORS = { walk: '#2FB457', run: '#E5604F', bike: '#4F7BF0', transit: '#8E6BE0', drive: '#E7A82A' };

const CSS = `
:root{
  --m-bg:#ECECEA; --m-bg-hi:#FFFFFF; --m-bg-lo:#DCDCDA;
  --m-card:#FFFFFF; --m-soft:#F5F5F3; --m-line:#E1E1DE;
  --m-ink:#0F0F0F; --m-ink-2:#3A3A38; --m-mute:#6E6E6A; --m-faint:#A3A39F;
  --m-dark:#141414; --m-dark-2:#2B2B2B; --m-on-dark:#FFFFFF; --m-on-dark-mute:#A8A8A4;
  --m-accent:#141414; --m-goal:#F6C343; --m-warn:#C2412F; --m-ok:#1E7A36;
  --m-walk:#2FB457; --m-run:#E5604F; --m-bike:#4F7BF0; --m-transit:#8E6BE0; --m-drive:#E7A82A;
  --m-font:'Inter Tight',system-ui,-apple-system,sans-serif;
  --m-r-card:28px; --m-r-row:18px; --m-r-pill:999px;
  --m-ease:cubic-bezier(.22,1,.36,1); --m-spring:cubic-bezier(.34,1.4,.64,1);
}
.m-dark-theme{
  --m-bg:#0C0C0C; --m-bg-hi:#1C1C1C; --m-bg-lo:#050505;
  --m-card:#1A1A1A; --m-soft:#242424; --m-line:#2C2C2C;
  --m-ink:#F2F2F0; --m-ink-2:#CFCFCB; --m-mute:#8F8F8A; --m-faint:#5E5E5A;
  --m-dark:#F2F2F0; --m-dark-2:#D8D8D4; --m-on-dark:#0F0F0F; --m-on-dark-mute:#5E5E5A;
}
/* Page: a soft glow, never flat grey. */
.m-page{background:radial-gradient(120% 70% at 85% 4%,var(--m-bg-hi) 0,var(--m-bg) 46%,var(--m-bg-lo) 100%);color:var(--m-ink);font:500 15px/1.4 var(--m-font);font-variant-numeric:tabular-nums}
.m-page.low{background:radial-gradient(90% 60% at 20% 100%,var(--m-bg-hi) 0,var(--m-bg) 50%,var(--m-bg-lo) 100%)}
/* Type: one family. Titles are lowercase with a full stop ("today."). */
.m-title{font:600 38px/1 var(--m-font);letter-spacing:-1.4px;margin:0}
.m-h2{font:600 22px/1.15 var(--m-font);letter-spacing:-.6px;margin:0}
.m-h3{font:600 16px/1.3 var(--m-font);margin:0}
.m-num{font:600 44px/1 var(--m-font);letter-spacing:-2px}
.m-num.s{font-size:21px;letter-spacing:-.6px}
.m-num{white-space:nowrap}
.m-label{font:600 11px/1.2 var(--m-font);letter-spacing:.4px;text-transform:uppercase;color:var(--m-mute)}
.m-sub{font:500 13px/1.45 var(--m-font);color:var(--m-mute)}
.m-say{font:400 24px/1.28 var(--m-font);letter-spacing:-.4px;text-align:center}
.m-say b{font-weight:700}
/* Surfaces */
.m-card{background:var(--m-card);border-radius:var(--m-r-card);padding:16px}
.m-card.dark{background:linear-gradient(160deg,var(--m-dark-2),var(--m-dark));color:var(--m-on-dark)}
.m-card.dark .m-label,.m-card.dark .m-sub{color:var(--m-on-dark-mute)}
/* Tuli on a dark card is drawn in negative: a white fox with dark details. */
.m-card.dark .tl{color:var(--m-on-dark);--m-bg-hi:var(--m-dark-2)}
.m-row{display:flex;align-items:center;gap:12px;min-height:44px;padding:10px 14px;border-radius:var(--m-r-row);background:var(--m-soft)}
.m-list{display:flex;flex-direction:column;gap:6px}
.m-dot{width:10px;height:10px;border-radius:5px;flex-shrink:0}
/* Controls: black pill is the one main action; white pill is secondary. */
.m-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:52px;padding:0 26px;border:0;border-radius:var(--m-r-pill);background:var(--m-ink);color:var(--m-bg-hi);font:600 15px var(--m-font);cursor:pointer;transition:transform .2s var(--m-ease),opacity .2s}
.m-btn.w{background:var(--m-card);color:var(--m-ink)}
.m-btn.wide{display:flex;width:100%}
.m-btn:active{transform:scale(.97)}
.m-icon{width:44px;height:44px;border-radius:22px;border:0;background:var(--m-card);color:var(--m-ink);display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
.m-icon.ink{background:var(--m-ink);color:var(--m-bg-hi)}
.m-chip{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 15px;border:0;border-radius:var(--m-r-pill);background:var(--m-card);color:var(--m-ink);font:600 13px var(--m-font);cursor:pointer;transition:background-color .22s var(--m-ease),color .22s var(--m-ease)}
.m-chip.on{background:var(--m-ink);color:var(--m-bg-hi)}
.m-option{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:50px;padding:10px 18px;border:0;border-radius:var(--m-r-pill);background:var(--m-card);color:var(--m-ink);font:600 14px var(--m-font);text-align:center;cursor:pointer;transition:background-color .25s var(--m-ease),color .25s var(--m-ease),border-radius .25s var(--m-ease)}
.m-option.on{background:var(--m-ink);color:var(--m-bg-hi);border-radius:26px}
.m-face{width:54px;height:54px;border-radius:27px;border:0;background:var(--m-card);color:var(--m-ink);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:background-color .22s,color .22s,transform .3s var(--m-spring)}
.m-face.on{background:var(--m-ink);color:var(--m-bg-hi);transform:scale(1.08)}
.m-toggle{width:50px;height:30px;border-radius:15px;border:0;background:var(--m-line);position:relative;cursor:pointer;transition:background-color .25s}
.m-toggle::after{content:'';position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:12px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2);transition:transform .3s var(--m-spring)}
.m-toggle.on,.m-toggle[aria-checked="true"]{background:var(--m-ink)}
.m-toggle.on::after,.m-toggle[aria-checked="true"]::after{transform:translateX(20px)}
.m-progress{height:4px;border-radius:2px;background:var(--m-line);overflow:hidden}
.m-progress>i{display:block;height:100%;background:var(--m-ink);border-radius:2px;transition:width .5s var(--m-ease)}
/* Top bar on pushed pages: transparent at the top; once you scroll it turns frosted and shows the page title small. */
.m-topbar{position:absolute;left:0;right:0;top:0;z-index:8;display:flex;align-items:center;gap:8px;padding:10px 20px 8px;transition:background-color .3s var(--m-ease),box-shadow .3s var(--m-ease),transform .65s cubic-bezier(.34,1.25,.64,1),opacity .4s ease}
.m-topbar.m-hide{transform:translateY(-110%);opacity:0;pointer-events:none;transition:transform .75s cubic-bezier(.32,.72,0,1),opacity .5s ease .15s}
.m-topbar .m-tt{flex:1;text-align:center;font:600 16px var(--m-font);opacity:0;transform:translateY(6px);transition:opacity .3s var(--m-ease),transform .3s var(--m-ease)}
.m-scrolled .m-topbar{background:color-mix(in srgb,var(--m-bg) 72%,transparent);-webkit-backdrop-filter:blur(22px) saturate(1.6);backdrop-filter:blur(22px) saturate(1.6);box-shadow:0 1px 0 color-mix(in srgb,var(--m-ink) 8%,transparent)}
.m-scrolled .m-topbar .m-tt{opacity:1;transform:none}
.m-scrolled .m-title{opacity:0;transform:translateY(-8px) scale(.96);transform-origin:left;transition:opacity .3s var(--m-ease),transform .3s var(--m-ease)}
.m-title{transition:opacity .3s var(--m-ease),transform .3s var(--m-ease)}
/* Tab headers: the big title stays; once you scroll, the header turns into a frosted bar the page slides under. */
.m-tabhead{position:relative;z-index:6;margin:-18px -20px -14px;padding:18px 20px 14px;transition:background-color .3s var(--m-ease),box-shadow .3s var(--m-ease)}
.m-scrolled .m-tabhead{background:color-mix(in srgb,var(--m-bg) 74%,transparent);-webkit-backdrop-filter:blur(22px) saturate(1.6);backdrop-filter:blur(22px) saturate(1.6);box-shadow:0 1px 0 color-mix(in srgb,var(--m-ink) 8%,transparent)}
.m-scrolled .m-tabhead .m-title{opacity:1;transform:none}
/* Navigation: a floating frosted pill. Scrolling down tucks it away; it springs back on the way up. */
m-nav.m-tabbar{transition:transform .65s cubic-bezier(.34,1.25,.64,1),opacity .4s ease!important}
m-nav.m-tabbar.m-hide{transform:translateY(120px) scale(.97)!important;opacity:0!important;pointer-events:none;transition:transform .75s cubic-bezier(.32,.72,0,1),opacity .55s ease .2s!important}

.m-tabbar{position:absolute;left:14px;right:14px;bottom:18px;height:64px;padding:6px;display:flex;border-radius:32px;background:color-mix(in srgb,var(--m-card) 82%,transparent);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);box-shadow:0 6px 24px rgba(0,0,0,.08)}
.m-tab{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;border:0;border-radius:26px;background:transparent;color:var(--m-mute);font:600 10.5px var(--m-font);cursor:pointer;transition:background-color .25s var(--m-ease),color .25s}
.m-tab.on{background:var(--m-soft);color:var(--m-ink)}
.m-sheet{position:absolute;left:0;right:0;bottom:0;padding:22px 20px 34px;border-radius:32px 32px 0 0;background:var(--m-card);animation:mSheet .42s var(--m-ease)}
/* Moment: a full-screen illustration, one sentence with a bold phrase, one button. */
.m-moment{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;padding:80px 32px 120px}
.m-moment .m-btn{position:absolute;left:22px;right:22px;bottom:34px}
.m-skel{background:linear-gradient(90deg,var(--m-soft) 0,var(--m-line) 50%,var(--m-soft) 100%);background-size:200% 100%;border-radius:var(--m-r-row);animation:mShimmer 1.4s linear infinite}
/* Motion: things arrive one after another (art, title, content, button last). */
.m-in{animation:mIn .6s var(--m-ease) backwards;animation-delay:calc(var(--i,0) * 70ms)}
.m-pop{animation:mPop .55s var(--m-spring) backwards;animation-delay:calc(var(--i,0) * 70ms)}
.m-late{animation:mIn .5s var(--m-ease) .45s backwards}
.m-bob{animation:mBob 3.4s ease-in-out infinite}
.m-draw path,.m-draw circle,.m-draw ellipse{stroke-dasharray:1;stroke-dashoffset:1;animation:mDraw 1.4s var(--m-ease) forwards}
@keyframes mIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes mPop{0%{opacity:0;transform:scale(.7)}70%{opacity:1;transform:scale(1.05)}100%{transform:none}}
@keyframes mBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@keyframes mDraw{to{stroke-dashoffset:0}}
@keyframes mSheet{from{transform:translateY(100%)}to{transform:none}}
@keyframes mShimmer{to{background-position:-200% 0}}
@media (prefers-reduced-motion: reduce){.m-in,.m-pop,.m-late,.m-bob,.m-sheet,.m-skel{animation:none!important}.m-draw *{animation:none!important;stroke-dashoffset:0!important}}
`;
if (typeof document !== 'undefined' && !document.getElementById('m-ds')) {
  const font = document.createElement('link');
  font.rel = 'stylesheet';
  font.href = 'https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&display=swap';
  const st = document.createElement('style');
  st.id = 'm-ds'; st.textContent = CSS;
  document.head.append(font, st);
}
