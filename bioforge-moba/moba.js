'use strict';
// Match rules: heroes, minion waves, towers, the fountain, respawns, bot heroes, winning. No DOM: runs in the browser and in Node.
// ---------- Tuning ----------
const HERO_RESPAWN = 15;                              // game seconds dead
const FOUNTAIN_R = 420, FOUNTAIN_HEAL = 0.15, FOUNTAIN_DMG = 25, FOUNTAIN_REGROW = 0.3;   // heal share/s, damage to enemies/s per cell, s per regrown cell
const TOWER_V = 500;                                  // tower glob speed
const AGGRO_MINION = 350, AGGRO_HERO = 500, BITE_R = 180, SPIT_HOLD = 230, HERO_FIRE_R = 240;   // bots press Space within HERO_FIRE_R
const RETREAT_HP = 0.4, RETREAT_CORE = 0.5;           // bots go home below this share of body health / nucleus health
const FOOD_N = 60;
const LANE_SPLIT = [['top', 'top', 'bot', 'bot', 'bot'], ['top', 'top', 'bot', 'bot', 'bot']];   // per team, by slot

const bodyHp = cr => cr.cells.reduce((s, c) => s + Math.max(0, c.hp), 0);
const dist = (a, b) => len2(a.cx - b.cx, a.cy - b.cy);
// why design bpo cannot be taken into a match ('' = it can): every hero gets the same budget and every cell type
function buildCheck(bpo) {
  if (bpo.cells.length > MATCH_CELLS) return `Too many cells: ${bpo.cells.length} / ${MATCH_CELLS}`;
  if (bpCost(bpo) > MATCH_BIOMASS) return `Over budget by ${bpCost(bpo) - MATCH_BIOMASS}`;
  return '';
}

// design: the player's blueprint (team 0, slot 0); null = all ten are bots
function makeMatch(design, seed = 1) {
  const w = newWorld(ARENA.w, ARENA.h);
  w.map = makeMap(ARENA);
  const m = { w, t: 0, waveT: WAVE_FIRST, foodT: 0, heroes: [], minions: [], structs: [], kills: [0, 0], winner: -1, events: [] };
  for (let team = 0; team < 2; team++) {
    for (const [lane, pts] of Object.entries(ARENA.lanes))
      ARENA.towers[lane][team].forEach((x, tier) => addStruct(m, 'tower', team, x, pts[2][1], lane, tier));
    addStruct(m, 'core', team, ...ARENA.teams[team].core, null, 2);
  }
  const rand = rng(seed), names = [...BOT_NAMES];
  for (let team = 0; team < 2; team++) for (let i = 0; i < 5; i++) {
    const me = team === 0 && i === 0 && design;
    const tplName = BOT_DESIGNS[Math.floor(rand() * BOT_DESIGNS.length)];
    const name = me ? 'You' : names.splice(Math.floor(rand() * names.length), 1)[0];
    const s = { team, i, name, player: !!me, design: me ? design : TEMPLATES[tplName], kind: me ? 'yours' : tplName,
                lane: LANE_SPLIT[team][i], cr: null, respawn: 0, deaths: 0, auto: false };
    m.heroes.push(s);
    spawnHero(m, s);
  }
  updateInv(m);
  return m;
}

function addStruct(m, kind, team, x, y, lane, tier) {
  const def = STRUCTS[kind], cr = spawn(m.w, def.tpl, x, y, 0, team);
  cr.core.hp = cr.core.max = def.hp;
  for (const c of cr.cells) c.pin = true;
  const mine = c => c.owner === cr;                    // pinned cells need no angle springs, and structures burn no fuel
  m.w.angles = m.w.angles.filter(g => !mine(g.c)); m.w.links = m.w.links.filter(v => !mine(v.a));
  cr.hp0 = bodyHp(cr);
  cr.mob = { kind, lane, tier, def, cd: def.every };
  m.structs.push(cr);
}

function spawnHero(m, s) {
  const [x, y] = ARENA.teams[s.team].spawn;
  s.cr = spawn(m.w, s.design, x, y + (s.i - 2) * 180, s.team ? -Math.PI / 2 : Math.PI / 2, s.team);
  s.cr.hp0 = bodyHp(s.cr);
  s.cr.slot = s;
  if (!s.player) s.cr.mob = { kind: 'hero', retreat: false };
}

// towers can be hit once the tower before them in their lane is down; the core once any inner tower is down
function updateInv(m) {
  const down = (team, lane, tier) => !m.structs.some(s => s.alive && s.team === team && s.mob.lane === lane && s.mob.tier === tier);
  for (const s of m.structs) {
    const b = s.mob;
    const inv = b.kind === 'core' ? !Object.keys(ARENA.lanes).some(l => down(s.team, l, 1)) : b.tier > 0 && !down(s.team, b.lane, b.tier - 1);
    for (const c of s.cells) c.inv = inv;
    s.inv = inv;
  }
}

// nearest living enemy creature within r of cr (centre to centre); structures only if they can be hit
function nearestFoe(m, cr, r, structs = true) {
  let best = null, bd = r;
  for (const o of m.w.creatures) {
    if (o.team === cr.team || o.team < 0 || o.debris || (o.mob && o.mob.def && (!structs || o.inv))) continue;
    const d = dist(cr, o);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

// call before step(), with the same dt
function tickMatch(m, dt) {
  const w = m.w;
  m.t += dt;
  for (const e of m.events) e.t -= dt;
  m.events = m.events.filter(e => e.t > 0);
  const say = text => m.events.push({ text, t: 6 });
  if (m.winner < 0) {
    m.waveT -= dt;
    if (m.waveT <= 0) { m.waveT = WAVE_EVERY; for (let team = 0; team < 2; team++) for (const lane of Object.keys(ARENA.lanes)) spawnWave(m, team, lane); }
  }
  // structures: fall, then shoot
  let fell = false;
  for (const s of m.structs) if (!s.alive && !s.gone) {
    s.gone = fell = true;
    const who = ARENA.teams[s.team].name;
    say(s.mob.kind === 'core' ? `${who} core destroyed` : `${who} ${s.mob.tier ? 'inner' : 'outer'} ${s.mob.lane} tower destroyed`);
    if (s.mob.kind === 'core' && m.winner < 0) m.winner = 1 - s.team;
  }
  m.structs = m.structs.filter(s => !s.gone);
  if (fell) updateInv(m);
  for (const s of m.structs) towerGun(m, s, dt);
  // heroes: deaths and respawns
  for (const s of m.heroes) {
    if (s.cr && !s.cr.alive && !s.respawn) {
      s.respawn = HERO_RESPAWN; s.deaths++; m.kills[1 - s.team]++;
      say(`${s.name} (${ARENA.teams[s.team].name}) was killed`);
    }
    if (s.respawn && (s.respawn -= dt) <= 0) { s.respawn = 0; if (m.winner < 0) spawnHero(m, s); }
  }
  m.minions = m.minions.filter(cr => cr.alive);
  for (const cr of m.minions) minionBrain(m, cr);
  for (const s of m.heroes) {
    const cr = s.cr;
    if (!cr || !cr.alive) continue;
    if (s.player) { if (s.auto) cr.mob = cr.mob || { kind: 'hero', retreat: false }; else delete cr.mob; }
    if (cr.mob) heroBrain(m, s);
  }
  fountain(m, dt);
  if ((m.foodT -= dt) <= 0) {                         // food specks keep everyone's energy up away from base
    m.foodT = 1;
    for (let i = 0; i < 4 && w.food.length < FOOD_N; i++) {
      const x = 900 + Math.random() * (w.w - 1800), y = 150 + Math.random() * (w.h - 300);
      if (!blocked(w.map, x, y, 10)) w.food.push({ x, y });
    }
  }
}

function spawnWave(m, team, lane) {
  const pts = ARENA.lanes[lane], [x, y] = team ? pts[pts.length - 2] : pts[1], [nx, ny] = team ? pts[pts.length - 3] : pts[2];
  const a = Math.atan2(nx - x, -(ny - y));
  WAVE.forEach((t, i) => {
    const cr = spawn(m.w, MINIONS[t], x + (i - 1) * 50, y + (i - 1) * 50 * (lane === 'top' ? 1 : -1), a, team);
    cr.mob = { kind: 'minion', type: t, lane };
    cr.hp0 = bodyHp(cr);
    m.minions.push(cr);
  });
}

// a tower shoots the nearest enemy minion in range, else the nearest enemy hero
function towerGun(m, s, dt) {
  const b = s.mob, def = b.def;
  if ((b.cd -= dt) > 0) return;
  let tgt = null, bd = Infinity;
  for (const o of m.w.creatures) {
    if (o.team === s.team || o.team < 0 || o.debris || o.mob && o.mob.def) continue;
    const d = dist(s, o) - (o.mob && o.mob.kind === 'minion' ? 1e4 : 0);   // minions first
    if (dist(s, o) < def.range && d < bd) { bd = d; tgt = o; }
  }
  if (!tgt) return;
  const c = s.core, e = tgt.cells.reduce((a, x) => (x.x - c.x) ** 2 + (x.y - c.y) ** 2 < (a.x - c.x) ** 2 + (a.y - c.y) ** 2 ? x : a);
  const dx = e.x - c.x, dy = e.y - c.y, l = len2(dx, dy) || 1;
  m.w.globs.push({ x: c.x + dx / l * 30, y: c.y + dy / l * 30, vx: dx / l * TOWER_V, vy: dy / l * TOWER_V, team: s.team, life: def.range * 1.3 / TOWER_V, dmg: def.dmg, big: true });
  b.cd = def.every;
}

// the fountain at each spawn heals and regrows its own team and burns enemies
function fountain(m, dt) {
  for (let team = 0; team < 2; team++) {
    const [fx, fy] = ARENA.teams[team].spawn;
    for (const cr of m.w.creatures) {
      if (cr.debris || cr.team < 0 || (cr.mob && cr.mob.def) || len2(cr.cx - fx, cr.cy - fy) > FOUNTAIN_R) continue;
      if (cr.team !== team) { for (const c of cr.cells) hurt(c, FOUNTAIN_DMG * dt); continue; }
      for (const c of cr.cells) {
        c.hp = Math.min(c.max, c.hp + c.max * FOUNTAIN_HEAL * dt);
        c.f[O] = Math.min(c.cap[O], c.f[O] + c.cap[O] * dt); c.f[S] = Math.min(c.cap[S], c.f[S] + c.cap[S] * dt);
        c.f[W] = Math.max(0, c.f[W] - c.cap[W] * dt);
      }
      if (!cr.plan || (cr.fount = (cr.fount || 0) + dt) < FOUNTAIN_REGROW) continue;
      cr.fount = 0;
      const b = cr.plan.find(b => !cellAt(cr, b.q, b.r) && NB.some(([dq, dr]) => cellAt(cr, b.q + dq, b.r + dr)));
      if (b) regrowCell(m.w, cr, b);
    }
  }
}

function minionBrain(m, cr) {
  const b = cr.mob, foe = nearestFoe(m, cr, AGGRO_MINION);
  if (foe) {
    const d = dist(cr, foe);
    if (b.type === 'spitling' && d < SPIT_HOLD) { cr.sx = cr.sy = 0; cr.want = Math.atan2(foe.cx - cr.cx, -(foe.cy - cr.cy)); }
    else steer(m.w, cr, foe.cx - cr.cx, foe.cy - cr.cy, 1);
    cr.ability = d < (b.type === 'spitling' ? SPIT_HOLD + 40 : BITE_R);
    return;
  }
  const [gx, gy] = laneGoal(ARENA.lanes[b.lane], cr.cx, cr.cy, cr.team ? -1 : 1);
  steer(m.w, cr, gx - cr.cx, gy - cr.cy, 1);
  cr.ability = false;
}

// bot hero: push its lane behind the minions, fight what comes near, never walk into an enemy tower's range alone,
// go home to the fountain when hurt and come back healed
function heroBrain(m, s) {
  const cr = s.cr, b = cr.mob, dir = s.team ? -1 : 1, lane = ARENA.lanes[s.lane], w = m.w;
  const hp = bodyHp(cr) / cr.hp0, core = cr.core.hp / cr.core.max;
  const [fx, fy] = ARENA.teams[s.team].spawn, home = len2(fx - cr.cx, fy - cr.cy);
  const foe = nearestFoe(m, cr, AGGRO_HERO);
  cr.ability = !!foe && dist(cr, foe) < HERO_FIRE_R;
  if (!b.retreat && (hp < RETREAT_HP || core < RETREAT_CORE)) b.retreat = true;
  if (b.retreat) {
    const whole = cr.plan.every(p => cellAt(cr, p.q, p.r));
    if (home < FOUNTAIN_R * 0.6) { cr.sx = cr.sy = 0; if (whole && hp > 0.95 && core > 0.95) b.retreat = false; return; }
    const [cx, cy] = ARENA.teams[s.team].core;
    const [gx, gy] = len2(cx - cr.cx, cy - cr.cy) < 350 ? [fx, fy] : laneGoal(lane, cr.cx, cr.cy, -dir);
    steer(w, cr, gx - cr.cx, gy - cr.cy, 1);
    return;
  }
  // an enemy structure that would shoot us: back off unless one of our minions is in its range to draw fire
  const tower = m.structs.find(t => t.team !== s.team && dist(cr, t) < t.mob.def.range + 60);
  if (tower && !m.minions.some(o => o.team === s.team && dist(o, tower) < tower.mob.def.range)) {
    const [gx, gy] = laneGoal(lane, cr.cx, cr.cy, -dir);
    steer(w, cr, gx - cr.cx, gy - cr.cy, 1);
    return;
  }
  if (foe) { steer(w, cr, foe.cx - cr.cx, foe.cy - cr.cy, 1); return; }
  const [gx, gy] = laneGoal(lane, cr.cx, cr.cy, dir);
  steer(w, cr, gx - cr.cx, gy - cr.cy, 1);
}
