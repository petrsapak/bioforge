'use strict';
// The levels and the creatures that live in them (pure data). levels.js builds and runs them. Field meanings:
//   id, chapter, name; brief: what to do; hint: a nudge toward how
//   arena: { width, height } in px; systems: the switchable systems that run (chapters 1 and 2: nerve only, so
//     every cell works at full power and nothing starves; chapter 3 adds fluid and vascular; chapter 4 metabolism
//     and food; chapter 5 secretions; chapter 6 chemical, scent and treatments)
//   seepFactor: share of the usual seeping between cells and unpumped vessel flow (cold water: less); a Heart's
//     pumping is not slowed
//   limits: design limits ({ budget, maxCells, maxNeurons, maxFibreUnits, maxVesselUnits }); any left out come from
//   RULES. kit: { protein, sugar, fat, mineral } (data/materials.js) instead of a budget: the body's recipes must fit
//   it, and what is left is the creature's starting sugar, fat and mineral, in place of stores two thirds full
//   food: the food supply (createFoodSupply in food.js), where the food system runs
//   start: the player's spawn { x, y } in px and heading in rad (0 faces up)
//   light: null, or { range } plus where it is: { x, y } fixed, { path, speed } going round a loop of points (px)
//     at speed px/s, or { carriedBy } the index of the level creature it sits on. It shines all the time, unless
//     it has blink: { on, off } (game s on, then off, repeating from the start) or flash: { at, length } (once, at
//     that game s, for that long)
//   creatures: others in the arena: { design (a LEVEL_CREATURES or TEMPLATES name), x, y, heading, behaviour }.
//     behaviour 'wired': it moves only by its own wiring; 'hunt': the AI steers it at the player; at: game s it
//     arrives (left out: there from the start); anchored: fixed in place, nothing moves it
//   goal: { kind: 'reach', x, y, radius } swim the creature's centre into the ring;
//     { kind: 'stayNear', radius, seconds } stay that close to the light for that long in all;
//     { kind: 'eat', count } eat that many food specks;
//     { kind: 'restIn', x, y, radius, speed, seconds } stay in the ring, slower than speed (px/s), that long without
//     a break;
//     { kind: 'survive', seconds } keep the Nucleus alive that long;
//     { kind: 'kill', creature } destroy the Nucleus of that level creature (its index in creatures)
//   stillWhileLit: { speed, grace }: lost when the player swims faster than speed (px/s) while the light has been
//     on longer than grace (game s)
//   stillUntilLit: { speed }: lost when the player swims faster than speed (px/s) before the light's flash
//   timeLimit: game s; par: { seconds, biomass }: a win within each earns a star (a survive level's par seconds is its
//   time limit: every win earns that star)

const ARENA = { width: 1400, height: 800 };               // px
const CHAPTER_1_SYSTEMS = ['nerve'];
const CIRCULATION_SYSTEMS = ['nerve', 'fluid', 'vascular'];
const FEEDING_SYSTEMS = ['nerve', 'fluid', 'vascular', 'metabolism', 'food'];
const ARMOUR_SYSTEMS = [...FEEDING_SYSTEMS, 'secretions'];
const MOODS_SYSTEMS = [...ARMOUR_SYSTEMS, 'chemical', 'scent', 'treatments'];
const CHAPTER_NAMES = { 1: 'Reflexes', 2: 'Memory and logic', 3: 'Circulation', 4: 'Feeding', 5: 'Armour', 6: 'Moods' };
const WATCHER_LIGHT = { x: 700, y: 60, range: 2000 };     // px: above the top ring, bright all over the arena
const TOP_RING = { kind: 'reach', x: 700, y: 200, radius: 70 };   // px
const START_BOTTOM = { x: 700, y: 680, heading: 0 };      // px, rad: bottom middle, facing up
// Grazing's food: a trail of specks (px) winding from the bottom left to the top right, about 90 px apart
const FOOD_TRAIL = [[200, 600], [220, 510], [270, 430], [340, 370], [430, 340], [520, 350], [600, 400], [670, 460],
  [750, 500], [840, 500], [920, 460], [990, 400], [1050, 330], [1100, 250], [1130, 170]];
const DRIFTING_LIGHT = {                                  // round a loop of points (px) at 18 px/s
  path: [[700, 420], [1050, 250], [1100, 550], [350, 600], [300, 250]], speed: 18, range: 450,
};
// a clam fixed to the rock in the upper middle, with the light on it so Light eyes find it
const ANCHORED_CLAM = { design: 'clam', x: 700, y: 200, heading: 0, behaviour: 'wired', anchored: true };
const CLAM_LIGHT = { carriedBy: 0, range: 900 };          // px
// the Puffer hunting from the bottom right corner, arriving at a given game s
const pufferArriving = at => ({ design: 'puffer', x: 1250, y: 700, heading: 0, behaviour: 'hunt', at });

// a level: the definition over the defaults
function createLevel(definition) {
  return { arena: ARENA, systems: CHAPTER_1_SYSTEMS, seepFactor: 1, limits: {}, start: START_BOTTOM, light: null,
    creatures: [], hint: '', ...definition };
}

const LEVELS = [
  createLevel({
    id: 'first-stroke', chapter: 1, name: 'First stroke',
    brief: 'Swim into the ring ahead.',
    hint: 'A Pacemaker in the Nucleus, wired to two Siphons at the back, pulses them both: the Jet does this.',
    limits: { budget: 40 },
    goal: { kind: 'reach', x: 700, y: 220, radius: 70 },
    timeLimit: 40, par: { seconds: 12, biomass: 12 },
  }),
  createLevel({
    id: 'lighthouse', chapter: 1, name: 'Lighthouse',
    brief: 'Reach the light.',
    hint: 'Two Light eyes at the front, each wired across to the Siphon on the far side: the eye nearer the light ' +
      'drives the far Siphon harder, which turns you toward it.',
    limits: { budget: 40 },
    light: { x: 1100, y: 260, range: 650 },
    goal: { kind: 'reach', x: 1100, y: 260, radius: 60 },
    timeLimit: 45, par: { seconds: 25, biomass: 20 },
  }),
  createLevel({
    id: 'moth', chapter: 1, name: 'Moth',
    brief: 'The light drifts round the arena. Keep close to it: 15 s within the dashed ring in all.',
    hint: 'A creature that turns toward the light follows it as it moves. It has to keep up.',
    limits: { budget: 40 },
    light: DRIFTING_LIGHT,
    goal: { kind: 'stayNear', radius: 100, seconds: 15 },
    timeLimit: 60, par: { seconds: 30, biomass: 20 },
  }),
  createLevel({
    id: 'shade', chapter: 1, name: 'Shade',
    brief: 'The light is in your eyes. Turn away from it and swim to the dark ring.',
    hint: 'Wire each Light eye to the Siphon on its own side: the eye nearer the light drives that side harder, ' +
      'which turns you away from it. Eyes alone slow down once the light is behind them; a Pacemaker on the ' +
      'Siphons too keeps you going.',
    limits: { budget: 40 },
    start: { x: 700, y: 420, heading: 0 },
    light: { x: 620, y: 320, range: 800 },
    goal: { kind: 'reach', x: 1180, y: 170, radius: 80 },
    timeLimit: 45, par: { seconds: 22, biomass: 20 },
  }),
  createLevel({
    id: 'hunt', chapter: 1, name: 'Hunt',
    brief: 'The glowing Darter is prey: it jets away when you come close. Stay on its tail: 8 s within the ring ' +
      'round it, in all.',
    hint: 'Follow the light it carries. It only flees straight ahead, so it ends up against a wall, where you can ' +
      'catch up. A slow follower loses it; one that never slows down overshoots.',
    limits: { budget: 50 },
    light: { carriedBy: 0, range: 700 },
    creatures: [{ design: 'darter', x: 1050, y: 250, heading: 0, behaviour: 'wired' }],
    goal: { kind: 'stayNear', radius: 80, seconds: 8 },
    timeLimit: 60, par: { seconds: 30, biomass: 20 },
  }),
  createLevel({
    id: 'freeze', chapter: 2, name: 'Freeze',
    brief: 'Swim to the ring. The light above it watches: while it is on, hold still. Still moving a moment ' +
      'after it comes on loses.',
    hint: 'An Inhibitor is on while its input is off. Wire both Light eyes into an Inhibitor in the Nucleus, and ' +
      'the Nucleus to both Siphons: you swim in the dark and stop in the light. One eye alone sits on one side ' +
      'and turns you in circles.',
    limits: { budget: 40 },
    light: { ...WATCHER_LIGHT, blink: { on: 2, off: 3 } },
    stillWhileLit: { speed: 10, grace: 0.75 },
    goal: TOP_RING,
    timeLimit: 35, par: { seconds: 18, biomass: 20 },
  }),
  createLevel({
    id: 'false-start', chapter: 2, name: 'False start',
    brief: 'Hold still until the light flashes, then swim to the ring. It flashes only once.',
    hint: 'A Latch flips on at a pulse and stays on. Wire both Light eyes into a Latch in the Nucleus, and the ' +
      'Nucleus to both Siphons.',
    limits: { budget: 40 },
    light: { ...WATCHER_LIGHT, flash: { at: 4, length: 0.5 } },
    stillUntilLit: { speed: 10 },
    goal: TOP_RING,
    timeLimit: 30, par: { seconds: 16, biomass: 20 },
  }),
  createLevel({
    id: 'metronome', chapter: 2, name: 'Metronome',
    brief: 'Swim to the ring. The light comes on every 4 s, and this time you must already be still when it does: ' +
      'there is no moment to coast to a stop.',
    hint: 'The Freeze build stops too late. Give one Light eye a Delay neuron: its late copy of a flash comes back ' +
      'just before the next flash, and the Inhibitor stops you in time. Try a delay between 2.5 and 3 s; the ' +
      'longer, the more you swim. Keep the body even: one that turns stops seeing the light, and the Inhibitor ' +
      'lets it swim while the light is on.',
    limits: { budget: 40 },
    light: { ...WATCHER_LIGHT, blink: { on: 1.5, off: 2.5 } },
    stillWhileLit: { speed: 10, grace: 0.25 },
    goal: TOP_RING,
    timeLimit: 45, par: { seconds: 20, biomass: 20 },
  }),
  createLevel({
    id: 'dock', chapter: 2, name: 'Dock',
    brief: 'Swim toward the light, but stop short of it: come to rest in the ring for 2 s.',
    hint: 'The nearer the light, the brighter your eyes. A Synapse is on once its inputs add up to its threshold: ' +
      'wire both Light eyes into a Synapse, the Synapse into an Inhibitor in another cell, and that cell to both ' +
      'Siphons. Raise the threshold until you stop in the ring. Keep the body even, or it turns.',
    limits: { budget: 40 },
    light: { x: 700, y: 60, range: 900 },
    goal: { kind: 'restIn', x: 700, y: 200, radius: 70, speed: 10, seconds: 2 },
    timeLimit: 40, par: { seconds: 18, biomass: 20 },
  }),
  createLevel({
    id: 'long-haul', chapter: 3, name: 'Long haul',
    brief: 'The light drifts round the arena, as in Moth. Keep close to it for 150 s in all: longer than a bare ' +
      'body\'s O₂, sugar and room for waste last. Speed the run up with the speed button (,).',
    hint: 'Watch the O₂, Sugar and Waste bars. Fat stores sugar, a Gill makes O₂ from the water, and a Pore on ' +
      'the surface dumps waste. A Seeker with a Fat on each side and a Gill at the back lasts. Keep the body even, ' +
      'or it turns.',
    systems: CIRCULATION_SYSTEMS,
    limits: { budget: 45 },
    light: DRIFTING_LIGHT,
    goal: { kind: 'stayNear', radius: 100, seconds: 150 },
    timeLimit: 240, par: { seconds: 180, biomass: 20 },
  }),
  createLevel({
    id: 'exhaust', chapter: 3, name: 'Exhaust',
    brief: 'The light drifts faster now. Keep close to it for 120 s in all. Hard work makes waste, and waste that ' +
      'builds up poisons the cells that made it.',
    hint: 'A Pore on the surface dumps waste into the water. Put one at the back, touching both Siphons, so their ' +
      'waste seeps into it. A Fat and an Air sac on the sides carry the fuel.',
    systems: CIRCULATION_SYSTEMS,
    limits: { budget: 45 },
    light: { ...DRIFTING_LIGHT, speed: 24 },
    goal: { kind: 'stayNear', radius: 100, seconds: 120 },
    timeLimit: 240, par: { seconds: 190, biomass: 20 },
  }),
  createLevel({
    id: 'cold-water', chapter: 3, name: 'Cold water',
    brief: 'The same chase as Exhaust, in cold water: fluids barely seep from cell to cell (20x slower), and ' +
      'blood in a vessel barely moves on its own. Your Siphons burn through their own O₂ and sugar, and the ' +
      'stores and the Pore beside them can\'t keep up.',
    hint: 'The cold doesn\'t slow a beating Heart. Put a Heart at the front between the eyes, and in the Vessels ' +
      'view (3) lay a vessel from it to the Fat, the Air sac, each Siphon and the Pore. Blood flows from the ' +
      'stores through the Heart to the Siphons, and their waste flows on to the Pore.',
    systems: CIRCULATION_SYSTEMS,
    seepFactor: 0.05,
    limits: { budget: 45 },
    light: { ...DRIFTING_LIGHT, speed: 24 },
    goal: { kind: 'stayNear', radius: 100, seconds: 120 },
    timeLimit: 240, par: { seconds: 190, biomass: 25 },
  }),
  createLevel({
    id: 'marathon', chapter: 3, name: 'Marathon',
    brief: 'Cold water again, and the light drifts as slowly as in Long haul, but keep close to it for 200 s in ' +
      'all. That is longer than the Cold water build\'s O₂ and sugar last.',
    hint: 'Everything from this chapter at once. Two Fats on the sides for sugar, a Gill beside each Siphon for ' +
      'O₂, the Pore at the back for waste, and a Heart at the front with a vessel to each of them and to both ' +
      'Siphons. A Gill makes O₂ for every cell only if blood carries it away. Keep the body short and even, or ' +
      'it turns.',
    systems: CIRCULATION_SYSTEMS,
    seepFactor: 0.05,
    limits: { budget: 50 },
    light: DRIFTING_LIGHT,
    goal: { kind: 'stayNear', radius: 100, seconds: 200 },
    timeLimit: 300, par: { seconds: 280, biomass: 28 },
  }),
  createLevel({
    id: 'packed-lunch', chapter: 4, name: 'Packed lunch',
    brief: 'Long haul\'s chase, but you build from a kit of materials instead of a biomass budget, and what you ' +
      'don\'t use is all the fuel you get: there is no food. Keep close to the light for 150 s in all.',
    hint: 'Cells are built from Protein, and a Fat cell takes one Fat as well. Leftover Sugar spreads over the ' +
      'body, but leftover Fat goes only into Fat cells, which turn it back into sugar as they run low. Long haul\'s ' +
      'Seeker with one Fat, a Gill and a Pore carries enough.',
    systems: FEEDING_SYSTEMS,
    limits: { kit: { protein: 32, sugar: 4, fat: 7 } },
    food: { maxCount: 0 },
    light: DRIFTING_LIGHT,
    goal: { kind: 'stayNear', radius: 100, seconds: 150 },
    timeLimit: 240, par: { seconds: 200, biomass: 20 },
  }),
  createLevel({
    id: 'grazing', chapter: 4, name: 'Grazing',
    brief: 'A trail of food specks winds across the dark water. Eat 13 of them.',
    hint: 'Two Noses at the front, each wired across to the Siphon on the far side, follow the smell from speck ' +
      'to speck, as crossed Light eyes follow the light. Any cell touching a speck eats it while a Mouth has room, ' +
      'and a Mouth only makes room by passing what it ate on: put a Fat beside it.',
    systems: FEEDING_SYSTEMS,
    limits: { kit: { protein: 30, sugar: 3, fat: 2 } },
    start: { x: 200, y: 700, heading: 0 },
    food: { maxCount: 0, specks: FOOD_TRAIL },
    goal: { kind: 'eat', count: 13 },
    timeLimit: 100, par: { seconds: 75, biomass: 18 },
  }),
  createLevel({
    id: 'bloom', chapter: 4, name: 'Bloom',
    brief: 'Food grows near the drifting light for the first 80 s, then stops. Your kit holds almost no sugar, so ' +
      'eat while it lasts and keep close to the light for 180 s in all.',
    hint: 'Everything so far: crossed Light eyes to follow the light, a Mouth with a Fat beside it to eat and store ' +
      'the bloom, a Gill beside each Siphon for O₂ and a Pore at the back for waste. Keep the body even, or it ' +
      'turns.',
    systems: FEEDING_SYSTEMS,
    limits: { kit: { protein: 38, sugar: 2, fat: 3 } },
    food: { maxCount: 8, interval: 2, nearLight: 120, until: 80 },
    light: DRIFTING_LIGHT,
    goal: { kind: 'stayNear', radius: 100, seconds: 180 },
    timeLimit: 260, par: { seconds: 250, biomass: 24 },
  }),
  createLevel({
    id: 'bulwark', chapter: 5, name: 'Bulwark',
    brief: 'The Puffer hunts you, and you can\'t outswim it. Keep your Nucleus alive for 60 s.',
    hint: 'Shell takes half damage, and thorns barely scratch it. Wall the Nucleus in with Shell on all six sides. ' +
      'Shell and Thorns are built with mineral: the kit has just enough for a ring.',
    systems: ARMOUR_SYSTEMS,
    limits: { kit: { protein: 30, sugar: 4, mineral: 6 } },
    food: { maxCount: 0 },
    start: { x: 700, y: 400, heading: 0 },
    creatures: [{ design: 'puffer', x: 250, y: 150, heading: 2, behaviour: 'hunt' }],
    goal: { kind: 'survive', seconds: 60 },
    timeLimit: 70, par: { seconds: 70, biomass: 12 },
  }),
  createLevel({
    id: 'clam', chapter: 5, name: 'Clam',
    brief: 'A clam sits on the rock, its Nucleus behind two layers of Shell, and the light is on it. Destroy its ' +
      'Nucleus.',
    hint: 'Acid eats Shell fast but soft cells only slowly; protease digests soft cells but can\'t touch Shell. Put ' +
      'a row of glands across the front (acid, protease, acid), fired by an Eyespot, and let crossed Light eyes ' +
      'drive you into the clam. Keep the body even, or it turns.',
    systems: ARMOUR_SYSTEMS,
    limits: { kit: { protein: 30, sugar: 4, fat: 3 } },
    food: { maxCount: 0 },
    start: { x: 700, y: 550, heading: 0 },
    light: CLAM_LIGHT,
    creatures: [ANCHORED_CLAM],
    goal: { kind: 'kill', creature: 0 },
    timeLimit: 50, par: { seconds: 36, biomass: 28 },
  }),
  createLevel({
    id: 'anglerfish', chapter: 5, name: 'Anglerfish',
    brief: 'It is dark. A Seeker rests nearby: its Light eyes drive it to any light they see. Lure it in and ' +
      'destroy its Nucleus. You don\'t have to swim at all.',
    hint: 'A Photophore glows while signalled (an Inhibitor in it keeps it on). The Seeker swims to it head first, ' +
      'and its eyes go first: once they are digested it is blind and stops. So wrap protease glands round the ' +
      'light like a cup, on both sides and in front of each side, so its Nucleus is already touching them.',
    systems: ARMOUR_SYSTEMS,
    limits: { kit: { protein: 30, sugar: 4, fat: 2 } },
    food: { maxCount: 0 },
    start: { x: 450, y: 500, heading: 0 },
    creatures: [{ design: 'seeker', x: 720, y: 300, heading: 2.2, behaviour: 'wired' }],
    goal: { kind: 'kill', creature: 0 },
    timeLimit: 55, par: { seconds: 45, biomass: 18 },
  }),
  createLevel({
    id: 'quarry', chapter: 5, name: 'Quarry',
    brief: 'Grazing\'s trail again, but the specks are mineral, and at 30 s the Puffer comes for you. Your kit has ' +
      'no mineral: eat it, armour yourself and keep your Nucleus alive for 80 s.',
    hint: 'Grazing\'s Noses and Mouth follow the trail. Put a Mineralizer where the Fat was, with a Pacemaker in it: ' +
      'each mineral speck you eat lets it harden one cell, nearest first, until the whole body is armoured.',
    systems: ARMOUR_SYSTEMS,
    limits: { kit: { protein: 30, sugar: 6, fat: 2 } },
    food: { maxCount: 0, mineralSpecks: FOOD_TRAIL },
    start: { x: 200, y: 700, heading: 0 },
    creatures: [pufferArriving(30)],
    goal: { kind: 'survive', seconds: 80 },
    timeLimit: 90, par: { seconds: 90, biomass: 19 },
  }),
  createLevel({
    id: 'siege', chapter: 5, name: 'Siege',
    brief: 'The clam again, and at 50 s the Puffer. Your kit has no mineral, but the clam\'s Shell is made of it. ' +
      'Keep your Nucleus alive for 120 s.',
    hint: 'Everything from this chapter: acid at the front to break the Shell, a Mouth to eat the mineral that falls ' +
      'out, and a Mineralizer with a Pacemaker to harden your body before the Puffer arrives. Keep the body even, ' +
      'or it turns.',
    systems: ARMOUR_SYSTEMS,
    limits: { kit: { protein: 40, sugar: 6, fat: 2 } },
    food: { maxCount: 0 },
    start: { x: 700, y: 550, heading: 0 },
    light: CLAM_LIGHT,
    creatures: [ANCHORED_CLAM, pufferArriving(50)],
    goal: { kind: 'survive', seconds: 120 },
    timeLimit: 130, par: { seconds: 130, biomass: 34 },
  }),
  createLevel({
    id: 'fight-or-flight', chapter: 6, name: 'Fight or flight',
    brief: 'The ring is right across the water and the clock is short: two Siphons alone are too slow. Reach it ' +
      'in 26 s.',
    hint: 'Adrenaline makes working cells up to 80% stronger. Put an Adrenal behind the Siphons, touching both, and ' +
      'fire it with them, so it reaches both evenly. Fat beside the Siphons keeps them fed.',
    systems: MOODS_SYSTEMS,
    limits: { kit: { protein: 30, sugar: 16, fat: 2 } },
    food: { maxCount: 0 },
    start: { x: 100, y: 400, heading: Math.PI / 2 },
    goal: { kind: 'reach', x: 1300, y: 400, radius: 70 },
    timeLimit: 26, par: { seconds: 24, biomass: 20 },
  }),
  createLevel({
    id: 'lie-low', chapter: 6, name: 'Lie low',
    brief: 'Stay near the drifting light for 120 s in all, on the little sugar you start with. There is no food.',
    hint: 'Calm halves what a cell burns, and lasts. A Calm gland with an Inhibitor in it is always on and costs ' +
      'little: put it at the back between the Siphons, where the burning is.',
    systems: MOODS_SYSTEMS,
    limits: { kit: { protein: 30, sugar: 5, fat: 2 } },
    food: { maxCount: 0 },
    light: DRIFTING_LIGHT,
    goal: { kind: 'stayNear', radius: 100, seconds: 120 },
    timeLimit: 170, par: { seconds: 160, biomass: 22 },
  }),
  createLevel({
    id: 'feast-and-famine', chapter: 6, name: 'Feast and famine',
    brief: 'Food blooms round the drifting light for the first 40 s, then never again. Stay near the light for ' +
      '220 s in all.',
    hint: 'Starved halves what the body burns once the food is gone. Fed banks food fast while it lasts, but ' +
      'locks it away if it stays on; Starved cancels it. A Nose fires a Fed gland, and a Receptor for Fed with an ' +
      'Inhibitor in it fires a Starved gland when the Fed fades.',
    systems: MOODS_SYSTEMS,
    limits: { kit: { protein: 45, sugar: 2, fat: 2 } },
    food: { maxCount: 8, interval: 2, nearLight: 120, until: 40 },
    light: { ...DRIFTING_LIGHT, speed: 10 },
    goal: { kind: 'stayNear', radius: 100, seconds: 220 },
    timeLimit: 310, par: { seconds: 290, biomass: 37 },
  }),
  createLevel({
    id: 'tanned-hide', chapter: 6, name: 'Tanned hide',
    brief: 'The Puffer hunts you, and your kit has no mineral for Shell. Keep your Nucleus alive for 60 s.',
    hint: 'A Tanner crosslinks the cells round it: they take 60% less damage and blunt thorns like Shell. Ring ' +
      'the Nucleus with Tissue and make one of the ring a Tanner with an Inhibitor in it, so it is always on.',
    systems: MOODS_SYSTEMS,
    limits: { kit: { protein: 30, sugar: 4 } },
    food: { maxCount: 0 },
    start: { x: 700, y: 400, heading: 0 },
    creatures: [{ design: 'puffer', x: 250, y: 150, heading: 2, behaviour: 'hunt' }],
    goal: { kind: 'survive', seconds: 60 },
    timeLimit: 70, par: { seconds: 70, biomass: 14 },
  }),
  createLevel({
    id: 'snap', chapter: 6, name: 'Snap',
    brief: 'The clam again, its Nucleus behind two layers of Shell, with the light on it, and no mineral or acid ' +
      'needed: destroy its Nucleus in 50 s.',
    hint: 'A springy muscle held contracted, then let go, strikes everything touching it and the cells round it. ' +
      'Put a Muscle at the front with a slow Pacemaker in it (0.5 Hz: a second held, a second let go) and a ' +
      'Resilin gland beside it with an Inhibitor in it. Crossed Light eyes drive you into the clam.',
    systems: MOODS_SYSTEMS,
    limits: { kit: { protein: 30, sugar: 4, fat: 3 } },
    food: { maxCount: 0 },
    start: { x: 700, y: 550, heading: 0 },
    light: CLAM_LIGHT,
    creatures: [ANCHORED_CLAM],
    goal: { kind: 'kill', creature: 0 },
    timeLimit: 50, par: { seconds: 45, biomass: 24 },
  }),
  createLevel({
    id: 'lullaby', chapter: 6, name: 'Lullaby',
    brief: 'An urchin sits on the rock with the light on it. Its Nettles sting anything its Eyespot sees within ' +
      '120 px, and they would digest your glands before you digest it. Calm it down, then destroy its Nucleus.',
    hint: 'Hormones leak into the water (C shows them), and cells take in what is around them. Calm raises a ' +
      'Synapse\'s threshold, and the urchin\'s Eyespot has one. Wait out of its reach while Calm glands fill the ' +
      'water: a Receptor for Calm and a Light eye both into a Synapse in each Siphon swim only once you are calm. ' +
      'Protease across the front.',
    systems: MOODS_SYSTEMS,
    limits: { kit: { protein: 45, sugar: 8, fat: 2 } },
    food: { maxCount: 0 },
    start: { x: 700, y: 430, heading: 0 },
    light: { carriedBy: 0, range: 900 },
    creatures: [{ design: 'urchin', x: 700, y: 250, heading: 0, behaviour: 'wired', anchored: true }],
    goal: { kind: 'kill', creature: 0 },
    timeLimit: 90, par: { seconds: 50, biomass: 44 },
  }),
  createLevel({
    id: 'moods', chapter: 6, name: 'Moods',
    brief: 'Hold still until the light flashes, then swim to the ring. Your nerves are short: 3 units of fibre in ' +
      'all, not enough to reach from an eye to the Siphons.',
    hint: 'Send the flash as adrenaline: a Light eye into an Adrenal holding a Latch, so it stays on. A Receptor ' +
      'for adrenaline beside each Siphon turns it back into a nerve signal. Seeping is slow and uneven: a Heart ' +
      'with vessels from the Adrenal to both Receptors carries it to them evenly.',
    systems: MOODS_SYSTEMS,
    limits: { kit: { protein: 40, sugar: 8, fat: 2 }, maxFibreUnits: 3 },
    food: { maxCount: 0 },
    light: { ...WATCHER_LIGHT, flash: { at: 5, length: 0.5 } },
    stillUntilLit: { speed: 10 },
    goal: TOP_RING,
    timeLimit: 35, par: { seconds: 30, biomass: 30 },
  }),
];

// Creatures that live in levels. The Darter holds still until its Eyespot sees an enemy within reach (120 px), then
// jets straight ahead on both Siphons. The Clam is a Nucleus inside two rings of Shell, and does nothing.
const LEVEL_CREATURES = {
  darter: {
    cells: [
      createDesignCell(0, 0, 'nucleus'),
      createDesignCell(0, -1, 'eyespot'),
      createDesignCell(-1, 1, 'siphon'),
      createDesignCell(0, 1, 'siphon'),
    ],
    fibres: [{ from: { q: 0, r: -1 }, to: { q: -1, r: 1 } }, { from: { q: 0, r: -1 }, to: { q: 0, r: 1 } }],
  },
  // an urchin: its Eyespot (on the far side, away from the light's approach) holds a Synapse wired to four Nettles,
  // so Calm in the water, which raises the threshold, puts it to sleep
  urchin: {
    cells: [
      createDesignCell(0, 0, 'nucleus'),
      createDesignCell(0, -1, 'eyespot', { neuron: { kind: 'synapse', setting: 0.9 } }),
      createDesignCell(1, -1, 'nettle'),
      createDesignCell(1, 0, 'nettle'),
      createDesignCell(0, 1, 'gill'),
      createDesignCell(-1, 1, 'nettle'),
      createDesignCell(-1, 0, 'nettle'),
    ],
    fibres: [[1, -1], [1, 0], [-1, 1], [-1, 0]].map(([q, r]) => ({ from: { q: 0, r: -1 }, to: { q, r } })),
  },
  clam: designFromArt([
    '  S S S',
    ' S S S S',
    'S S N S S',
    ' S S S S',
    '  S S S',
  ]),
};
