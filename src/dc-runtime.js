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
  document.documentElement.style.background = '#0e0d1a';
}

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
  const kids = () => node.kids.map((c) => build(c, scope));

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
  if (!DARK) return h(tag, props, ...kids());
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
  try { return h(tag, props, ...kids()); } finally { ctx = saved; }
}

function load(name) {
  if (registry[name]) return registry[name];
  if (!SOURCES[name]) throw new Error('Unknown screen: ' + name);
  const doc = new DOMParser().parseFromString(SOURCES[name], 'text/html');
  const dc = doc.querySelector('x-dc');
  const helmet = dc.querySelector('helmet');
  // A screen's styles go in when it is first shown (see componentFor), not when it is prepared early.
  const styles = helmet ? Array.from(helmet.querySelectorAll('style'), (s) => (DARK ? s.textContent.replace(/(background(?:-color)?:\s*)(#[0-9a-fA-F]{3,6})\b/g, (m, p, c) => p + (DARK_BG[c.toLowerCase()] || c)) : s.textContent)) : [];
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
