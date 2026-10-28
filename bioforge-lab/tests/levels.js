'use strict';
// Levels: every chapter 1 level is beaten headless by a reference solution and not by the wrong tool, runs are the
// same every time, stars follow the par; then the app (fake DOM) picks a level, runs it to a win, keeps the result
// and moves on to the next level.
const { load } = require('./load');
const { startApp } = require('./dom');
const { check, done } = require('./check');
const { X: sim } = load({}, ['LEVELS', 'TEMPLATES', 'runLevel', 'levelScore', 'levelLimits', 'buildCheck',
  'createDesignCell', 'createNeuron']);

const cell = (q, r, typeName, extra = {}) => sim.createDesignCell(q, r, typeName, extra);
const fibre = (fromQ, fromR, toQ, toR) => ({ from: { q: fromQ, r: fromR }, to: { q: toQ, r: toR } });
const pacemakerNucleus = () => cell(0, 0, 'nucleus', { neuron: sim.createNeuron('pacemaker') });
// Light eyes on the front, left (0,-1) and right (1,-1); Siphons at the back, left (-1,1) and right (0,1)
const eyesAndSiphons = [cell(0, -1, 'lighteye'), cell(1, -1, 'lighteye'), cell(-1, 1, 'siphon'), cell(0, 1, 'siphon')];
const CROSSED = [fibre(0, -1, 0, 1), fibre(1, -1, -1, 1)];
const SAME_SIDE = [fibre(0, -1, -1, 1), fibre(1, -1, 0, 1)];
const SOLUTIONS = {
  'first-stroke': { cells: [pacemakerNucleus(), cell(-1, 1, 'siphon'), cell(0, 1, 'siphon')],
    fibres: [fibre(0, 0, -1, 1), fibre(0, 0, 0, 1)] },
  lighthouse: { cells: [cell(0, 0, 'nucleus'), ...eyesAndSiphons], fibres: CROSSED },
  moth: { cells: [cell(0, 0, 'nucleus'), ...eyesAndSiphons], fibres: CROSSED },
  shade: { cells: [pacemakerNucleus(), ...eyesAndSiphons],
    fibres: [...SAME_SIDE, fibre(0, 0, -1, 1), fibre(0, 0, 0, 1)] },
  hunt: { cells: [cell(0, 0, 'nucleus'), ...eyesAndSiphons], fibres: CROSSED },
};
// the wrong tool for each level: it must not win
const WRONG_TOOLS = {
  lighthouse: sim.TEMPLATES.jet,
  moth: sim.TEMPLATES.jet,
  shade: SOLUTIONS.lighthouse,
  hunt: SOLUTIONS.shade,
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
const rows = byId('levels-list').children;
check('the levels sheet lists every level', byId('levels-sheet').style.display === 'flex' &&
  rows.length === readGlobal('LEVELS.length'), rows.length + ' rows');
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
check('Next level goes back to the builder with level 2 chosen', byId('hud').style.display === 'none' &&
  byId('level-card-title').innerHTML.includes('Lighthouse') && byId('level-result').style.display === 'none');
byId('level-leave').onclick();
check('leaving the level hides the card and brings back the free-build limits',
  byId('level-card').style.display === 'none' && byId('budget').innerHTML.includes('of 50'));
done();
