'use strict';
// Simulation: tuning constants, hex helpers, world, physics, cells, fluids, combat. No DOM: runs in the browser and in Node.
// ---------- Tuning ----------
const CR = 10, HX = 2 * CR, HY = CR * Math.sqrt(3), GR = 30;   // cell radius, hex spacing, grid radius
const TAU = Math.PI * 2, SUB = 8;
const K_RAD = 2500, D_RAD = 20, K_ANG = 150000, K_COL = 4000;
const DRAG_ISO = 1.0, DRAG_N = 4;                              // water drag per cell / normal drag on outer membrane
const SWIM_F = 90, CILIA_SWIM = 2.5, TURN_K = 10, TURN_D = 5, SIPHON_F = 600, TURN_RATE = 2.5;
const G_NERVE = 25, LEAK = 0.4, PULSE_HZ = 1.4, SENSE_R = 120;
const THORN_DMG = 5, THORN_SPD = 0.06, THORN_CD = 0.3;
const BITE_DMG = 3, BITE_S = 0.5, BITE_CD = 0.4;
const NETTLE_R = 45, NETTLE_DMG = 4, NETTLE_CD = 0.5;
// Snare: line reach (px), line speed, pull per px of stretch, pull cap, reel-in speed, shortest line, hold time, pause after
const SNARE_LEN = 200, SNARE_V = 700, SNARE_K = 60, SNARE_F = 1500, SNARE_REEL = 150, SNARE_MIN = 3 * CR, SNARE_HOLD = 2.5, SNARE_CD = 1.5;
const SPIT_DMG = 6, SPIT_V = 450, SPIT_R = 280, SPIT_CD = 0.7;   // Spitter: glob damage, speed, range, pause between globs
const DEBRIS_DECAY = 6, DRONE_MIN = 0.05, START_BUDGET = 50, WAVE_BONUS = 15;
// fluids: amounts per cell, flow between touching cells from high to low fill level (amount / capacity)
const O = 0, S = 1, W = 2, R = 3, A = 4;
const FLUIDS = [{ name: 'Oxygen', short: 'O₂', color: '#ff5560' }, { name: 'Energy', short: 'Energy', color: '#ffd23f' },
                { name: 'Waste', short: 'Waste', color: '#a89a3a' }, { name: 'Repair', short: 'Repair', color: '#5ef08a' },
                { name: 'Adrenaline', short: 'Adren.', color: '#e05ad0' }];
const G_FLOW = 0.4, G_HEART = 2.5, G_MAX = 8, HEART_R = 3;    // conductance between touching cells, per beating heart near them, cap; heart reach in cells
const START_FILL = 0.7, GILL_O2 = 0.25, GILL_SPD = 0.002, PORE_RATE = 0.8, TEST_FEED = 0.15;
const POISON = 0.75, POISON_DMG = 6, REPAIR_RATE = 0.5, REPAIR_HP = 40;
const REGROW_RATE = 0.08, REGROW_K = 0.2, REGROW_HP = 0.25;  // Mender regrowth: repair fluid drawn per second, fluid per biomass, start health
const FUEL_K = 0.25;                              // global burn rate: every cell burns fuel * FUEL_K per second (lower = longer trips)
const GROW_FUEL = 0.05, LAUNCH_V = 260, BUD_CD = 1;  // Bud: fuel per biomass grown, launch speed, pause before regrowing
const ADR_GAIN = 8, ADR_K = 0.8, ADR_DECAY = 0.25;
const FOOD_S = 1, FOOD_MAX = 14, FOOD_EVERY = 1.2, FOOD_DROP = 0.35;
const NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];
const key = (q, r) => q + ',' + r;
const hexPx = (q, r) => [HX * (q + r / 2), HY * r];
const clamp01 = v => Math.max(0, Math.min(1, v));
const rotHex = (q, r, n) => { for (let i = 0; i < (n % 6 + 6) % 6; i++) [q, r] = [-r, q + r]; return [q, r]; };   // 60° steps clockwise
const adjHex = (A, B) => Math.abs(A.q - B.q) + Math.abs(A.r - B.r) + Math.abs(A.q + A.r - B.q - B.r) === 2;
const wrap = a => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;

// ---------- World ----------
// links: fluid connections, one per pair of touching cells in a creature (fluids move only along them)
function newWorld(w, h) { return { cells: [], bonds: [], angles: [], links: [], creatures: [], zaps: [], globs: [], sparks: [], food: [], foodT: 0, w, h, t: 0, test: false }; }
const link = (w, a, b) => w.links.push({ a, b, open: true, G: G_FLOW });

function spawn(w, bpo, x, y, a, team) {
  const cr = { team, cells: [], alive: true, ai: team !== 0, auto: false, debris: false, pump: 0,
               want: a, theta: a, sx: 0, sy: 0, ability: false, cx: x, cy: y };
  const map = new Map(), c = Math.cos(a), s = Math.sin(a);
  cr.map = map; cr.plan = bpo.cells;                   // the design, for Menders to regrow lost cells from
  for (const b of bpo.cells) {
    const cell = makeCell(b.t, b.q, b.r, cr);
    if (b.bind) cell.bind = b.bind;
    if (b.t === 'bud' && b.tpl) cell.grow = { plan: budPlan(bpo.cells, b), prog: 0, have: 0, done: false };
    cr.cells.push(cell); w.cells.push(cell); map.set(key(b.q, b.r), cell);
  }
  restFrame(cr);
  for (const cell of cr.cells) {
    const lx = cell.ox - cr.rx, ly = cell.oy - cr.ry;
    cell.x = x + lx * c - ly * s; cell.y = y + lx * s + ly * c;
  }
  // bonds: one per neighbour pair
  for (const cell of cr.cells) for (const [dq, dr] of [[1, 0], [0, 1], [-1, 1]]) {
    const n = map.get(key(cell.q + dq, cell.r + dr));
    if (n) { w.bonds.push({ a: cell, b: n, k: K_RAD * Math.min(cell.d.rad, n.d.rad), ext: false }); link(w, cell, n); }
  }
  // angular springs at each cell for neighbour pairs that are not bonded to each other (keeps chains from folding)
  for (const cell of cr.cells) {
    const nbrs = NB.map(([dq, dr]) => map.get(key(cell.q + dq, cell.r + dr))).filter(Boolean);
    for (let i = 0; i < nbrs.length; i++) for (let j = i + 1; j < nbrs.length; j++) addAngle(w, cell, nbrs[i], nbrs[j]);
  }
  w.creatures.push(cr);
  markExterior(w, cr);
  return cr;
}

function makeCell(t, q, r, cr) {
  const d = CELLS[t], [px, py] = hexPx(q, r);
  return { t, d, q, r, ox: px, oy: py, x: 0, y: 0, vx: 0, vy: 0, fx: 0, fy: 0,
           hp: d.hp, max: d.hp, V: 0, dq: 0, scale: 1, rad: CR, cd: 0, flash: 0, owner: cr, dead: false,
           cap: [d.capO, d.capS, 1, 1, 1], f: [d.capO * START_FILL, d.capS * START_FILL, 0, 0, 0],
           e: 1, boost: 1, ext: false, starve: false, poison: false };
}
// angular spring at cell c between two of its neighbours that are not neighbours of each other (keeps chains from folding)
function addAngle(w, c, A, B) {
  if (adjHex(A, B)) return;
  const ux = A.ox - c.ox, uy = A.oy - c.oy, vx = B.ox - c.ox, vy = B.oy - c.oy;
  w.angles.push({ c, a: A, b: B, phi0: Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy), k: K_ANG * c.d.stiff });
}
// the creature's live cell at (q, r), if any
const cellAt = (cr, q, r) => { const c = cr.map && cr.map.get(key(q, r)); return c && !c.dead && c.owner === cr ? c : null; };

// where a Bud grows its part: where the player placed it (b.off = part anchor relative to the Bud, b.rot = turn), or by
// default turned so the part's front (top in the builder) points away from the body, attached on the Bud's most outward
// free side. Hexes the body already uses are skipped. Cells come in growth order, nearest the Bud first.
function budPlan(cells, b) {
  const occ = new Set(cells.map(c => key(c.q, c.r)));
  const free = NB.filter(([dq, dr]) => !occ.has(key(b.q + dq, b.r + dr)));
  if (!b.tpl || !free.length) return { cells: [], blocked: b.tpl ? b.tpl.cells.length : 0, dir: [0, -1], rot: b.rot || 0 };
  let ux, uy, rot;
  if (b.rot !== undefined) { rot = b.rot; ux = Math.sin(rot * Math.PI / 3); uy = -Math.cos(rot * Math.PI / 3); }   // turned by the player
  else {                                               // default: away from the body's middle
    let mx = 0, my = 0;
    for (const c of cells) { const [x, y] = hexPx(c.q, c.r); mx += x / cells.length; my += y / cells.length; }
    const [bx, by] = hexPx(b.q, b.r);
    ux = bx - mx; uy = by - my;
    const ul = Math.hypot(ux, uy);
    if (ul < 1e-6) { ux = 0; uy = -1; } else { ux /= ul; uy /= ul; }
    rot = Math.round(Math.atan2(ux, -uy) / (Math.PI / 3));
  }
  const turned = b.tpl.cells.map(c => { const [q, r] = rotHex(c.q, c.r, rot); return { q, r, t: c.t }; });
  let oq, orr;
  if (b.off) { oq = b.q + b.off[0]; orr = b.r + b.off[1]; }
  else {
    const out = (q, r) => { const [x, y] = hexPx(q, r); return x * ux + y * uy; };
    const [nq, nr] = free.reduce((a, d) => out(...d) > out(...a) ? d : a);
    const back = turned.reduce((a, c) => out(c.q, c.r) < out(a.q, a.r) ? c : a);
    oq = b.q + nq - back.q; orr = b.r + nr - back.r;
  }
  const has = new Map(turned.map(c => ({ q: c.q + oq, r: c.r + orr, t: c.t })).filter(c => !occ.has(key(c.q, c.r))).map(c => [key(c.q, c.r), c]));
  const seen = new Set([key(b.q, b.r)]), order = [], queue = [[b.q, b.r]];
  while (queue.length) {
    const [q, r] = queue.shift();
    for (const [dq, dr] of NB) {
      const k = key(q + dq, r + dr);
      if (has.has(k) && !seen.has(k)) { seen.add(k); order.push(has.get(k)); queue.push([q + dq, r + dr]); }
    }
  }
  // dir (rest frame): the player's aim (b.aim, radians clockwise from the front) or else where the turned part's front points
  const aim = b.aim !== undefined ? b.aim : rot * Math.PI / 3;
  return { cells: order, blocked: b.tpl.cells.length - order.length, dir: [Math.sin(aim), -Math.cos(aim)], rot, off: [oq - b.q, orr - b.r] };
}

// add one grown cell to a living creature, next to its existing neighbours; it starts small and swells to size
function growCell(w, cr, b, bud) {
  const nb = NB.map(([dq, dr]) => cellAt(cr, b.q + dq, b.r + dr)).filter(Boolean);
  if (!nb.length) return;
  const cell = makeCell(b.t, b.q, b.r, cr), p = nb[0], c = Math.cos(cr.theta), s = Math.sin(cr.theta);
  const lx = cell.ox - p.ox, ly = cell.oy - p.oy;
  cell.x = p.x + lx * c - ly * s; cell.y = p.y + lx * s + ly * c; cell.vx = p.vx; cell.vy = p.vy;
  cell.f = [0, 0, 0, 0, 0]; cell.scale = 0.3; cell.rad = CR * 0.3; cell.piece = bud;
  // the body fills the growing part through every cell it touches (the Bud too); cut when it is fired
  for (const n of nb) { w.bonds.push({ a: cell, b: n, k: K_RAD * Math.min(cell.d.rad, n.d.rad), ext: false }); link(w, cell, n); }
  for (let i = 0; i < nb.length; i++) for (let j = i + 1; j < nb.length; j++) addAngle(w, cell, nb[i], nb[j]);
  for (const n of nb) for (const [dq, dr] of NB) { const m = cellAt(cr, n.q + dq, n.r + dr); if (m) addAngle(w, n, cell, m); }
  cr.cells.push(cell); w.cells.push(cell); cr.map.set(key(b.q, b.r), cell);
  restFrame(cr); markExterior(w, cr);
  return cell;
}

// cut a Bud's finished part loose and shoot it the way its front points, turned with the creature's heading
// (not from where the soft part happens to flop); the whole part gets one velocity so it flies without spinning; the body recoils
function release(w, cr, bud) {
  const piece = new Set(cr.cells.filter(c => c.piece === bud));
  if (!piece.size) return;
  const cut = (a, b) => piece.has(a) !== piece.has(b);
  w.bonds = w.bonds.filter(b => !cut(b.a, b.b));
  w.angles = w.angles.filter(g => !cut(g.c, g.a) && !cut(g.c, g.b));
  w.links = w.links.filter(v => !cut(v.a, v.b));
  cr.cells = cr.cells.filter(c => !piece.has(c));
  const [ax, ay] = bud.grow.plan.dir;
  const shot = { team: cr.team, cells: [...piece], alive: true, debris: true, shot: true, aim: Math.atan2(ax, -ay), pump: 0, want: 0, theta: 0, sx: 0, sy: 0, ability: false, cx: 0, cy: 0 };
  let m = 0, vx = 0, vy = 0, mb = 0;
  for (const c of piece) { c.owner = shot; c.piece = null; m += c.d.mass; vx += c.vx * c.d.mass; vy += c.vy * c.d.mass; }
  for (const c of cr.cells) mb += c.d.mass;
  const [dx, dy] = bud.grow.plan.dir, ct = Math.cos(cr.theta), st = Math.sin(cr.theta);
  const ux = dx * ct - dy * st, uy = dx * st + dy * ct;
  for (const c of piece) { c.vx = vx / m + ux * LAUNCH_V; c.vy = vy / m + uy * LAUNCH_V; }
  for (const c of cr.cells) { c.vx -= ux * LAUNCH_V * m / mb; c.vy -= uy * LAUNCH_V * m / mb; }
  restFrame(shot); markExterior(w, shot); restFrame(cr); markExterior(w, cr);
  w.creatures.push(shot);
  bud.cd = BUD_CD; bud.grow.prog = 0; bud.grow.done = false;
  sparks(w, bud.x, bud.y, bud.d.color, 6);
}

// Buds turn burned fuel into their part one cell at a time; a nerve signal fires the finished part
function buds(w) {
  for (const c of [...w.cells]) {
    if (c.t !== 'bud' || !c.grow || c.owner.debris || c.dead) continue;
    const g = c.grow, cr = c.owner;
    const next = g.plan.cells.find(b => !cellAt(cr, b.q, b.r));
    g.done = !next;
    if (next && g.prog >= GROW_FUEL * CELLS[next.t].cost) { g.prog -= GROW_FUEL * CELLS[next.t].cost; growCell(w, cr, next, c); }
    g.have = g.plan.cells.filter(b => cellAt(cr, b.q, b.r)).length;
    if (g.done && g.have && c.V > 0.5 && c.cd <= 0) release(w, cr, c);
  }
}

// rest-shape centre (mass weighted), used to measure the creature's heading
function restFrame(cr) {
  let m = 0, x = 0, y = 0;
  for (const c of cr.cells) { m += c.d.mass; x += c.ox * c.d.mass; y += c.oy * c.d.mass; }
  cr.rx = x / m; cr.ry = y / m; cr.core = cr.cells.find(c => c.t === 'nucleus');
}

// a bond is on the outer membrane if fewer than two cells close a triangle over it; its cells touch the water
function markExterior(w, cr) {
  const adj = new Map(cr.cells.map(c => [c, new Set()]));
  const mine = w.bonds.filter(b => b.a.owner === cr);
  for (const c of cr.cells) c.ext = cr.cells.length < 3;
  for (const b of mine) { adj.get(b.a).add(b.b); adj.get(b.b).add(b.a); }
  for (const b of mine) {
    let n = 0; for (const x of adj.get(b.a)) if (adj.get(b.b).has(x)) n++;
    b.ext = n < 2;
    if (b.ext) b.a.ext = b.b.ext = true;
  }
}

// ---------- Simulation ----------
function control(w, cr, h) {
  let m = 0, cx = 0, cy = 0;
  for (const c of cr.cells) { m += c.d.mass; cx += c.x * c.d.mass; cy += c.y * c.d.mass; }
  cx /= m; cy /= m; cr.cx = cx; cr.cy = cy;
  if (cr.debris && !cr.shot) return;
  // a released Bud part (drone) does not steer and gets no free swimming: only its own cilia and siphons push it,
  // the way it was fired (cr.aim = launch direction in its rest frame); muscles and bloaters move it through the water
  const drone = cr.debris;
  let sc = 0, dc = 0, L = 0, I = 0;
  for (const c of cr.cells) {
    const r0x = c.ox - cr.rx, r0y = c.oy - cr.ry, rx = c.x - cx, ry = c.y - cy;
    sc += c.d.mass * (r0x * ry - r0y * rx); dc += c.d.mass * (r0x * rx + r0y * ry);
    L += c.d.mass * (rx * c.vy - ry * c.vx); I += c.d.mass * (rx * rx + ry * ry);
  }
  cr.theta = Math.atan2(sc, dc);
  const omega = L / (I || 1);
  const err = wrap(cr.want - cr.theta), head = cr.theta + (cr.aim || 0);
  const fwx = Math.sin(head), fwy = -Math.cos(head);
  if (drone) { cr.sx = fwx; cr.sy = fwy; }
  const turn = drone ? 0 : TURN_K * err - TURN_D * omega;
  for (const c of cr.cells) {
    const rx = c.x - cx, ry = c.y - cy;
    const sw = (drone ? 0 : c.d.swim) + (c.t === 'cilia' ? CILIA_SWIM * c.e * c.boost : 0);
    c.fx += c.d.mass * turn * -ry + SWIM_F * sw * cr.sx;
    c.fy += c.d.mass * turn * rx + SWIM_F * sw * cr.sy;
    if (c.t === 'siphon' && c.V > 0) { const p = SIPHON_F * clamp01(c.V) * c.e * c.boost; c.fx += fwx * p; c.fy += fwy * p; }
  }
}

function forces(w) {
  for (const b of w.bonds) {
    const A = b.a, B = b.b;
    let dx = B.x - A.x, dy = B.y - A.y;
    const d = Math.hypot(dx, dy) || 1e-6; dx /= d; dy /= d;
    const rvx = B.vx - A.vx, rvy = B.vy - A.vy;
    const f = b.k * (d - A.rad - B.rad) + D_RAD * (rvx * dx + rvy * dy);
    A.fx += f * dx; A.fy += f * dy; B.fx -= f * dx; B.fy -= f * dy;
    if (b.ext) {                                     // outer membrane resists sideways motion through water
      const nx = -dy, ny = dx, vn = ((A.vx + B.vx) * nx + (A.vy + B.vy) * ny) * 0.5;
      const fn = -DRAG_N * vn * 0.5;
      A.fx += fn * nx; A.fy += fn * ny; B.fx += fn * nx; B.fy += fn * ny;
    }
  }
  for (const g of w.angles) {
    const c = g.c, A = g.a, B = g.b;
    const ux = A.x - c.x, uy = A.y - c.y, vx = B.x - c.x, vy = B.y - c.y;
    const lu = Math.hypot(ux, uy) || 1e-6, lv = Math.hypot(vx, vy) || 1e-6;
    const err = wrap(Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy) - g.phi0);
    const fa = g.k * err / (lu * lu), fb = g.k * err / (lv * lv);
    const ax = -uy * fa, ay = ux * fa, bx = vy * fb, by = -vx * fb;   // rotate arms to close the error
    A.fx += ax; A.fy += ay; B.fx += bx; B.fy += by; c.fx -= ax + bx; c.fy -= ay + by;
  }
  for (const c of w.cells) { c.fx -= DRAG_ISO * c.vx; c.fy -= DRAG_ISO * c.vy; }
  // a Snare's line pulls its catch in hard; the Snare feels only part of it, so small prey comes to you
  for (const c of w.cells) {
    const t = c.line && c.line.tgt;
    if (!t || t.dead) continue;
    let dx = c.x - t.x, dy = c.y - t.y;
    const d = Math.hypot(dx, dy) || 1e-6; dx /= d; dy /= d;
    const f = Math.min(SNARE_F, SNARE_K * Math.max(0, d - c.line.rest)) * c.e * c.boost;
    t.fx += f * dx; t.fy += f * dy; c.fx -= 0.3 * f * dx; c.fy -= 0.3 * f * dy;
  }
}

function collisions(w, h) {
  const cs = w.creatures;
  for (const cr of cs) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const c of cr.cells) { x0 = Math.min(x0, c.x - c.rad); y0 = Math.min(y0, c.y - c.rad); x1 = Math.max(x1, c.x + c.rad); y1 = Math.max(y1, c.y + c.rad); }
    cr.box = [x0, y0, x1, y1];
  }
  for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
    const P = cs[i], Q = cs[j], p = P.box, q = Q.box;
    if (p[2] < q[0] || q[2] < p[0] || p[3] < q[1] || q[3] < p[1]) continue;
    const hostile = P.team !== Q.team;
    for (const a of P.cells) for (const b of Q.cells) {
      const dx = b.x - a.x, dy = b.y - a.y, rr = a.rad + b.rad;
      if (dx * dx + dy * dy >= rr * rr) continue;
      const d = Math.hypot(dx, dy) || 1e-6, nx = dx / d, ny = dy / d, f = K_COL * (rr - d);
      a.fx -= f * nx; a.fy -= f * ny; b.fx += f * nx; b.fy += f * ny;
      if (hostile) {
        const sp = Math.hypot(b.vx - a.vx, b.vy - a.vy);
        thornHit(w, a, b, sp); thornHit(w, b, a, sp);
        bite(w, a, b); bite(w, b, a);
      }
    }
  }
}

function thornHit(w, s, t, speed) {
  if (s.t !== 'thorn' || s.cd > 0 || s.dead) return;
  s.cd = THORN_CD;
  hurt(t, THORN_DMG + THORN_SPD * speed);
  sparks(w, (s.x + t.x) / 2, (s.y + t.y) / 2, '#ffffff', 4);
}

function bite(w, m, t) {
  if (m.t !== 'mouth' || m.cd > 0 || m.dead || (m.owner.debris && !m.owner.shot)) return;
  m.cd = BITE_CD;
  hurt(t, BITE_DMG);
  m.f[S] = Math.min(m.cap[S], m.f[S] + BITE_S);
  sparks(w, (m.x + t.x) / 2, (m.y + t.y) / 2, FLUIDS[S].color, 3);
}

function hurt(c, dmg) { if (c.dead) return; c.hp -= dmg * c.d.armor; c.flash = 0.12; }

function integrate(w, h) {
  for (const c of w.cells) {
    const m = c.d.mass;
    c.vx += c.fx / m * h; c.vy += c.fy / m * h;
    c.x += c.vx * h; c.y += c.vy * h;
    c.fx = 0; c.fy = 0;
    if (c.x < c.rad) { c.x = c.rad; c.vx = Math.abs(c.vx) * 0.3; }
    if (c.x > w.w - c.rad) { c.x = w.w - c.rad; c.vx = -Math.abs(c.vx) * 0.3; }
    if (c.y < c.rad) { c.y = c.rad; c.vy = Math.abs(c.vy) * 0.3; }
    if (c.y > w.h - c.rad) { c.y = w.h - c.rad; c.vy = -Math.abs(c.vy) * 0.3; }
  }
}

function genOut(w, c) {
  const cr = c.owner;
  if (c.piece) return 0;                              // signal sources in a growing Bud part wait for release
  if (c.d.gen === 'pulse') return Math.sin(TAU * PULSE_HZ * w.t) > 0 ? 1 : 0;
  if (cr.debris && !cr.shot) return 0;
  // Command: a bound one fires on its number key for the player; unbound ones, the AI and the builder use Space / ability
  const held = !!c.bind && !!cr.held && cr.held.has(c.bind);
  if (c.d.gen === 'key') return (c.bind && !cr.ai && !cr.auto && !w.test ? held : cr.ability || held) ? 1 : 0;
  if (w.test) return cr.ability ? 1 : 0;              // builder/demo worlds: Space also fires eyespots
  for (const o of w.creatures) {
    if (o.team === cr.team || o.debris) continue;
    for (const e of o.cells) if ((e.x - c.x) ** 2 + (e.y - c.y) ** 2 < SENSE_R * SENSE_R) return 1;
  }
  return 0;
}

// Signal charge flows between nerve-conducting neighbours; signal sources hold their output.
function nerves(w, dt) {
  for (const c of w.cells) if (c.d.gen) c.out = genOut(w, c);
  const n = 4, h = dt / n;
  for (let k = 0; k < n; k++) {
    for (const c of w.cells) { c.dq = 0; if (c.d.gen) c.V = c.out; }
    for (const b of w.bonds) {                       // a growing Bud part has its own nerves, apart from the body's
      if (!b.a.d.cond || !b.b.d.cond || (b.a.piece || null) !== (b.b.piece || null)) continue;
      const I = G_NERVE * (b.b.V - b.a.V);
      b.a.dq += I; b.b.dq -= I;
    }
    for (const c of w.cells) if (c.d.cond && !c.d.gen) c.V += (c.dq / (c.d.cap || 1) - LEAK * c.V) * h;
  }
}

// how hard a fuel-burning cell is working this frame (0..1)
function activity(c) {
  const V = clamp01(c.V), cr = c.owner;
  if (c.piece) return 0;                              // a Bud's part sleeps until it is released
  switch (c.t) {
    case 'muscle': case 'bloater': case 'siphon': return V;
    case 'nettle': case 'adrenal': case 'spitter': return V > 0.5 ? 1 : 0;
    case 'snare': return c.line || V > 0.5 ? 1 : 0;
    case 'cilia': return cr.sx || cr.sy ? 1 : 0;
    case 'heart': return 1;
    case 'mender': return c.f[R] < 0.9 * c.cap[R] ? 1 : 0;
    case 'bud': return c.grow && !c.grow.done && c.cd <= 0 ? 1 : 0;
  }
  return 0;
}

// burn equal parts O2 and energy from the cell's own store; c.e = fraction of the demand it got
function burn(c, need) {
  const f = c.f;
  if (need <= 0) { c.e = f[O] > 0.01 && f[S] > 0.01 ? 1 : 0; return 0; }
  const take = Math.min(need, f[O], f[S]);
  f[O] -= take; f[S] -= take; f[W] = Math.min(2 * c.cap[W], f[W] + take);
  c.e = take / need;
  return take;
}

// released Bud parts run on what they carry: they stay alive until their O2 or energy is used up, then rot
function metabolism(w, dt) {
  for (const c of w.cells) {
    const f = c.f, cap = c.cap;
    c.boost = 1 + ADR_K * clamp01(f[A] / cap[A]);
    f[A] *= 1 - ADR_DECAY * dt;
    c.poison = c.d.fuel > 0 && f[W] > POISON * cap[W];   // only working cells care about waste
    if (c.poison) c.hp -= POISON_DMG * dt;
    if (f[R] > 0 && c.hp < c.max) { const u = Math.min(f[R], REPAIR_RATE * dt); f[R] -= u; c.hp = Math.min(c.max, c.hp + u * REPAIR_HP); }
    if (c.owner.debris && !c.owner.shot) continue;
    if (c.d.fuel) {
      const act = activity(c), got = burn(c, c.d.fuel * FUEL_K * act * dt);
      c.starve = act > 0 && c.e < 0.4;
      if (c.t === 'mender') f[R] += got / FUEL_K;              // glands make as much as before from less fuel
      if (c.t === 'adrenal') f[A] += got * ADR_GAIN / FUEL_K;
      if (c.t === 'bud' && c.grow) c.grow.prog += got;
    }
    if (c.t === 'gill') f[O] = Math.min(cap[O], f[O] + (GILL_O2 + GILL_SPD * Math.hypot(c.vx, c.vy)) * dt);
    if (c.t === 'pore' && c.ext) f[W] = Math.max(0, f[W] - PORE_RATE * dt);
    if (c.t === 'mouth' && w.test) f[S] = Math.min(cap[S], f[S] + TEST_FEED * dt);
  }
  // fed = it has a working cell and still carries O2 and energy somewhere (Fat, Air sacs, pipes, the cells themselves)
  for (const cr of w.creatures) if (cr.shot) {
    const has = i => cr.cells.reduce((s, c) => s + c.f[i], 0) > DRONE_MIN;
    cr.fed = cr.cells.some(c => c.d.fuel) && has(O) && has(S);
  }
}

// Fluids move between touching cells from the fuller one to the emptier one (by fill level).
// A fed Heart speeds up every link with a cell within HEART_R cells of it; Valves without a signal let nothing through.
const hexDist = (a, b) => (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;
function flow(w, dt) {
  for (const c of w.cells) c.pump = 0;
  for (const h of w.cells) if (h.t === 'heart' && h.e > 0)
    for (const c of h.owner.cells) if (hexDist(c, h) <= HEART_R) c.pump += h.e;
  for (const v of w.links) {
    v.open = (v.a.t !== 'valve' || v.a.V > 0.5) && (v.b.t !== 'valve' || v.b.V > 0.5);
    v.G = Math.min(G_MAX, G_FLOW + G_HEART * Math.max(v.a.pump, v.b.pump));
  }
  const n = 8, h = dt / n;                          // pipes hold little, so take small steps
  for (let k = 0; k < n; k++) for (const v of w.links) {
    if (!v.open) continue;
    const a = v.a, b = v.b;
    for (let i = 0; i < 5; i++) {
      let fl = v.G * (a.f[i] / a.cap[i] - b.f[i] / b.cap[i]) * h;
      fl = Math.max(-b.f[i], Math.min(a.f[i], fl));
      a.f[i] -= fl; b.f[i] += fl;
    }
  }
}

function effectors(w, dt) {
  for (const c of w.cells) {
    c.cd -= dt; c.flash = Math.max(0, c.flash - dt);
    const V = clamp01(c.V), p = c.e * c.boost;
    let target = 1;
    if (c.t === 'muscle') target = Math.max(0.35, 1 - 0.55 * V * p);
    else if (c.t === 'bloater') target = Math.min(2, 1 + 0.8 * V * p);
    const fast = c.t === 'bloater' ? target > c.scale : target < c.scale;   // snap on, slow recovery
    c.scale += (target - c.scale) * Math.min(1, dt * (fast ? 16 : 4));
    c.rad = CR * c.scale;
    if (c.t === 'nettle' && c.V > 0.5 && c.e > 0.3 && c.cd <= 0 && (!c.owner.debris || c.owner.shot)) {
      let hit = false;
      for (const o of w.creatures) {
        if (o.team === c.owner.team) continue;
        for (const e of o.cells) {
          if ((e.x - c.x) ** 2 + (e.y - c.y) ** 2 > NETTLE_R * NETTLE_R) continue;
          hurt(e, NETTLE_DMG * p); hit = true;
          w.zaps.push({ x0: c.x, y0: c.y, x1: e.x, y1: e.y, life: 0.15 });
        }
      }
      if (hit) c.cd = NETTLE_CD;
    }
    const armed = c.V > 0.5 && c.e > 0.3 && c.cd <= 0 && (!c.owner.debris || c.owner.shot);
    if (c.t === 'snare') {
      if (c.line) snareLine(w, c, dt);
      else if (armed) { const [dx, dy] = aimAt(w, c, SNARE_LEN); c.line = { x: c.x, y: c.y, vx: dx * SNARE_V, vy: dy * SNARE_V, tgt: null, rest: 0, t: 0 }; }
    }
    if (c.t === 'spitter' && armed) {
      const [dx, dy] = aimAt(w, c, SPIT_R);
      w.globs.push({ x: c.x + dx * c.rad, y: c.y + dy * c.rad, vx: c.vx + dx * SPIT_V, vy: c.vy + dy * SPIT_V, team: c.owner.team, life: SPIT_R / SPIT_V, dmg: SPIT_DMG * p });
      c.vx -= dx * 40; c.vy -= dy * 40; c.cd = SPIT_CD;
    }
    if (c.owner.debris && !c.owner.fed) c.hp -= DEBRIS_DECAY * dt;   // released parts rot once their fuel is gone
  }
}

// unit vector from cell c to the nearest enemy cell within range, or straight out from its body if there is none
function aimAt(w, c, range) {
  let best = null, bd = range * range;
  for (const o of w.creatures) {
    if (o.team === c.owner.team || (o.debris && !o.shot)) continue;
    for (const e of o.cells) { const d = (e.x - c.x) ** 2 + (e.y - c.y) ** 2; if (d < bd) { bd = d; best = e; } }
  }
  const dx = best ? best.x - c.x : c.x - c.owner.cx, dy = best ? best.y - c.y : c.y - c.owner.cy, l = Math.hypot(dx, dy) || 1;
  return [dx / l, dy / l];
}

// a Snare's line flies out until it sticks to an enemy cell or runs out of reach; a caught cell is reeled in
// (the pull itself is in forces) until the hold time is up, the line is stretched to twice its reach or either end dies
function snareLine(w, c, dt) {
  const L = c.line;
  if (!L.tgt) {
    L.x += L.vx * dt; L.y += L.vy * dt;
    for (const o of w.creatures) if (o.team !== c.owner.team)
      for (const e of o.cells) if ((e.x - L.x) ** 2 + (e.y - L.y) ** 2 < (e.rad + 4) ** 2) {
        L.tgt = e; L.t = SNARE_HOLD; L.rest = Math.hypot(e.x - c.x, e.y - c.y);
        hurt(e, 2); sparks(w, e.x, e.y, c.d.color, 4); return;
      }
    if (Math.hypot(L.x - c.x, L.y - c.y) > SNARE_LEN) { c.line = null; c.cd = SNARE_CD / 2; }
    return;
  }
  L.t -= dt; L.rest = Math.max(SNARE_MIN, L.rest - SNARE_REEL * dt);
  if (L.t <= 0 || L.tgt.dead || Math.hypot(L.tgt.x - c.x, L.tgt.y - c.y) > 2 * SNARE_LEN) { c.line = null; c.cd = SNARE_CD; }
}

// Spitter globs fly straight and burst on the first cell of another team they touch
function globs(w, dt) {
  w.globs = w.globs.filter(g => {
    g.x += g.vx * dt; g.y += g.vy * dt; g.life -= dt;
    for (const o of w.creatures) {
      const b = o.box;
      if (o.team === g.team || !b || g.x < b[0] - 4 || g.x > b[2] + 4 || g.y < b[1] - 4 || g.y > b[3] + 4) continue;
      for (const e of o.cells) if ((e.x - g.x) ** 2 + (e.y - g.y) ** 2 < (e.rad + 4) ** 2) {
        hurt(e, g.dmg); sparks(w, g.x, g.y, CELLS.spitter.color, 5); return false;
      }
    }
    return g.life > 0;
  });
}

// food specks drift in the battle arena; a creature with a Mouth eats the specks that touch any of its cells (into a Mouth with room)
function food(w, dt) {
  if (!w.test) {
    w.foodT -= dt;
    if (w.foodT <= 0 && w.food.length < FOOD_MAX) {
      w.foodT = FOOD_EVERY;
      w.food.push({ x: 30 + Math.random() * (w.w - 60), y: 30 + Math.random() * (w.h - 60) });
    }
  }
  for (const p of w.food) { p.x += Math.sin(w.t * 0.7 + p.y * 0.01) * 4 * dt; p.y += Math.cos(w.t * 0.5 + p.x * 0.01) * 4 * dt; }
  for (const cr of w.creatures) {
    if (cr.debris && !cr.shot) continue;
    const mouths = cr.cells.filter(c => c.t === 'mouth');
    if (!mouths.length) continue;
    w.food = w.food.filter(p => {
      const m = mouths.find(c => c.f[S] <= c.cap[S] - FOOD_S / 2);
      if (!m || !cr.cells.some(c => (p.x - c.x) ** 2 + (p.y - c.y) ** 2 <= (c.rad + 5) ** 2)) return true;
      m.f[S] = Math.min(m.cap[S], m.f[S] + FOOD_S);
      return false;
    });
  }
}

// Remove dead cells; split creatures into connected pieces. Pieces without the nucleus become debris.
function cleanup(w) {
  if (!w.cells.some(c => c.hp <= 0)) return;
  const touched = new Set();
  for (const c of w.cells) if (c.hp <= 0) {
    c.dead = true; touched.add(c.owner); sparks(w, c.x, c.y, c.d.color, 10);
    if (!w.test && Math.random() < FOOD_DROP) w.food.push({ x: c.x, y: c.y });
  }
  w.cells = w.cells.filter(c => !c.dead);
  w.bonds = w.bonds.filter(b => !b.a.dead && !b.b.dead);
  w.angles = w.angles.filter(g => !g.c.dead && !g.a.dead && !g.b.dead);
  w.links = w.links.filter(v => !v.a.dead && !v.b.dead);
  for (const cr of touched) {
    const alive = cr.cells.filter(c => !c.dead);
    const adj = new Map(alive.map(c => [c, []]));
    for (const b of w.bonds) if (b.a.owner === cr) { adj.get(b.a).push(b.b); adj.get(b.b).push(b.a); }
    const seen = new Set(), parts = [];
    const coreAlive = cr.core && !cr.core.dead;
    const roots = coreAlive ? [cr.core, ...alive] : alive;
    for (const root of roots) {
      if (seen.has(root)) continue;
      const part = [root]; seen.add(root);
      for (let i = 0; i < part.length; i++) for (const n of adj.get(part[i])) if (!seen.has(n)) { seen.add(n); part.push(n); }
      parts.push(part);
    }
    const keep = coreAlive && !cr.debris ? parts.shift() : null;
    cr.cells = keep || [];
    if (!keep) cr.alive = false;
    for (const part of parts) {
      const d = { team: cr.debris ? cr.team : -1, shot: !!cr.shot, aim: cr.aim, cells: part, alive: true, debris: true, pump: 0, want: 0, theta: 0, sx: 0, sy: 0, ability: false, cx: 0, cy: 0 };
      for (const c of part) c.owner = d;
      restFrame(d); markExterior(w, d);
      w.creatures.push(d);
    }
    if (keep) { restFrame(cr); markExterior(w, cr); }
  }
  w.creatures = w.creatures.filter(c => c.alive && c.cells.length);
}

// Menders regrow lost cells of the design: they pool repair fluid and rebuild the missing cell nearest a Mender that
// touches the body, one at a time; it swells to size from a quarter health and repair fluid heals the rest
function regrow(w, dt) {
  for (const cr of w.creatures) {
    if (cr.debris || !cr.plan) continue;
    const menders = cr.cells.filter(c => c.t === 'mender' && !c.piece);
    const body = (q, r) => { const n = cellAt(cr, q, r); return n && !n.piece; };
    const miss = cr.plan.filter(b => !cellAt(cr, b.q, b.r) && NB.some(([dq, dr]) => body(b.q + dq, b.r + dr)));
    if (!menders.length || !miss.length) { cr.regrow = 0; continue; }
    for (const m of menders) { const u = Math.min(m.f[R], REGROW_RATE * dt); m.f[R] -= u; cr.regrow = (cr.regrow || 0) + u; }
    const near = b => Math.min(...menders.map(m => hexDist(m, b)));
    const b = miss.reduce((a, x) => near(x) < near(a) ? x : a), need = REGROW_K * CELLS[b.t].cost;
    if (cr.regrow < need) continue;
    const cell = growCell(w, cr, b, null);
    if (!cell) continue;
    cr.regrow -= need; cell.hp = cell.max * REGROW_HP;
    if (b.bind) cell.bind = b.bind;
    if (b.t === 'bud' && b.tpl) cell.grow = { plan: budPlan(cr.plan, b), prog: 0, have: 0, done: false };
    sparks(w, cell.x, cell.y, CELLS.mender.color, 6);
  }
}

function sparks(w, x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, sp = 40 + Math.random() * 140;
    w.sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.3 + Math.random() * 0.4, color });
  }
}

function aiControl(w, cr) {
  let tgt = null, td = Infinity;
  for (const o of w.creatures) {
    if (o.team === cr.team || o.debris) continue;
    const d = Math.hypot(o.cx - cr.cx, o.cy - cr.cy);
    if (d < td) { td = d; tgt = o; }
  }
  if (!tgt) { cr.sx = cr.sy = 0; cr.ability = false; return; }
  const dx = (tgt.cx - cr.cx) / td, dy = (tgt.cy - cr.cy) / td;
  cr.sx = dx; cr.sy = dy; cr.want = Math.atan2(dx, -dy);
  cr.ability = td < 170;
}

function step(w, dt, input) {
  for (const cr of w.creatures) {
    if (cr.debris) continue;
    if (cr.team !== 0 && w.idle) { cr.sx = cr.sy = 0; cr.ability = false; }   // sandbox: enemies hold still
    else if (cr.ai || cr.auto) aiControl(w, cr);
    else if (input && 'fwd' in input) {
      // car-style: turn rotates the heading, fwd swims along it (negative = reverse without turning)
      cr.ability = input.ability; cr.held = input.held;
      cr.want = cr.theta + Math.max(-1, Math.min(1, wrap(cr.want + input.turn * TURN_RATE * dt - cr.theta)));
      cr.sx = Math.sin(cr.want) * input.fwd; cr.sy = -Math.cos(cr.want) * input.fwd;
    } else if (input) {
      cr.sx = input.sx; cr.sy = input.sy; cr.ability = input.ability; cr.held = input.held;
      if (input.sx || input.sy) cr.want = Math.atan2(input.sx, -input.sy);
    }
  }
  const h = dt / SUB;
  for (let i = 0; i < SUB; i++) {
    for (const cr of w.creatures) control(w, cr, h);
    forces(w);
    collisions(w, h);
    integrate(w, h);
  }
  w.t += dt;
  nerves(w, dt);
  metabolism(w, dt);
  flow(w, dt);
  effectors(w, dt);
  globs(w, dt);
  buds(w);
  regrow(w, dt);
  food(w, dt);
  cleanup(w);
  for (const p of w.sparks) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; p.vx *= 0.9; p.vy *= 0.9; }
  w.sparks = w.sparks.filter(p => p.life > 0);
  for (const z of w.zaps) z.life -= dt;
  w.zaps = w.zaps.filter(z => z.life > 0);
}

// ---------- Waves ----------
function waveBlueprints(n) {
  const T = TEMPLATES;
  const hand = { 1: [T.wiggler], 2: [T.nettler], 3: [T.puffer], 4: [T.wiggler, T.nettler], 5: [T.squirter, T.puffer] };
  if (hand[n]) return hand[n];
  const pool = [T.wiggler, T.squirter, T.nettler, T.puffer];
  return Array.from({ length: Math.min(6, n - 3) }, (_, i) => pool[(n + i) % pool.length]);
}
