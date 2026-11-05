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
    props[name] = value;
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
    helmet.querySelectorAll('style').forEach((s) => injectStyles(s.textContent));
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
      if (this.logic.componentDidMount) this.logic.componentDidMount();
    }
    componentWillUnmount() {
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
