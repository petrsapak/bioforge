// Golden tests: run fixed scenarios and compare a fingerprint of the exact simulation state with the recorded one.
// A refactor must leave every fingerprint unchanged. After a deliberate behaviour change, record new fingerprints with
//   node tests/golden.js --update
// and say why in the session log.
const fs = require('fs');
const path = require('path');
const { load } = require('./load');
const { check, done } = require('./check');

const GOLDEN_FILE = path.join(__dirname, 'golden.json');
const STEP_SECONDS = 1 / 40;
const SCENARIO_SECONDS = 10;
const PLAYER_DESIGNS = [
  'wiggler', 'squirter', 'nettler', 'puffer', 'lancer', 'stinger', 'spitter', 'snarer', 'eel', 'crab',
];
const OPPONENT_DESIGN = 'nettler';
const SEED = 7;

const { X: sim } = load({}, ['newWorld', 'spawn', 'step', 'TEMPLATES']);

// FNV-1a over the exact bits of every number, so any change in any digit changes the fingerprint
function createFingerprint() {
  const bytes = new Uint8Array(8);
  const view = new DataView(bytes.buffer);
  let hash = 0x811c9dc5;
  return {
    addNumber(value) {
      view.setFloat64(0, value);
      for (const byte of bytes) {
        hash ^= byte;
        hash = Math.imul(hash, 0x01000193) >>> 0;
      }
    },
    result() {
      return hash.toString(16).padStart(8, '0');
    },
  };
}

// every number that describes the world's state: cell motion, health, signals and fluids, food, the random
// generator, plus what exists
function fingerprintWorld(world) {
  const fingerprint = createFingerprint();
  fingerprint.addNumber(world.creatures.length);
  fingerprint.addNumber(world.cells.length);
  fingerprint.addNumber(world.globs.length);
  fingerprint.addNumber(world.food.length);
  fingerprint.addNumber(world.randomState);
  for (const speck of world.food) {
    fingerprint.addNumber(speck.x);
    fingerprint.addNumber(speck.y);
  }
  for (const cell of world.cells) {
    const state = [cell.x, cell.y, cell.velocityX, cell.velocityY, cell.health, cell.signal, cell.size, ...cell.fluids];
    for (const value of state) fingerprint.addNumber(value);
  }
  return fingerprint.result();
}

// the player's design swims forward and fires its abilities every other second, against a hunting opponent
function runScenario(designName) {
  const world = sim.newWorld(1600, 1200, { seed: SEED });
  const player = sim.spawn(world, sim.TEMPLATES[designName], 800, 800, 0, 0);
  player.aiControlled = false;
  sim.spawn(world, sim.TEMPLATES[OPPONENT_DESIGN], 800, 450, Math.PI, 1);
  const stepCount = Math.round(SCENARIO_SECONDS / STEP_SECONDS);
  for (let i = 0; i < stepCount; i++) {
    const secondsElapsed = i * STEP_SECONDS;
    const abilityHeld = Math.floor(secondsElapsed) % 2 === 1;
    sim.step(world, STEP_SECONDS, { swimX: 0, swimY: -1, ability: abilityHeld, heldKeys: new Set() });
  }
  return fingerprintWorld(world);
}

const fingerprints = Object.fromEntries(PLAYER_DESIGNS.map(name => [name, runScenario(name)]));

if (process.argv.includes('--update')) {
  fs.writeFileSync(GOLDEN_FILE, JSON.stringify(fingerprints, null, 2) + '\n');
  console.log(`Recorded ${PLAYER_DESIGNS.length} fingerprints in ${path.basename(GOLDEN_FILE)}`);
} else {
  const recorded = fs.existsSync(GOLDEN_FILE) ? JSON.parse(fs.readFileSync(GOLDEN_FILE, 'utf8')) : {};
  const rerun = runScenario(PLAYER_DESIGNS[0]);
  check('same scenario twice in one process gives the same fingerprint', rerun === fingerprints[PLAYER_DESIGNS[0]]);
  for (const name of PLAYER_DESIGNS) {
    check(`${name} matches its golden fingerprint`, recorded[name] === fingerprints[name],
      `recorded ${recorded[name]}, now ${fingerprints[name]}`);
  }
  done();
}
