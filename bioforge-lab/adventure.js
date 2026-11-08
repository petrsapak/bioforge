'use strict';
// Adventures: a level played as a journey (chapter 7's Metastasis, user 2026-11-08): a long arena the camera follows,
// dens where the creature is rebuilt from what it has collected, pickups and kills' drops that add materials and
// unlock cell types, creatures that sleep at their posts until the player comes near, a boss that sends out waves
// as it is broken, secrets, and a respawn at the last den (pure).

const DEN_RADIUS = 110;                                   // px: the ring of a den
const PICKUP_RADIUS = 60;                                 // px from the player's centre within which it takes one
const LOSE_TRACK_FACTOR = 2;                              // an awake creature sleeps again past this many wake ranges
const NEWS_SECONDS = 6;                                   // game s a line of news stays in the HUD
const WAVE_DISTANCE = 120;                                // px from a creature's centre its wave appears
const LEASH_RETURN_SHARE = 0.8;                           // a leashed creature wakes again within this share of it

// A pickup lying in the water: materials ({ protein, fat, mineral }) for the bank, and cell types and neuron kinds
// it unlocks. name: what the HUD calls it; secret: off the way, counted in the summary.
function createPickup(definition) {
  return { x: 0, y: 0, name: '', materials: {}, cells: [], neurons: [], secret: false, taken: false, ...definition };
}

// The adventure's state on a level run. bank: the materials the creature may be built from, the level's kit plus
// all collected; cells and neurons: what the builder may use so far; dropped: per level creature, whether its kill
// has dropped its pickup; waves: per level creature, how many of its waves it has sent; den: the den the player
// respawns at; atDen: the den it is in now, or -1. Each sleeper's post is where it starts.
function startAdventure(run) {
  const adventure = run.level.adventure;
  run.adventure = {
    bank: { ...levelLimits(run.level).kit },
    cells: [...adventure.cells],
    neurons: [...adventure.neurons],
    pickups: adventure.pickups.map(createPickup),
    dropped: run.level.creatures.map(() => false),
    waves: run.level.creatures.map(() => 0),
    den: 0,
    atDen: 0,
    deaths: 0,
    news: [],
  };
  run.level.creatures.forEach((entry, i) => {
    if (run.creatures[i] && entry.wakeRange) run.creatures[i].post = { x: entry.x, y: entry.y };
  });
}

// The cell types and neuron kinds an adventure's builder has: the Nucleus and those in the lists.
function adventureUnlocks(cells, neurons) {
  const unlockedCells = new Set(Object.keys(CELLS).filter(typeName => CELLS[typeName].isNucleus));
  cells.forEach(typeName => unlockedCells.add(typeName));
  return { cells: unlockedCells, neurons: new Set(neurons) };
}

// The limits a rebuild at a den must fit: the level's, with the bank for the kit and only what is unlocked so far.
function adventureLimits(run) {
  const unlocked = adventureUnlocks(run.adventure.cells, run.adventure.neurons);
  return {
    ...levelLimits(run.level),
    kit: { ...run.adventure.bank },
    lockedCells: Object.keys(CELLS).filter(typeName => !unlocked.cells.has(typeName)),
    lockedNeurons: Object.keys(NEURONS).filter(kind => !unlocked.neurons.has(kind)),
  };
}

// one step of the adventure, after the world's: wakes and calms creatures, drops and takes pickups, notes the den
// the player is in, and brings a destroyed player back at the last den
function stepAdventure(run) {
  noteDen(run);
  wakeNearbyCreatures(run);
  sendWaves(run);
  dropFromKills(run);
  takePickups(run);
  if (!run.player.alive) respawnAtDen(run);
}

// A sleeping creature (behaviour 'guard' with a wakeRange) wakes when the player comes within its range, and goes
// back to sleep at its post (ai.js) once the player is far off, or it is farther from its post than its leash (px)
// until it is back within most of it. In a den the player is hidden: everything sleeps.
function wakeNearbyCreatures(run) {
  const isHidden = run.adventure.atDen >= 0;
  run.level.creatures.forEach((entry, i) => {
    const creature = run.creatures[i];
    if (!creature || !creature.alive || !entry.wakeRange) return;
    const distance = distanceToPlayer(run, creature.centerX, creature.centerY);
    const fromPost = vectorLength(creature.centerX - entry.x, creature.centerY - entry.y);
    const isLeashed = !!entry.leash && fromPost > entry.leash;
    const isOnLeash = !entry.leash || fromPost < entry.leash * LEASH_RETURN_SHARE;
    if (isHidden || isLeashed || distance > entry.wakeRange * LOSE_TRACK_FACTOR) creature.guardAwake = false;
    else if (distance < entry.wakeRange && isOnLeash) creature.guardAwake = true;
  });
}

// A level creature with waves ([{ share, design, count, name }]) sends out each wave once it is down to that share of
// its cells: that many of the design, hunting, round it; name: the HUD's news.
function sendWaves(run) {
  run.level.creatures.forEach((entry, i) => {
    const creature = run.creatures[i];
    const wave = entry.waves && entry.waves[run.adventure.waves[i]];
    if (!wave || !creature || !creature.alive) return;
    const fullCount = (LEVEL_CREATURES[entry.design] || TEMPLATES[entry.design]).cells.length;
    if (creature.cells.length > fullCount * wave.share) return;
    run.adventure.waves[i] += 1;
    for (let j = 0; j < wave.count; j++) {
      const angle = TAU * j / wave.count;
      spawnLevelCreature(run.world, { design: wave.design, x: creature.centerX + cosine(angle) * WAVE_DISTANCE,
        y: creature.centerY + sine(angle) * WAVE_DISTANCE, heading: angle, behaviour: 'hunt' });
    }
    addNews(run, wave.name);
  });
}

// how the journey went, for the result box: secrets found (of the secret pickups and the secret drops of kills),
// pickups taken, times grown back
function adventureSummary(run) {
  const secretCount = run.level.adventure.pickups.filter(pickup => pickup.secret).length +
    run.level.creatures.filter(entry => entry.drop && entry.drop.secret).length;
  const found = run.adventure.pickups.filter(pickup => pickup.secret && pickup.taken).length;
  const taken = run.adventure.pickups.filter(pickup => pickup.taken).length;
  return `Secrets ${found} / ${secretCount} · ${taken} pickups · grew back ${run.adventure.deaths}×`;
}

// A level creature with a drop ({ materials, cells, neurons }) leaves it as a pickup where it died.
function dropFromKills(run) {
  run.level.creatures.forEach((entry, i) => {
    const creature = run.creatures[i];
    if (!entry.drop || !creature || creature.alive || run.adventure.dropped[i]) return;
    run.adventure.dropped[i] = true;
    run.adventure.pickups.push(createPickup({ ...entry.drop, x: creature.centerX, y: creature.centerY }));
  });
}

// the pickups the player swims over go into the bank and the builder
function takePickups(run) {
  for (const pickup of run.adventure.pickups) {
    if (pickup.taken || distanceToPlayer(run, pickup.x, pickup.y) > PICKUP_RADIUS) continue;
    pickup.taken = true;
    collectPickup(run, pickup);
  }
}

// adds a pickup's materials to the bank and its pieces to the builder, and tells the HUD
function collectPickup(run, pickup) {
  const adventure = run.adventure;
  const parts = [];
  for (const [id, amount] of Object.entries(pickup.materials)) {
    adventure.bank[id] = (adventure.bank[id] || 0) + amount;
    parts.push(`+${amount} ${MATERIALS_BY_ID[id].name.toLowerCase()}`);
  }
  for (const typeName of pickup.cells.filter(name => !adventure.cells.includes(name))) {
    adventure.cells.push(typeName);
    parts.push(`new cell: ${CELLS[typeName].name}`);
  }
  for (const kind of pickup.neurons.filter(name => !adventure.neurons.includes(name))) {
    adventure.neurons.push(kind);
    parts.push(`new neuron: ${NEURONS[kind].name}`);
  }
  if (parts.length) addNews(run, (pickup.name ? pickup.name + ': ' : '') + parts.join(', '));
}

// a line for the HUD, kept for NEWS_SECONDS
function addNews(run, text) {
  run.adventure.news.push({ text, time: run.time });
}

// the news still to show, newest last
function currentNews(run) {
  return run.adventure.news.filter(item => run.time - item.time < NEWS_SECONDS);
}

// which den the player is in, if any; the last one entered is where it comes back (a destroyed body is in none)
function noteDen(run) {
  const dens = run.level.adventure.dens;
  if (!run.player.alive) return;
  run.adventure.atDen = dens.findIndex(den => distanceToPlayer(run, den.x, den.y) < DEN_RADIUS);
  if (run.adventure.atDen >= 0) run.adventure.den = run.adventure.atDen;
}

// the player's design spawned in the middle of a den, facing the way on, with the bank's leftover as its reserves
function spawnPlayerAtDen(run, design, denIndex) {
  const den = run.level.adventure.dens[denIndex];
  const player = spawn(run.world, design, den.x, den.y, run.level.start.heading, 0);
  player.autonomous = true;
  stockReserves(player, kitReserves(design, run.adventure.bank));
  run.player = player;
  run.design = design;
  run.adventure.atDen = denIndex;
}

// the Nucleus was destroyed (or the body given up): the same design comes back at the last den, and nothing
// collected is lost
function respawnAtDen(run) {
  run.adventure.deaths += 1;
  spawnPlayerAtDen(run, run.design, run.adventure.den);
  addNews(run, `You grew back at den ${run.adventure.den + 1}.`);
}

// The player gave up its body (stuck, or starving far from food): it grows back at the last den, as if destroyed.
function returnToDen(run) {
  removeCreature(run.world, run.player);
  respawnAtDen(run);
}

// The player rebuilt its creature in the den it is in: the old body goes, the new design grows there from the bank.
// Returns false (and changes nothing) outside a den or when the design doesn't fit.
function rebuildAtDen(run, design) {
  const denIndex = run.adventure.atDen;
  if (denIndex < 0 || buildCheck(design, adventureLimits(run))) return false;
  removeCreature(run.world, run.player);
  spawnPlayerAtDen(run, design, denIndex);
  return true;
}
