'use strict';
// Levels: every level is beaten headless by a reference solution and not by the wrong tool, runs are the
// same every time, stars follow the par; then the app (fake DOM) picks a level, runs it to a win, keeps the result
// and moves on to the next level.
const { load } = require('./load');
const { startApp } = require('./dom');
const { check, done } = require('./check');
const { X: sim } = load({}, ['LEVELS', 'TEMPLATES', 'runLevel', 'levelScore', 'levelLimits', 'buildCheck',
  'createDesignCell', 'createNeuron', 'isLevelLightOn', 'isLevelOpen', 'FLUID_OXYGEN']);

const cell = (q, r, typeName, extra = {}) => sim.createDesignCell(q, r, typeName, extra);
const fibre = (fromQ, fromR, toQ, toR) => ({ from: { q: fromQ, r: fromR }, to: { q: toQ, r: toR } });
const pacemakerNucleus = () => cell(0, 0, 'nucleus', { neuron: sim.createNeuron('pacemaker') });
// Light eyes on the front, left (0,-1) and right (1,-1); Siphons at the back, left (-1,1) and right (0,1)
const eyesAndSiphons = [cell(0, -1, 'lighteye'), cell(1, -1, 'lighteye'), cell(-1, 1, 'siphon'), cell(0, 1, 'siphon')];
const CROSSED = [fibre(0, -1, 0, 1), fibre(1, -1, -1, 1)];
const SAME_SIDE = [fibre(0, -1, -1, 1), fibre(1, -1, 0, 1)];
// Both Light eyes into the Nucleus, which holds a neuron of this kind and drives both Siphons. leftEyeNeuron: a
// neuron in the left eye, or none.
function eyesThroughNucleus(neuronKind, leftEyeNeuron = null) {
  const leftEye = cell(0, -1, 'lighteye', leftEyeNeuron ? { neuron: leftEyeNeuron } : {});
  const nucleus = cell(0, 0, 'nucleus', { neuron: sim.createNeuron(neuronKind) });
  return { cells: [nucleus, leftEye, ...eyesAndSiphons.slice(1)],
    fibres: [fibre(0, -1, 0, 0), fibre(1, -1, 0, 0), fibre(0, 0, -1, 1), fibre(0, 0, 0, 1)] };
}
// Both Light eyes into a Synapse in the Nucleus, the Nucleus into an Inhibitor in a Tissue cell on its right, and
// that cell to both Siphons; a plain Tissue cell on the left keeps the body even.
function eyesThroughSynapse(threshold) {
  const nucleus = cell(0, 0, 'nucleus', { neuron: { kind: 'synapse', setting: threshold } });
  const inhibitorCell = cell(1, 0, 'tissue', { neuron: sim.createNeuron('inhibitor') });
  return { cells: [nucleus, ...eyesAndSiphons, inhibitorCell, cell(-1, 0, 'tissue')],
    fibres: [fibre(0, -1, 0, 0), fibre(1, -1, 0, 0), fibre(0, 0, 1, 0), fibre(1, 0, -1, 1), fibre(1, 0, 0, 1)] };
}
// the crossed Seeker with a Fat on each side, and a Gill at the back if asked
const seekerWithFat = withGill => ({ cells: [cell(0, 0, 'nucleus'), ...eyesAndSiphons, cell(-1, 0, 'fat'),
  cell(1, 0, 'fat'), ...(withGill ? [cell(-1, 2, 'gill')] : [])], fibres: CROSSED });
// the crossed Seeker with a Fat and an Air sac on the sides, and this cell at the back touching both Siphons
const seekerWithStores = backTypeName => ({ cells: [cell(0, 0, 'nucleus'), ...eyesAndSiphons, cell(-1, 0, 'fat'),
  cell(1, 0, 'airsac'), cell(-1, 2, backTypeName)], fibres: CROSSED });
const SOLUTIONS = {
  'first-stroke': { cells: [pacemakerNucleus(), cell(-1, 1, 'siphon'), cell(0, 1, 'siphon')],
    fibres: [fibre(0, 0, -1, 1), fibre(0, 0, 0, 1)] },
  lighthouse: { cells: [cell(0, 0, 'nucleus'), ...eyesAndSiphons], fibres: CROSSED },
  moth: { cells: [cell(0, 0, 'nucleus'), ...eyesAndSiphons], fibres: CROSSED },
  shade: { cells: [pacemakerNucleus(), ...eyesAndSiphons],
    fibres: [...SAME_SIDE, fibre(0, 0, -1, 1), fibre(0, 0, 0, 1)] },
  hunt: { cells: [cell(0, 0, 'nucleus'), ...eyesAndSiphons], fibres: CROSSED },
  freeze: eyesThroughNucleus('inhibitor'),
  'false-start': eyesThroughNucleus('latch'),
  metronome: eyesThroughNucleus('inhibitor', { kind: 'delay', setting: 3 }),
  dock: eyesThroughSynapse(1.5),
  'long-haul': seekerWithFat(true),
  exhaust: seekerWithStores('pore'),
};
// the wrong tool for each level: it must not win
const WRONG_TOOLS = {
  lighthouse: sim.TEMPLATES.jet,
  moth: sim.TEMPLATES.jet,
  shade: SOLUTIONS.lighthouse,
  hunt: SOLUTIONS.shade,
  freeze: SOLUTIONS.lighthouse,
  'false-start': SOLUTIONS.freeze,
  metronome: SOLUTIONS.freeze,
  dock: SOLUTIONS.freeze,
  'long-haul': SOLUTIONS.moth,
  exhaust: SOLUTIONS['long-haul'],
};

for (const level of sim.LEVELS) {
  const solution = SOLUTIONS[level.id];
  const problem = sim.buildCheck(solution, sim.levelLimits(level));
  const run = sim.runLevel(level, solution);
  check(`"${level.name}": the reference solution fits and wins with 3 stars`,
    !problem && run.outcome === 'won' && sim.levelScore(run, solution).stars === 3,
    `${problem} ${run.outcome} ${run.reason} in ${run.time.toFixed(1)} s`);
  const wrongTool = WRONG_TOOLS[level.id];
  if (!wrongTool) continue;
  const wrongRun = sim.runLevel(level, wrongTool);
  check(`"${level.name}": the wrong tool doesn't win`, wrongRun.outcome === 'lost', wrongRun.reason);
}

const levelById = id => sim.LEVELS.find(level => level.id === id);
const dockRuns = [1, 2].map(threshold => sim.runLevel(levelById('dock'), eyesThroughSynapse(threshold)));
check('"Dock": the Synapse\'s threshold matters: 1 stops short of the ring, 2 never stops',
  dockRuns.every(run => run.outcome === 'lost'), dockRuns.map(run => run.player.centerY.toFixed(0)).join());
const fatOnly = sim.runLevel(levelById('long-haul'), seekerWithFat(false));
check('"Long haul": Fat alone is not enough, it runs out of O2', fatOnly.outcome === 'lost' &&
  fatOnly.player.cells.every(playerCell => playerCell.fluids[sim.FLUID_OXYGEN] < 0.01), fatOnly.reason);
const tissueBack = sim.runLevel(levelById('exhaust'), seekerWithStores('tissue'));
check('"Exhaust": the same body with Tissue for the Pore loses its Siphons to waste', tissueBack.outcome === 'lost' &&
  tissueBack.player.cells.filter(playerCell => playerCell.type.jets).length < 2, tissueBack.reason);
const blinking = levelById('freeze').light;
check('a blinking light is on for 2 s, off for 3 s, and round again',
  [0.5, 2.5, 4.9, 5.1].map(time => sim.isLevelLightOn(blinking, time)).join() === 'true,false,false,true');
const flashing = levelById('false-start').light;
check('a flashing light shines once, for half a second at 4 s',
  [3.9, 4.2, 4.6, 9.2].map(time => sim.isLevelLightOn(flashing, time)).join() === 'false,true,false,false');

check('levels open in order: the first always, the next once the one before is won',
  sim.isLevelOpen({}, 0) && !sim.isLevelOpen({}, 1) && sim.isLevelOpen({ 'first-stroke': { stars: 1 } }, 1) &&
  !sim.isLevelOpen({ 'first-stroke': { stars: 1 } }, 2));

const firstLevel = sim.LEVELS[0];
const firstTime = sim.runLevel(firstLevel, SOLUTIONS['first-stroke']).time;
check('a level run is the same every time', sim.runLevel(firstLevel, SOLUTIONS['first-stroke']).time === firstTime,
  firstTime.toFixed(3) + ' s');
const jetRun = sim.runLevel(firstLevel, sim.TEMPLATES.jet);
check('the Jet wins the first level, but over the par biomass and time: 1 star',
  jetRun.outcome === 'won' && sim.levelScore(jetRun, sim.TEMPLATES.jet).stars === 1,
  `${jetRun.time.toFixed(1)} s`);

// ---------- The app ----------
const { byId, fire, runFrames, readGlobal, storage } = startApp([]);
runFrames(3);
check('no level is chosen at first: the card is hidden', byId('level-card').style.display === 'none');
byId('show-levels').onclick();
const listed = byId('levels-list').children;
const rows = listed.filter(child => child.className.startsWith('level-row'));
const headings = listed.filter(child => child.className === 'chapter-heading');
check('the levels sheet lists every level under its chapter', byId('levels-sheet').style.display === 'flex' &&
  rows.length === readGlobal('LEVELS.length') && headings.length === 3 &&
  headings[2].textContent === 'Chapter 3: Circulation', `${rows.length} rows, ${headings.length} headings`);
check('at first only level 1 is open: the others are locked and say which win opens them',
  !rows[0].className.includes('locked') && rows.slice(1).every(row => row.className.includes('locked')) &&
  rows[1].innerHTML.includes('Win “First stroke” to open it.'), rows[1].innerHTML);
rows[1].onclick();
check('a locked level can\'t be chosen', byId('level-card').style.display === 'none' &&
  byId('levels-sheet').style.display === 'flex');
rows[0].onclick();
check('choosing a level closes the sheet and shows its card with its limits',
  byId('levels-sheet').style.display === 'none' && byId('level-card').style.display === 'block' &&
  byId('level-card-title').innerHTML.includes('First stroke') && byId('budget').innerHTML.includes('of 30'),
  byId('level-card-title').innerHTML);
byId('level-hint').onclick();
check('Hint shows the level\'s hint', byId('level-card-hint').textContent.includes('Pacemaker'));

byId('level-run').onclick();          // the starting design is the Jet
check('Run level starts the level with its bar and HUD', byId('level-bar').style.display === 'flex' &&
  byId('hud').style.display === 'block' && byId('dock').style.display === 'none');
runFrames(5);
check('the HUD names the level and runs its clock', byId('hud-mode').textContent === '1. First stroke' &&
  /^0\.\d \/ 40 s$/.test(byId('hud-enemies').textContent), byId('hud-enemies').textContent);
fire('window', 'keydown', { key: 'p' });
runFrames(3);
const pausedClock = byId('hud-enemies').textContent;
runFrames(3);
check('P pauses the level',
  byId('hud-enemies').textContent === pausedClock && byId('level-pause').textContent === '▶');
fire('window', 'keydown', { key: 'p' });
runFrames(1150);                       // the Jet needs about 17.3 game s, at 16 ms of game time per frame
check('the Jet swims into the ring: the result box shows a win with 1 star',
  byId('level-result').style.display === 'block' && byId('result-title').textContent === 'Level done' &&
  (byId('result-stars').innerHTML.match(/class="lit"/g) || []).length === 1, byId('result-text').textContent);
const kept = JSON.parse(storage.items['bioforge-lab-level-results'] || '{}');
check('the win is kept as the best result', kept['first-stroke'] && kept['first-stroke'].stars === 1,
  JSON.stringify(kept));
byId('result-next').onclick();
byId('show-levels').onclick();
const rowsAfterWin = byId('levels-list').children.filter(child => child.className.startsWith('level-row'));
check('the win opens level 2, and only level 2', !rowsAfterWin[1].className.includes('locked') &&
  rowsAfterWin[2].className.includes('locked'));
byId('show-levels').onclick();
check('Next level goes back to the builder with level 2 chosen', byId('hud').style.display === 'none' &&
  byId('level-card-title').innerHTML.includes('Lighthouse') && byId('level-result').style.display === 'none');
byId('level-leave').onclick();
check('leaving the level hides the card and brings back the free-build limits',
  byId('level-card').style.display === 'none' && byId('budget').innerHTML.includes('of 50'));
done();
