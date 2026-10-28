'use strict';
// The levels and the creatures that live in them (pure data). levels.js builds and runs them. Field meanings:
//   id, chapter, name; brief: what to do; hint: a nudge toward how
//   arena: { width, height } in px; systems: the switchable systems that run (chapter 1: nerve only, so every
//     cell works at full power and nothing starves)
//   limits: design limits ({ budget, maxCells, maxNeurons, maxFibreUnits }); any left out come from RULES
//   start: the player's spawn { x, y } in px and heading in rad (0 faces up)
//   light: null, or { range } plus where it is: { x, y } fixed, { path, speed } going round a loop of points (px)
//     at speed px/s, or { carriedBy } the index of the level creature it sits on. It shines all the time, unless
//     it has blink: { on, off } (game s on, then off, repeating from the start) or flash: { at, length } (once, at
//     that game s, for that long)
//   creatures: others in the arena: { design (a LEVEL_CREATURES or TEMPLATES name), x, y, heading, behaviour }.
//     behaviour 'wired': it moves only by its own wiring; 'hunt': the AI steers it at the player
//   goal: { kind: 'reach', x, y, radius } swim the creature's centre into the ring;
//     { kind: 'stayNear', radius, seconds } stay that close to the light for that long in all
//   stillWhileLit: { speed, grace }: lost when the player swims faster than speed (px/s) while the light has been
//     on longer than grace (game s)
//   stillUntilLit: { speed }: lost when the player swims faster than speed (px/s) before the light's flash
//   timeLimit: game s; par: { seconds, biomass }: a win within each earns a star

const ARENA = { width: 1400, height: 800 };               // px
const CHAPTER_1_SYSTEMS = ['nerve'];
const CHAPTER_NAMES = { 1: 'Reflexes', 2: 'Memory and logic' };
const WATCHER_LIGHT = { x: 700, y: 60, range: 2000 };     // px: above the top ring, bright all over the arena
const TOP_RING = { kind: 'reach', x: 700, y: 200, radius: 70 };   // px
const START_BOTTOM = { x: 700, y: 680, heading: 0 };      // px, rad: bottom middle, facing up

function createLevel(definition) {
  return { arena: ARENA, systems: CHAPTER_1_SYSTEMS, limits: {}, start: START_BOTTOM, light: null, creatures: [],
    hint: '', ...definition };
}

const LEVELS = [
  createLevel({
    id: 'first-stroke', chapter: 1, name: 'First stroke',
    brief: 'Swim into the ring ahead.',
    hint: 'A Pacemaker in the Nucleus, wired to two Siphons at the back, pulses them both: the Jet does this.',
    limits: { budget: 30 },
    goal: { kind: 'reach', x: 700, y: 220, radius: 70 },
    timeLimit: 40, par: { seconds: 12, biomass: 12 },
  }),
  createLevel({
    id: 'lighthouse', chapter: 1, name: 'Lighthouse',
    brief: 'Reach the light.',
    hint: 'Two Light eyes at the front, each wired across to the Siphon on the far side: the eye nearer the light ' +
      'drives the far Siphon harder, which turns you toward it.',
    limits: { budget: 30 },
    light: { x: 1100, y: 260, range: 650 },
    goal: { kind: 'reach', x: 1100, y: 260, radius: 60 },
    timeLimit: 45, par: { seconds: 25, biomass: 20 },
  }),
  createLevel({
    id: 'moth', chapter: 1, name: 'Moth',
    brief: 'The light drifts round the arena. Keep close to it: 15 s within the dashed ring in all.',
    hint: 'A creature that turns toward the light follows it as it moves. It has to keep up.',
    limits: { budget: 30 },
    light: { path: [[700, 420], [1050, 250], [1100, 550], [350, 600], [300, 250]], speed: 18, range: 450 },
    goal: { kind: 'stayNear', radius: 100, seconds: 15 },
    timeLimit: 60, par: { seconds: 30, biomass: 20 },
  }),
  createLevel({
    id: 'shade', chapter: 1, name: 'Shade',
    brief: 'The light is in your eyes. Turn away from it and swim to the dark ring.',
    hint: 'Wire each Light eye to the Siphon on its own side: the eye nearer the light drives that side harder, ' +
      'which turns you away from it. Eyes alone slow down once the light is behind them; a Pacemaker on the ' +
      'Siphons too keeps you going.',
    limits: { budget: 30 },
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
    limits: { budget: 40 },
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
    limits: { budget: 30 },
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
    limits: { budget: 30 },
    light: { ...WATCHER_LIGHT, flash: { at: 4, length: 0.5 } },
    stillUntilLit: { speed: 10 },
    goal: TOP_RING,
    timeLimit: 30, par: { seconds: 16, biomass: 20 },
  }),
];

// Creatures that live in levels. The Darter holds still until its Eyespot sees an enemy within reach (120 px), then
// jets straight ahead on both Siphons.
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
};
