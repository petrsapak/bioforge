'use strict';
// The field guide's entries: every cell type, neuron, topic and glossary term, grouped into sections, and each
// cell's and neuron's facts read from the game's own data and tuning constants, so the guide's numbers are always
// the game's. The words are in data/guide.js; the sheet is guideview.js. Pure: no DOM.

const CELL_CATEGORY_ORDER = ['Body', 'Sense', 'Action', 'Fluid', 'Gland'];
const WORK_WHEN = {                                       // when a cell burns its fuel, by its `work` behaviour
  graded: 'as hard as its signal',
  onSignal: 'while signalled',
  snare: 'while signalled or holding a line',
  swimming: 'while the creature swims',
  always: 'all the time',
  refillRepair: 'until its repair fluid is nearly full',
  growPart: 'while its part is unfinished',
};

// one entry of the guide; id: 'cell:muscle', 'neuron:latch', 'topic:fuel' or 'term:Biomass'
function guideEntry(kind, key, name, chapter) {
  return { id: `${kind}:${key}`, kind, key, name, chapter };
}

// The guide's sections in order: [{ title, entries }]. Cells come by category, as the dock shows them.
function guideSections() {
  const cellEntries = category => Object.entries(CELLS)
    .filter(([, type]) => type.category === category)
    .map(([typeName, type]) => guideEntry('cell', typeName, type.name, pieceChapter(typeName)));
  return [
    ...CELL_CATEGORY_ORDER.map(category => ({ title: `Cells: ${category}`, entries: cellEntries(category) })),
    { title: 'Neurons', entries: Object.entries(NEURONS)
      .map(([kind, type]) => guideEntry('neuron', kind, type.name, pieceChapter(kind))) },
    { title: 'How it works', entries: GUIDE_TOPICS.map(topic => guideEntry('topic', topic.id, topic.title,
      topic.chapter)) },
    { title: 'Glossary', entries: [guideEntry('term', 'all', 'All terms', 1)] },
  ];
}

// the chapter of the level that brings a cell type or neuron kind; 1 for the Nucleus, which every creature has, and
// 0 for a piece no level brings
function pieceChapter(name) {
  if (CELLS[name] && CELLS[name].isNucleus) return 1;
  const level = levelBringing(name);
  return level ? level.chapter : 0;
}

// every entry, in section order
function guideEntries() {
  return guideSections().flatMap(section => section.entries);
}

// the entry with this id, or null
function findGuideEntry(id) {
  return guideEntries().find(entry => entry.id === id) || null;
}

// the name a cell type or neuron kind is shown by, or '' for neither
function guideName(name) {
  if (CELLS[name]) return CELLS[name].name;
  if (NEURONS[name]) return NEURONS[name].name;
  return '';
}

// whether pictures of this cell type or neuron should show the hormones: it makes one or senses one
function showsHormones(name) {
  const type = CELLS[name];
  return !!type && (type.product === 'hormone' || type.senses === 'hormone');
}

// the entry a related name points at: a cell type, a neuron kind, or a topic id
function relatedGuideEntry(name) {
  if (CELLS[name]) return findGuideEntry('cell:' + name);
  if (NEURONS[name]) return findGuideEntry('neuron:' + name);
  return findGuideEntry('topic:' + name);
}

// a number as the guide prints it: no trailing zeros, at most two decimals
function guideNumber(value) {
  return String(Math.round(value * 100) / 100);
}

// what a cell type is built from, as "2 Protein, 1 Mineral"
function recipeText(type) {
  return Object.entries(type.recipe)
    .filter(([, amount]) => amount > 0)
    .map(([materialId, amount]) => `${amount} ${MATERIALS_BY_ID[materialId].name}`)
    .join(', ');
}

// A cell type's cost, toughness and fuel as the guide draws them: its recipe as [{ name, color, amount }], and its
// health and burn (O₂ and sugar per s) each with its share of the most any cell type has.
function cellStats(typeName) {
  const type = CELLS[typeName];
  const types = Object.values(CELLS);
  const mostHealth = Math.max(...types.map(other => other.health));
  const mostBurn = Math.max(...types.map(other => other.fuelBurn || 0));
  const burn = type.fuelBurn || 0;
  return {
    recipe: Object.entries(type.recipe)
      .filter(([, amount]) => amount > 0)
      .map(([materialId, amount]) => ({ ...MATERIALS_BY_ID[materialId], amount })),
    health: { value: type.health, share: type.health / mostHealth },
    burn: { value: guideNumber(burn * FUEL_BURN_SCALE), share: burn / mostBurn, when: WORK_WHEN[type.work] || '' },
  };
}

// A cell type's facts as [label, value] rows: what it costs, how tough it is, what it burns and stores, and the
// numbers of what it does, read from its behaviours and the systems' constants.
function cellFacts(typeName) {
  const type = CELLS[typeName];
  const facts = [['Built from', recipeText(type) || 'nothing (it comes with every creature)'], ['Health', type.health]];
  if (type.recipe.mineral) facts.push(['Hard', 'yes: acid eats it, thorns and stings barely scratch it']);
  if (type.damageFactor !== 1) facts.push(['Damage taken', `${guideNumber(type.damageFactor * 100)}%`]);
  if (type.mass !== 1) facts.push(['Weight', `${guideNumber(type.mass)}× a plain cell`]);
  if (type.fuelBurn) {
    const perSecond = guideNumber(type.fuelBurn * FUEL_BURN_SCALE);
    facts.push(['Burns', `${perSecond} O₂ and ${perSecond} sugar per s, ${WORK_WHEN[type.work] || 'while working'}`]);
  } else {
    facts.push(['Burns', 'nothing: it only passes O₂ and sugar on']);
  }
  if (type.needsSignal) facts.push(['Needs', 'a nerve signal']);
  if (type.isWeapon) facts.push(['Weapon', 'hurts other creatures']);
  facts.push(...behaviourFacts(type));
  return facts.map(([label, value]) => [label, String(value)]);
}

// the numbers of what a cell type does, by its behaviour fields (data/cells.js)
function behaviourFacts(type) {
  const facts = [];
  const senses = {
    enemy: `an enemy cell within ${EYESPOT_RANGE} px`,
    light: `the level's light within its reach, or another creature's Photophore within ${PHOTOPHORE_RANGE} px`,
    food: `the nearest food speck within ${NOSE_RANGE} px`,
    hormone: 'how full of its hormone its own cell is',
  };
  if (type.senses) facts.push(['Senses', senses[type.senses]]);
  if (type.glows) facts.push(['Light', `reaches ${PHOTOPHORE_RANGE} px`]);
  if (type.trigger === 'nettle') {
    facts.push(['Sting', `${NETTLE_DAMAGE} to every enemy cell within ${NETTLE_RANGE} px, every ${NETTLE_COOLDOWN} s`]);
  }
  if (type.trigger === 'snare') facts.push(['Line', `reaches ${SNARE_LENGTH} px, holds ${SNARE_HOLD_TIME} s`]);
  if (type.trigger === 'spit') {
    facts.push(['Glob', `${SPIT_DAMAGE} damage, up to ${SPIT_RANGE} px, one every ${SPIT_COOLDOWN} s`]);
  }
  if (type.spiked) facts.push(['Hit', `${THORN_DAMAGE}, plus ${THORN_SPEED_DAMAGE} per px/s of the hit's speed`]);
  if (type.secretes === 'acid') {
    facts.push(['Dissolves', `${ACID_HARD_DAMAGE} health per s from hard cells, ${ACID_SOFT_DAMAGE} from soft ones`]);
  }
  if (type.secretes === 'protease') {
    facts.push(['Digests', `${PROTEASE_DAMAGE} health per s from soft cells, into sugar`]);
  }
  if (type.mineralizes) {
    facts.push(['Hardens', `one cell every ${MINERALIZE_TIME} s within ${MINERALIZE_REACH} hexes, for 1 mineral ` +
      `(stores ${MINERALIZER_CAPACITY})`]);
  }
  if (type.treats === 'tan') {
    facts.push(['Tans', `one cell every ${TREAT_TIME} s within ${TREAT_REACH} hexes: it then takes ` +
      `${guideNumber(TANNED_DAMAGE_FACTOR * 100)}% damage`]);
  }
  if (type.treats === 'resilin') {
    facts.push(['Springs', `one muscle every ${TREAT_TIME} s within ${TREAT_REACH} hexes: a full snap does ` +
      `${RESILIN_STRIKE_DAMAGE} damage`]);
  }
  if (type.product === 'hormone') facts.push(['Makes', FLUIDS[fluidIndex(type.hormone)].name]);
  if (type.breathes) facts.push(['Makes', `${GILL_OXYGEN_RATE} O₂ per s, more while swimming fast`]);
  if (type.dumpsWaste) facts.push(['Dumps', `${PORE_RATE} waste per s, from the surface`]);
  if (type.fatCapacity) facts.push(['Stores', `${type.fatCapacity} fat`]);
  if (type.mineralCapacity) facts.push(['Stores', `${type.mineralCapacity} mineral`]);
  if (type.oxygenCapacity > 1) {
    facts.push(['Holds', `${guideNumber(type.oxygenCapacity)}× the O₂ of a working cell`]);
  }
  if (type.sugarCapacity > 1) {
    facts.push(['Holds', `${guideNumber(type.sugarCapacity)}× the sugar of a working cell`]);
  }
  return facts;
}

// a neuron's facts: its setting's range, and whether it reads its inputs
function neuronFacts(kind) {
  const type = NEURONS[kind];
  const facts = [['Inputs', type.ignoresInputs ? 'none: it makes its own signal' : 'the sum of its fibres']];
  const setting = type.setting;
  if (setting) {
    const unit = setting.unit ? ' ' + setting.unit : '';
    facts.push([setting.name, `${setting.min}–${setting.max}${unit}, in steps of ${setting.step} (new: ` +
      `${setting.start}${unit})`]);
  }
  return facts;
}

// an example's design cells: [q, r, typeName, neuronKind, setting], neuronKind and setting optional
function exampleCells(example) {
  return example.cells.map(([q, r, typeName, neuronKind, setting]) => {
    if (!neuronKind) return createDesignCell(q, r, typeName);
    const neuron = createNeuron(neuronKind);
    if (setting !== undefined) neuron.setting = setting;
    return createDesignCell(q, r, typeName, { neuron });
  });
}

// an example build from TIPS or NEURON_TIPS as a design, with its fibres ([fromQ, fromR, toQ, toR]) and a Bud's part
function exampleDesign(example) {
  const design = { cells: exampleCells(example), fibres: linksFromList(example.fibres || []) };
  if (example.budPart) {
    for (const cell of design.cells) if (CELLS[cell.typeName].growsParts) cell.budPart = example.budPart;
  }
  return design;
}

// ---------- Running an example ----------
// An example runs in open water of its own, with what its senses need: a light or a food speck ahead (moved on once
// the creature reaches it), an enemy that comes and goes, or the Space key pressed and let go (a Command). Its senses
// read the real thing, not Space, and the creature moves only by its own cells, as in a level, so a Light eye's
// example turns to the light. The view follows the creature (cameraX, cameraY).
const EXAMPLE_TANK_WIDTH = 288;                           // px of the view
const EXAMPLE_TANK_HEIGHT = 190;                          // px of the view
const EXAMPLE_WORLD_SIZE = 4000;                          // px: open water, far bigger than a demo swims
const EXAMPLE_CAMERA_EASE = 0.05;                         // share of the view's lag behind the creature closed per step
const EXAMPLE_CYCLE = 4;                                  // game s: an enemy or a key press is on for the second half
// where the light or speck goes, from the creature, in its own frame: px to its right and px ahead
const EXAMPLE_TARGET_OFFSETS = [[-80, 65], [80, 65]];
const EXAMPLE_TARGET_REACHED = 20;                        // px from the creature's centre: the target moves on
const EXAMPLE_ENEMY_GAP = 30;                             // px from the creature's front to the enemy
const EXAMPLE_ENEMY_TOUCHING_GAP = 34;                    // px: its nearest cell just within a gland's reach

// a running example: its world and creature, the enemy while it is there, the time (game s) and the view's middle
function createExampleRun(example) {
  const world = newTestTank(EXAMPLE_WORLD_SIZE, EXAMPLE_WORLD_SIZE);
  world.spaceFiresAllSources = false;
  const middle = EXAMPLE_WORLD_SIZE / 2;
  const creature = spawn(world, exampleDesign(example), middle, middle, 0, 0);
  creature.autonomous = true;                             // as in a level: only its own cells move and turn it
  for (const cell of creature.cells) {
    if (example.startsHurt && example.startsHurt.includes(cell.typeName)) cell.health = cell.maxHealth * 0.1;
  }
  const run = { example, world, creature, enemy: null, time: 0, targetCount: 0, cameraX: middle, cameraY: middle };
  placeExampleStimulus(run);
  return run;
}

// whether the example's enemy is there or its key held now: the second half of each cycle
function isExampleStimulusOn(run) {
  return run.time % EXAMPLE_CYCLE >= EXAMPLE_CYCLE / 2;
}

// Moves the example on by dt: its target moves on once reached, its enemy comes or goes, Space is held for a
// Command, and the view eases after the creature.
function stepExampleRun(run, dt) {
  run.time += dt;
  placeExampleStimulus(run);
  const isKeyHeld = run.example.stimulus === 'key' && isExampleStimulusOn(run);
  stepInPieces(run.world, dt, { swimX: 0, swimY: 0, ability: isKeyHeld, heldKeys: new Set() });
  if (!run.creature.alive) return;
  run.cameraX += (run.creature.centerX - run.cameraX) * EXAMPLE_CAMERA_EASE;
  run.cameraY += (run.creature.centerY - run.cameraY) * EXAMPLE_CAMERA_EASE;
}

// puts the example's light, speck or enemy where it is now
function placeExampleStimulus(run) {
  const stimulus = run.example.stimulus;
  if (stimulus === 'light' || stimulus === 'food') placeExampleTarget(run, stimulus);
  if (stimulus === 'enemy') placeExampleEnemy(run, isExampleStimulusOn(run));
}

// The light or speck: placed ahead of the creature, to one side, and placed again on the other side once the
// creature reaches it.
function placeExampleTarget(run, stimulus) {
  const target = stimulus === 'light' ? run.world.light : run.world.food[0];
  const { centerX, centerY } = run.creature;
  const isReached = target && distanceSquared(centerX, centerY, target.x, target.y) <
    EXAMPLE_TARGET_REACHED * EXAMPLE_TARGET_REACHED;
  if (target && !isReached) return;
  const [right, ahead] = EXAMPLE_TARGET_OFFSETS[run.targetCount % EXAMPLE_TARGET_OFFSETS.length];
  run.targetCount++;
  const [x, y] = pointInCreatureFrame(run.creature, right, ahead);
  if (stimulus === 'light') run.world.light = createLight(x, y);
  else run.world.food = [{ x, y }];
}

// the world point that lies right px to the creature's right and ahead px in front of its centre
function pointInCreatureFrame(creature, right, ahead) {
  const forwardX = sine(creature.heading);
  const forwardY = -cosine(creature.heading);
  const x = creature.centerX - forwardY * right + forwardX * ahead;
  const y = creature.centerY + forwardX * right + forwardY * ahead;
  return [x, y];
}

// Brings the example's enemy, three dummy cells, in just in front of the creature, or takes it away. A gland's
// example holds it anchored, touching the glands.
function placeExampleEnemy(run, isThere) {
  if (!isThere) {
    if (run.enemy) removeCreature(run.world, run.enemy);
    run.enemy = null;
    return;
  }
  if (run.enemy) return;
  const { example, creature } = run;
  const dummyType = example.dummyType || 'tissue';
  const dummyDesign = { cells: blueprintFromList([[0, 0, dummyType], [1, 0, dummyType], [0, 1, dummyType]]) };
  const forwardX = sine(creature.heading);
  const forwardY = -cosine(creature.heading);
  const front = Math.max(...creature.cells.map(cell =>
    (cell.x - creature.centerX) * forwardX + (cell.y - creature.centerY) * forwardY));
  const gap = example.dummyTouches ? EXAMPLE_ENEMY_TOUCHING_GAP : EXAMPLE_ENEMY_GAP;
  const [x, y] = pointInCreatureFrame(creature, 0, front + gap);
  run.enemy = spawn(run.world, dummyDesign, x, y, creature.heading, 1);
  run.enemy.aiControlled = false;
  run.enemy.anchored = !!example.dummyTouches;
}

// What an example wires to what, for the guide's wiring pictures: [{ from, to, link }], each end named by the
// neuron its cell holds, else its cell type; link is 'fibre', and each pair is listed once.
function exampleWiring(example) {
  const design = exampleDesign(example);
  const nameAt = new Map(design.cells.map(cell =>
    [hexKey(cell.q, cell.r), cell.neuron ? cell.neuron.kind : cell.typeName]));
  const pairs = [];
  const listed = new Set();
  const addPairs = (links, link) => {
    for (const { from, to } of links) {
      const pair = { from: nameAt.get(hexKey(from.q, from.r)), to: nameAt.get(hexKey(to.q, to.r)), link };
      const pairKey = `${pair.from}>${pair.to}>${link}`;
      if (!pair.from || !pair.to || listed.has(pairKey)) continue;
      listed.add(pairKey);
      pairs.push(pair);
    }
  };
  addPairs(design.fibres, 'fibre');
  return pairs;
}
