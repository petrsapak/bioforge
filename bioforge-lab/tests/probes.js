'use strict';
// Signal probes (full app, fake DOM): a Sandbox run probes the Seeker's eyes and Siphons in order, records their
// signals while it runs and keeps only the last few seconds, T hides the panel and is remembered, and a level run
// probes its own player.
const { startApp } = require('./dom');
const { check, done } = require('./check');

const { byId, fire, runFrames, templateButton, readGlobal, storage } = startApp(['seeker']);
const pressKey = key => fire('window', 'keydown', { key });
// the app isn't a global, so catch the probes object (and count the resets) as resetProbes is called
readGlobal('globalThis.probeResets = 0; const resetProbesBefore = resetProbes; ' +
  'resetProbes = (probes, creature) => { globalThis.caughtProbes = probes; globalThis.probeResets++; ' +
  'resetProbesBefore(probes, creature); };');
const probes = () => readGlobal('caughtProbes');
const laneLabels = () => probes().lanes.map(lane => lane.label).join();

runFrames(3);
templateButton('seeker').onclick();
byId('start-sandbox').onclick();
runFrames(5);
check('the Sandbox probes the senses first, then the cells acting on a signal',
  laneLabels() === '1 Light eye,2 Light eye,3 Siphon,4 Siphon', laneLabels());
check('the signal panel shows', byId('hud-probes').style.display === 'block');
runFrames(20);
const sampleCount = probes().lanes[0].samples.length;
check('each sim step adds a sample', sampleCount >= 20, sampleCount + ' samples');
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

pressKey('escape');
runFrames(2);
byId('show-levels').onclick();
byId('levels-list').children.find(child => child.className.startsWith('level-row')).onclick();
const resetsBefore = readGlobal('probeResets');
byId('level-run').onclick();
runFrames(5);
check('a level run probes its own player afresh', readGlobal('probeResets') === resetsBefore + 1 &&
  probes().creature.team === 0 && laneLabels().startsWith('1 Light eye') && probes().lanes[0].samples.length <= 6,
  laneLabels());

done();
