'use strict';
// Levels: every level is beaten headless by a reference solution and not by the wrong tool, runs are the
// same every time, stars follow the par; then the app (fake DOM) picks a level, runs it to a win, keeps the result
// and moves on to the next level.
const { load } = require('./load');
const { startApp } = require('./dom');
const { check, done } = require('./check');
const { X: sim } = load({}, ['LEVELS', 'TEMPLATES', 'runLevel', 'levelScore', 'levelLimits', 'buildCheck',
  'createDesignCell', 'createNeuron', 'isLevelLightOn', 'isLevelOpen', 'isLevelEarned', 'RULES', 'FLUID_OXYGEN',
  'linksFromList']);

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
// Exhaust's body plumbed for cold water. heart: a Heart at the front between the eyes, with a vessel from it to the
// Fat, the Air sac, each Siphon and the Pore; no heart: vessels straight from the stores to the Siphons and the Pore.
const EXHAUST_BODY = seekerWithStores('pore');
const coldWaterBuild = withHeart => withHeart ?
  { cells: [...EXHAUST_BODY.cells, cell(1, -2, 'heart')], fibres: CROSSED,
    vessels: [fibre(1, -2, -1, 0), fibre(1, -2, 1, 0), fibre(1, -2, -1, 1), fibre(1, -2, 0, 1), fibre(1, -2, -1, 2)] } :
  { cells: EXHAUST_BODY.cells, fibres: CROSSED,
    vessels: [fibre(-1, 0, 0, 1), fibre(1, 0, -1, 1), fibre(-1, 0, -1, 1), fibre(1, 0, 0, 1), fibre(-1, 2, -1, 0)] };
// The Cold water build lasting longer: two Fats on the sides, a Gill beside each Siphon, and a vessel from the
// Heart to each Gill too. airSac: an Air sac on the right side instead of the second Fat; plumbed: false leaves the
// Gills off the vessels.
const marathonBuild = ({ airSac = false, plumbed = true } = {}) => {
  const coldWater = coldWaterBuild(true);
  const cells = coldWater.cells.map(bodyCell =>
    bodyCell.typeName === 'airsac' && !airSac ? cell(1, 0, 'fat') : bodyCell);
  const gillVessels = plumbed ? [fibre(1, -2, -2, 1), fibre(1, -2, 1, 1)] : [];
  return { cells: [...cells, cell(-2, 1, 'gill'), cell(1, 1, 'gill')], fibres: CROSSED,
    vessels: [...coldWater.vessels, ...gillVessels] };
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
  cell(1, 0, 'mouth'), cell(-1, 2, 'pore'), cell(-2, 1, 'gill'), cell(1, 1, 'gill'), cell(1, -2, fed ? 'nose' : 'tissue'),
  cell(-1, -1, starved ? 'starvedgland' : 'tissue'),
  cell(2, -1, starved ? 'receptor' : 'tissue',
    starved ? { neuron: sim.createNeuron('inhibitor'), sensedHormone: 'fed' } : {}),
  cell(-2, 0, fed ? 'fedgland' : 'tissue'), cell(2, 0, 'tissue')],
  fibres: [...CROSSED, ...(fed ? [fibre(1, -2, -2, 0)] : []), ...(starved ? [fibre(2, -1, -1, -1)] : [])] });
// Tanned hide: the Nucleus in a ring of Tissue, one of them a Tanner holding an Inhibitor if asked
const tannedRingBuild = withTanner => ({ cells: [cell(0, 0, 'nucleus'),
  ...[[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]].map(([q, r]) => (withTanner && q === 0 && r === 1
    ? cell(q, r, 'tanner', { neuron: sim.createNeuron('inhibitor') }) : cell(q, r, 'tissue')))] });
// Snap: the crossed Seeker with a Fat, and across the front this cell (a Resilin gland holds an Inhibitor), a Muscle
// with a 0.5 Hz Pacemaker in it, and Tissue
const snapBuild = leftTypeName => ({ cells: [cell(0, 0, 'nucleus'), ...eyesAndSiphons, cell(-1, 0, 'tissue'),
  cell(1, 0, 'fat'),
  cell(0, -2, leftTypeName, leftTypeName === 'resilin' ? { neuron: sim.createNeuron('inhibitor') } : {}),
  cell(1, -2, 'muscle', { neuron: { kind: 'pacemaker', setting: 0.5 } }), cell(2, -2, 'tissue')], fibres: CROSSED });
// Moods: a Light eye at the front middle into an Adrenal holding a Latch; a Fat each side; beside each Siphon this
// cell (a Receptor drives its Siphon); a Heart at the back with vessels from the Adrenal and to both side cells
const moodsBuild = (sideTypeName, withHeart = true) => ({ cells: [cell(0, 0, 'nucleus'), cell(1, -2, 'lighteye'),
  cell(0, -1, 'adrenal', { neuron: sim.createNeuron('latch') }), cell(1, -1, 'gill'), cell(-1, 0, 'fat'),
  cell(1, 0, 'fat'), cell(-1, 1, 'siphon'), cell(0, 1, 'siphon'), cell(-2, 1, sideTypeName), cell(1, 1, sideTypeName),
  ...(withHeart ? [cell(-1, 2, 'heart')] : [])],
  fibres: [fibre(1, -2, 0, -1), ...(sideTypeName === 'receptor' ? [fibre(-2, 1, -1, 1), fibre(1, 1, 0, 1)] : [])],
  vessels: withHeart ? sim.linksFromList([[0, -1, -1, 2], [-1, 2, -2, 1], [-1, 2, 1, 1]]) : [] });
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
  exhaust: EXHAUST_BODY,
  'cold-water': coldWaterBuild(true),
  marathon: marathonBuild(),
  'packed-lunch': lunchBuild('fat'),
  grazing: grazingBuild('fat'),
  bloom: bloomBuild('fat'),
  bulwark: ringBuild('shell'),
  clam: glandRowBuild(['acid', 'protease', 'acid']),
  quarry: quarryBuild('mineralizer'),
  siege: siegeBuild(),
  'fight-or-flight': sprinterBuild('adrenal'),
  'lie-low': calmSeekerBuild('calmgland'),
  'feast-and-famine': feastBuild(true, true),
  'tanned-hide': tannedRingBuild(true),
  snap: snapBuild('resilin'),
  moods: moodsBuild('receptor'),
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
  'cold-water': SOLUTIONS.exhaust,
  marathon: SOLUTIONS['cold-water'],
  'packed-lunch': lunchBuild('tissue'),
  grazing: { cells: [cell(0, 0, 'nucleus'), ...eyesAndSiphons, cell(-1, 0, 'mouth'), cell(1, 0, 'fat')],
    fibres: CROSSED },
  bloom: SOLUTIONS['packed-lunch'],
  bulwark: ringBuild('tissue'),
  clam: glandRowBuild(['acid', 'acid', 'acid']),
  quarry: quarryBuild('tissue'),
  siege: siegeBuild(['acid', 'acid', 'acid'], 'tissue'),
  'fight-or-flight': sprinterBuild('tissue'),
  'lie-low': calmSeekerBuild('tissue'),
  'feast-and-famine': feastBuild(false, false),
  'tanned-hide': tannedRingBuild(false),
  snap: snapBuild('tissue'),
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
const dockRuns = [1, 2].map(threshold => sim.runLevel(levelById('dock'), eyesThroughSynapse(threshold)));
check('"Dock": the Synapse\'s threshold matters: 1 stops short of the ring, 2 never stops',
  dockRuns.every(run => run.outcome === 'lost'), dockRuns.map(run => run.player.centerY.toFixed(0)).join());
const fatOnly = sim.runLevel(levelById('long-haul'), seekerWithFat(false));
check('"Long haul": Fat alone is not enough, it runs out of O2', fatOnly.outcome === 'lost' &&
  fatOnly.player.cells.every(playerCell => playerCell.fluids[sim.FLUID_OXYGEN] < 0.01), fatOnly.reason);
const tissueBack = sim.runLevel(levelById('exhaust'), seekerWithStores('tissue'));
check('"Exhaust": the same body with Tissue for the Pore loses its Siphons to waste', tissueBack.outcome === 'lost' &&
  tissueBack.player.cells.filter(playerCell => playerCell.type.jets).length < 2, tissueBack.reason);
const unpumped = sim.runLevel(levelById('cold-water'), coldWaterBuild(false));
check('"Cold water": the same vessels without a Heart lose', unpumped.outcome === 'lost',
  `${unpumped.reason} ${unpumped.goalTime.toFixed(0)} s near the light`);
const marathonRuns = [marathonBuild({ airSac: true }), marathonBuild({ plumbed: false })]
  .map(build => sim.runLevel(levelById('marathon'), build));
check('"Marathon": an Air sac for the second Fat runs out of sugar, and Gills off the vessels don\'t feed the Siphons',
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

// ---------- The app ----------
// with every level open (RULES.allLevelsOpen, for testing), a later level can be chosen and brings its kit
const allOpen = startApp([]);
allOpen.readGlobal('RULES.allLevelsOpen = true');
allOpen.runFrames(3);
allOpen.byId('show-levels').onclick();
const openTiles = allOpen.byId('levels-list').children.filter(child => child.className.startsWith('level-tile'));
const bloomTile = openTiles[sim.LEVELS.findIndex(level => level.id === 'bloom')];
bloomTile.onclick();
allOpen.byId('level-build').onclick();
check('with every level open, any level can be chosen, and the builder takes its limits',
  openTiles.every(tile => !tile.className.includes('locked')) && /Protein/.test(allOpen.byId('budget').innerHTML) &&
  /\/ 38/.test(allOpen.byId('budget').innerHTML), allOpen.byId('budget').innerHTML.slice(0, 200));

// the rest runs with levels opening in order, as a player will have them
const { byId, fire, runFrames, readGlobal, storage } = startApp([]);
readGlobal('RULES.allLevelsOpen = false');
runFrames(3);
check('no level is chosen at first', !byId('show-levels').classList.contains('selected'));
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
byId('show-levels').onclick();
check('while a level is chosen, the sheet offers to leave it',
  byId('level-leave').style.display === 'block' && /Leave “First stroke”/.test(byId('level-leave').textContent));

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
const kept = JSON.parse(storage.items['bioforge-lab-level-results'] || '{}');
check('the win is kept as the best result', kept['first-stroke'] && kept['first-stroke'].stars === 1,
  JSON.stringify(kept));
byId('result-next').onclick();
byId('show-levels').onclick();
const rowsAfterWin = byId('levels-list').children.filter(child => child.className.startsWith('level-tile'));
check('the win opens level 2, and only level 2', !rowsAfterWin[1].className.includes('locked') &&
  rowsAfterWin[2].className.includes('locked'));
check('Next level goes back to the builder with level 2 chosen, and the sheet shows it',
  byId('hud').style.display === 'none' && byId('level-card-title').innerHTML.includes('Lighthouse') &&
  byId('level-result').style.display === 'none' && byId('budget').innerHTML.includes('of 40'));
byId('level-leave').onclick();
check('leaving the level brings back the free-build limits', byId('budget').innerHTML.includes('of 50') &&
  !byId('show-levels').classList.contains('selected') && byId('level-leave').style.display === 'none');
byId('show-levels').onclick();
done();
