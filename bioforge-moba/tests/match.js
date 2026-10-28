// 5v5 match (sim only): arena, structures and their locks, waves, tower fire, deaths and respawns, the fountain,
// bot retreat, winning, the build budget, and frame time with ten bots
const { load } = require('./load');
const { check, done } = require('./dom');
const { X } = load({}, ['makeMatch', 'tickMatch', 'step', 'ARENA', 'TEMPLATES', 'MINIONS', 'spawn', 'removeCreature', 'polyDist', 'buildCheck',
  'HERO_RESPAWN', 'WAVE_FIRST', 'WAVE', 'FOUNTAIN_R', 'BOT_DESIGNS']);
const { makeMatch, tickMatch, step, ARENA, TEMPLATES, MINIONS, spawn, removeCreature, polyDist, buildCheck, HERO_RESPAWN, WAVE_FIRST, WAVE, FOUNTAIN_R, BOT_DESIGNS } = X;
const DT = 1 / 40;                                     // the game's step
const run = (m, secs) => { for (let i = 0; i < secs / DT; i++) { tickMatch(m, DT); step(m.w, DT, { fwd: 0, turn: 0, ability: false }); } };
const move = (cr, x, y) => { const dx = x - cr.cx, dy = y - cr.cy; for (const c of cr.cells) { c.x += dx; c.y += dy; } cr.cx = x; cr.cy = y; };
const hp = cr => cr.cells.reduce((s, c) => s + c.hp, 0);
const kill = cr => { cr.core.inv = false; cr.core.hp = 0; };
const towers = (m, team) => m.structs.filter(s => s.team === team);

{ // arena and setup
  const m = makeMatch(TEMPLATES.lancer, 1);
  check('rocks clear of lanes and bases', m.w.map.rocks.every(o => Object.values(ARENA.lanes).every(l => polyDist(l, o.x, o.y) > ARENA.laneW + o.r)
    && ARENA.teams.every(t => Math.hypot(t.spawn[0] - o.x, t.spawn[1] - o.y) > FOUNTAIN_R + o.r)));
  check('10 heroes, you are team 0 slot 0', m.heroes.length === 10 && m.heroes.filter(h => h.player).length === 1 && m.heroes[0].player && !m.heroes[0].cr.mob);
  check('5 structures a side: 2 towers per lane and a core', [0, 1].every(t => towers(m, t).length === 5 && towers(m, t).filter(s => s.mob.kind === 'core').length === 1));
  check('outer towers open, inner towers and cores shielded', m.structs.every(s => s.inv === (s.mob.kind === 'core' || s.mob.tier === 1)));
  check('bot designs fit the budget', BOT_DESIGNS.every(n => !buildCheck(TEMPLATES[n])));
  check('over budget refused', /Over budget|Too many/.test(buildCheck(TEMPLATES.eel)), buildCheck(TEMPLATES.eel));
  run(m, WAVE_FIRST + 0.1);
  check('first wave: 3 minions per lane per team', m.minions.length === WAVE.length * 4, `${m.minions.length}`);
  const x0 = m.minions.map(c => c.cx);
  run(m, 10);
  check('minions swim toward the enemy base', m.minions.every((c, i) => c.team === 0 ? c.cx > x0[i] + 100 : c.cx < x0[i] - 100));
}

{ // locks: an inner tower takes no damage until the outer one is down; the core opens when an inner one falls
  const m = makeMatch(null, 1);
  const lane = s => towers(m, 1).find(t => t.mob.lane === 'top' && t.mob.tier === s), outer = lane(0), inner = lane(1);
  const before = hp(inner), foe = spawn(m.w, TEMPLATES.lancer, inner.cx - 90, inner.cy, Math.PI / 2, 0);
  foe.mob = { kind: 'idle' };
  run(m, 2);
  check('shielded inner tower ignores damage', hp(inner) === before);
  removeCreature(m.w, foe);
  kill(outer); run(m, 0.1);
  check('outer down: inner open, core still shielded', !inner.inv && towers(m, 1).find(t => t.mob.kind === 'core').inv && m.events.some(e => /outer top tower/.test(e.text)));
  kill(inner); run(m, 0.1);
  const core = towers(m, 1).find(t => t.mob.kind === 'core');
  check('inner down: core open', !core.inv);
  kill(core); run(m, 0.1);
  check('core down: Reef wins', m.winner === 0 && m.events.some(e => /core destroyed/.test(e.text)));
}

{ // towers shoot an enemy minion in range before a hero
  const m = makeMatch(null, 1);
  for (const s of m.heroes) { removeCreature(m.w, s.cr); s.cr.alive = false; s.respawn = 1e9; }
  const t = towers(m, 1).find(s => s.mob.lane === 'top' && s.mob.tier === 0);
  const hero = spawn(m.w, TEMPLATES.lancer, t.cx - 250, t.cy, 0, 0); hero.mob = { kind: 'idle' }; hero.hp0 = hp(hero);
  const mini = spawn(m.w, MINIONS.grunt, t.cx - 200, t.cy + 120, 0, 0); mini.mob = { kind: 'idle' };
  const h0 = hp(hero), n0 = hp(mini);
  run(m, 1.5);
  check('tower hits the minion, not the hero', hp(mini) < n0 && hp(hero) >= h0 - 1, `minion ${n0}->${hp(mini).toFixed(0)}, hero ${h0}->${hp(hero).toFixed(0)}`);
}

{ // a dead hero respawns at its fountain; the kill counts for the other team
  const m = makeMatch(TEMPLATES.spitter, 1), me = m.heroes[0];
  move(me.cr, 3000, 1500); kill(me.cr); run(m, 0.2);
  check('death counted, respawn timer running', !me.cr.alive && m.kills[1] === 1 && me.respawn > 0);
  run(m, HERO_RESPAWN);
  const [fx, fy] = ARENA.teams[0].spawn;
  check('back at the fountain', me.cr.alive && Math.hypot(me.cr.cx - fx, me.cr.cy - fy) < FOUNTAIN_R, `${me.cr.cx | 0}, ${me.cr.cy | 0}`);
}

{ // the fountain heals and regrows its team and burns enemies
  const m = makeMatch(TEMPLATES.snarer, 1), me = m.heroes[0], [fx, fy] = ARENA.teams[0].spawn;
  for (const s of m.heroes.slice(1)) { removeCreature(m.w, s.cr); s.cr.alive = false; s.respawn = 1e9; }
  const lost = me.cr.cells.filter(c => c.t !== 'nucleus' && c.ext).slice(0, 3);
  for (const c of me.cr.cells) if (c.t !== 'nucleus') c.hp = Math.min(c.hp, c.max * 0.3);
  for (const c of lost) c.hp = -100;
  const n = me.cr.plan.length;
  run(m, 0.1);
  check('cells lost', me.cr.cells.length < n);
  run(m, 6);
  check('fountain regrew the body and healed it', me.cr.cells.length === n && me.cr.cells.every(c => c.hp > c.max * 0.9), `${me.cr.cells.length} / ${n}`);
  const foe = spawn(m.w, TEMPLATES.lancer, fx + 150, fy, 0, 1); foe.mob = { kind: 'idle' };
  const f0 = hp(foe);
  run(m, 1);
  check('fountain burns an enemy', hp(foe) < f0 - 50, `${f0} -> ${hp(foe).toFixed(0)}`);
}

{ // a hurt bot goes home
  const m = makeMatch(null, 1), bot = m.heroes[1];
  move(bot.cr, 2000, ARENA.lanes[bot.lane][2][1]);
  for (const c of bot.cr.cells) c.hp *= 0.3;
  const d0 = bot.cr.cx;
  run(m, 6);
  check('hurt bot retreats toward its base', bot.cr.mob.retreat && bot.cr.cx < d0 - 100, `${d0 | 0} -> ${bot.cr.cx | 0}`);
}

{ // ten bots: a few minutes without error, frame time
  const m = makeMatch(null, 3);
  const t0 = Date.now();
  run(m, 120);
  const ms = (Date.now() - t0) / (120 / DT);
  check('2 minutes of bots run', m.t >= 119.9 && m.w.cells.every(c => Number.isFinite(c.x + c.y)), `${m.minions.length} minions, kills ${m.kills}`);
  // the browser runs GAME_SPEED (2.5) game seconds per real second; in this vm loader calls are slower than in a browser
  check('sim cost under 250 ms per game second', ms / DT < 250, `${(ms / DT).toFixed(0)} ms`);
}
done();
