// Fake browser for headless UI tests: elements by id, event listeners, a canvas context that swallows every call,
// and a requestAnimationFrame queue stepped by run(n) at 16 ms per frame.
const { load } = require('./load');

function app(tplNames) {
  const ctx2d = new Proxy({}, { get: (t, k) => k in t ? t[k] : (() => {}), set: (t, k, v) => (t[k] = v, true) });
  const els = {}, L = {};
  const on = (id, ev, f) => (L[id + ev] = L[id + ev] || []).push(f), fire = (id, ev, e) => (L[id + ev] || []).forEach(f => f(e));
  const mkEl = id => ({ id, style: {}, innerHTML: '', textContent: '', dataset: {},
    classList: { _s: new Set(), toggle(c, f) { (f === undefined ? !this._s.has(c) : f) ? this._s.add(c) : this._s.delete(c); }, contains(c) { return this._s.has(c); } },
    appendChild() {}, addEventListener(ev, f) { on(id, ev, f); }, getContext: () => ctx2d, width: 0, height: 0, onclick: null });
  const tpl = tplNames.map(v => { const e = mkEl('tpl'); e.dataset.tpl = v; e.textContent = v[0].toUpperCase() + v.slice(1); return e; });
  const document = { getElementById: id => els[id] || (els[id] = mkEl(id)), createElement: () => mkEl('x'),
    querySelectorAll: s => s === '[data-tpl]' ? tpl : [] };
  const raf = [];
  load({ document, window: {}, innerWidth: 1600, innerHeight: 900, performance: { now: () => Date.now() },
    requestAnimationFrame: f => raf.push(f), addEventListener: (ev, f) => on('win', ev, f) });
  let t = Date.now();
  const run = n => { for (let i = 0; i < n; i++) { const f = raf.shift(); t += 16; f(t); } };
  const $ = id => document.getElementById(id);
  return { els, $, fire, run, tpl, document };
}

let ok = true;
const check = (n, c, i = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + ' ' + i); if (!c) ok = false; };
const done = () => { console.log(ok ? 'ALL PASS' : 'SOME FAIL'); process.exitCode = ok ? 0 : 1; };

module.exports = { app, check, done };
