'use strict';
// Arena map: rocks, currents, lanes, rock/current physics hooks and rock-avoiding steering. No DOM.
// ---------- Tuning ----------
const MAP_G = 256;                                    // obstacle grid bucket size (px)
const AVOID_M = 100;                                  // creatures steer around rocks closer than this

// seeded random numbers (mulberry32), so the arena is the same every match
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = a + 0x6D2B79F5 >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const between = (rand, [a, b]) => a + (b - a) * rand();

// distance from (x, y) to the polyline pts
function polyDist(pts, x, y) {
  let best = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, len2(ax + dx * t - x, ay + dy * t - y));
  }
  return best;
}

function makeMap(def) {
  const rand = rng(def.seed), M = 120;
  const map = { w: def.w, h: def.h, rocks: [], currents: [], lanes: def.lanes, regions: [], landmarks: [],
                cols: Math.ceil(def.w / MAP_G), rows: Math.ceil(def.h / MAP_G), grid: [] };
  const lanes = Object.values(def.lanes);
  const bases = def.teams.flatMap(t => [t.spawn, t.core]);
  const clear = (x, y, r) => x > M && y > M && x < def.w - M && y < def.h - M
    && lanes.every(l => polyDist(l, x, y) > def.laneW + r)
    && bases.every(([bx, by]) => len2(x - bx, y - by) > 550 + r);
  const addRock = (x, y, r) => { if (clear(x, y, r)) map.rocks.push({ x, y, r }); };
  for (let i = 0; i < def.rocks.n; i++) {
    const u = rand();
    addRock(between(rand, [0, def.w]), between(rand, [0, def.h]), def.rocks.r[0] + (def.rocks.r[1] - def.rocks.r[0]) * u * u);
  }
  for (let i = 0; i < def.ridges.n; i++) {            // a wall: a wandering chain of rocks
    let x = between(rand, [0, def.w]), y = between(rand, [800, def.h - 800]), a = rand() * TAU;
    for (let j = 0, n = Math.round(between(rand, def.ridges.len)); j < n; j++) {
      const r = between(rand, def.ridges.r);
      addRock(x, y, r);
      a += (rand() - 0.5) * 0.8; x += Math.cos(a) * r * 1.3; y += Math.sin(a) * r * 1.3;
    }
  }
  for (const o of map.rocks) {                        // bucket every rock into the grid cells its box covers
    for (let gx = Math.max(0, (o.x - o.r) / MAP_G | 0); gx <= Math.min(map.cols - 1, (o.x + o.r) / MAP_G | 0); gx++)
      for (let gy = Math.max(0, (o.y - o.r) / MAP_G | 0); gy <= Math.min(map.rows - 1, (o.y + o.r) / MAP_G | 0); gy++)
        (map.grid[gx + gy * map.cols] = map.grid[gx + gy * map.cols] || []).push(o);
  }
  for (let i = 0; i < def.currents.n; i++) {
    const a = rand() * TAU, v = between(rand, def.currents.v);
    map.currents.push({ x: between(rand, [1500, def.w - 1500]), y: between(rand, [900, def.h - 900]), r: between(rand, def.currents.r), vx: Math.cos(a) * v, vy: Math.sin(a) * v });
  }
  return map;
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
    const k = DRAG_ISO * (1 - len2(dx, dy) / u.r);
    c.fx += u.vx * k; c.fy += u.vy * k;
  }
}

// the next waypoint along lane pts from (x, y): dir +1 toward its end, -1 toward its start
function laneGoal(pts, x, y, dir) {
  let bi = 0, bd = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const d = polyDist([pts[i], pts[i + 1]], x, y);
    if (d < bd) { bd = d; bi = i; }
  }
  let k = dir > 0 ? bi + 1 : bi;
  if (len2(pts[k][0] - x, pts[k][1] - y) < 150) k = Math.max(0, Math.min(pts.length - 1, k + dir));
  return pts[k];
}

// swim along (dx, dy) at speed share k, bending away from rocks just ahead
function steer(w, cr, dx, dy, k) {
  let l = len2(dx, dy) || 1, ux = dx / l, uy = dy / l;
  for (const o of rocksAt(w.map, cr.cx + ux * AVOID_M, cr.cy + uy * AVOID_M)) {
    const ox = cr.cx - o.x, oy = cr.cy - o.y, d = len2(ox, oy) || 1, gap = d - o.r;
    if (gap > AVOID_M * 1.5 || ox * ux + oy * uy > 0) continue;     // far, or already behind us
    const s = 2 * (1 - Math.max(0, gap) / (AVOID_M * 1.5)), nx = ox / d, ny = oy / d;
    let tx = -ny, ty = nx;                            // around its side, the way we are already going
    if (tx * ux + ty * uy < 0) { tx = -tx; ty = -ty; }
    ux += (nx + tx) * s; uy += (ny + ty) * s;
  }
  l = len2(ux, uy) || 1; ux /= l; uy /= l;
  cr.sx = ux * k; cr.sy = uy * k; cr.want = Math.atan2(ux, -uy);
}
