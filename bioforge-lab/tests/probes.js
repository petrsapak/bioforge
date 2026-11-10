'use strict';
// Signal probes (full app, fake DOM): a Sandbox run probes the Seeker's eyes and Siphons in order, records their
// signals while it runs and keeps only the last few seconds, T hides the panel and is remembered, clicking the
// player's cells chooses the lanes (kept through a respawn), and a level run probes its own player afresh, where a
// click on a cell works through the arena's scaling too. Each lane shows its value now.
const { startApp } = require('./dom');
const { check, done } = require('./check');

const { byId, fire, runFrames, templateButton, readGlobal, storage } = startApp();
const pressKey = key => fire('window', 'keydown', { key });
// the app isn't a global, so catch the probes object (and count the resets) as resetProbes is called
readGlobal('globalThis.probeResets = 0; const resetProbesBefore = resetProbes; ' +
  'resetProbes = (probes, creature) => { globalThis.caughtProbes = probes; globalThis.probeResets++; ' +
  'resetProbesBefore(probes, creature); };');
const probes = () => readGlobal('caughtProbes');
const laneLabels = () => probes().lanes.map(lane => lane.label).join();
// catch where the level arena sits on screen, to click its cells
readGlobal('const arenaViewBefore = arenaView; arenaView = (app, world) => { ' +
  'globalThis.caughtView = arenaViewBefore(app, world); return globalThis.caughtView; };');
const playerCell = typeName => probes().creature.cells.find(cell => cell.typeName === typeName);
// a left click on the screen at (x, y)
const clickScreen = (x, y) => fire('game', 'mousedown', { clientX: x, clientY: y, button: 0, target: byId('game') });
// a left click on a cell in the Sandbox, where the world is the screen
const clickCell = cell => clickScreen(cell.x, cell.y);

runFrames(3);
templateButton('seeker').onclick();
byId('start-sandbox').onclick();
runFrames(5);
// the Seeker's Heart holds an Inhibitor, so it beats, and is probed like any cell acting on a signal (2026-11-01)
check('the Sandbox probes the senses first, then the cells acting on a signal',
  laneLabels() === '1 Light eye,2 Light eye,3 Heart ¬,4 Siphon,5 Siphon', laneLabels());
check('the signal panel shows', byId('hud-probes').style.display === 'block');
runFrames(20);
const sampleCount = probes().lanes[0].samples.length;
// 25 frames of 16 ms are 0.4 s: 16 steps of 1/40 s (until 2026-11-10 every frame was one step, so 20 or more)
check('each sim step adds a sample', sampleCount >= 14 && sampleCount <= 16, sampleCount + ' samples');
runFrames(600);
const samples = probes().lanes[0].samples;
const oldest = samples[samples.length - 1].time - samples[0].time;
check('only the last 6 game s are kept', oldest <= readGlobal('PROBE_SECONDS'), oldest.toFixed(2) + ' s');

pressKey('t');
runFrames(2);
check('T hides the signal panel', byId('hud-probes').style.display === 'none');
check('hiding it is remembered', storage.items['bioforge-lab-probes-shown'] === 'false');
pressKey('t');
runFrames(2);
check('T shows it again', byId('hud-probes').style.display === 'block');

// count the creatures spawned, to see a click on the water still spawn an enemy
readGlobal('globalThis.spawnCount = 0; const spawnBefore = spawn; ' +
  'spawn = (...args) => { globalThis.spawnCount++; return spawnBefore(...args); };');
const siphonLane = probes().lanes[3];
clickCell(siphonLane.cell);
check('a click on a probed cell removes its lane and numbers the rest again',
  laneLabels() === '1 Light eye,2 Light eye,3 Heart ¬,4 Siphon', laneLabels());
const nucleus = playerCell('nucleus');
clickCell(nucleus);
check('a click on an unprobed cell of yours adds a lane at the end',
  probes().lanes.length === 5 && probes().lanes[4].cell === nucleus && laneLabels().endsWith('5 Nucleus'),
  laneLabels());
const chosenLabels = laneLabels();
pressKey('r');
runFrames(3);
check('a respawn keeps the cells you chose', laneLabels() === chosenLabels && probes().lanes[3].cell !== nucleus,
  laneLabels());
const lanesBefore = probes().lanes.length;
const spawnsBefore = readGlobal('spawnCount');
clickScreen(40, 40);
check('a click on the water still spawns an enemy, and leaves the lanes alone',
  probes().lanes.length === lanesBefore && readGlobal('spawnCount') === spawnsBefore + 1, laneLabels());
for (const lane of [...probes().lanes]) clickCell(lane.cell);
runFrames(2);
check('with no lanes the panel stays up and says how to add one',
  byId('hud-probes').style.display === 'block' && byId('probe-more').textContent.startsWith('Click a cell'));
clickCell(playerCell('nucleus'));
pressKey('t');
clickCell(playerCell('lighteye'));
check('while the signals are hidden a click on your cell does not probe it', laneLabels() === '1 Nucleus',
  laneLabels());
pressKey('t');

pressKey('escape');
runFrames(2);
byId('show-levels').onclick();
// the first level whose dock has every piece the Seeker is built from (Grazing), opened for the test
readGlobal('RULES.allLevelsOpen = true');
const grazingIndex = readGlobal('LEVELS.findIndex(level => level.id === "grazing")');
byId('levels-list').children.filter(child => child.className.startsWith('level-tile'))[grazingIndex].onclick();
const resetsBefore = readGlobal('probeResets');
byId('level-run').onclick();
runFrames(5);
check('a level run probes its own player afresh', readGlobal('probeResets') === resetsBefore + 1 &&
  probes().creature.team === 0 && laneLabels().startsWith('1 Light eye') && probes().lanes[0].samples.length <= 6,
  laneLabels());

runFrames(2);
const view = readGlobal('caughtView');
const levelEye = probes().lanes[0].cell;
clickScreen(view.offsetX + levelEye.x * view.scale, view.offsetY + levelEye.y * view.scale);
check('in a level, a click on a cell is found through the arena\'s scaling', !probes().lanes.some(lane =>
  lane.cell === levelEye) && laneLabels().startsWith('1 Light eye'), laneLabels());

// the number right of each trace: the latest signal, 0 or 1 for an on/off lane, else one decimal
const valueText = values => readGlobal('probeValueText')({ samples: values.map((value, time) => ({ time, value })) });
check('an on/off lane (a Pacemaker) shows 0 or 1', valueText([0, 1, 1]) === '1' && valueText([1, 0]) === '0');
check('an analogue lane shows one decimal', valueText([0.2, 0.46]) === '0.5' && valueText([0.37, 1]) === '1.0' &&
  valueText([0.5, 0]) === '0.0', `${valueText([0.2, 0.46])} ${valueText([0.37, 1])} ${valueText([0.5, 0])}`);
check('a lane with no samples yet shows nothing', valueText([]) === '');
const eyeLane = probes().lanes[0];
check('the level\'s eye lane shows its value as a number', /^\d+(\.\d)?$/.test(readGlobal('probeValueText')(eyeLane)),
  readGlobal('probeValueText')(eyeLane));

done();
