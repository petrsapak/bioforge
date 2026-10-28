'use strict';
// Live mini tank inside the cell tooltip, running the cell's example build from TIPS (browser only).

const DEMO_W = 288, DEMO_H = 190, DEMO_RESET = 8;      // restarts every DEMO_RESET seconds
let demo = null;

function startDemo(t, cv) {
  const ex = TIPS[t].ex, cells = bp(ex.cells);
  if (ex.tpl) for (const b of cells) if (b.t === 'bud') b.tpl = ex.tpl;
  const w = newWorld(DEMO_W, DEMO_H); w.test = true;
  const cr = spawn(w, { cells }, DEMO_W / 2, DEMO_H / 2 + 10, 0, 0);
  for (const c of cr.cells) {
    if (ex.hurt && ex.hurt.includes(c.t)) c.hp = c.max * 0.1;
    if (ex.empty && ex.empty.includes(c.t)) c.f[O] = c.f[S] = 0;
  }
  if (ex.target) {                                     // dummy enemy just in front of the creature
    const front = Math.min(...cr.cells.map(c => c.y));
    spawn(w, { cells: bp([[0, 0, 'tissue'], [1, 0, 'tissue'], [0, 1, 'tissue']]) }, DEMO_W / 2, front - 30, 0, 1).ai = false;
  }
  demo = { t, ex, w, cr, time: 0, cv };
}
const stopDemo = () => { demo = null; };

function runDemo(dt) {
  if (!demo) return;
  const { ex, w, cr } = demo;
  demo.time += dt;
  if (demo.time > DEMO_RESET) { startDemo(demo.t, demo.cv); return; }
  const hold = !!ex.space && demo.time % 2 > 1;        // the demo presses Space every other second
  step(w, dt, { sx: 0, sy: ex.swim ? -1 : 0, ability: hold });
  if (cr.alive) for (const c of w.cells) { c.x += (DEMO_W / 2 - cr.cx) * 0.05; c.y += (DEMO_H / 2 + 10 - cr.cy) * 0.05; }
  const g = demo.cv.getContext('2d');
  drawWater(g, w, DEMO_W, DEMO_H);
  drawWorld(g, w, ex.view || 0);
  g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.setLineDash([3, 3]); g.globalAlpha = 0.55 + 0.45 * Math.sin(demo.time * 5);
  for (const c of cr.cells) if (c.t === demo.t) { g.beginPath(); g.arc(c.x, c.y, c.rad + 3, 0, TAU); g.stroke(); }
  g.setLineDash([]); g.globalAlpha = 1; g.font = '11px system-ui';
  if (ex.space) {
    g.textAlign = 'left'; g.fillStyle = hold ? '#e8c547' : '#6f7b88';
    g.fillText(hold ? `● ${ex.space}` : ex.space === 'Space held' ? '○ Space released' : '○ No enemy', 6, 14);
  }
  if (ex.view) { g.textAlign = 'right'; g.fillStyle = FLUIDS[ex.view - 1].color; g.fillText(`${FLUIDS[ex.view - 1].name} view`, DEMO_W - 6, 14); }
}
