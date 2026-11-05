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
const DARK_BG = { '#ffffff': '#1c1b36', '#fff': '#1c1b36', '#f6f5fc': '#100f22', '#f3f2fa': '#24234a', '#eef0f6': '#24234a', '#f0eff8': '#24234a', '#e3e1f3': '#2f2d58',
  '#1f1d47': '#34307a', '#fde9e6': '#3a1f2a', '#ddf5e3': '#173322', '#fdf1cf': '#3a3218', '#eef0ff': '#26265a', '#c9c5ec': '#3a3768' };
const DARK_FG = { '#1f1d47': '#ecebfa', '#4a4770': '#c3c0e4', '#6b6890': '#9f9cc4', '#9a97b8': '#7d7aa3', '#4b3fd8': '#a49cff', '#c2412f': '#ff8a7a', '#1e7a36': '#7fe39a' };
const DARK_LINE = { '#e3e1f3': '#2f2d58', '#f0eff8': '#26244a', '#ffffff': '#1c1b36', '#f6f5fc': '#100f22', '#c9c5ec': '#3a3768' };
const swap = (v, map) => v.replace(/#[0-9a-fA-F]{3,6}\b/g, (c) => map[c.toLowerCase()] || c);
const darkCache = new Map();
function darkStyle(css) {
  let out = darkCache.get(css);
  if (out !== undefined) return out;
  out = css.split(';').map((d) => {
    const i = d.indexOf(':');
    if (i < 0) return d;
    const prop = d.slice(0, i).trim().toLowerCase(), val = d.slice(i + 1);
    // Near-opaque whites (floating buttons, frosted title bars) go dark too; faint whites on dark pages stay.
    if (prop === 'background' || prop === 'background-color') return d.slice(0, i + 1) + swap(val, DARK_BG).replace(/rgba\(255,\s*255,\s*255,\s*0?\.([89]\d*)\)/g, 'rgba(28,27,54,0.$1)').replace(/rgba\(246,\s*245,\s*252,\s*(0?\.\d+)\)/g, 'rgba(16,15,34,$1)');
    if (prop === 'color') return d.slice(0, i + 1) + swap(val, DARK_FG);
    if (prop.startsWith('border') || prop === 'outline') return d.slice(0, i + 1) + swap(val, DARK_LINE);
    return d;
  }).join(';');
  darkCache.set(css, out);
  return out;
}
if (DARK) {
  document.documentElement.style.colorScheme = 'dark';
  document.documentElement.style.background = '#100f22';
}

function build(node, scope) {
  if (node.nodeType === 3) return node.data.includes('{{') ? interpolate(node.data, scope) : node.data;
  if (node.nodeType !== 1) return null;
  const tag = node.localName;
  const kids = () => Array.from(node.childNodes).map((c) => build(c, scope));

  if (tag === 'sc-if') return resolve(node.getAttribute('value') || 'false', scope) ? kids() : null;

  if (tag === 'sc-for') {
    const list = resolve(node.getAttribute('list') || '', scope) || [];
    const as = node.getAttribute('as') || 'item';
    return list.map((item, i) => {
      const inner = { ...scope, [as]: item, $index: i };
      return Array.from(node.childNodes).map((c) => build(c, inner));
    });
  }

  if (tag === 'dc-import') {
    const props = {};
    for (const a of node.attributes) {
      if (a.name.startsWith('hint-') || a.name === 'name') continue;
      const key = a.name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      props[key] = resolve(a.value, scope);
    }
    return h(componentFor(node.getAttribute('name')), props);
  }

  const props = {};
  for (const a of node.attributes) {
    let name = a.name;
    const value = a.value.includes('{{') ? resolve(a.value, scope) : a.value;
    if (name in EVENTS) {
      name = EVENTS[name];
      // Designed handlers fire while typing, which is "input" in the DOM.
      if (name === 'onChange' && (tag === 'input' || tag === 'textarea')) name = 'onInput';
    }
    props[name] = DARK && typeof value === 'string' ? (name === 'style' ? darkStyle(value) : name === 'stroke' ? swap(value, DARK_FG) : value) : value;
  }
  return h(tag, props, ...kids());
}

function load(name) {
  if (registry[name]) return registry[name];
  if (!SOURCES[name]) throw new Error('Unknown screen: ' + name);
  const doc = new DOMParser().parseFromString(SOURCES[name], 'text/html');
  const dc = doc.querySelector('x-dc');
  const helmet = dc.querySelector('helmet');
  if (helmet) {
    helmet.querySelectorAll('style').forEach((s) => injectStyles(DARK ? s.textContent.replace(/(background(?:-color)?:\s*)(#[0-9a-fA-F]{3,6})\b/g, (m, p, c) => p + (DARK_BG[c.toLowerCase()] || c)) : s.textContent));
    helmet.remove();
  }
  const code = doc.querySelector('script[data-dc-script]').textContent;
  const Logic = new Function('DCLogic', code + '\nreturn Component;')(DCLogic);
  return (registry[name] = { Logic, nodes: Array.from(dc.childNodes) });
}

const comps = {};
function componentFor(name) {
  if (comps[name]) return comps[name];
  const { Logic, nodes } = load(name);
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
      // Screens redraw when the app's data changes (new trip, sync, settings).
      if (window.Motio) this.unsub = window.Motio.subscribe(() => this.forceUpdate());
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
      return out;
    }
  };
  return comps[name];
}

export function mount(name, el, props = {}) {
  render(h(componentFor(name), props), el);
}
