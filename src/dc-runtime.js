// Runs the designed screens (design/*.dc.html) as-is: each file is a template plus a small logic
// class. This renders them with Preact so the app and the design canvas stay one source of truth.
import { h, render, Component as PComponent } from 'preact';

const SOURCES = window.__DC_SOURCES;
const registry = {};

class DCLogic {}

// Rules that belong to the canvas page, not to the app shell.
const stripPageRules = (css) => css.replace(/(^|\n)\s*(html,body|body)\s*\{[^}]*\}/g, '$1');

const injectedLines = new Set();
function injectStyles(css) {
  const fresh = stripPageRules(css).split('\n').map((l) => l.trim()).filter((l) => l && !injectedLines.has(l));
  fresh.forEach((l) => injectedLines.add(l));
  if (!fresh.length) return;
  const el = document.createElement('style');
  el.textContent = fresh.join('\n');
  document.head.appendChild(el);
}

const lookup = (path, scope) => {
  const p = path.trim();
  if (p === 'true') return true;
  if (p === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(p)) return Number(p);
  let v = scope;
  for (const k of p.split('.')) {
    if (v == null) return undefined;
    v = v[k];
  }
  return v;
};

const WHOLE = /^\s*\{\{([^}]*)\}\}\s*$/;
const ANY = /\{\{([^}]*)\}\}/g;
const interpolate = (text, scope) => text.replace(ANY, (_, p) => { const v = lookup(p, scope); return v == null ? '' : String(v); });
const resolve = (raw, scope) => { const m = WHOLE.exec(raw); return m ? lookup(m[1], scope) : interpolate(raw, scope); };

// HTML lowercases attribute names, so event attributes come in as "onclick" and so on.
const EVENTS = { onclick: 'onClick', onchange: 'onChange', oninput: 'onInput', onpointerdown: 'onPointerDown', onpointermove: 'onPointerMove', onpointerup: 'onPointerUp', onpointercancel: 'onPointerCancel' };

// Dark mode: every screen colours itself inline from one light palette, so the renderer swaps each palette
// colour for its dark partner as it builds. Accent colours (yellow, coral, green, blue) stay as they are.
const THEME = (() => { try { return window.localStorage.getItem('motio.theme') || 'system'; } catch (e) { return 'system'; } })();
export const DARK = THEME === 'dark' || (THEME === 'system' && !!window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
// Layers, darkest first: page #0e0d1a, card #1a1830, raised #24223d, line #2e2b4a. Brand purple pages
// become deep indigo; accent fills (yellow, coral, green, blue, violet) keep their colour and the dark
// text on them, so buttons and avatars stay readable.
const DARK_BG = {
  '#f6f5fc': '#0e0d1a', '#ffffff': '#1a1830', '#fff': '#1a1830', '#eef0f6': '#24223d', '#f3f2fa': '#24223d', '#f0eff8': '#24223d', '#e4e8f0': '#24223d', '#dde3ee': '#24223d',
  '#e3e1f3': '#2e2b4a', '#c9c5ec': '#3a3668', '#c9bdff': '#3a3668', '#1f1d47': '#2a2752', '#16142f': '#0e0d1a', '#2d2a6e': '#211e45',
  '#4b3fd8': '#1b1745', '#5b4fe0': '#2a2470', '#8c7cf0': '#1e1a48',
  '#fde9e6': '#3a1e24', '#fdecea': '#3a1e24', '#fff4d6': '#3a3016', '#fdf1cf': '#3a3016', '#ddf5e3': '#16301f', '#e9f7ec': '#16301f', '#eef0ff': '#24225a'
};
const DARK_FG = { '#1f1d47': '#edebfa', '#16142f': '#edebfa', '#4a4770': '#b9b6d9', '#6b6890': '#8f8cb2', '#9a97b8': '#7c79a0', '#b9b5d6': '#6e6b93', '#4b3fd8': '#a49cff', '#5b4fe0': '#a49cff', '#c2412f': '#ff8a7a', '#1e7a36': '#7fe39a' };
const DARK_LINE = { '#e3e1f3': '#2e2b4a', '#f0eff8': '#24223d', '#eef0f6': '#24223d', '#ffffff': '#1a1830', '#f6f5fc': '#0e0d1a', '#c9c5ec': '#3a3668', '#f5c6c0': '#5a2a2e' };
// Decorative brand-purple shapes in SVGs; illustration colours (skin, white details) stay.
const DARK_FILL = { '#5649e4': '#221d58', '#6a5fe8': '#272058', '#4b3fd8': '#1b1745', '#5b4fe0': '#2a2470', '#8c7cf0': '#1e1a48', '#9888f4': '#272058', '#f6f5fc': '#0e0d1a', '#eef0f6': '#24223d', '#e3e1f3': '#2e2b4a' };
const DARK_STROKE = { ...DARK_FG, '#eceaf8': '#2e2b4a' }; // the day road
const ACCENT = /#(f6c343|f2766b|3dbf5c|6e8cf7|b57be0|ffc107|fc4c02)\b/i;
const swap = (v, map) => v.replace(/#[0-9a-fA-F]{3,6}\b/g, (c) => map[c.toLowerCase()] || c);
const darkCache = new Map();
// While building: inside a coloured fill?, and the text colour inherited in the light and the dark tree.
let ctx = { acc: false, light: '#1f1d47', dark: '#edebfa' };
function darkStyle(css, tag) {
  const key = tag + '|' + css;
  let out = darkCache.get(key);
  if (out !== undefined) return out;
  const bgDecl = (css.match(/(?:^|;)\s*background(?:-color)?\s*:([^;]*)/i) || [])[1] || '';
  const onAccent = ACCENT.test(bgDecl);
  // A dark-navy button is the primary action: in dark mode it turns brand purple instead of fading out.
  const primary = (tag === 'button' || tag === 'a') && /#1f1d47/i.test(bgDecl);
  out = css.split(';').map((d) => {
    const i = d.indexOf(':');
    if (i < 0) return d;
    const prop = d.slice(0, i).trim().toLowerCase(), val = d.slice(i + 1);
    if (prop === 'background' || prop === 'background-color') {
      if (primary) return d.slice(0, i + 1) + val.replace(/#1f1d47/gi, '#5b4fe0');
      // Near-opaque whites (floating buttons, frosted title bars) go dark too; faint whites on dark pages stay.
      return d.slice(0, i + 1) + swap(val, DARK_BG).replace(/rgba\(255,\s*255,\s*255,\s*0?\.([89]\d*)\)/g, 'rgba(26,24,48,0.$1)').replace(/rgba\(246,\s*245,\s*252,\s*(0?\.\d+)\)/g, 'rgba(14,13,26,$1)');
    }
    if (prop === 'color') return onAccent ? d : d.slice(0, i + 1) + swap(val, DARK_FG);
    if (prop.startsWith('border') || prop === 'outline') return d.slice(0, i + 1) + swap(val, DARK_LINE);
    if (prop === 'box-shadow') return d.slice(0, i + 1) + val.replace(/rgba\((20,\s*14,\s*70|31,\s*29,\s*71)/g, 'rgba(0,0,0');
    return d;
  }).join(';');
  darkCache.set(key, out);
  return out;
}
if (DARK) {
  document.documentElement.style.colorScheme = 'dark';
  document.documentElement.style.background = '#0c0c0c';
  document.documentElement.classList.add('m-dark-theme');
}

// Motio 5.0 skin: screens are still written in the 4.x palette, so every colour and the font are swapped for
// the 5.0 design system (src/ds.js) as the tree is built: calm greys, black ink, colour only where it means
// something. Runs after the dark mapping, so it also neutralises the dark theme's indigo layers.
const SKIN = {
  // light surfaces and ink
  '#f6f5fc': '#ececea', '#f3f2fa': '#f5f5f3', '#f0eff8': '#f5f5f3', '#eef0f6': '#f5f5f3', '#e4e8f0': '#e1e1de', '#dde3ee': '#e1e1de',
  '#e3e1f3': '#e1e1de', '#eceaf8': '#e6e6e3', '#e3e1f3cc': '#e1e1de', '#c9c5ec': '#d4d4d0', '#c9bdff': '#d4d4d0', '#bfd0ff': '#d4d4d0',
  '#1f1d47': '#0f0f0f', '#16142f': '#0f0f0f', '#2d2a6e': '#1c1c1c', '#4a4770': '#3a3a38', '#6b6890': '#6e6e6a', '#8a87a8': '#8e8e8a',
  '#9a97b8': '#9a9a96', '#b9b5d6': '#b4b4b0', '#eef0ff': '#f5f5f3',
  // brand purple becomes the dark card colour; its tints become greys
  '#4b3fd8': '#141414', '#5b4fe0': '#141414', '#5649e4': '#1c1c1c', '#6a5fe8': '#242424', '#7b6ef5': '#2e2e2e', '#8c7cf0': '#3a3a3a', '#9888f4': '#3a3a3a',
  // modes, slightly calmer
  '#3dbf5c': '#2fb457', '#6e8cf7': '#4f7bf0', '#b57be0': '#8e6be0', '#f2766b': '#e5604f',
  // the dark theme's indigo layers become neutral
  '#0e0d1a': '#0c0c0c', '#1a1830': '#1a1a1a', '#24223d': '#242424', '#2e2b4a': '#2c2c2c', '#3a3668': '#3a3a3a', '#2a2752': '#262626',
  '#211e45': '#1c1c1c', '#1b1745': '#141414', '#2a2470': '#1e1e1e', '#1e1a48': '#1a1a1a', '#221d58': '#1c1c1c', '#272058': '#202020', '#24225a': '#242424',
  '#edebfa': '#f2f2f0', '#b9b6d9': '#cfcfcb', '#8f8cb2': '#8f8f8a', '#7c79a0': '#7a7a76', '#6e6b93': '#5e5e5a', '#a49cff': '#e8e8e4', '#5a2a2e': '#4a2a2a'
};
const skinCache = new Map();
function skin(v) {
  if (typeof v !== 'string' || !v) return v;
  let out = skinCache.get(v);
  if (out !== undefined) return out;
  out = v.replace(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g, (c) => SKIN[c.toLowerCase()] || c)
    .replace(/'Poppins'|Poppins/g, "'Inter Tight'")
    .replace(/rgba\((?:20,\s*14,\s*70|31,\s*29,\s*71|20,\s*12,\s*90)/g, 'rgba(0,0,0')
    .replace(/rgba\(26,\s*24,\s*48/g, 'rgba(26,26,26').replace(/rgba\(14,\s*13,\s*26/g, 'rgba(12,12,12')
    .replace(/rgba\(246,\s*245,\s*252/g, 'rgba(236,236,234').replace(/rgba\((?:75,\s*63,\s*216|91,\s*79,\s*224)/g, 'rgba(20,20,20');
  if (skinCache.size > 4000) skinCache.clear();
  skinCache.set(v, out);
  return out;
}
// Light theme: 4.x pages were full-screen colour (purple, coral, green, navy) with white text. In 5.0 every page
// is the light glow with ink text, so inside a coloured page white text, icons and see-through white panels flip
// to ink and white cards. Anything with its own solid fill (a black button, a yellow chip) keeps its look.
const PAGE_BG = 'radial-gradient(120% 70% at 85% 4%, #FFFFFF 0, #ECECEA 46%, #DCDCDA 100%)';
const BG_RE = /(?:^|;)\s*background(?:-color)?\s*:([^;]*)/i;
const SEE_THROUGH = /rgba\(255,\s*255,\s*255,\s*0?\.[0-4]\d*\)/i;
let lift = false;
const liftColor = (v) => v.replace(/#fff(?:fff)?\b/gi, '#0F0F0F').replace(/rgba\(255,\s*255,\s*255,\s*(0?\.\d+)\)/g, (m, a) => `rgba(15,15,15,${Math.min(1, +a * 0.7).toFixed(2)})`);
function liftStyle(css) {
  return css.split(';').map((d) => {
    const i = d.indexOf(':');
    if (i < 0) return d;
    const p = d.slice(0, i).trim().toLowerCase(), v = d.slice(i + 1);
    if (p === 'color' || p.startsWith('border') || p === 'outline' || p === 'fill' || p === 'stroke') return d.slice(0, i + 1) + liftColor(v);
    if (p === 'background' || p === 'background-color') return d.slice(0, i + 1) + v.replace(/rgba\(255,\s*255,\s*255,\s*0?\.[0-4]\d*\)/g, '#FFFFFF');
    return d;
  }).join(';');
}
// Big coloured cards (records, profile tiles, insight cards) were solid yellow, coral, green or blue. In 5.0 they become
// soft tints of the same hue with ink text; small coloured chips, icons and buttons keep their full colour.
const TINT = { '#f6c343': '#F7EBC5', '#f2766b': '#F6D9D4', '#3dbf5c': '#D9EEDF', '#6e8cf7': '#DAE3FA', '#b57be0': '#E8DDF6', '#e5604f': '#F6D9D4', '#2fb457': '#D9EEDF', '#4f7bf0': '#DAE3FA', '#8e6be0': '#E8DDF6' };
function bigAccent(raw, bg) {
  const key = (bg.match(/#[0-9a-fA-F]{6}\b/) || [''])[0].toLowerCase();
  if (!TINT[key] || /gradient/.test(bg)) return null;
  const px = (re) => { const m = raw.match(re); return m ? +m[1] : null; };
  const w = px(/(?:^|;)\s*width:\s*(\d+)px/), h = px(/(?:^|;)\s*height:\s*(\d+)px/), pad = px(/(?:^|;)\s*padding:\s*(\d+)px/), r = px(/border-radius:\s*(\d+)px/);
  if ((w && w <= 72) || (h && h <= 72)) return null;
  if (!(r && r >= 18) || !(pad >= 12 || (h && h >= 90) || /min-height:\s*(9\d|\d{3})px/.test(raw))) return null;
  return TINT[key];
}
function lightProps(props) {
  const raw = typeof props.style === 'string' ? props.style : '';
  const bg = ((raw.match(BG_RE) || [])[1] || '').trim();
  const page = /height:\s*844px/.test(raw) && bg && ((/^#/.test(bg) && !/^#(f6f5fc|ffffff|fff|eef0f6|f3f2fa)$/i.test(bg)) || /^(radial|linear)-gradient/.test(bg) && /#16142f|#1f1d47|#4b3fd8/i.test(bg));
  const solid = bg && !/^(transparent|none)$/i.test(bg) && !SEE_THROUGH.test(bg) && !/^var\(/.test(bg);
  const tint = !page && bg && bigAccent(raw, bg);
  if (tint) { props.style = raw.replace(BG_RE, (m) => m.replace(bg, tint)) + '; color: #0F0F0F'; return true; }
  if (page) props.style = raw.replace(BG_RE, (m) => m.replace(bg, PAGE_BG)) + '; color: #0F0F0F';
  else if (lift && !solid) {
    if (raw) props.style = liftStyle(raw);
    // Purple shapes drawn on a purple page were decoration; on the light page they become soft white light.
    if (typeof props.fill === 'string') props.fill = liftColor(props.fill).replace(/#(5649e4|6a5fe8|7b6ef5|8c7cf0|9888f4|5b4fe0|4b3fd8)\b/gi, 'rgba(255,255,255,0.7)');
    if (typeof props.stroke === 'string') props.stroke = liftColor(props.stroke);
  }
  return page ? true : solid ? false : lift;
}
const skinProps = (p) => { if (p.style) p.style = skin(p.style); if (p.fill) p.fill = skin(p.fill); if (p.stroke) p.stroke = skin(p.stroke); if (p['stop-color']) p['stop-color'] = skin(p['stop-color']); return p; };

// Templates are read from the DOM once and kept as plain objects, so a redraw doesn't walk DOM nodes,
// attribute lists and '{{' checks again for every element on every render.
function compile(n) {
  if (n.nodeType === 3) return { text: n.data, dyn: n.data.includes('{{') };
  if (n.nodeType !== 1) return null;
  const attrs = Array.from(n.attributes, (a) => ({ name: a.name, value: a.value, dyn: a.value.includes('{{') }));
  return { tag: n.localName, attrs, at: Object.fromEntries(attrs.map((a) => [a.name, a.value])), kids: Array.from(n.childNodes, compile).filter(Boolean) };
}

function build(node, scope) {
  if (node.text !== undefined) return node.dyn ? interpolate(node.text, scope) : node.text;
  const tag = node.tag;
  let kids = () => node.kids.map((c) => build(c, scope));

  if (tag === 'sc-if') return resolve(node.at.value || 'false', scope) ? kids() : null;

  if (tag === 'sc-for') {
    const list = resolve(node.at.list || '', scope) || [];
    const as = node.at.as || 'item';
    return list.map((item, i) => {
      const inner = { ...scope, [as]: item, $index: i };
      return node.kids.map((c) => build(c, inner));
    });
  }

  if (tag === 'dc-import') {
    const props = {};
    for (const a of node.attrs) {
      if (a.name.startsWith('hint-') || a.name === 'name') continue;
      const key = a.name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      props[key] = resolve(a.value, scope);
    }
    return h(componentFor(node.at.name), props);
  }

  const props = {};
  for (const a of node.attrs) {
    let name = a.name;
    const value = a.dyn ? resolve(a.value, scope) : a.value;
    if (name in EVENTS) {
      name = EVENTS[name];
      // Designed handlers fire while typing, which is "input" in the DOM.
      if (name === 'onChange' && (tag === 'input' || tag === 'textarea')) name = 'onInput';
    }
    props[name] = value;
  }
  // Page titles in 5.0 are lowercase with a full stop ("friends."), one voice on every page.
  if (tag === 'h1' && node.kids.length === 1 && node.kids[0].text !== undefined && !node.kids[0].dyn) { // names and other data keep their case
    const t = interpolate(node.kids[0].text, scope).trim();
    if (t && t.length < 32 && !/[.!?:]$/.test(t)) {
      props.style = (props.style || '') + '; letter-spacing: -1px; font-weight: 600';
      kids = () => [t.toLowerCase() + '.'];
    }
  }
  if (!DARK) {
    const saved = lift;
    lift = lightProps(props);
    try { return h(tag, skinProps(props), ...kids()); } finally { lift = saved; }
  }
  // Dark mode. Inside a coloured fill (yellow button, coral avatar, green card) everything keeps its light
  // look, so dark text and icons stay readable; a solid surface inside it starts the dark rules again.
  const raw = typeof props.style === 'string' ? props.style : '';
  const bg = (raw.match(/(?:^|;)\s*background(?:-color)?\s*:([^;]*)/i) || [])[1] || '';
  const declared = ((raw.match(/(?:^|;)\s*color\s*:([^;]*)/gi) || []).pop() || '').replace(/^;?\s*color\s*:/i, '').trim();
  const accentBg = ACCENT.test(bg), veil = /rgba\(255,\s*255,\s*255,\s*0?\.[5-9]/i.test(bg);
  let acc = ctx.acc;
  // A white text chip on a coloured card stays white; a white panel (no font size of its own) turns dark.
  const chip = ctx.acc && /#fff(fff)?\b/i.test(bg) && /(?:^|;)\s*font-size/i.test(raw);
  if (accentBg || (ctx.acc && veil) || chip) acc = true;
  else if (bg && !/^\s*(transparent|none)\s*$/i.test(bg) && !/rgba\([^)]*,\s*0?\.[0-4]\d*\)/i.test(bg) && !/var\(/.test(bg)) acc = false;
  const own = declared && !/inherit|currentcolor/i.test(declared) ? declared : ctx.light;
  const want = acc ? own : swap(own, DARK_FG);
  if (raw) props.style = acc ? raw : darkStyle(raw, tag);
  // Spell the colour out when it differs from what would be inherited in the dark tree.
  if (want !== ctx.dark || (declared && !acc)) props.style = (props.style ? props.style + '; ' : '') + 'color: ' + want;
  if (!acc && typeof props.stroke === 'string') props.stroke = swap(props.stroke, DARK_STROKE);
  if (!acc && typeof props.fill === 'string') props.fill = swap(props.fill, DARK_FILL);
  const saved = ctx;
  ctx = { acc, light: own, dark: want };
  try { return h(tag, skinProps(props), ...kids()); } finally { ctx = saved; }
}

function load(name) {
  if (registry[name]) return registry[name];
  if (!SOURCES[name]) throw new Error('Unknown screen: ' + name);
  const doc = new DOMParser().parseFromString(SOURCES[name], 'text/html');
  const dc = doc.querySelector('x-dc');
  const helmet = dc.querySelector('helmet');
  // A screen's styles go in when it is first shown (see componentFor), not when it is prepared early.
  const styles = helmet ? Array.from(helmet.querySelectorAll('style'), (s) => (DARK ? s.textContent.replace(/(background(?:-color)?:\s*)(#[0-9a-fA-F]{3,6})\b/g, (m, p, c) => p + (DARK_BG[c.toLowerCase()] || c)) : s.textContent)).map(skin) : [];
  if (helmet) helmet.remove();
  const code = doc.querySelector('script[data-dc-script]').textContent;
  const Logic = new Function('DCLogic', code + '\nreturn Component;')(DCLogic);
  return (registry[name] = { Logic, styles, nodes: Array.from(dc.childNodes, compile).filter(Boolean) });
}

const comps = {};
function componentFor(name) {
  if (comps[name]) return comps[name];
  const { Logic, nodes, styles } = load(name);
  styles.forEach(injectStyles);
  comps[name] = class extends PComponent {
    constructor(props) {
      super(props);
      const logic = (this.logic = new Logic());
      logic.props = props;
      logic.state = {};
      logic.setState = (patch) => {
        logic.state = { ...logic.state, ...(typeof patch === 'function' ? patch(logic.state) : patch) };
        this.setState({});
      };
      logic.forceUpdate = () => this.forceUpdate();
    }
    // A page only re-renders for its own state or when the parent hands it different props.
    shouldComponentUpdate(next, nextState) {
      if (nextState !== this.state) return true;
      const keys = Object.keys(next);
      return keys.length !== Object.keys(this.props).length || keys.some((k) => next[k] !== this.props[k]);
    }
    componentDidMount() {
      // A new page's slide-in starts once the page is built and painted (two frames), so the slide plays
      // from its first frame instead of popping in half-finished. Released by re-rendering without the hold
      // class; the timer is a backup in case frames are paused (app in the background).
      const release = () => { if (this.held) return; this.held = true; this.forceUpdate(); };
      requestAnimationFrame(() => requestAnimationFrame(release));
      setTimeout(release, 160);
      // Screens redraw when the app's data changes (new trip, sync, settings). A tab you can't see (tracking
      // changes data every second) waits and redraws once when it comes into view, so it costs no frames.
      const hidden = () => !!(this.rootEl && this.rootEl.closest('[data-page=tab][aria-hidden="true"]'));
      if (window.Motio) this.unsub = window.Motio.subscribe(() => { if (hidden()) this.stale = true; else this.forceUpdate(); });
      // The catch-up waits for the tab's slide (380 ms) to finish, so it never costs a frame mid-motion.
      this.onTab = () => { if (this.stale && !hidden()) { this.stale = false; clearTimeout(this.tabT); this.tabT = setTimeout(() => this.forceUpdate(), 400); } };
      window.addEventListener('motio:tab', this.onTab);
      // Auto-refresh: a screen that loads server data does it again (the methods screens already use), then redraws.
      this.onRefresh = () => {
        const L = this.logic;
        ['load', 'loadSocial', 'loadProfile', 'checkSetup'].forEach((k) => { if (typeof L[k] === 'function') { try { L[k](); } catch (e) { /* the screen shows its own error */ } } });
        this.forceUpdate();
      };
      window.addEventListener('motio:refresh', this.onRefresh);
      if (this.logic.componentDidMount) this.logic.componentDidMount();
    }
    componentWillUnmount() {
      window.removeEventListener('motio:refresh', this.onRefresh);
      window.removeEventListener('motio:tab', this.onTab);
      clearTimeout(this.tabT);
      if (this.unsub) this.unsub();
      if (this.logic.componentWillUnmount) this.logic.componentWillUnmount();
    }
    render(props) {
      this.logic.props = props;
      const t0 = performance.now();
      const vals = this.logic.renderVals();
      const t1 = performance.now();
      const out = nodes.map((n) => build(n, vals)).filter((v) => v != null && !(typeof v === 'string' && !v.trim()));
      // Slow renders are kept for checking smoothness: window.__motioSlow lists [screen, logic ms, markup ms].
      const t2 = performance.now();
      if (t2 - t0 > 8) { const l = (window.__motioSlow = window.__motioSlow || []); l.push([name, Math.round(t1 - t0), Math.round(t2 - t1)]); if (l.length > 50) l.shift(); }
      // The first element is the screen itself: mark it so the app can stretch it to the phone.
      const root = out[0];
      if (root && root.props) root.props.class = ((root.props.class || '') + ' dc-root' + (this.held ? '' : ' motio-hold')).trim();
      // Screens render several root nodes, so `this.base` isn't reliable; keep the screen's own element.
      if (root && root.props && !root.ref) root.ref = this.setRoot || (this.setRoot = (el) => { this.rootEl = el; });
      return out;
    }
  };
  return comps[name];
}

export function mount(name, el, props = {}) {
  render(h(componentFor(name), props), el);
  // Prepare every screen (parse + compile its template and code) in idle moments after launch, so the
  // first time a page opens it doesn't spend a frame doing that before its slide starts.
  const idle = window.requestIdleCallback || ((f) => setTimeout(f, 50));
  const names = Object.keys(SOURCES);
  const next = () => { const n = names.shift(); if (!n) return; try { load(n); } catch (e) { /* shown when that screen opens */ } idle(next); };
  setTimeout(() => idle(next), 2500);
}
