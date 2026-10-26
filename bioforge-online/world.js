'use strict';
// Open world: map (rocks, currents), spawners, sleeping far-away enemies, enemy AI. No DOM: runs in the browser and in Node.
// ---------- Tuning ----------
const MAP_G = 256;                                    // obstacle grid bucket size (px)
const REGION_G = 200;                                 // region grid cell size (px), only for drawing the map
const WAKE_R = 1800, SLEEP_R = 2200;                  // enemies within WAKE_R of a player are simulated; past SLEEP_R they sleep
const TICK = 0.25;                                    // seconds between sleep/respawn/food checks
const SPAWN_R = 250, RESPAWN_T = 25, SPAWN_HIDE = 1200;   // spawner radius, respawn delay, no respawn this close to a player
const LEASH_R = 900, DROP_K = 2.5, FLEE_T = 4, WANDER = 0.35, BITE_R = 170;   // leash from home, give up at aggro * DROP_K
const AVOID_M = 100;                                  // enemies steer around rocks closer than this
const FOOD_NEAR = 20, FOOD_R0 = 300, FOOD_R1 = 1200;  // food kept around each player

// seeded random numbers (mulberry32), so a biome's layout is the same everywhere
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = a + 0x6D2B79F5 >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const between = (rand, [a, b]) => a + (b - a) * rand();

// ---------- Map ----------
function makeMap(def) {
  const rand = rng(def.seed), [sx, sy] = def.start, M = 150;
  const map = { w: def.w, h: def.h, rocks: [], currents: [], spawners: [], start: def.start, safeR: def.safeR,
                regions: def.regions || [], landmarks: [],
                cols: Math.ceil(def.w / MAP_G), rows: Math.ceil(def.h / MAP_G), grid: [] };
  const clearOfStart = (x, y, r) => Math.hypot(x - sx, y - sy) > def.safeR + r;
  const clearOfMarks = (x, y, r) => map.landmarks.every(l => Math.hypot(x - l.x, y - l.y) > l.r + r + 150);
  const addRock = (x, y, r) => { if (x > M && y > M && x < def.w - M && y < def.h - M && clearOfStart(x, y, r) && clearOfMarks(x, y, r)) map.rocks.push({ x, y, r }); };
  for (const l of def.landmarks || []) {             // a ring of big rocks with openings; the first gap faces the start
    const [x, y] = l.at, a0 = Math.atan2(sy - y, sx - x), gapW = 500 / l.r;
    const mark = { name: l.name, kind: l.kind, x, y, r: l.r, desc: l.desc || '', gates: [] };
    for (let a = 0; a < TAU; a += 110 / l.r) {
      const off = Math.abs(((a + TAU / l.gaps / 2) % (TAU / l.gaps)) - TAU / l.gaps / 2);    // angle to the nearest gap
      const rx = x + Math.cos(a0 + a) * l.r, ry = y + Math.sin(a0 + a) * l.r;
      if (off >= gapW / 2) map.rocks.push({ x: rx, y: ry, r: 95 + rand() * 25, ring: true });
      else if (l.kind === 'lair') { const g = { x: rx, y: ry, r: 70, gate: true }; map.rocks.push(g); mark.gates.push(g); }   // sealed
    }
    map.landmarks.push(mark);
  }
  for (let i = 0; i < def.rocks.n; i++) {
    const u = rand();
    addRock(between(rand, [0, def.w]), between(rand, [0, def.h]), def.rocks.r[0] + (def.rocks.r[1] - def.rocks.r[0]) * u * u);
  }
  for (let i = 0; i < def.ridges.n; i++) {           // a wall: a wandering chain of rocks
    let x = between(rand, [0, def.w]), y = between(rand, [0, def.h]), a = rand() * TAU;
    for (let j = 0, n = Math.round(between(rand, def.ridges.len)); j < n; j++) {
      const r = between(rand, def.ridges.r);
      addRock(x, y, r);
      a += (rand() - 0.5) * 0.8; x += Math.cos(a) * r * 1.3; y += Math.sin(a) * r * 1.3;
    }
  }
  for (const k of map.rocks.keys()) {                 // bucket every rock into the grid cells its box covers
    const o = map.rocks[k];
    for (let gx = Math.max(0, (o.x - o.r) / MAP_G | 0); gx <= Math.min(map.cols - 1, (o.x + o.r) / MAP_G | 0); gx++)
      for (let gy = Math.max(0, (o.y - o.r) / MAP_G | 0); gy <= Math.min(map.rows - 1, (o.y + o.r) / MAP_G | 0); gy++)
        (map.grid[gx + gy * map.cols] = map.grid[gx + gy * map.cols] || []).push(o);
  }
  for (let i = 0; i < def.currents.n; i++) {
    const a = rand() * TAU, v = between(rand, def.currents.v);
    map.currents.push({ x: between(rand, [0, def.w]), y: between(rand, [0, def.h]), r: between(rand, def.currents.r), vx: Math.cos(a) * v, vy: Math.sin(a) * v });
  }
  for (const o of map.rocks) o.k = regionAt(map, o.x, o.y);
  map.rcols = Math.ceil(def.w / REGION_G); map.rrows = Math.ceil(def.h / REGION_G);   // coarse region grid, for the map view
  map.rgrid = [];
  for (let j = 0; j < map.rrows; j++) for (let i = 0; i < map.rcols; i++) map.rgrid.push(regionAt(map, (i + 0.5) * REGION_G, (j + 0.5) * REGION_G));
  for (const z of def.zones) for (let i = 0; i < z.spawners; i++) {
    const cave = z.cave && map.landmarks.find(l => l.name === z.cave), reg = z.region && map.regions.findIndex(r => r.name === z.region);
    if (cave) { map.spawners.push({ x: cave.x, y: cave.y, r: Math.min(SPAWN_R, cave.r * 0.5), tpl: z.tpl, size: z.size, aggro: z.aggro, flee: z.flee, lvl: z.lvl || 1, mobs: [], wait: [] }); continue; }
    for (let tries = 0; tries < 200; tries++) {
      let x, y;
      if (z.region) { const [rx, ry] = map.regions[reg].at, a = rand() * TAU, d = 3500 * Math.sqrt(rand()); x = rx + Math.cos(a) * d; y = ry + Math.sin(a) * d; }
      else { const a = rand() * TAU, d = between(rand, z.ring); x = sx + Math.cos(a) * d; y = sy + Math.sin(a) * d; }
      x = Math.max(M + SPAWN_R, Math.min(def.w - M - SPAWN_R, x)); y = Math.max(M + SPAWN_R, Math.min(def.h - M - SPAWN_R, y));
      if (z.region && regionAt(map, x, y) !== reg) continue;
      if (!clearOfStart(x, y, SPAWN_R) || !clearOfMarks(x, y, SPAWN_R)) continue;
      if (blocked(map, x, y, SPAWN_R * 0.5) || map.spawners.some(s => Math.hypot(s.x - x, s.y - y) < 600)) continue;
      map.spawners.push({ x, y, r: SPAWN_R, tpl: z.tpl, size: z.size, aggro: z.aggro, flee: z.flee, lvl: z.lvl || 1, mobs: [], wait: [] });
      break;
    }
  }
  return map;
}

// named places: the region whose centre is nearest (index into map.regions, -1 if the biome has none); the landmark
// whose ring (x, y) is inside
function regionAt(map, x, y) {
  let k = -1, best = Infinity;
  map.regions.forEach((r, i) => { const d = (r.at[0] - x) ** 2 + (r.at[1] - y) ** 2; if (d < best) { best = d; k = i; } });
  return k;
}
const landmarkAt = (map, x, y) => map.landmarks.find(l => (l.x - x) ** 2 + (l.y - y) ** 2 < l.r * l.r) || null;
// what the HUD calls (x, y): { name, sub } of the landmark you are in, else the region
function placeAt(map, x, y) {
  const l = landmarkAt(map, x, y), r = map.regions[regionAt(map, x, y)];
  if (l) return { name: l.name, sub: l.desc || (r ? r.name : ''), region: r, landmark: l };
  if (Math.hypot(x - map.start[0], y - map.start[1]) < map.safeR) return { name: 'Haven', sub: 'Where you start. Hub comes later', region: r, landmark: null };
  return r ? { name: r.name, sub: r.desc, region: r, landmark: null } : { name: '', sub: '', region: null, landmark: null };
}

// rocks near (x, y): the grid bucket's list
const rocksAt = (map, x, y) => map.grid[Math.max(0, Math.min(map.cols - 1, x / MAP_G | 0)) + Math.max(0, Math.min(map.rows - 1, y / MAP_G | 0)) * map.cols] || [];
const blocked = (map, x, y, m) => rocksAt(map, x, y).some(o => (o.x - x) ** 2 + (o.y - y) ** 2 < (o.r + m) ** 2);

// called by the sim for every cell each substep: push it out of rocks, keep only a little of the speed into the rock
function rockHit(map, c) {
  for (const o of rocksAt(map, c.x, c.y)) {
    const dx = c.x - o.x, dy = c.y - o.y, rr = o.r + c.rad, d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr) continue;
    const d = Math.sqrt(d2) || 1e-6, nx = dx / d, ny = dy / d, vn = c.vx * nx + c.vy * ny;
    c.x = o.x + nx * rr; c.y = o.y + ny * rr;
    if (vn < 0) { c.vx -= 1.3 * vn * nx; c.vy -= 1.3 * vn * ny; }
  }
}
// moving water: drag pulls cells toward the current's speed, strongest at its middle
function currents(map, c) {
  for (const u of map.currents) {
    const dx = c.x - u.x, dy = c.y - u.y;
    if (dx * dx + dy * dy >= u.r * u.r) continue;
    const k = DRAG_ISO * (1 - Math.hypot(dx, dy) / u.r);
    c.fx += u.vx * k; c.fy += u.vy * k;
  }
}

// ---------- World ----------
function makeWorld(def) {
  const map = makeMap(def), w = newWorld(def.w, def.h);
  w.map = map; w.name = def.name; w.start = def.start; w.mobs = []; w.tick = 0;
  w.kills = [];                                       // enemies killed since the game last read this: { lvl, tpl, x, y }
  for (const sp of map.spawners) for (let i = 0; i < sp.size; i++) sleep(w, spawnMob(w, sp));
  return w;
}

// a random spot within r of (x, y) with no rock closer than m (rocks of every grid bucket the margin reaches);
// the search widens if the area is crowded
function freeSpot(map, x, y, r, m = 60) {
  const clear = (px, py) => [-m, 0, m].every(ox => [-m, 0, m].every(oy => !blocked(map, px + ox, py + oy, m)));
  for (let i = 0; i < 80; i++) {
    const a = Math.random() * TAU, d = r * (1 + i / 20) * Math.sqrt(Math.random()), px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
    if (clear(px, py)) return [px, py];
  }
  return [x, y];
}

function spawnMob(w, sp) {
  const cells = TEMPLATES[sp.tpl].cells, m = cells.reduce((s, b) => s + CELLS[b.t].mass, 0);   // reach from the mass centre,
  const mx = cells.reduce((s, b) => s + hexPx(b.q, b.r)[0] * CELLS[b.t].mass, 0) / m;            // which is where spawn() puts it
  const my = cells.reduce((s, b) => s + hexPx(b.q, b.r)[1] * CELLS[b.t].mass, 0) / m;
  const body = cells.reduce((s, b) => { const [x, y] = hexPx(b.q, b.r); return Math.max(s, Math.hypot(x - mx, y - my)); }, 0) + 2 * CR;
  const [x, y] = freeSpot(w.map, sp.x, sp.y, sp.r, body);
  const cr = spawn(w, TEMPLATES[sp.tpl], x, y, Math.random() * TAU, 1);
  cr.hp0 = cr.cells.reduce((s, c) => s + c.max, 0);
  cr.mob = { sp, state: 'idle', t: 0, tgt: null, hp: cr.hp0, goal: null, goalT: 0 };
  sp.mobs.push(cr); w.mobs.push(cr);
  return cr;
}

// a sleeping creature is taken out of the sim with its springs and fluid links, unchanged, and put back when a player
// comes near. One that was away from home (chasing, fleeing, leashing) is sent home healed.
function sleep(w, cr) {
  const mine = c => c.owner === cr;
  for (const c of w.cells) if (c.line && c.line.tgt && mine(c.line.tgt)) c.line = null;
  for (const c of cr.cells) c.line = null;
  cr.frozen = { bonds: w.bonds.filter(b => mine(b.a)), angles: w.angles.filter(g => mine(g.c)), links: w.links.filter(v => mine(v.a)) };
  removeCreature(w, cr);
  const m = cr.mob;
  if (m && m.state !== 'idle') { goHome(cr); m.state = 'idle'; m.tgt = null; }
}
function wake(w, cr) {
  for (const c of cr.cells) { c.vx = c.vy = c.fx = c.fy = 0; w.cells.push(c); }
  w.bonds.push(...cr.frozen.bonds); w.angles.push(...cr.frozen.angles); w.links.push(...cr.frozen.links);
  w.creatures.push(cr); cr.frozen = null;
}
function goHome(cr) {
  const sp = cr.mob.sp, dx = sp.x - cr.cx, dy = sp.y - cr.cy;
  for (const c of cr.cells) { c.x += dx; c.y += dy; c.hp = c.max; }
  cr.cx += dx; cr.cy += dy; cr.mob.hp = cr.cells.reduce((s, c) => s + c.hp, 0);
}

// call before step(): players = the creatures that keep the world around them awake (dead ones too, until they
// respawn, so the world does not vanish on death); enemies hunt the living ones
function tickWorld(w, players, dt) {
  const near = (x, y, r) => players.some(p => (p.cx - x) ** 2 + (p.cy - y) ** 2 < r * r);
  w.tick -= dt;
  if (w.tick <= 0) {
    w.tick = TICK;
    for (const cr of w.mobs) {
      if (cr.frozen) { if (near(cr.cx, cr.cy, WAKE_R)) wake(w, cr); }
      else if (!near(cr.cx, cr.cy, SLEEP_R)) sleep(w, cr);
    }
    for (const sp of w.map.spawners) {
      for (const cr of sp.mobs) if (!cr.alive) { sp.wait.push(RESPAWN_T); w.kills.push({ lvl: sp.lvl, tpl: sp.tpl, x: cr.cx, y: cr.cy }); }
      sp.mobs = sp.mobs.filter(cr => cr.alive);
      sp.wait = sp.wait.map(t => t - TICK);
      if (sp.wait.length && sp.wait[0] <= 0 && !near(sp.x, sp.y, SPAWN_HIDE)) {
        sp.wait.shift();
        const cr = spawnMob(w, sp);
        if (!near(cr.cx, cr.cy, WAKE_R)) sleep(w, cr);
      }
    }
    w.mobs = w.mobs.filter(cr => cr.alive);
    for (const cr of w.creatures) if (cr.debris && !near(cr.cx, cr.cy, SLEEP_R)) removeCreature(w, cr);
    w.food = w.food.filter(p => near(p.x, p.y, SLEEP_R));
    for (const p of players) {
      if (w.food.filter(f => (f.x - p.cx) ** 2 + (f.y - p.cy) ** 2 < FOOD_R1 * FOOD_R1).length >= FOOD_NEAR) continue;
      const a = Math.random() * TAU, d = FOOD_R0 + Math.random() * (FOOD_R1 - FOOD_R0), x = p.cx + Math.cos(a) * d, y = p.cy + Math.sin(a) * d;
      if (x > 0 && y > 0 && x < w.w && y < w.h && !blocked(w.map, x, y, 10)) w.food.push({ x, y });
    }
  }
  const prey = players.filter(p => p.alive);
  for (const cr of w.mobs) if (!cr.frozen && cr.alive) brain(w, cr, prey, dt);
}

// ---------- Enemy AI ----------
// idle: wander near the spawner; chase: a player came within aggro (or hurt it from further); flee: low health, for
// the kinds that flee; leash: too far from home or the player got away: swim home ignoring everything, healed on arrival
function brain(w, cr, players, dt) {
  const m = cr.mob, sp = m.sp;
  const hp = cr.cells.reduce((s, c) => s + c.hp, 0), hit = hp < m.hp - 0.5;
  m.hp = hp; m.t += dt;
  const dist = o => Math.hypot(o.cx - cr.cx, o.cy - cr.cy);
  let p = null;
  for (const o of players) if (!p || dist(o) < dist(p)) p = o;
  const home = Math.hypot(sp.x - cr.cx, sp.y - cr.cy);
  const to = (s, t) => { m.state = s; m.t = 0; m.tgt = t; };
  if (m.state === 'idle' && p && !sp.aggro && hit) to('flee', p);                    // passive kinds only run
  else if (m.state === 'idle' && p && sp.aggro && (dist(p) < sp.aggro || hit && dist(p) < sp.aggro * DROP_K)) to('chase', p);
  if (m.state === 'chase') {
    if (!m.tgt.alive || dist(m.tgt) > sp.aggro * DROP_K || home > LEASH_R) to('leash', null);
    else if (sp.flee && hp < cr.hp0 * sp.flee) to('flee', m.tgt);
  }
  if (m.state === 'flee' && (m.t > FLEE_T || !m.tgt.alive)) to('leash', null);
  if (m.state === 'leash' && home < sp.r * 0.6) {
    for (const c of cr.cells) c.hp = c.max;
    m.hp = cr.cells.reduce((s, c) => s + c.hp, 0); to('idle', null);
  }
  cr.ability = false;
  if (m.state === 'chase') { steer(w, cr, m.tgt.cx - cr.cx, m.tgt.cy - cr.cy, 1); cr.ability = dist(m.tgt) < BITE_R; }
  else if (m.state === 'flee') steer(w, cr, cr.cx - m.tgt.cx, cr.cy - m.tgt.cy, 1);
  else if (m.state === 'leash') steer(w, cr, sp.x - cr.cx, sp.y - cr.cy, 1);
  else {                                              // wander to a random spot near home, rest, pick another
    m.goalT -= dt;
    if (!m.goal || m.goalT <= 0) { m.goal = freeSpot(w.map, sp.x, sp.y, sp.r); m.goalT = 4 + Math.random() * 4; }
    const dx = m.goal[0] - cr.cx, dy = m.goal[1] - cr.cy;
    if (dx * dx + dy * dy > 40 * 40) steer(w, cr, dx, dy, WANDER); else cr.sx = cr.sy = 0;
  }
}

// swim along (dx, dy) at speed share k, bending away from rocks just ahead
function steer(w, cr, dx, dy, k) {
  let l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
  for (const o of rocksAt(w.map, cr.cx + ux * AVOID_M, cr.cy + uy * AVOID_M)) {
    const ox = cr.cx - o.x, oy = cr.cy - o.y, d = Math.hypot(ox, oy) || 1, gap = d - o.r;
    if (gap > AVOID_M * 1.5 || ox * ux + oy * uy > 0) continue;     // far, or already behind us
    const s = 2 * (1 - Math.max(0, gap) / (AVOID_M * 1.5)), nx = ox / d, ny = oy / d;
    let tx = -ny, ty = nx;                            // around its side, the way we are already going
    if (tx * ux + ty * uy < 0) { tx = -tx; ty = -ty; }
    ux += (nx + tx) * s; uy += (ny + ty) * s;
  }
  l = Math.hypot(ux, uy) || 1; ux /= l; uy /= l;
  cr.sx = ux * k; cr.sy = uy * k; cr.want = Math.atan2(ux, -uy);
}
