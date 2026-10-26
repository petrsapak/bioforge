// Loads the game's scripts (in index.html order) into one vm context, like the browser's shared global scope.
// load()          -> sim only (no DOM): returns the context; pull names out with ctx.X after expose(...)
// load({ dom })   -> full app with a fake DOM (see tests/dom.js)
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..');

function scripts() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  return [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
}

// names: top-level consts/functions to hand back (top-level const is not a property of the global object)
function load(globals = {}, names = []) {
  const ctx = vm.createContext({ Math, console, ...globals });
  // every global lookup in a vm context goes through a slow interceptor; a script-scope binding makes Math.* run at
  // browser speed (frame-time tests depend on it)
  vm.runInContext('const Math = globalThis.Math;', ctx);
  for (const s of scripts()) vm.runInContext(fs.readFileSync(path.join(ROOT, s), 'utf8'), ctx, { filename: s });
  if (names.length) vm.runInContext(`this.X = { ${names.join(', ')} };`, ctx);
  return ctx;
}

module.exports = { load, scripts, ROOT };
