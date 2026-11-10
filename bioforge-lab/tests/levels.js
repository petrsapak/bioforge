'use strict';
// Levels: every level is beaten headless by a reference solution and not by the wrong tool, runs are the
// same every time, stars follow the par; then the app (fake DOM) picks a level, runs it to a win, keeps the result
// and moves on to the next level.
const { load } = require('./load');
const { startApp } = require('./dom');
const { check, done } = require('./check');
const { X: sim } = load({}, ['LEVELS', 'TEMPLATES', 'runLevel',
  'levelScore', 'levelLimits', 'buildCheck',
  'createDesignCell', 'createNeuron', 'isLevelLightOn', 'isLevelOpen', 'isLevelEarned', 'RULES', 'FLUID_OXYGEN',
  'linksFromList', 'CELLS', 'NEURONS', 'isCellLocked', 'isNeuronLocked',
  'isLastLevelWon', 'withEverythingUnlocked', 'levelBringing', 'isPieceMet']);

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
// Stale water's body with a Heart at the front between the eyes for cold water. heartBeat: what beats the Heart: an
// Inhibitor in it (all the time), a Pacemaker in it (in pulses), 'eyes' (fibres from both Light eyes: while they see
// the light, as the Siphons work) or 'none' (nothing: it doesn't beat).
const EXHAUST_BODY = seekerWithStores('pore');
// the Heart at the front and the fibres that beat it, for heartBeat as above
function heartAtFront(heartBeat) {
  const isNeuron = heartBeat === 'inhibitor' || heartBeat === 'pacemaker';
  return { heart: cell(1, -2, 'heart', isNeuron ? { neuron: sim.createNeuron(heartBeat) } : {}),
    fibres: heartBeat === 'eyes' ? [fibre(0, -1, 1, -2), fibre(1, -1, 1, -2)] : [] };
}
const coldWaterBuild = (heartBeat = 'inhibitor') => {
  const { heart, fibres } = heartAtFront(heartBeat);
  return { cells: [...EXHAUST_BODY.cells, heart], fibres: [...CROSSED, ...fibres] };
};
// Shape: no nerves. Cilia in a row left of the Nucleus, a Tissue right of it (if asked) and Cilia behind it, on the
// left, the right or both: more push on the left, so it curves right
const shapeBuild = ({ leftCilia = 2, rightTissue = true, backCilia = [[-1, 1], [0, 1]] } = {}) => ({
  cells: [cell(0, 0, 'nucleus'), ...Array.from({ length: leftCilia }, (unused, i) => cell(-1 - i, 0, 'cilia')),
    ...(rightTissue ? [cell(1, 0, 'tissue')] : []), ...backCilia.map(([q, r]) => cell(q, r, 'cilia'))],
  fibres: [] });
// Packed lunch: a straight swimmer with even sides. This neuron in the Nucleus drives both Siphons; a Fat on each
// side, a cell of gillTypeName at each front corner and a Pore at the back
const crossingBuild = (neuronKind = 'inhibitor', gillTypeName = 'gill') => ({
  cells: [cell(0, 0, 'nucleus', { neuron: sim.createNeuron(neuronKind) }), cell(-1, 1, 'siphon'), cell(0, 1, 'siphon'),
    cell(-1, 0, 'fat'), cell(1, 0, 'fat'), cell(0, -1, gillTypeName), cell(1, -1, gillTypeName), cell(-1, 2, 'pore')],
  fibres: [fibre(0, 0, -1, 1), fibre(0, 0, 0, 1)] });
// Reel: an Eyespot at the front left wired to the cell of snareTypeName at the front right and to a Nettle in front
// of each
const reelBuild = (snareTypeName = 'snare') => ({
  cells: [cell(0, 0, 'nucleus'), cell(0, -1, 'eyespot'), cell(1, -1, snareTypeName), cell(0, -2, 'nettle'),
    cell(2, -2, 'nettle')],
  fibres: [fibre(0, -1, 1, -1), fibre(0, -1, 0, -2), fibre(0, -1, 2, -2)] });
// Long haul: the crossed Seeker with this store on the left, a Gill on the right and this cell (a
// Pore) at the back
const lunchBuild = (storeTypeName, backTypeName = 'pore') => ({ cells: [cell(0, 0, 'nucleus'), ...eyesAndSiphons,
  cell(-1, 0, storeTypeName), cell(1, 0, 'gill'), cell(-1, 2, backTypeName)], fibres: CROSSED });
// Grazing: two Noses at the front crossed to the Siphons, a Mouth on the left and this cell on the right
const grazingBuild = rightTypeName => ({ cells: [cell(0, 0, 'nucleus'), cell(0, -1, 'nose'), cell(1, -1, 'nose'),
  cell(-1, 1, 'siphon'), cell(0, 1, 'siphon'), cell(-1, 0, 'mouth'), cell(1, 0, rightTypeName)], fibres: CROSSED });
// Bloom: the crossed Seeker with this store on the left and a Mouth on the right, a Pore at the back and a Gill
// beside each Siphon
const bloomBuild = storeTypeName => ({ cells: [cell(0, 0, 'nucleus'), ...eyesAndSiphons, cell(-1, 0, storeTypeName),
  cell(1, 0, 'mouth'), cell(-1, 2, 'pore'), cell(-2, 1, 'gill'), cell(1, 1, 'gill')], fibres: CROSSED });
// Bulwark: a Nucleus inside a ring of six cells of this type
const ringBuild = typeName => ({ cells: [cell(0, 0, 'nucleus'), ...[[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]]
  .map(([q, r]) => cell(q, r, typeName))] });
// Clam and Siege: the crossed Seeker with a row of three cells across the front, all fired by an Eyespot on the
// left; on the right this cell (a Mineralizer gets a Pacemaker), and any more cells
const glandRowBuild = ([left, tip, right], rightTypeName = 'fat', extra = []) => ({
  cells: [cell(0, 0, 'nucleus'), ...eyesAndSiphons, cell(0, -2, left), cell(1, -2, tip), cell(2, -2, right),
    cell(-1, 0, 'eyespot'),
    cell(1, 0, rightTypeName, rightTypeName === 'mineralizer' ? { neuron: sim.createNeuron('pacemaker') } : {}),
    ...extra],
  fibres: [...CROSSED, fibre(-1, 0, 0, -2), fibre(-1, 0, 1, -2), fibre(-1, 0, 2, -2)] });
// Siege: three acid glands, a Mineralizer with a Pacemaker, a Mouth and a Fat; one of them swapped for Tissue
const siegeBuild = (front = ['acid', 'acid', 'acid'], store = 'mineralizer', mouth = 'mouth') =>
  glandRowBuild(front, store, [cell(1, 1, mouth), cell(-2, 1, 'fat')]);
// Quarry: Grazing's body with this cell in the Fat's place (a Mineralizer gets a Pacemaker)
const quarryBuild = rightTypeName => ({ cells: [cell(0, 0, 'nucleus'), cell(0, -1, 'nose'), cell(1, -1, 'nose'),
  cell(-1, 1, 'siphon'), cell(0, 1, 'siphon'), cell(-1, 0, 'mouth'),
  cell(1, 0, rightTypeName, rightTypeName === 'mineralizer' ? { neuron: sim.createNeuron('pacemaker') } : {})],
  fibres: CROSSED });
// Anglerfish: a lit cell (a Photophore, or Tissue) at the front, in a cup of four always-on protease glands
const lit = () => ({ neuron: sim.createNeuron('inhibitor') });
const cupBuild = lureTypeName => ({ cells: [cell(0, 0, 'nucleus'), cell(0, -1, lureTypeName, lit()),
  cell(-1, -1, 'protease', lit()), cell(1, -2, 'protease', lit()), cell(-1, 0, 'protease', lit()),
  cell(1, -1, 'protease', lit()), cell(1, 0, 'fat')] });
// Grazed: a Nucleus inside a ring of Tissue, with this cell on both sides (left and right)
const grazedBuild = sideTypeName => ({ cells: [cell(0, 0, 'nucleus'), cell(1, 0, sideTypeName),
  cell(-1, 0, sideTypeName), ...[[0, 1], [0, -1], [1, -1], [-1, 1]].map(([q, r]) => cell(q, r, 'tissue'))] });
// Swarm: a Bud at the front fired by a 0.2 Hz Pacemaker in the Nucleus, growing this part facing up; a Fat, a Gill
// and a Pore round the Nucleus
const swarmBuild = part => ({ cells: [cell(0, 0, 'nucleus', { neuron: { kind: 'pacemaker', setting: 0.2 } }),
  cell(0, -1, 'bud', { budPart: part, partRotation: 0 }), cell(1, 0, 'fat'), cell(-1, 0, 'gill'), cell(0, 1, 'pore')],
fibres: [fibre(0, 0, 0, -1)] });
// a homing stinger: the crossed Seeker without a Nucleus (Tissue in its place), a Nettle always on at the front middle
const HOMING_PART = { name: 'stinger', cells: [cell(0, -1, 'lighteye'), cell(1, -1, 'lighteye'), cell(0, 0, 'tissue'),
  cell(-1, 1, 'siphon'), cell(0, 1, 'siphon'), cell(1, -2, 'nettle', { neuron: sim.createNeuron('inhibitor') })],
fibres: CROSSED };
// a Nettle on a Tissue cell, with no way to steer
const NETTLE_PART = { name: 'nettle', cells: [cell(0, 0, 'tissue'),
  cell(0, -1, 'nettle', { neuron: sim.createNeuron('inhibitor') })], fibres: [] };
// Tumour: a Nucleus with a 0.5 Hz Pacemaker firing a Bud in front, a Fat and a Gill, and the Bud's part: a Cilia
// and partSize - 1 Tissue. With a part of 4 no body has more than 8 cells; with 5 the body has 9 while it grows one.
const tumourBuild = partSize => ({ cells: [cell(0, 0, 'nucleus', { neuron: { kind: 'pacemaker', setting: 0.5 } }),
  cell(0, -1, 'bud', { budPart: { name: 'lump', cells: [cell(0, 0, 'cilia'),
    ...[[0, -1], [1, -1], [1, 0], [-1, 0]].slice(0, partSize - 1).map(([q, r]) => cell(q, r, 'tissue'))], fibres: [] },
  partRotation: 0 }), cell(1, 0, 'fat'), cell(-1, 0, 'gill')], fibres: [fibre(0, 0, 0, -1)] });
// Crevice: a worm two cells wide, front to back: a pair of Bloaters, the Nucleus with a Pacemaker at the rate (Hz),
// rows of Muscles (pairs on odd rows, one on even rows), a Tissue with an Inhibitor of the Pacemaker, and the back
// cells (Bloaters, or backTypeName; a pair after an odd number of Muscle rows). The front Bloaters and the Muscles are
// wired to the Nucleus, the back cells to the Inhibitor.
function creviceWormBuild(rate = 1.5, muscleRows = 3, backTypeName = 'bloater') {
  const at = (x, r, typeName, extra) => cell(x - r / 2, r, typeName, extra);
  const rowAt = (r, typeName, extra) => (r % 2 ? [at(-0.5, r, typeName, extra), at(0.5, r, typeName)]
    : [at(0, r, typeName, extra)]);
  const front = rowAt(-1, 'bloater');
  const muscles = Array.from({ length: muscleRows }, (unused, i) => rowAt(1 + i, 'muscle')).flat();
  const inhibitorRow = rowAt(1 + muscleRows, 'tissue', { neuron: sim.createNeuron('inhibitor') });
  const back = rowAt(2 + muscleRows, backTypeName);
  const wire = (from, cells) => cells.map(target => fibre(from.q, from.r, target.q, target.r));
  return { cells: [cell(0, 0, 'nucleus', { neuron: { kind: 'pacemaker', setting: rate } }), ...front, ...muscles,
    ...inhibitorRow, ...back],
  fibres: [...wire({ q: 0, r: 0 }, [...front, ...muscles, inhibitorRow[0]]), ...wire(inhibitorRow[0], back)] };
}
// Tail: the Lean paddler, the Paddler with Tissue for its Mouth, Pore, Gills and Heart, which do nothing in
// chapter 2, so it uses only the cells the dock has by then
const tailFish = sim.TEMPLATES.leanPaddler;
// Tail: the Wiggler with its Inhibitor taken out, so both sides of the tail contract together and only pulse
const wigglerWithoutInhibitor = { ...sim.TEMPLATES.wiggler, cells: sim.TEMPLATES.wiggler.cells.map(bodyCell =>
  (bodyCell.neuron && bodyCell.neuron.kind === 'inhibitor' ? { ...bodyCell, neuron: null } : bodyCell)) };
// Sting: the crossed Seeker with Nettles across the front fired by an Eyespot on the left, and a Fat on the right;
// isWired: false leaves the Eyespot's fibres out, so the Nettles never fire
const stingBuild = (isWired = true) => ({ cells: [cell(0, 0, 'nucleus'), ...eyesAndSiphons, cell(0, -2, 'nettle'),
  cell(1, -2, 'nettle'), cell(2, -2, 'nettle'), cell(-1, 0, 'eyespot'), cell(1, 0, 'fat')],
fibres: [...CROSSED, ...(isWired ? [fibre(-1, 0, 0, -2), fibre(-1, 0, 1, -2), fibre(-1, 0, 2, -2)] : [])] });
// Spit: the crossed Seeker with two always-on Spitters at the front and a Fat on each side
const spitBuild = { cells: [cell(0, 0, 'nucleus'), ...eyesAndSiphons, cell(0, -2, 'spitter', lit()),
  cell(1, -2, 'spitter', lit()), cell(-1, 0, 'fat'), cell(1, 0, 'fat')], fibres: CROSSED };
// Hunt: the crossed Seeker with a Pacemaker in the Nucleus pulsing both Siphons, so it swims on until it sees the
// light; or with Cilia on both sides of the Nucleus, which always beat
const huntBuild = { cells: [pacemakerNucleus(), ...eyesAndSiphons],
  fibres: [...CROSSED, fibre(0, 0, -1, 1), fibre(0, 0, 0, 1)] };
const huntCiliaBuild = { cells: [cell(0, 0, 'nucleus'), ...eyesAndSiphons, cell(-1, 0, 'cilia'), cell(1, 0, 'cilia')],
  fibres: CROSSED };
const SOLUTIONS = {
  'first-stroke': { cells: [pacemakerNucleus(), cell(-1, 1, 'siphon'), cell(0, 1, 'siphon')],
    fibres: [fibre(0, 0, -1, 1), fibre(0, 0, 0, 1)] },
  lighthouse: { cells: [cell(0, 0, 'nucleus'), ...eyesAndSiphons], fibres: CROSSED },
  shade: { cells: [pacemakerNucleus(), ...eyesAndSiphons],
    fibres: [...SAME_SIDE, fibre(0, 0, -1, 1), fibre(0, 0, 0, 1)] },
  hunt: huntBuild,
  shape: shapeBuild(),
  freeze: eyesThroughNucleus('inhibitor'),
  'false-start': eyesThroughNucleus('latch'),
  metronome: eyesThroughNucleus('inhibitor', { kind: 'delay', setting: 3 }),
  dock: eyesThroughSynapse(1.5),
  tail: tailFish,
  crevice: creviceWormBuild(),
  'long-haul': lunchBuild('fat'),
  exhaust: EXHAUST_BODY,
  'cold-water': coldWaterBuild(),
  'packed-lunch': crossingBuild(),
  grazing: grazingBuild('fat'),
  bloom: bloomBuild('fat'),
  sting: stingBuild(),
  reel: reelBuild(),
  bulwark: ringBuild('shell'),
  pincushion: ringBuild('thorn'),
  clam: glandRowBuild(['acid', 'protease', 'acid']),
  anglerfish: cupBuild('photophore'),
  quarry: quarryBuild('mineralizer'),
  siege: siegeBuild(),
  spit: spitBuild,
  grazed: grazedBuild('mender'),
  swarm: swarmBuild(HOMING_PART),
  tumour: tumourBuild(4),
};
// the wrong tool for each level: it must not win
const WRONG_TOOLS = {
  lighthouse: sim.TEMPLATES.jet,
  shade: SOLUTIONS.lighthouse,
  hunt: SOLUTIONS.lighthouse,
  shape: shapeBuild({ leftCilia: 1, rightTissue: false, backCilia: [] }),   // one Cilia: it spins on the spot
  freeze: SOLUTIONS.lighthouse,
  'false-start': SOLUTIONS.freeze,
  metronome: SOLUTIONS.freeze,
  dock: SOLUTIONS.freeze,
  tail: wigglerWithoutInhibitor,
  crevice: sim.TEMPLATES.paddler,
  'long-haul': SOLUTIONS.lighthouse,
  exhaust: SOLUTIONS['long-haul'],
  'cold-water': SOLUTIONS.exhaust,
  'packed-lunch': crossingBuild('inhibitor', 'tissue'),     // no Gills: it runs out of O2 on the way
  grazing: { cells: [cell(0, 0, 'nucleus'), ...eyesAndSiphons, cell(-1, 0, 'mouth'), cell(1, 0, 'fat')],
    fibres: CROSSED },
  bloom: SOLUTIONS['long-haul'],
  sting: stingBuild(false),
  reel: reelBuild('tissue'),                                // no Snare: the Whirler never comes near
  bulwark: ringBuild('tissue'),
  pincushion: ringBuild('shell'),
  clam: glandRowBuild(['acid', 'acid', 'acid']),
  anglerfish: cupBuild('tissue'),
  quarry: quarryBuild('tissue'),
  siege: siegeBuild(['acid', 'acid', 'acid'], 'tissue'),
  spit: glandRowBuild(['acid', 'protease', 'acid']),
  grazed: grazedBuild('tissue'),
  swarm: swarmBuild(NETTLE_PART),
  tumour: tumourBuild(5),
};

// the cells and neurons in a design that the level's dock doesn't have yet (buildCheck lets them run, but the
// player can't build them; user, 2026-11-01, of Tail: "this is what I have available for that level")
function piecesNotInDock(design, level) {
  const limits = sim.levelLimits(level);
  const cells = design.cells.filter(bodyCell => sim.isCellLocked(limits, bodyCell.typeName))
    .map(bodyCell => bodyCell.typeName);
  const neurons = design.cells.filter(bodyCell => bodyCell.neuron && sim.isNeuronLocked(limits, bodyCell.neuron.kind))
    .map(bodyCell => bodyCell.neuron.kind);
  return [...new Set([...cells, ...neurons])];
}

// an adventure is played with keys and rebuilt on the way, so runLevel can't win it: tests/adventure.js plays it
for (const level of sim.LEVELS.filter(entry => !entry.adventure)) {
  const solution = SOLUTIONS[level.id];
  const missing = piecesNotInDock(solution, level);
  check(`"${level.name}": the reference solution uses only pieces the dock has`, !missing.length, missing.join(', '));
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
{
  const plainRow = { cells: [cell(0, 0, 'nucleus'), cell(0, -1, 'photophore', lit()), cell(0, -2, 'protease', lit()),
    cell(1, -2, 'protease', lit()), cell(-1, -1, 'protease', lit()), cell(1, -1, 'protease', lit()),
    cell(1, 0, 'fat')] };
  check('"Anglerfish": glands in front of the light, not round it, lose (the blind Seeker stops short)',
    sim.runLevel(levelById('anglerfish'), plainRow).outcome === 'lost');
}
const dockRuns = [1, 2].map(threshold => sim.runLevel(levelById('dock'), eyesThroughSynapse(threshold)));
check('"Dock": the Synapse\'s threshold matters: 1 stops short of the ring, 2 never stops',
  dockRuns.every(run => run.outcome === 'lost'), dockRuns.map(run => run.player.centerY.toFixed(0)).join());
// Six Mouths round the Nucleus survived every Puffer level (2026-11-05): they bit the soft front of the Puffer's
// crown away and the Nucleus rode in the hole. Mouths now can't bite hard cells, and a fifth Thorn closes the gap.
const PUFFER_LEVELS = ['bulwark', 'pincushion', 'quarry', 'siege'];
const mouthRingRuns = PUFFER_LEVELS.map(id => sim.runLevel(levelById(id), ringBuild('mouth')));
check('a ring of Mouths loses every Puffer level', mouthRingRuns.every(run => run.outcome === 'lost'),
  mouthRingRuns.map(run => `${run.outcome} ${run.time.toFixed(0)} s`).join(', '));
// Cilia steered by side Muscles won the endurance levels with no stores while Cilia burned nothing (2026-11-05)
const ciliaCruiser = { cells: [cell(0, 0, 'nucleus'), cell(-1, 0, 'muscle'), cell(1, 0, 'muscle'),
  cell(-2, 0, 'lighteye'), cell(2, 0, 'lighteye'), cell(0, -1, 'tissue'), cell(1, -1, 'tissue'), cell(-1, 1, 'cilia'),
  cell(0, 1, 'cilia'), cell(-1, 2, 'cilia')], fibres: [fibre(-2, 0, -1, 0), fibre(2, 0, 1, 0)] };
const ENDURANCE_LEVELS = ['long-haul', 'exhaust', 'cold-water', 'bloom'];
const cruiserRuns = ENDURANCE_LEVELS.map(id => sim.runLevel(levelById(id), ciliaCruiser));
check('a Cilia cruiser with no stores loses every endurance level', cruiserRuns.every(run => run.outcome === 'lost'),
  cruiserRuns.map(run => `${run.outcome} ${run.time.toFixed(0)} s`).join(', '));
check('"Tail" and "Crevice" don\'t allow Siphons or Cilia: the Jet doesn\'t fit',
  ['tail', 'crevice'].every(id => /Siphon/.test(sim.buildCheck(sim.TEMPLATES.jet, sim.levelLimits(levelById(id))))));
const wiggling = sim.runLevel(levelById('tail'), sim.TEMPLATES.wiggler);
check('"Tail": the Wiggler wins without the Paddler\'s wave, but slower than the par', wiggling.outcome === 'won' &&
  sim.levelScore(wiggling, sim.TEMPLATES.wiggler).stars === 2, `${wiggling.time.toFixed(1)} s`);
const wormRuns = [creviceWormBuild(1), creviceWormBuild(1.5, 5), creviceWormBuild(2, 5)]
  .map(build => sim.runLevel(levelById('crevice'), build));
check('"Crevice": the worm crawls out at other rates and lengths too', wormRuns.every(run => run.outcome === 'won'),
  wormRuns.map(run => `${run.outcome} ${run.time.toFixed(0)} s`).join(', '));
const noBackGrip = sim.runLevel(levelById('crevice'), creviceWormBuild(1.5, 3, 'tissue'));
check('"Crevice": without Bloaters at the back nothing holds the body while it stretches, and the current wins',
  noBackGrip.outcome === 'lost', noBackGrip.reason);
check('"Long haul" opens the Pore', sim.levelBringing('pore') === levelById('long-haul'));
const fatOnly = sim.runLevel(levelById('long-haul'), seekerWithFat(false));
check('"Long haul": Fat alone is not enough, it runs out of O2', fatOnly.outcome === 'lost' &&
  fatOnly.player.cells.every(playerCell => playerCell.fluids[sim.FLUID_OXYGEN] < 0.01), fatOnly.reason);
// Long haul's bodies without a Pore were poisoned with nothing to fix it while the Pore came a level later
// (user, 2026-11-06: "my creature dies of poisoning because it doesn't have pores, But pore is locked")
const tissueBack = sim.runLevel(levelById('long-haul'), lunchBuild('fat', 'tissue'));
check('"Long haul": the same body with Tissue for the Pore loses its Siphons to waste', tissueBack.outcome === 'lost' &&
  tissueBack.player.cells.filter(playerCell => playerCell.type.jets).length < 2, tissueBack.reason);
// the player's layout: the Gill on the left and the Fat on the right, which pulls a little to one side
const mirroredLongHaul = { cells: [cell(0, 0, 'nucleus'), ...eyesAndSiphons, cell(-1, 0, 'gill'), cell(1, 0, 'fat'),
  cell(-1, 2, 'pore')], fibres: CROSSED };
const mirroredRun = sim.runLevel(levelById('long-haul'), mirroredLongHaul);
check('"Long haul": the Gill and the Fat the other way round win too', mirroredRun.outcome === 'won',
  `${mirroredRun.outcome} ${mirroredRun.time.toFixed(0)} s, ${mirroredRun.goalTime.toFixed(0)} s near the light`);
// Cold water should have more than one way to win (user, 2026-10-30: "it seems like there's only one design that can
// finish the assigment")
const coldRuns = ['pacemaker', 'eyes']
  .map(heartBeat => sim.runLevel(levelById('cold-water'), coldWaterBuild(heartBeat)));
check('"Cold water": a Heart beating in pulses, or only while the eyes see the light, wins as well',
  coldRuns.every(run => run.outcome === 'won'),
  coldRuns.map(run => run.outcome + ' ' + run.time.toFixed(0)).join(', '));
// Hunt must need something the Lighthouse build doesn't have (user, 2026-10-30: "Level5 can be finished with the
// same design as levels 2,3"; Moth, level 3 then, was dropped on 2026-11-01)
const huntRuns = [huntCiliaBuild, sim.TEMPLATES.jet, SOLUTIONS.shade]
  .map(build => sim.runLevel(levelById('hunt'), build));
check('"Hunt": Cilia on the sides catch the Darter too; the Jet and the Shade build lose',
  huntRuns[0].outcome === 'won' && huntRuns.slice(1).every(run => run.outcome === 'lost'),
  huntRuns.map(run => `${run.outcome} ${run.time.toFixed(0)} s`).join(', '));
// The Darter flees in sprints that tire it (user, 2026-11-01: "improve the hunted organism so that it actually has a
// chance to avoid the player's organism if it is slow"): the reference with two Tissue cells more swims 31 px/s
// instead of 45 and never closes in
const heavyHunter = { ...huntBuild, cells: [...huntBuild.cells, cell(-1, 0, 'tissue'), cell(1, 0, 'tissue')] };
const heavyHunt = sim.runLevel(levelById('hunt'), heavyHunter);
check('"Hunt": the Darter outruns a heavier hunter', heavyHunt.outcome === 'lost',
  `${heavyHunt.outcome} ${heavyHunt.time.toFixed(0)} s`);
// Shape (2026-11-10): the level that needs Cilia. With no neurons and no fibres only the body's shape steers.
{
  const shape = levelById('shape');
  const shapeLimits = sim.levelLimits(shape);
  check('"Shape" allows no neurons and no fibres: Hunt\'s build doesn\'t fit',
    /Too many neurons/.test(sim.buildCheck(SOLUTIONS.hunt, shapeLimits)) &&
    /Too many fibre units/.test(sim.buildCheck(SOLUTIONS.lighthouse, shapeLimits)));
  const evenSides = { cells: [cell(0, 0, 'nucleus'), cell(-1, 0, 'cilia'), cell(1, 0, 'cilia')], fibres: [] };
  const evenRun = sim.runLevel(shape, evenSides);
  check('"Shape": a Cilia on each side swims straight up, past the ring', evenRun.outcome === 'lost' &&
    Math.abs(evenRun.player.centerX - shape.start.x) < 20, evenRun.player.centerX.toFixed(0) + ' px');
  const otherRun = sim.runLevel(shape, shapeBuild({ backCilia: [[0, 1]] }));
  check('"Shape": with one Cilia behind, on the right, the body curves into the ring too', otherRun.outcome === 'won',
    `${otherRun.outcome} ${otherRun.time.toFixed(0)} s`);
  const mirrored = { cells: SOLUTIONS.shape.cells.map(bodyCell =>
    cell(-bodyCell.q - bodyCell.r, bodyCell.r, bodyCell.typeName)), fibres: [] };
  check('"Shape": the mirrored body curves left, away from the ring',
    sim.runLevel(shape, mirrored).outcome === 'lost');
}
// Packed lunch (2026-11-10: a crossing; until then Long haul's chase from a kit, won by Long haul's body)
{
  const lunch = levelById('packed-lunch');
  const lunchLimits = sim.levelLimits(lunch);
  const stillSeeker = sim.runLevel(lunch, SOLUTIONS['long-haul']);
  check('"Packed lunch": Long haul\'s Seeker has no light to follow and never leaves', stillSeeker.outcome === 'lost' &&
    Math.abs(stillSeeker.player.centerX - lunch.start.x) < 50, stillSeeker.player.centerX.toFixed(0) + ' px');
  const bareJet = sim.runLevel(lunch, SOLUTIONS['first-stroke']);
  check('"Packed lunch": a body with no stores runs dry on the way', bareJet.outcome === 'lost' &&
    bareJet.player.centerX > 2000 && bareJet.player.centerX < lunch.goal.x - lunch.goal.radius,
    bareJet.player.centerX.toFixed(0) + ' px');
  const pulsed = sim.runLevel(lunch, crossingBuild('pacemaker'));
  check('"Packed lunch": the same body on a Pacemaker crosses too, slower than the par',
    pulsed.outcome === 'won' && sim.levelScore(pulsed, crossingBuild('pacemaker')).stars === 2,
    `${pulsed.outcome} ${pulsed.time.toFixed(0)} s`);
  const ciliaPair = { cells: [cell(0, 0, 'nucleus'), cell(-1, 1, 'cilia'), cell(0, 1, 'cilia')], fibres: [] };
  check('"Packed lunch" allows no Cilia (a pair crosses with no stores at all)',
    /No Cilia allowed/.test(sim.buildCheck(ciliaPair, lunchLimits)) &&
    sim.runLevel(lunch, ciliaPair).outcome === 'won');
  check('"Packed lunch" is three screens long, and the camera follows the creature',
    lunch.arena.width === 3 * lunch.view.width && lunch.arena.height === lunch.view.height);
}
// Reel (2026-11-10): the level that needs the Snare
{
  const reel = levelById('reel');
  check('"Reel" brings the Snare', sim.levelBringing('snare') === reel);
  const beaten = { cells: [cell(0, 0, 'nucleus', { neuron: sim.createNeuron('inhibitor') }), cell(0, -1, 'nettle'),
    cell(1, -1, 'nettle'), cell(1, -2, 'snare')],
  fibres: [fibre(0, 0, 1, -2), fibre(0, 0, 0, -1), fibre(0, 0, 1, -1)] };
  const beatenRun = sim.runLevel(reel, beaten);
  check('"Reel": a Snare and Nettles that are always on win too, with no Eyespot', beatenRun.outcome === 'won',
    `${beatenRun.outcome} ${beatenRun.time.toFixed(0)} s`);
  const losers = [SOLUTIONS.sting, ringBuild('nettle'), { cells: [cell(0, 0, 'nucleus',
    { neuron: sim.createNeuron('inhibitor') }), cell(1, -1, 'snare')], fibres: [fibre(0, 0, 1, -1)] }];
  const loserRuns = losers.map(build => sim.runLevel(reel, build));
  check('"Reel": Sting\'s build, a ring of Nettles and a Snare with no Nettles lose',
    loserRuns.every(run => run.outcome === 'lost'), loserRuns.map(run => run.outcome).join(', '));
}
const unbeating = sim.runLevel(levelById('cold-water'), coldWaterBuild('none'));
check('"Cold water": a Heart without a signal doesn\'t beat, and loses', unbeating.outcome === 'lost',
  `${unbeating.reason} ${unbeating.goalTime.toFixed(0)} s near the light`);
const fullMouth = sim.runLevel(levelById('grazing'), grazingBuild('tissue'));
check('"Grazing": without a Fat the body is soon full of sugar and eats too little',
  fullMouth.outcome === 'lost' && fullMouth.player.foodEaten < 13, `ate ${fullMouth.player.foodEaten}`);
const noStore = sim.runLevel(levelById('bloom'), bloomBuild('tissue'));
check('"Bloom": with Tissue for the Fat, the bloom\'s food has nowhere to go', noStore.outcome === 'lost',
  `near the light ${noStore.goalTime.toFixed(0)} s, ate ${noStore.player.foodEaten}`);
const keptRule = sim.runLevel(levelById('tumour'), tumourBuild(4));
const brokenRule = sim.runLevel(levelById('tumour'), tumourBuild(5));
const isAwake = run => run.creatures.filter(guard => guard.guardAwake).length;
check('"Tumour": keeping every body to 8 cells leaves the guards asleep; one body of 9 wakes all four',
  !keptRule.ruleBroken && isAwake(keptRule) === 0 && brokenRule.ruleBroken && isAwake(brokenRule) === 4,
  `kept: ${isAwake(keptRule)} awake; broken: ${isAwake(brokenRule)} awake, ${brokenRule.reason}`);
const blinking = levelById('freeze').light;
check('a blinking light is on for 2 s, off for 3 s, and round again',
  [0.5, 2.5, 4.9, 5.1].map(time => sim.isLevelLightOn(blinking, time)).join() === 'true,false,false,true');
const flashing = levelById('false-start').light;
check('a flashing light shines once, for half a second at 4 s',
  [3.9, 4.2, 4.6, 9.2].map(time => sim.isLevelLightOn(flashing, time)).join() === 'false,true,false,false');

check('levels are earned in order: the first always, the next once the one before is won',
  sim.isLevelEarned({}, 0) && !sim.isLevelEarned({}, 1) && sim.isLevelEarned({ 'first-stroke': { stars: 1 } }, 1) &&
  !sim.isLevelEarned({ 'first-stroke': { stars: 1 } }, 2));
check('levels open only once earned, unless RULES.allLevelsOpen (testing) opens them all',
  sim.isLevelOpen({}, 5) === !!sim.RULES.allLevelsOpen);

const firstLevel = sim.LEVELS[0];
const firstTime = sim.runLevel(firstLevel, SOLUTIONS['first-stroke']).time;
check('a level run is the same every time', sim.runLevel(firstLevel, SOLUTIONS['first-stroke']).time === firstTime,
  firstTime.toFixed(3) + ' s');
const jetRun = sim.runLevel(firstLevel, sim.TEMPLATES.jet);
check('the Jet wins the first level, but over the par biomass and time: 1 star',
  jetRun.outcome === 'won' && sim.levelScore(jetRun, sim.TEMPLATES.jet).stars === 1,
  `${jetRun.time.toFixed(1)} s`);

// ---------- The dock fills level by level ----------
const lastLevel = sim.LEVELS[sim.LEVELS.length - 1];
check('every level unlocks real cell types and neurons', sim.LEVELS.every(level =>
  level.unlocks.cells.every(typeName => sim.CELLS[typeName]) &&
  level.unlocks.neurons.every(kind => sim.NEURONS[kind])));
// the piece of the reference solution the level's dock doesn't have yet, or ''
function lockedPieceOf(level) {
  const limits = sim.levelLimits(level);
  const solution = SOLUTIONS[level.id];
  const cellPiece = solution.cells.find(bodyCell => sim.isCellLocked(limits, bodyCell.typeName));
  if (cellPiece) return cellPiece.typeName;
  const neuronPiece = solution.cells.find(bodyCell =>
    bodyCell.neuron && sim.isNeuronLocked(limits, bodyCell.neuron.kind));
  return neuronPiece ? neuronPiece.neuron.kind : '';
}
const levelsMissingPieces = sim.LEVELS.filter(level => !level.adventure && lockedPieceOf(level))
  .map(level => level.id + ': ' + lockedPieceOf(level));
check('every reference solution is built from what its level\'s dock has by then', levelsMissingPieces.length === 0,
  levelsMissingPieces.join(', '));
{
  const firstLimits = sim.levelLimits(sim.LEVELS[0]);
  const coldWater = sim.levelLimits(levelById('cold-water'));
  check('First stroke has the Nucleus, Tissue, Siphons and the Pacemaker, and no Light eye, Synapse or Heart',
    !sim.isCellLocked(firstLimits, 'nucleus') && !sim.isCellLocked(firstLimits, 'siphon') &&
    !sim.isNeuronLocked(firstLimits, 'pacemaker') && sim.isCellLocked(firstLimits, 'lighteye') &&
    sim.isNeuronLocked(firstLimits, 'synapse') && sim.isCellLocked(firstLimits, 'heart'));
  check('a later level keeps what the earlier ones unlocked, and Cold water brings the Heart',
    !sim.isCellLocked(coldWater, 'lighteye') && !sim.isNeuronLocked(coldWater, 'synapse') &&
    !sim.isCellLocked(coldWater, 'heart') && sim.isCellLocked(coldWater, 'shell'));
  check('Hunt brings Cilia, Dock the Ganglion and Metastasis the Command (a key the player holds, to steer)',
    sim.levelBringing('cilia') === levelById('hunt') && sim.levelBringing('ganglion') === levelById('dock') &&
    sim.levelBringing('command') === levelById('metastasis'));
  check('a piece is met once the level that brings it is earned, or the last level is won',
    sim.isPieceMet({}, 'siphon') && !sim.isPieceMet({}, 'muscle') && !sim.isPieceMet({}, 'command') &&
    sim.isPieceMet({ [lastLevel.id]: { stars: 1 } }, 'muscle'));
  const opened = sim.withEverythingUnlocked(firstLimits);
  check('winning the last level opens everything',
    !sim.isLastLevelWon({}) && sim.isLastLevelWon({ [lastLevel.id]: { stars: 1 } }) &&
    opened.lockedCells.length === 0 && opened.lockedNeurons.length === 0);
}

// ---------- The app ----------
// with every level open (RULES.allLevelsOpen, for testing), a later level can be chosen and brings its kit
const allOpen = startApp();
allOpen.readGlobal('RULES.allLevelsOpen = true');
allOpen.runFrames(3);
allOpen.byId('show-levels').onclick();
const openTiles = allOpen.byId('levels-list').children.filter(child => child.className.startsWith('level-tile'));
const bloomTile = openTiles[sim.LEVELS.findIndex(level => level.id === 'bloom')];
bloomTile.onclick();
allOpen.byId('level-build').onclick();
// the dock's buttons, open or locked (every piece is in the dock; the locked ones are greyed out with a lock)
const dockButtonsOf = page => page.byId('palette').children.flatMap(section => section.children[0].children);
const isDockShown = (page, attribute, name) => !dockButtonsOf(page)
  .find(button => button.dataset[attribute] === name).classList.contains('locked');
check('Bloom\'s dock has the cells of the levels before it open, the later ones locked',
  isDockShown(allOpen, 'type', 'mouth') && isDockShown(allOpen, 'type', 'heart') &&
  !isDockShown(allOpen, 'type', 'shell') && !isDockShown(allOpen, 'type', 'nettle'));
check('every piece stays in the dock, locked or not',
  dockButtonsOf(allOpen).every(button => button.style.display !== 'none'));
check('with every level open, any level can be chosen, and the builder takes its limits',
  openTiles.every(tile => !tile.className.includes('locked')) && /Protein/.test(allOpen.byId('budget').innerHTML) &&
  /\/ 38/.test(allOpen.byId('budget').innerHTML), allOpen.byId('budget').innerHTML.slice(0, 200));

// the rest runs with levels opening in order, as a player will have them
const { byId, fire, runFrames, readGlobal, loadTestDesign, storage, templateButton } = startApp();
readGlobal('RULES.allLevelsOpen = false');
runFrames(3);
check('no level is chosen at first', !byId('show-levels').classList.contains('selected'));
check('Run level (bottom right) points at level 1 while nothing is won',
  byId('run-next-label').textContent === 'Run level 1' && byId('run-next-name').textContent === 'First stroke');
check('in free build every cell and neuron in the dock is open',
  dockButtonsOf({ byId }).every(button => !button.classList.contains('locked')));
byId('show-levels').onclick();
const listed = byId('levels-list').children;
const rows = listed.filter(child => child.className.startsWith('level-tile'));
const headings = listed.filter(child => child.className === 'chapter-heading');
check('the levels sheet lists every level under its chapter', byId('levels-sheet').style.display === 'flex' &&
  rows.length === readGlobal('LEVELS.length') && headings.length === 7 &&
  headings[6].textContent === 'Chapter 7: Breaking the rules',
  `${rows.length} rows, ${headings.length} headings`);
check('at first only level 1 is open: the others are locked and say which win opens them',
  !rows[0].className.includes('locked') && rows.slice(1).every(row => row.className.includes('locked')) &&
  rows[1].title === 'Win “First stroke” to open it.', rows[1].title);
check('the sheet shows the latest open level\'s card at first, with its limits and par',
  byId('level-card-title').innerHTML.includes('First stroke') && rows[0].className.includes('selected') &&
  /Biomass<\/span><b>40/.test(byId('level-card-rules').innerHTML), byId('level-card-rules').innerHTML);
rows[1].onclick();
check('a locked level can\'t be shown', byId('level-card-title').innerHTML.includes('First stroke'));
check('showing a level doesn\'t choose it: the builder keeps its limits until Build or Run',
  byId('budget').innerHTML.includes('of 50') && byId('level-leave').style.display === 'none');
byId('level-hint').onclick();
check('Hint shows the level\'s hint', byId('level-card-hint').textContent.includes('Pacemaker'));
byId('level-build').onclick();
check('Build for it chooses the level and goes back to the builder with its limits',
  byId('levels-sheet').style.display === 'none' && byId('budget').innerHTML.includes('of 40') &&
  byId('show-levels').classList.contains('selected'));
// the briefing (user, 2026-11-05: "you end up in the lab but you have no idead what you're preparing for")
const isBriefingShown = () => byId('briefing-sheet').style.display === 'flex';
const briefedPieces = () => byId('briefing-pieces').children.map(row => row.children[1].innerHTML).join(' | ');
runFrames(1);
check('the first time the Lab builds for a level, its briefing opens: name, goal, arena, new pieces, rules',
  isBriefingShown() && byId('briefing-title').textContent === 'First stroke' &&
  byId('briefing-brief').textContent === 'Swim into the ring ahead.' && byId('briefing-arena').width > 0 &&
  /<b>Siphon<\/b>/.test(briefedPieces()) && /<b>Pacemaker neuron<\/b>/.test(briefedPieces()) &&
  /Biomass<\/span><b>40/.test(byId('briefing-rules').innerHTML), briefedPieces());
check('its hint is hidden until Hint', byId('briefing-hint-text').style.display === 'none');
byId('briefing-hint').onclick();
check('Hint shows it', byId('briefing-hint-text').style.display === 'block' &&
  /Pacemaker/.test(byId('briefing-hint-text').textContent));
fire('window', 'keydown', { key: 'Enter' });
runFrames(1);
check('Enter closes it, and it does not open again for the same level', !isBriefingShown() &&
  JSON.parse(storage.items['bioforge-lab-game-1-briefed-levels']).join() === 'first-stroke');
check('First stroke\'s Needs card has no Oxygen, Sugar, Waste or Blood rows, nor how long the sugar lasts',
  byId('needs').innerHTML.includes('Signal') && !/Oxygen|Sugar|Waste|Blood/.test(byId('needs').innerHTML),
  byId('needs').innerHTML.slice(0, 300));
{
  const page = { byId };
  const siphonButton = dockButtonsOf(page).find(button => button.dataset.type === 'siphon');
  // its category's section, opened for it although the player had only the first one open
  const siphonSection = byId('palette').children.find(section => section.children[0].children.includes(siphonButton));
  const categoryTabs = byId('dock-tabs').children.filter(tab => tab.style.display !== 'none');
  check('First stroke\'s dock has only Tissue, Siphons and the Pacemaker open, its own ones marked new',
    isDockShown(page, 'type', 'tissue') && !siphonButton.classList.contains('locked') &&
    siphonButton.classList.contains('new') && siphonSection.style.display !== 'none' &&
    !isDockShown(page, 'type', 'lighteye') &&
    isDockShown(page, 'neuron', 'pacemaker') && !isDockShown(page, 'neuron', 'synapse'),
    dockButtonsOf(page).filter(button => !button.classList.contains('locked')).map(button => button.dataset.type ||
      button.dataset.neuron).join(','));
  check('every category keeps its tab, even with all its cells locked', categoryTabs.length === 5,
    categoryTabs.map(tab => tab.textContent).join(','));
  const eyeButton = dockButtonsOf(page).find(button => button.dataset.type === 'lighteye');
  eyeButton.onclick();
  check('a locked cell can\'t be picked, and says which level opens it',
    !eyeButton.classList.contains('selected') && /Opens with level 2, Lighthouse/.test(byId('message').textContent),
    byId('message').textContent);
}
byId('show-levels').onclick();
check('while a level is chosen, the sheet offers to leave it',
  byId('level-leave').style.display === 'block' && /Leave “First stroke”/.test(byId('level-leave').textContent));

// the starting design is the Jet: a creature from later levels can't run in level 1 (user, 2026-11-05)
check('Run level is shut while the design holds a piece no level so far brings, and says which',
  byId('level-run').disabled === true &&
  /doesn't fit: Take out the Mouth: a later level brings it/.test(byId('level-run-note').textContent),
  byId('level-run-note').textContent);
byId('levels-close').onclick();
loadTestDesign(SOLUTIONS['first-stroke'], 'First stroke');
byId('show-levels').onclick();
byId('layer-nerve').onclick();        // left in the Nerve view: the builder comes back in Body
byId('level-run').onclick();
check('Run level closes the sheet and starts the level with its bar and HUD',
  byId('levels-sheet').style.display === 'none' && byId('level-bar').style.display === 'flex' &&
  byId('hud').style.display === 'block' && byId('dock').style.display === 'none');
runFrames(5);
check('the HUD names the level and runs its clock', byId('hud-mode').textContent === '1. First stroke' &&
  /^0\.\d \/ 40 s$/.test(byId('hud-enemies').textContent), byId('hud-enemies').textContent);
check('the goal shows in its own banner at the top, not among the vitals chips',
  byId('hud-goal').style.display === 'flex' && byId('hud-goal-text').textContent === 'Reach the ring' &&
  !byId('hud-chips').innerHTML.includes('Reach'), byId('hud-goal-text').textContent);
fire('window', 'keydown', { key: 'p' });
runFrames(3);
const pausedClock = byId('hud-enemies').textContent;
runFrames(3);
check('P pauses the level',
  byId('hud-enemies').textContent === pausedClock && byId('level-pause').textContent === '▶');
check('a level shows the big Lab button', byId('run-exit').style.display === 'flex' &&
  typeof byId('back-to-lab').onclick === 'function');
fire('window', 'keydown', { key: 'p' });
const firstStars = sim.levelScore(sim.runLevel(firstLevel, SOLUTIONS['first-stroke']), SOLUTIONS['first-stroke']).stars;
runFrames(Math.ceil(firstTime / 0.016) + 60);   // 16 ms of game time per frame
check('the creature swims into the ring: the result box shows the win and its stars',
  byId('level-result').style.display === 'block' && byId('result-title').textContent === 'Level done' &&
  (byId('result-stars').innerHTML.match(/class="lit"/g) || []).length === firstStars, byId('result-text').textContent);
const kept = JSON.parse(storage.items['bioforge-lab-game-1-level-results'] || '{}');
check('the win is kept as the best result', kept['first-stroke'] && kept['first-stroke'].stars === firstStars,
  JSON.stringify(kept));
check('the result box offers Retry and Builder only (Next level was the same as Builder; user, 2026-10-30)',
  !byId('result-next').onclick && byId('result-retry').onclick && byId('result-builder').onclick);
byId('result-builder').onclick();
check('back in the builder from a level, the Body view is shown', byId('layer-body').classList.contains('selected') &&
  !byId('layer-nerve').classList.contains('selected'));
check('after the win, Run level points at level 2', byId('run-next-label').textContent === 'Run level 2' &&
  byId('run-next-name').textContent === 'Lighthouse', byId('run-next-label').textContent);
{
  // the user's bug (2026-11-05): the Lab stayed on level 1 after the win, its Light eye locked
  const eyeButton = dockButtonsOf({ byId }).find(button => button.dataset.type === 'lighteye');
  check('back in the Lab after a first win, the Lab builds for level 2: the Light eye open and marked new',
    /level 2: Lighthouse/.test(byId('show-levels').title) && !eyeButton.classList.contains('locked') &&
    eyeButton.classList.contains('new'), byId('show-levels').title);
}
runFrames(1);
check('and Lighthouse\'s briefing opens, with the Light eye new in the dock', isBriefingShown() &&
  byId('briefing-title').textContent === 'Lighthouse' && /<b>Light eye<\/b>/.test(briefedPieces()),
  briefedPieces());
byId('briefing-build').onclick();
check('Build closes it', !isBriefingShown());
byId('show-levels').onclick();
const rowsAfterWin = byId('levels-list').children.filter(child => child.className.startsWith('level-tile'));
check('the win opens level 2, and only level 2', !rowsAfterWin[1].className.includes('locked') &&
  rowsAfterWin[2].className.includes('locked'));
rowsAfterWin[1].onclick();
byId('level-build').onclick();
check('Builder goes back to the builder, and level 2 can be chosen from the sheet',
  byId('hud').style.display === 'none' && byId('level-card-title').innerHTML.includes('Lighthouse') &&
  byId('level-result').style.display === 'none' && byId('budget').innerHTML.includes('of 40'));
byId('level-leave').onclick();
check('leaving the level brings back the free-build limits', byId('budget').innerHTML.includes('of 50') &&
  !byId('show-levels').classList.contains('selected') && byId('level-leave').style.display === 'none');
byId('show-levels').onclick();
check('Run level is open while the design fits', !byId('level-run').disabled &&
  byId('level-run-note').textContent === '');
byId('levels-close').onclick();
byId('run-next-level').onclick();
check('Run level chooses the next unfinished level and runs the creature in it, from free build too',
  byId('level-bar').style.display === 'flex' && byId('hud').style.display === 'block' &&
  byId('level-buttons').style.display === 'none', byId('hud-mode').textContent);
runFrames(2);
check('the run is level 2', byId('hud-mode').textContent === '2. Lighthouse', byId('hud-mode').textContent);
byId('back-to-lab').onclick();
check('back in the Lab, Run level shows again and level 2 is chosen',
  byId('level-buttons').style.display === '' && byId('show-levels').classList.contains('selected'));
templateButton('eel').onclick();
byId('run-next-level').onclick();
check('Run level refuses a design that doesn\'t fit the level, and stays in the Lab',
  byId('hud').style.display === 'none' && /doesn't fit this level/.test(byId('message').textContent),
  byId('message').textContent);
byId('show-levels').onclick();
check('Run level is shut while the design does not fit the level, and says why', byId('level-run').disabled === true &&
  /doesn't fit: (Take out|Too much|Too many)/.test(byId('level-run-note').textContent),
  byId('level-run-note').textContent);
byId('levels-close').onclick();

// Reset level progress (Settings): asks first, then the stars go and the levels lock again
byId('setting-reset-levels').onclick();
check('Reset level progress asks first, in red', byId('dialog-sheet').style.display === 'flex' &&
  byId('dialog-box').classList.contains('dangerous'));
byId('dialog-confirm').onclick();
byId('show-levels').onclick();
const rowsAfterReset = byId('levels-list').children.filter(child => child.className.startsWith('level-tile'));
check('after it, no level has a result and level 2 is locked again',
  JSON.stringify(JSON.parse(storage.items['bioforge-lab-game-1-level-results'])) === '{}' &&
  rowsAfterReset[1].className.includes('locked') && !rowsAfterReset[0].className.includes('locked'));
check('after it, Run level points at level 1 again', byId('run-next-label').textContent === 'Run level 1');

// once the last level is won, every level's dock has everything
{
  const finished = startApp({ 'bioforge-lab-game-1-level-results': JSON.stringify({ [lastLevel.id]: { stars: 1,
    seconds: 1, biomass: 1 } }) });
  finished.runFrames(3);
  finished.byId('show-levels').onclick();
  finished.byId('levels-list').children.find(child => child.className.startsWith('level-tile')).onclick();
  finished.byId('level-build').onclick();
  check('after the last level is won, First stroke\'s dock has everything, nothing marked new',
    dockButtonsOf(finished).every(button => !button.classList.contains('locked') && !button.classList.contains('new')));
  // Reset level progress in Settings too: the results go, and the dock locks again
  finished.byId('setting-reset-levels').onclick();
  finished.byId('dialog-confirm').onclick();
  check('Reset level progress in Settings forgets the results, and First stroke\'s dock locks again',
    finished.storage.items['bioforge-lab-game-1-level-results'] === '{}' &&
    dockButtonsOf(finished).some(button => button.classList.contains('locked')),
    finished.storage.items['bioforge-lab-game-1-level-results']);
}

// Run level: a level skipped among won ones comes first, and once every level is won it stays on the last
{
  const resultsWithout = skippedId => JSON.stringify(Object.fromEntries(sim.LEVELS.filter(level => level.id !==
    skippedId).map(level => [level.id, { stars: 1, seconds: 1, biomass: 1 }])));
  // a save of the current version: an older one forgets its Packed lunch result (savegame.js, version 4)
  const CURRENT_SAVE = { 'bioforge-lab-save-version': '4',
    'bioforge-lab-games': JSON.stringify({ list: [{ id: 1, playedAt: 0 }], current: 1, nextId: 2 }) };
  const skipping = startApp({ ...CURRENT_SAVE,
    'bioforge-lab-game-1-level-results': resultsWithout(sim.LEVELS[2].id) });
  skipping.runFrames(3);
  check('Run level points at the first level not won, even with later ones won',
    skipping.byId('run-next-label').textContent === 'Run level 3', skipping.byId('run-next-label').textContent);
  const allWon = startApp({ ...CURRENT_SAVE, 'bioforge-lab-game-1-level-results': resultsWithout(null) });
  allWon.runFrames(3);
  check('once every level is won, Run level points at the last level',
    allWon.byId('run-next-label').textContent === `Run level ${sim.LEVELS.length}` &&
    allWon.byId('run-next-name').textContent === lastLevel.name, allWon.byId('run-next-label').textContent);
}
done();
