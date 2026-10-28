// Determinism (sim only): the deterministic math matches Math closely, the seeded random generator repeats, the seed
// decides the run, and the pure sim files keep away from engine-dependent math, Math.random, the DOM and type names.
const fs = require('fs');
const path = require('path');
const { load, ROOT } = require('./load');
const { check, done } = require('./check');
const { X: sim } = load({}, ['sine', 'cosine', 'arcTangent2', 'nextRandom', 'newWorld', 'spawn', 'step', 'TEMPLATES']);

const SIM_FILES = ['math.js', 'core.js', 'physics.js', 'nerve.js', 'fluid.js', 'actuators.js', 'combat.js', 'growth.js',
  'food.js', 'ai.js', 'design.js', 'builder.js', 'data/rules.js', 'data/fluids.js', 'data/cells.js',
  'data/templates.js', 'data/tips.js'];
const SAMPLE_COUNT = 20000;

// distance between two numbers relative to their size (absolute near zero)
const relativeError = (value, expected) => Math.abs(value - expected) / Math.max(1, Math.abs(expected));

{ // the math helpers stay within a few units of the last place of Math's results
  let state = 99;
  const random = () => {
    const [nextState, fraction] = sim.nextRandom(state);
    state = nextState;
    return fraction;
  };
  let worstSineError = 0;
  let worstArcTangentError = 0;
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const angle = (random() - 0.5) * 2000;
    worstSineError = Math.max(worstSineError, relativeError(sim.sine(angle), Math.sin(angle)),
      relativeError(sim.cosine(angle), Math.cos(angle)));
    const y = (random() - 0.5) * 100;
    const x = (random() - 0.5) * 100;
    worstArcTangentError = Math.max(worstArcTangentError, relativeError(sim.arcTangent2(y, x), Math.atan2(y, x)));
  }
  check('sine and cosine match Math', worstSineError < 1e-15, `worst ${worstSineError}`);
  check('arcTangent2 matches Math', worstArcTangentError < 1e-15, `worst ${worstArcTangentError}`);
  const edgeCases = [[0, 1], [0, -1], [-0, -1], [1, 0], [-1, 0], [0, 0], [0, -0], [-0, -0], [Infinity, -Infinity]];
  check('arcTangent2 edge cases (zeros, infinities) match Math',
    edgeCases.every(([y, x]) => Object.is(sim.arcTangent2(y, x), Math.atan2(y, x))));
}

{ // the random generator is mulberry32: fixed numbers from a fixed seed
  const [stateAfterOne, firstFraction] = sim.nextRandom(1);
  const [, secondFraction] = sim.nextRandom(stateAfterOne);
  check('random generator gives the known sequence', firstFraction === 0.6270739405881613 &&
    secondFraction === 0.002735721180215478, `${firstFraction} ${secondFraction}`);
}

// a wiggler in a world with food for 10 game s; returns where the food ended up
function foodAfterRun(seed) {
  const world = sim.newWorld(1200, 1200, { seed });
  sim.spawn(world, sim.TEMPLATES.wiggler, 600, 600, 0, 0);
  for (let i = 0; i < 400; i++) sim.step(world, 1 / 40, { swimX: 0, swimY: -1, ability: false });
  return world.food.map(speck => speck.x + ',' + speck.y).join(' ');
}
check('same seed, same food', foodAfterRun(3) === foodAfterRun(3));
check('other seed, other food', foodAfterRun(3) !== foodAfterRun(4));

// rules for pure sim files (CLAUDE.md): each pattern, and why it is banned
const BANNED = [
  [/Math\.(random|sin|cos|tan|atan|atan2|exp|log|pow|hypot)\b/, 'engine-dependent math or Math.random'],
  [/\*\*/, '** (use x * x or square())'],
  [/\b(document|window|localStorage|requestAnimationFrame)\b/, 'the DOM'],
  [/typeName\s*[!=]==/, 'a type-name check (use a behaviour field in data/cells.js)'],
];
for (const file of SIM_FILES) {
  const lines = fs.readFileSync(path.join(ROOT, file), 'utf8').split(/\r?\n/);
  const problems = [];
  lines.forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, '');               // comments may name what is banned
    for (const [pattern, reason] of BANNED) {
      if (pattern.test(code)) problems.push(`line ${i + 1}: ${reason}`);
    }
  });
  check(`${file} follows the pure-sim rules`, !problems.length, problems.join('; '));
}
done();
