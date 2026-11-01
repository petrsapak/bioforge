'use strict';
// Levels: every level is beaten headless by a reference solution and not by the wrong tool, runs are the
// same every time, stars follow the par; then the app (fake DOM) picks a level, runs it to a win, keeps the result
// and moves on to the next level.
const { load } = require('./load');
const { startApp } = require('./dom');
const { check, done } = require('./check');
const { X: sim } = load({}, ['LEVELS', 'TEMPLATES', 'runLevel', 'levelScore', 'levelLimits', 'buildCheck',
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
// Exhaust's body with a Heart at the front between the eyes for cold water. heartBeat: what beats the Heart: an
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
// The Cold water build lasting longer: two Fats on the sides and a Gill beside each Siphon, and its Heart beating in
// pulses. airSac: an Air sac on the right side instead of the second Fat.
const marathonBuild = ({ airSac = false, heartBeat = 'pacemaker' } = {}) => {
  const coldWater = coldWaterBuild(heartBeat);
  const cells = coldWater.cells.map(bodyCell =>
    bodyCell.typeName === 'airsac' && !airSac ? cell(1, 0, 'fat') : bodyCell);
  return { cells: [...cells, cell(-2, 1, 'gill'), cell(1, 1, 'gill')], fibres: coldWater.fibres };
};
// Packed lunch: the crossed Seeker with this store on the left, a Gill on the right and a Pore at the back
const lunchBuild = storeTypeName => ({ cells: [cell(0, 0, 'nucleus'), ...eyesAndSiphons, cell(-1, 0, storeTypeName),
  cell(1, 0, 'gill'), cell(-1, 2, 'pore')], fibres: CROSSED });
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
// Fight or flight: Siphons driven by an always-on Inhibitor in the Nucleus, Fat beside them, Gills at the front, and
// at the back between the Siphons this cell (an Adrenal is fired with them)
const sprinterBuild = backTypeName => ({ cells: [cell(0, 0, 'nucleus', { neuron: sim.createNeuron('inhibitor') }),
  cell(-1, 1, 'siphon'), cell(0, 1, 'siphon'), cell(0, -1, 'gill'), cell(1, -1, 'gill'), cell(-1, 0, 'fat'),
  cell(1, 0, 'fat'), cell(-1, 2, backTypeName)],
  fibres: [fibre(0, 0, -1, 1), fibre(0, 0, 0, 1), ...(backTypeName === 'adrenal' ? [fibre(0, 0, -1, 2)] : [])] });
// Lie low: the crossed Seeker with Fat on both sides and this cell at the back (a Calm gland holds an Inhibitor)
const calmSeekerBuild = backTypeName => ({ cells: [cell(0, 0, 'nucleus'), ...eyesAndSiphons, cell(-1, 0, 'fat'),
  cell(1, 0, 'fat'),
  cell(-1, 2, backTypeName, backTypeName === 'calmgland' ? { neuron: sim.createNeuron('inhibitor') } : {})],
  fibres: CROSSED });
// Feast and famine: Bloom's body with a Nose at the front middle into a Fed gland beside the Fat, and a Receptor for
// Fed holding an Inhibitor into a Starved gland; Tissue where a gland is left out, so the body keeps its balance
const feastBuild = (fed, starved) => ({ cells: [cell(0, 0, 'nucleus'), ...eyesAndSiphons, cell(-1, 0, 'fat'),
  cell(1, 0, 'mouth'), cell(-1, 2, 'pore'), cell(-2, 1, 'gill'), cell(1, 1, 'gill'),
  cell(1, -2, fed ? 'nose' : 'tissue'), cell(-1, -1, starved ? 'starvedgland' : 'tissue'),
  cell(2, -1, starved ? 'receptor' : 'tissue',
    starved ? { neuron: sim.createNeuron('inhibitor'), sensedHormone: 'fed' } : {}),
  cell(-2, 0, fed ? 'fedgland' : 'tissue'), cell(2, 0, 'tissue')],
  fibres: [...CROSSED, ...(fed ? [fibre(1, -2, -2, 0)] : []), ...(starved ? [fibre(2, -1, -1, -1)] : [])] });
// Tanned hide: the Nucleus in a ring of Tissue, one of them a Tanner holding an Inhibitor if asked
const tannedRingBuild = withTanner => ({ cells: [cell(0, 0, 'nucleus'),
  ...[[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]].map(([q, r]) => (withTanner && q === 0 && r === 1
    ? cell(q, r, 'tanner', { neuron: sim.createNeuron('inhibitor') }) : cell(q, r, 'tissue')))] });
// Anglerfish: a lit cell (a Photophore, or Tissue) at the front, in a cup of four always-on protease glands
const lit = () => ({ neuron: sim.createNeuron('inhibitor') });
const cupBuild = lureTypeName => ({ cells: [cell(0, 0, 'nucleus'), cell(0, -1, lureTypeName, lit()),
  cell(-1, -1, 'protease', lit()), cell(1, -2, 'protease', lit()), cell(-1, 0, 'protease', lit()),
  cell(1, -1, 'protease', lit()), cell(1, 0, 'fat')] });
// Lullaby: protease across the front, Light eyes behind, Calm glands (or Tissue) at the sides, and a Receptor for
// Calm at the back; each Siphon holds a Synapse, so with isGated it swims only once a crossed eye and the Receptor
// add up to 1, that is once the body is calm
const lullabyBuild = (sideTypeName, isGated = true) => {
  const sideExtra = () => (sideTypeName === 'calmgland' ? lit() : {});
  const siphonExtra = isGated ? () => ({ neuron: { kind: 'synapse', setting: 1 } }) : () => ({});
  return { cells: [cell(0, 0, 'nucleus'), cell(0, -1, 'lighteye'), cell(1, -1, 'lighteye'),
    cell(-1, 1, 'siphon', siphonExtra()), cell(0, 1, 'siphon', siphonExtra()),
    ...[[0, -2], [1, -2], [-1, -1], [2, -2]].map(([q, r]) => cell(q, r, 'protease', lit())),
    ...[[-1, 0], [1, 0], [-2, 1], [1, 1]].map(([q, r]) => cell(q, r, sideTypeName, sideExtra())),
    cell(2, -1, 'fat'), cell(-1, 2, 'receptor', { sensedHormone: 'calm' })],
  fibres: [...CROSSED, fibre(-1, 2, -1, 1), fibre(-1, 2, 0, 1)] };
};
// Snap: the crossed Seeker with a Fat, and across the front this cell (a Resilin gland holds an Inhibitor), a Muscle
// with a 0.5 Hz Pacemaker in it, and Tissue
const snapBuild = leftTypeName => ({ cells: [cell(0, 0, 'nucleus'), ...eyesAndSiphons, cell(-1, 0, 'tissue'),
  cell(1, 0, 'fat'),
  cell(0, -2, leftTypeName, leftTypeName === 'resilin' ? { neuron: sim.createNeuron('inhibitor') } : {}),
  cell(1, -2, 'muscle', { neuron: { kind: 'pacemaker', setting: 0.5 } }), cell(2, -2, 'tissue')], fibres: CROSSED });
// Moods: a Light eye at the front middle into an Adrenal holding a Latch; a Fat each side; beside each Siphon this
// cell (a Receptor drives its Siphon); a Heart at the back, kept beating by an Inhibitor
const moodsBuild = (sideTypeName, withHeart = true) => ({ cells: [cell(0, 0, 'nucleus'), cell(1, -2, 'lighteye'),
  cell(0, -1, 'adrenal', { neuron: sim.createNeuron('latch') }), cell(1, -1, 'gill'), cell(-1, 0, 'fat'),
  cell(1, 0, 'fat'), cell(-1, 1, 'siphon'), cell(0, 1, 'siphon'), cell(-2, 1, sideTypeName), cell(1, 1, sideTypeName),
  ...(withHeart ? [cell(-1, 2, 'heart', { neuron: sim.createNeuron('inhibitor') })] : [])],
  fibres: [fibre(1, -2, 0, -1), ...(sideTypeName === 'receptor' ? [fibre(-2, 1, -1, 1), fibre(1, 1, 0, 1)] : [])] });
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
// Tail: the Paddler with Tissue for its Mouth, Pore, Gills and Heart (without the Heart's Inhibitor), which do
// nothing in chapter 2, so it uses only the cells the dock has by then
const FEEDING_CELLS = ['mouth', 'pore', 'gill', 'heart'];
const asTailCell = ({ neuron, ...bodyCell }) => {
  const keepsNeuron = neuron && bodyCell.typeName !== 'heart';
  const typeName = FEEDING_CELLS.includes(bodyCell.typeName) ? 'tissue' : bodyCell.typeName;
  return { ...bodyCell, typeName, ...(keepsNeuron ? { neuron } : {}) };
};
const tailFish = { cells: sim.TEMPLATES.paddler.cells.map(asTailCell), fibres: sim.TEMPLATES.paddler.fibres };
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
// Moth: both Light eyes into both Siphons, and a Pacemaker in the Nucleus into one Siphon (pacemakerSide 'left' or
// 'right'): the light drives it forward and the Pacemaker side keeps it turning, round the light
const mothBuild = (pacemakerSide = 'right') => ({ cells: [pacemakerNucleus(), ...eyesAndSiphons],
  fibres: [fibre(0, -1, -1, 1), fibre(0, -1, 0, 1), fibre(1, -1, -1, 1), fibre(1, -1, 0, 1),
    pacemakerSide === 'right' ? fibre(0, 0, 0, 1) : fibre(0, 0, -1, 1)] });
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
  moth: mothBuild(),
  shade: { cells: [pacemakerNucleus(), ...eyesAndSiphons],
    fibres: [...SAME_SIDE, fibre(0, 0, -1, 1), fibre(0, 0, 0, 1)] },
  hunt: huntBuild,
  freeze: eyesThroughNucleus('inhibitor'),
  'false-start': eyesThroughNucleus('latch'),
  metronome: eyesThroughNucleus('inhibitor', { kind: 'delay', setting: 3 }),
  dock: eyesThroughSynapse(1.5),
  tail: tailFish,
  crevice: creviceWormBuild(),
  'long-haul': seekerWithFat(true),
  exhaust: EXHAUST_BODY,
  'cold-water': coldWaterBuild(),
  marathon: marathonBuild(),
  'packed-lunch': lunchBuild('fat'),
  grazing: grazingBuild('fat'),
  bloom: bloomBuild('fat'),
  sting: stingBuild(),
  bulwark: ringBuild('shell'),
  pincushion: ringBuild('thorn'),
  clam: glandRowBuild(['acid', 'protease', 'acid']),
  anglerfish: cupBuild('photophore'),
  quarry: quarryBuild('mineralizer'),
  siege: siegeBuild(),
  spit: spitBuild,
  'fight-or-flight': sprinterBuild('adrenal'),
  'lie-low': calmSeekerBuild('calmgland'),
  'feast-and-famine': feastBuild(true, true),
  'tanned-hide': tannedRingBuild(true),
  snap: snapBuild('resilin'),
  lullaby: lullabyBuild('calmgland'),
  moods: moodsBuild('receptor'),
};
// the wrong tool for each level: it must not win
const WRONG_TOOLS = {
  lighthouse: sim.TEMPLATES.jet,
  moth: SOLUTIONS.lighthouse,
  shade: SOLUTIONS.lighthouse,
  hunt: SOLUTIONS.lighthouse,
  freeze: SOLUTIONS.lighthouse,
  'false-start': SOLUTIONS.freeze,
  metronome: SOLUTIONS.freeze,
  dock: SOLUTIONS.freeze,
  tail: wigglerWithoutInhibitor,
  crevice: sim.TEMPLATES.paddler,
  'long-haul': SOLUTIONS.lighthouse,
  exhaust: SOLUTIONS['long-haul'],
  'cold-water': SOLUTIONS.exhaust,
  marathon: SOLUTIONS['cold-water'],
  'packed-lunch': lunchBuild('tissue'),
  grazing: { cells: [cell(0, 0, 'nucleus'), ...eyesAndSiphons, cell(-1, 0, 'mouth'), cell(1, 0, 'fat')],
    fibres: CROSSED },
  bloom: SOLUTIONS['packed-lunch'],
  sting: stingBuild(false),
  bulwark: ringBuild('tissue'),
  pincushion: ringBuild('shell'),
  clam: glandRowBuild(['acid', 'acid', 'acid']),
  anglerfish: cupBuild('tissue'),
  quarry: quarryBuild('tissue'),
  siege: siegeBuild(['acid', 'acid', 'acid'], 'tissue'),
  spit: glandRowBuild(['acid', 'protease', 'acid']),
  'fight-or-flight': sprinterBuild('tissue'),
  'lie-low': calmSeekerBuild('tissue'),
  'feast-and-famine': feastBuild(false, false),
  'tanned-hide': tannedRingBuild(false),
  snap: snapBuild('tissue'),
  lullaby: lullabyBuild('tissue'),
  moods: moodsBuild('tissue'),
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
{
  const rushing = sim.runLevel(levelById('lullaby'), lullabyBuild('calmgland', false));
  check('"Lullaby": Calm glands alone lose, swimming in before the urchin is calm', rushing.outcome === 'lost',
    rushing.reason);
  const plainRow = { cells: [cell(0, 0, 'nucleus'), cell(0, -1, 'photophore', lit()), cell(0, -2, 'protease', lit()),
    cell(1, -2, 'protease', lit()), cell(-1, -1, 'protease', lit()), cell(1, -1, 'protease', lit()),
    cell(1, 0, 'fat')] };
  check('"Anglerfish": glands in front of the light, not round it, lose (the blind Seeker stops short)',
    sim.runLevel(levelById('anglerfish'), plainRow).outcome === 'lost');
}
const dockRuns = [1, 2].map(threshold => sim.runLevel(levelById('dock'), eyesThroughSynapse(threshold)));
check('"Dock": the Synapse\'s threshold matters: 1 stops short of the ring, 2 never stops',
  dockRuns.every(run => run.outcome === 'lost'), dockRuns.map(run => run.player.centerY.toFixed(0)).join());
check('"Lullaby" doesn\'t allow Spitters, which kill the urchin from out of reach without calming it',
  /Spitter/.test(sim.buildCheck(spitBuild, sim.levelLimits(levelById('lullaby')))));
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
const fatOnly =sim.runLevel(levelById('long-haul'), seekerWithFat(false));
check('"Long haul": Fat alone is not enough, it runs out of O2', fatOnly.outcome === 'lost' &&
  fatOnly.player.cells.every(playerCell => playerCell.fluids[sim.FLUID_OXYGEN] < 0.01), fatOnly.reason);
const tissueBack = sim.runLevel(levelById('exhaust'), seekerWithStores('tissue'));
check('"Exhaust": the same body with Tissue for the Pore loses its Siphons to waste', tissueBack.outcome === 'lost' &&
  tissueBack.player.cells.filter(playerCell => playerCell.type.jets).length < 2, tissueBack.reason);
// Cold water should have more than one way to win (user, 2026-10-30: "it seems like there's only one design that can
// finish the assigment")
const coldRuns = ['pacemaker', 'eyes']
  .map(heartBeat => sim.runLevel(levelById('cold-water'), coldWaterBuild(heartBeat)));
check('"Cold water": a Heart beating in pulses, or only while the eyes see the light, wins as well',
  coldRuns.every(run => run.outcome === 'won'),
  coldRuns.map(run => run.outcome + ' ' + run.time.toFixed(0)).join(', '));
// Moth and Hunt must each need something the Lighthouse build doesn't have (user, 2026-10-30: "moth can be finished
// with the same design as level 2 ... Level5 can be finished with the same design as levels 2,3")
const mothRuns = [mothBuild('left'), sim.TEMPLATES.jet, SOLUTIONS.shade]
  .map(build => sim.runLevel(levelById('moth'), build));
check('"Moth": circling the other way wins too; the Jet and the Shade build never circle the lamp',
  mothRuns[0].outcome === 'won' && mothRuns.slice(1).every(run => run.outcome === 'lost'),
  mothRuns.map(run => `${run.outcome} ${run.goalTime.toFixed(0)} s`).join(', '));
const mothSeeker = sim.runLevel(levelById('moth'), SOLUTIONS.lighthouse);
check('"Moth": the Lighthouse build flies into the light', /flew into the light/.test(mothSeeker.reason || ''),
  mothSeeker.reason);
const huntRuns = [huntCiliaBuild, sim.TEMPLATES.jet, SOLUTIONS.shade, SOLUTIONS.moth]
  .map(build => sim.runLevel(levelById('hunt'), build));
check('"Hunt": Cilia on the sides catch the Darter too; the Jet, the Shade and the Moth builds lose',
  huntRuns[0].outcome === 'won' && huntRuns.slice(1).every(run => run.outcome === 'lost'),
  huntRuns.map(run => `${run.outcome} ${run.time.toFixed(0)} s`).join(', '));
// Packed lunch was beaten by the Marathon build (user, 2026-10-30: "14 can be finished with the same vessel as 13")
const lunchProblem = sim.buildCheck(SOLUTIONS.marathon, sim.levelLimits(levelById('packed-lunch')));
check('"Packed lunch": the Marathon build doesn\'t fit its kit', /Not enough protein/.test(lunchProblem), lunchProblem);
const unbeating = sim.runLevel(levelById('cold-water'), coldWaterBuild('none'));
check('"Cold water": a Heart without a signal doesn\'t beat, and loses', unbeating.outcome === 'lost',
  `${unbeating.reason} ${unbeating.goalTime.toFixed(0)} s near the light`);
const marathonRuns = [marathonBuild({ heartBeat: 'inhibitor' }), marathonBuild({ airSac: true })]
  .map(build => sim.runLevel(levelById('marathon'), build));
check('"Marathon": a Heart that never stops beating runs the body dry, and so does an Air sac for the second Fat',
  marathonRuns.every(run => run.outcome === 'lost'),
  marathonRuns.map(run => `${run.reason} ${run.goalTime.toFixed(0)} s near the light`).join(', '));
const fullMouth = sim.runLevel(levelById('grazing'), grazingBuild('tissue'));
check('"Grazing": without a Fat beside the Mouth, the Mouth stays full and eats too little',
  fullMouth.outcome === 'lost' && fullMouth.player.foodEaten < 13, `ate ${fullMouth.player.foodEaten}`);
const noStore = sim.runLevel(levelById('bloom'), bloomBuild('tissue'));
check('"Bloom": with Tissue for the Fat, the bloom\'s food has nowhere to go', noStore.outcome === 'lost',
  `near the light ${noStore.goalTime.toFixed(0)} s, ate ${noStore.player.foodEaten}`);
const fedOnly = sim.runLevel(levelById('feast-and-famine'), feastBuild(true, false));
check('"Feast and famine": Fed left on loses: it locks the food away for the famine', fedOnly.outcome === 'lost',
  `near the light ${fedOnly.goalTime.toFixed(0)} s`);
const seeped = sim.runLevel(levelById('moods'), moodsBuild('receptor', false));
check('"Moods": Receptors without a Heart get the adrenaline unevenly and miss the ring', seeped.outcome === 'lost',
  seeped.reason);
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
const levelsMissingPieces = sim.LEVELS.filter(level => lockedPieceOf(level))
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
  check('Shade brings Cilia and Dock the Ganglion; no level brings the Command (a key the player holds)',
    sim.levelBringing('cilia') === levelById('shade') && sim.levelBringing('ganglion') === levelById('dock') &&
    sim.levelBringing('command') === null);
  check('a piece is met once the level that brings it is earned, or the last level is won',
    sim.isPieceMet({}, 'siphon') && !sim.isPieceMet({}, 'muscle') && sim.isPieceMet({}, 'command') &&
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
// the dock's buttons, shown or not
const dockButtonsOf = page => page.byId('palette').children.flatMap(section => section.children[0].children);
const isDockShown = (page, attribute, name) => dockButtonsOf(page)
  .find(button => button.dataset[attribute] === name).style.display !== 'none';
check('Bloom\'s dock has the cells of the levels before it, not the later ones',
  isDockShown(allOpen, 'type', 'mouth') && isDockShown(allOpen, 'type', 'heart') &&
  !isDockShown(allOpen, 'type', 'shell') && !isDockShown(allOpen, 'type', 'nettle'));
check('with every level open, any level can be chosen, and the builder takes its limits',
  openTiles.every(tile => !tile.className.includes('locked')) && /Protein/.test(allOpen.byId('budget').innerHTML) &&
  /\/ 38/.test(allOpen.byId('budget').innerHTML), allOpen.byId('budget').innerHTML.slice(0, 200));

// the rest runs with levels opening in order, as a player will have them
const { byId, fire, runFrames, readGlobal, storage, templateButton } = startApp();
readGlobal('RULES.allLevelsOpen = false');
runFrames(3);
check('no level is chosen at first', !byId('show-levels').classList.contains('selected'));
check('in free build the dock has every cell and neuron',
  dockButtonsOf({ byId }).every(button => button.style.display !== 'none'));
byId('show-levels').onclick();
const listed = byId('levels-list').children;
const rows = listed.filter(child => child.className.startsWith('level-tile'));
const headings = listed.filter(child => child.className === 'chapter-heading');
check('the levels sheet lists every level under its chapter', byId('levels-sheet').style.display === 'flex' &&
  rows.length === readGlobal('LEVELS.length') && headings.length === 6 &&
  headings[5].textContent === 'Chapter 6: Moods', `${rows.length} rows, ${headings.length} headings`);
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
check('First stroke\'s Needs card has no Oxygen, Sugar, Waste or Blood rows, nor how long the sugar lasts',
  byId('needs').innerHTML.includes('Signal') && !/Oxygen|Sugar|Waste|Blood/.test(byId('needs').innerHTML),
  byId('needs').innerHTML.slice(0, 300));
{
  const page = { byId };
  const siphonButton = dockButtonsOf(page).find(button => button.dataset.type === 'siphon');
  // its category's section, opened for it although the player had only the first one open
  const siphonSection = byId('palette').children.find(section => section.children[0].children.includes(siphonButton));
  const categoryTabs = byId('dock-tabs').children.filter(tab => tab.style.display !== 'none');
  check('First stroke\'s dock has only Tissue, Siphons and the Pacemaker, its own ones marked new',
    isDockShown(page, 'type', 'tissue') && siphonButton.style.display !== 'none' &&
    siphonButton.classList.contains('new') && siphonSection.style.display !== 'none' &&
    !isDockShown(page, 'type', 'lighteye') &&
    isDockShown(page, 'neuron', 'pacemaker') && !isDockShown(page, 'neuron', 'synapse'),
    dockButtonsOf(page).filter(button => button.style.display !== 'none').map(button => button.dataset.type ||
      button.dataset.neuron).join(','));
  check('the tabs of empty categories are hidden', categoryTabs.length === 2,
    categoryTabs.map(tab => tab.textContent).join(','));
}
byId('show-levels').onclick();
check('while a level is chosen, the sheet offers to leave it',
  byId('level-leave').style.display === 'block' && /Leave “First stroke”/.test(byId('level-leave').textContent));

byId('layer-nerve').onclick();        // left in the Nerve view: the builder comes back in Body
byId('level-run').onclick();          // the starting design is the Jet
check('Run level closes the sheet and starts the level with its bar and HUD',
  byId('levels-sheet').style.display === 'none' && byId('level-bar').style.display === 'flex' &&
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
const kept = JSON.parse(storage.items['bioforge-lab-profile-1-level-results'] || '{}');
check('the win is kept as the best result', kept['first-stroke'] && kept['first-stroke'].stars === 1,
  JSON.stringify(kept));
check('the result box offers Retry and Builder only (Next level was the same as Builder; user, 2026-10-30)',
  !byId('result-next').onclick && byId('result-retry').onclick && byId('result-builder').onclick);
byId('result-builder').onclick();
check('back in the builder from a level, the Body view is shown', byId('layer-body').classList.contains('selected') &&
  !byId('layer-nerve').classList.contains('selected'));
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
templateButton('eel').onclick();
byId('show-levels').onclick();
check('Run level is shut while the design does not fit the level, and says why', byId('level-run').disabled === true &&
  /doesn't fit: (Over budget|Too many)/.test(byId('level-run-note').textContent), byId('level-run-note').textContent);
byId('levels-close').onclick();

// Reset level progress (main menu > Profile): asks first, then the stars go and the levels lock again
byId('profile-reset-levels').onclick();
check('Reset level progress asks first, in red', byId('dialog-sheet').style.display === 'flex' &&
  byId('dialog-box').classList.contains('dangerous'));
byId('dialog-confirm').onclick();
byId('show-levels').onclick();
const rowsAfterReset = byId('levels-list').children.filter(child => child.className.startsWith('level-tile'));
check('after it, no level has a result and level 2 is locked again',
  JSON.stringify(JSON.parse(storage.items['bioforge-lab-profile-1-level-results'])) === '{}' &&
  rowsAfterReset[1].className.includes('locked') && !rowsAfterReset[0].className.includes('locked'));

// once the last level is won, every level's dock has everything
{
  const finished = startApp({ 'bioforge-lab-profile-1-level-results': JSON.stringify({ [lastLevel.id]: { stars: 1,
    seconds: 1, biomass: 1 } }) });
  finished.runFrames(3);
  finished.byId('show-levels').onclick();
  finished.byId('levels-list').children.find(child => child.className.startsWith('level-tile')).onclick();
  finished.byId('level-build').onclick();
  check('after the last level is won, First stroke\'s dock has everything, nothing marked new',
    dockButtonsOf(finished).every(button => button.style.display !== 'none' && !button.classList.contains('new')));
  // Reset level progress in Settings too: the results go, and the dock locks again
  finished.byId('setting-reset-levels').onclick();
  finished.byId('dialog-confirm').onclick();
  check('Reset level progress in Settings forgets the results, and First stroke\'s dock locks again',
    finished.storage.items['bioforge-lab-profile-1-level-results'] === '{}' &&
    dockButtonsOf(finished).some(button => button.style.display === 'none'),
    finished.storage.items['bioforge-lab-profile-1-level-results']);
}
done();
