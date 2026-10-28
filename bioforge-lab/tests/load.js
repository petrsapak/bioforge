// Loads the game's scripts, in index.html order, into one Node vm context, like the browser's shared global scope.
//   load(globals, names) runs every script with the extra globals (such as a fake DOM, see tests/dom.js) and returns
//   the context. names: top-level consts and functions to hand back as context.X (a top-level const is not a
//   property of the global object, so it can't be read from the context directly).
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// the script files index.html loads, in order
function scripts() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  return [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(match => match[1]);
}

function load(globals = {}, names = []) {
  const context = vm.createContext({ Math, console, ...globals });
  // Every global lookup in a vm context goes through a slow interceptor. A script-scope binding makes Math run at
  // browser speed.
  vm.runInContext('const Math = globalThis.Math;', context);
  for (const file of scripts()) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { filename: file });
  }
  if (names.length) vm.runInContext(`this.X = { ${names.join(', ')} };`, context);
  return context;
}

module.exports = { load, scripts, ROOT };
