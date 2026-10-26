// open world (milestone 2): Tidepool map, named regions and landmarks, 200+ enemies, sleeping far-away enemies, frame time, rocks, currents,
// aggro / chase / leash home / flee, respawn; and the app's Enter Tidepool with the camera
const { load } = require('./load');
const { app, check, done } = require('./dom');
const { X } = load({}, ['newWorld', 'spawn', 'step', 'bp', 'TEMPLATES', 'BIOMES', 'makeWorld', 'makeMap', 'placeAt', 'blocked', 'bpCost', 'tickWorld', 'WAKE_R', 'SLEEP_R', 'LEASH_R', 'RESPAWN_T']);
const { newWorld, spawn, step, bp, TEMPLATES, BIOMES, makeWorld, makeMap, placeAt, blocked, bpCost, tickWorld, WAKE_R, SLEEP_R, LEASH_R, RESPAWN_T } = X;
const DT = 1 / 60;
const frame = (w, players, input = { fwd: 0, turn: 0, ability: false }) => { tickWorld(w, players, DT); step(w, DT, input); };
const move = (cr, x, y) => { const dx = x - cr.cx, dy = y - cr.cy; for (const c of cr.cells) { c.x += dx; c.y += dy; } cr.cx = x; cr.cy = y; };
const inRock = (w, c) => w.map.rocks.some(o => Math.hypot(c.x - o.x, c.y - o.y) < o.r + c.rad - 3);
const hp = cr => cr.cells.reduce((s, c) => s + c.hp, 0);

{ // the map
  const a = makeMap(BIOMES.tidepool), b = makeMap(BIOMES.tidepool);
  check('same seed, same map', JSON.stringify(a.rocks) === JSON.stringify(b.rocks) && a.spawners.length === b.spawners.length);
  const want = BIOMES.tidepool.zones.reduce((s, z) => s + z.spawners, 0);
  check('every spawner placed', a.spawners.length === want, `${a.spawners.length} / ${want}`);
  check('start area clear of rocks', a.rocks.every(o => Math.hypot(o.x - 6000, o.y - 6000) > BIOMES.tidepool.safeR));
  const zoneOf = z => a.spawners.filter(s => s.tpl === z.tpl);
  check('each region zone spawns inside its region', BIOMES.tidepool.zones.filter(z => z.region).every(z =>
    zoneOf(z).filter(s => placeAt(a, s.x, s.y).region.name === z.region).length >= z.spawners));
  check('places are named: start, region, cave', placeAt(a, 6000, 6000).name === 'Haven' && placeAt(a, 9000, 8000).name === 'Stinger Reef'
    && placeAt(a, 9700, 8700).name === 'Glow Grotto', [placeAt(a, 6000, 6000).name, placeAt(a, 9000, 8000).name, placeAt(a, 9700, 8700).name].join(', '));
  const line = l => { const t = Math.atan2(6000 - l.y, 6000 - l.x); let n = 0; for (let d = 0; d <= l.r + 200; d += 10) n += blocked(a, l.x + Math.cos(t) * d, l.y + Math.sin(t) * d, 30); return n; };
  const marks = a.landmarks;
  check('caves and the world boss ring: open toward the start', marks.filter(l => l.kind !== 'lair').every(l => line(l) === 0), marks.map(l => l.name + ' ' + line(l)).join(', '));
  check('boss lair sealed', marks.filter(l => l.kind === 'lair').every(l => line(l) > 0 && l.gates.length));
  check('landmark insides free of rocks', marks.every(l => a.rocks.every(o => o.ring || o.gate || Math.hypot(o.x - l.x, o.y - l.y) > l.r + o.r)));
  check('each cave holds its den', BIOMES.tidepool.zones.filter(z => z.cave).every(z => a.spawners.some(s => s.tpl === z.tpl && placeAt(a, s.x, s.y).name === z.cave)));
  const starter = TEMPLATES.starter;
  check('starter prey smaller and cheaper than the starter build', ['mote', 'nipper'].every(t => TEMPLATES[t].cells.length < starter.cells.length && bpCost(TEMPLATES[t]) < bpCost(starter)));
}

const w = makeWorld(BIOMES.tidepool);
check('200+ enemies in the world', w.mobs.length >= 200, `${w.mobs.length}`);
check('all asleep before a player arrives', w.mobs.every(m => m.frozen) && w.creatures.length === 0);
check('no enemy spawned inside a rock', w.mobs.every(m => m.cells.every(c => !inRock(w, c))));

{ // a player tours the map: only enemies near it are simulated; time per frame (sim only)
  const me = spawn(w, TEMPLATES.starter, ...w.start, 0, 0);
  const stops = [[6000, 6000], [7800, 6000], [6000, 3500], [3000, 3000], [9500, 9500], [1200, 6000]];
  let worst = 0, maxAwake = 0, ms = 0, frames = 0, wrong = 0, inside = 0;
  for (const [x, y] of stops) {
    move(me, x, y);
    for (let i = 0; i < 180; i++) {
      const t0 = process.hrtime.bigint();
      frame(w, [me], { fwd: 1, turn: i % 120 < 60 ? 0.3 : -0.3, ability: false });
      const t = Number(process.hrtime.bigint() - t0) / 1e6;
      if (i > 20) { ms += t; frames++; worst = Math.max(worst, t); }
      const awake = w.mobs.filter(m => !m.frozen);
      maxAwake = Math.max(maxAwake, awake.length);
      if (i === 179) wrong += w.mobs.filter(m => m.frozen ? Math.hypot(m.cx - me.cx, m.cy - me.cy) < WAKE_R - 300 : Math.hypot(m.cx - me.cx, m.cy - me.cy) > SLEEP_R + 300).length;
      inside += w.cells.filter(c => inRock(w, c)).length;
      if (!me.alive) { me.alive = true; break; }       // only the frame time matters here
    }
  }
  check('only nearby enemies awake', maxAwake < w.mobs.length / 3 && wrong === 0, `max awake ${maxAwake} of ${w.mobs.length}, misplaced ${wrong}`);
  check('sim frame well under 16 ms with 200+ enemies (vm test harness; ~2x faster in a browser)', ms / frames < 10, `avg ${(ms / frames).toFixed(2)} ms, worst ${worst.toFixed(1)} ms`);
  check('cells never sink into rocks', inside === 0, `${inside} cell-frames inside`);
  check('no NaN', w.cells.every(c => isFinite(c.x) && isFinite(c.y)));
  me.alive = true;
  for (let i = 0; i < 60 * 8; i++) { frame(w, [me]); me.alive = true; }
  const fed = w.food.filter(p => Math.hypot(p.x - me.cx, p.y - me.cy) < 1200).length;
  check('food kept around the player', fed >= 15, `${fed} specks near`);
  const awake = w.mobs.filter(m => !m.frozen).length;
  me.alive = false; for (let i = 0; i < 60; i++) frame(w, [me]);
  check('player dead: the enemies around stay (asleep only once it respawns elsewhere)', w.mobs.filter(m => !m.frozen).length >= awake - 2 && awake > 0, `${awake} awake`);
}

// a small test biome: one wiggler spawner (they flee when hurt), no rocks or currents
const lab = (zone) => makeWorld({ name: 'Lab', w: 6000, h: 6000, seed: 1, start: [1000, 3000], safeR: 0,
  rocks: { n: 0, r: [1, 1] }, ridges: { n: 0, len: [0, 0], r: [1, 1] }, currents: { n: 0, r: [1, 1], v: [0, 0] },
  zones: [{ tpl: 'wiggler', ring: [1500, 1500], spawners: 1, size: 1, aggro: 300, flee: 0, ...zone }] });
// stand-in player that cannot be killed
const dummy = (w, x, y) => { const d = spawn(w, { cells: bp([[0, 0, 'nucleus'], [1, 0, 'shell'], [0, 1, 'shell'], [-1, 1, 'shell']]) }, x, y, 0, 0); for (const c of d.cells) c.hp = c.max = 1e9; return d; };
{ // passive kinds (aggro 0) never chase; hurt, they run
  const w = lab({ tpl: 'mote', aggro: 0, flee: 1 });
  const sp = w.map.spawners[0], mob = w.mobs[0];
  const me = dummy(w, sp.x + 700, sp.y);
  for (let i = 0; i < 30; i++) frame(w, [me]);
  move(me, mob.cx + 120, mob.cy);
  let chased = false;
  for (let i = 0; i < 120; i++) { frame(w, [me]); chased = chased || mob.mob.state === 'chase'; }
  check('passive mote ignores a player next to it', !chased && mob.mob.state === 'idle', mob.mob.state);
  mob.cells.find(c => c.t === 'gill').hp -= 5;
  const d0 = Math.hypot(me.cx - mob.cx, me.cy - mob.cy);
  for (let i = 0; i < 120; i++) frame(w, [me]);
  check('hurt mote runs away', mob.mob.state === 'flee' && Math.hypot(me.cx - mob.cx, me.cy - mob.cy) > d0 + 20, `${mob.mob.state}, ${d0.toFixed(0)} -> ${Math.hypot(me.cx - mob.cx, me.cy - mob.cy).toFixed(0)}`);
  for (let i = 0; i < 60 * 30; i++) frame(w, [me]);
  check('mote still alive and swimming after 30 s awake', mob.alive && mob.cells.every(c => !c.starve), mob.cells.filter(c => c.starve).map(c => c.t).join());
}

{ // aggro, chase; the player swims off faster than the enemy: it gives up
  const w = lab();
  const sp = w.map.spawners[0], mob = w.mobs[0];
  const me = dummy(w, sp.x + 700, sp.y);
  for (let i = 0; i < 60; i++) frame(w, [me]);
  check('enemy idle while player is out of aggro range', mob.mob.state === 'idle', mob.mob.state);
  move(me, mob.cx + 200, mob.cy);
  let chased = false;
  for (let i = 0; i < 60 * 6; i++) {
    frame(w, [me]);
    if (mob.mob.state === 'chase') chased = true;
    if (chased) move(me, me.cx + 260 * DT, me.cy);       // swims away along x
    if (chased && mob.mob.state !== 'chase') break;
  }
  check('enemy notices the player and chases', chased);
  check('player got away: enemy gives up', mob.mob.state !== 'chase' && Math.hypot(me.cx - mob.cx, me.cy - mob.cy) > 300 * 2.5 - 10, mob.mob.state);
}
{ // the player stays just ahead, luring the enemy out: past the leash range it turns back and swims home
  const w = lab();
  const sp = w.map.spawners[0], mob = w.mobs[0];
  const me = dummy(w, sp.x + 700, sp.y);
  for (let i = 0; i < 30; i++) frame(w, [me]);
  mob.cells.find(c => c.t === 'fat').hp -= 15;
  let leashed = false, far = 0, t = 0;
  for (; t < 60 * 150; t++) {
    if (!leashed) move(me, mob.cx + 150, mob.cy);        // keep the bait in front of it
    frame(w, [me]);
    if (mob.mob.state === 'leash') { if (!leashed) move(me, mob.cx + 1000, mob.cy); leashed = true; }
    far = Math.max(far, Math.hypot(mob.cx - sp.x, mob.cy - sp.y));
    if (leashed && mob.mob.state === 'idle') break;
  }
  const home = Math.hypot(mob.cx - sp.x, mob.cy - sp.y);
  check('lured past the leash range, it turns back', leashed && far > LEASH_R - 50 && far < LEASH_R + 150, `went ${far.toFixed(0)} px out (leash ${LEASH_R}), ${(t / 60).toFixed(0)} s`);
  check('swims home and goes idle', mob.mob.state === 'idle' && home < sp.r, `${mob.mob.state}, ${home.toFixed(0)} px from home`);
  check('no free heal at home (it has no Mender)', hp(mob) < mob.hp0 - 10, `${hp(mob).toFixed(0)} / ${mob.hp0}`);
}
{ // hurting it from outside its aggro range makes it come for you
  const w = lab();
  const sp = w.map.spawners[0], mob = w.mobs[0];
  const me = dummy(w, sp.x + 600, sp.y);
  for (let i = 0; i < 30; i++) frame(w, [me]);
  move(me, mob.cx + 550, mob.cy);
  for (let i = 0; i < 10; i++) frame(w, [me]);
  mob.cells.find(c => c.t === 'fat').hp -= 20;
  for (let i = 0; i < 5; i++) frame(w, [me]);
  check('hurt enemy chases from further away', mob.mob.state === 'chase', mob.mob.state);
}
{ // fleeing kinds run when low
  const w = lab({ flee: 0.5 });
  const sp = w.map.spawners[0], mob = w.mobs[0];
  const me = dummy(w, sp.x + 600, sp.y);
  for (let i = 0; i < 30; i++) frame(w, [me]);
  move(me, mob.cx + 150, mob.cy);
  for (let i = 0; i < 10; i++) frame(w, [me]);
  for (const c of mob.cells) if (c.t !== 'nucleus') c.hp = c.max * 0.3;
  let d0 = Math.hypot(me.cx - mob.cx, me.cy - mob.cy);
  for (let i = 0; i < 90; i++) frame(w, [me]);
  check('low enemy flees', mob.mob.state === 'flee' && Math.hypot(me.cx - mob.cx, me.cy - mob.cy) > d0, `${mob.mob.state}, ${d0.toFixed(0)} -> ${Math.hypot(me.cx - mob.cx, me.cy - mob.cy).toFixed(0)}`);
  check('it flees slower than it can swim', Math.hypot(mob.sx, mob.sy) < 0.7);
  for (let i = 0; i < 60 * 4; i++) frame(w, [me]);
  check('after fleeing once it turns back to fight', mob.mob.state === 'chase', mob.mob.state);
  for (let i = 0; i < 60; i++) frame(w, [me]);
  check('and does not flee again', mob.mob.state === 'chase', mob.mob.state);
}
{ // a killed enemy comes back after the respawn time, once the player is not right there
  const w = lab();
  const sp = w.map.spawners[0], mob = w.mobs[0];
  const me = dummy(w, sp.x + 800, sp.y);
  for (let i = 0; i < 30; i++) frame(w, [me]);
  mob.core.hp = -1;
  for (let i = 0; i < 30; i++) frame(w, [me]);
  check('killed enemy is gone', !mob.alive && w.mobs.length === 0);
  for (let i = 0; i < 60 * (RESPAWN_T + 1); i++) frame(w, [me]);
  check('player near the spawner: no respawn in its face', w.mobs.length === 0);
  move(me, sp.x + 2000, sp.y);
  for (let i = 0; i < 60; i++) frame(w, [me]);
  check('respawns once the player is away', w.mobs.length === 1 && w.mobs[0] !== mob);
}
{ // sleeping keeps an enemy as it was; one away from home goes back healed
  const w = lab();
  const sp = w.map.spawners[0], mob = w.mobs[0];
  const me = dummy(w, sp.x + 700, sp.y);
  for (let i = 0; i < 30; i++) frame(w, [me]);
  const n = mob.cells.length, bonds = w.bonds.filter(b => b.a.owner === mob).length;
  move(me, sp.x + SLEEP_R + 500, sp.y); frame(w, [me]); for (let i = 0; i < 20; i++) frame(w, [me]);
  check('far away: asleep and out of the sim', mob.frozen && !w.creatures.includes(mob) && !w.cells.some(c => c.owner === mob));
  move(me, sp.x + 700, sp.y); for (let i = 0; i < 20; i++) frame(w, [me]);
  check('back near: awake with every cell and spring', !mob.frozen && mob.cells.length === n && w.bonds.filter(b => b.a.owner === mob).length === bonds);
}
{ // currents carry a creature that does not swim
  const w = lab();
  w.map.currents.push({ x: 4000, y: 4000, r: 600, vx: 80, vy: 0 });
  const log = dummy(w, 4000, 4000); log.ai = false;
  for (let i = 0; i < 120; i++) frame(w, [log]);
  check('current drifts a creature downstream', log.cx > 4040 && Math.abs(log.cy - 4000) < 30, `${(log.cx - 4000).toFixed(0)} px along, ${(log.cy - 4000).toFixed(0)} across`);
}
{ // the app: Enter Tidepool, swim, the camera and HUD follow
  const { $, fire, run, tpl } = app(['wiggler']);
  run(5); tpl[0].onclick(); run(5);
  $('fight').onclick(); run(5);
  fire('win', 'keydown', { key: 'w', preventDefault() {} }); run(300);
  const pos = /(\d+), (\d+)/.exec($('hudwave').textContent);
  check('HUD names the place', /Tidepool · (Haven|Sunlit Shallows) · /.test($('hudwave').textContent), $('hudwave').textContent);
  fire('win', 'keydown', { key: 'm', preventDefault() {} }); run(5); fire('win', 'keydown', { key: 'm', preventDefault() {} }); run(5);
  check('in Tidepool, HUD shows position and enemy count', pos && /in Tidepool/.test($('hudfoes').textContent), $('hudwave').textContent + ' | ' + $('hudfoes').textContent);
  check('swam away from the start', pos && Math.hypot(pos[1] - 6000, pos[2] - 6000) > 100, pos && pos[0]);
  fire('win', 'keydown', { key: 'Escape', preventDefault() {} }); run(5);
  check('Esc back to builder', $('hud').style.display === 'none');
}
done();
