// Snare and Spitter (never exercised by the v3 tests): an eyespot build facing a dummy, sim only
const { load } = require('./load');
const { check, done } = require('./dom');
const { X } = load({}, ['newWorld', 'spawn', 'step', 'bp', 'SNARE_LEN']);
const { newWorld, spawn, step, bp } = X;

function arena(cells, gap) {
  const w = newWorld(2000, 2000);
  const me = spawn(w, { cells: bp(cells) }, 1000, 1000, 0, 0);
  me.ai = false;
  const front = Math.min(...me.cells.map(c => c.y));
  const dummy = spawn(w, { cells: bp([[0, 0, 'nucleus'], [1, 0, 'tissue'], [0, 1, 'tissue'], [-1, 1, 'tissue']]) }, 1000, front - gap, 0, 1);
  dummy.ai = false;
  return { w, me, dummy };
}
const hp = cr => cr.cells.reduce((s, c) => s + c.hp, 0);

{ // Snare: catches the dummy and drags it closer
  const { w, me, dummy } = arena([[0, 0, 'nucleus'], [0, -1, 'eyespot'], [1, -1, 'snare'], [-1, 0, 'gill'], [1, 0, 'fat'], [0, 1, 'pore']], 110);
  const snare = me.cells.find(c => c.t === 'snare');
  const d0 = Math.hypot(dummy.cx - me.cx, dummy.cy - me.cy);
  let caught = false, dmin = d0;
  for (let i = 0; i < 120; i++) {
    step(w, 1 / 60, { sx: 0, sy: 0, ability: false });
    if (snare.line && snare.line.tgt) caught = true;
    if (dummy.alive) dmin = Math.min(dmin, Math.hypot(dummy.cx - me.cx, dummy.cy - me.cy));
  }
  check('snare catches dummy', caught);
  check('snare drags dummy in', dmin < d0 - 40, `start ${d0.toFixed(0)} closest ${dmin.toFixed(0)}`);
  check('no NaN (snare)', w.cells.every(c => isFinite(c.x) && isFinite(c.y)));
}
{ // Spitter: hits the dummy from range
  const { w, me, dummy } = arena([[0, 0, 'nucleus'], [0, -1, 'eyespot'], [1, -1, 'spitter'], [-1, 0, 'gill'], [1, 0, 'fat'], [0, 1, 'pore']], 100);
  const h0 = hp(dummy);
  let globs = 0;
  for (let i = 0; i < 180; i++) { step(w, 1 / 60, { sx: 0, sy: 0, ability: false }); globs = Math.max(globs, w.globs.length); }
  check('spitter fires globs', globs > 0);
  check('globs damage dummy', !dummy.alive || hp(dummy) < h0 - 10, `hp ${h0} -> ${dummy.alive ? hp(dummy).toFixed(0) : 'dead'}`);
  check('own cells unhurt', me.cells.every(c => c.hp >= c.max - 1e-6));
}
done();
