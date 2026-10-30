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
    .map(([typeName, type]) => guideEntry('cell', typeName, type.name, GUIDE_CELLS[typeName].chapter));
  return [
    ...CELL_CATEGORY_ORDER.map(category => ({ title: `Cells: ${category}`, entries: cellEntries(category) })),
    { title: 'Neurons', entries: Object.entries(NEURONS)
      .map(([kind, type]) => guideEntry('neuron', kind, type.name, GUIDE_NEURONS[kind].chapter)) },
    { title: 'How it works', entries: GUIDE_TOPICS.map(topic => guideEntry('topic', topic.id, topic.title,
      topic.chapter)) },
    { title: 'Glossary', entries: [guideEntry('term', 'all', 'All terms', 1)] },
  ];
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

// An example build from TIPS or NEURON_TIPS as a design. Examples are in the format from before the nerve layer,
// unless they list their own fibres as [fromQ, fromR, toQ, toR]; vessels are listed the same way.
function exampleDesign(example) {
  const cells = exampleCells(example);
  const fibres = example.fibres && linksFromList(example.fibres);
  const design = upgradeToNerveLayer(fibres ? { cells, fibres } : { cells });
  design.vessels = linksFromList(example.vessels || []);
  // after the upgrade: an old example lists its neurons as cell types (command, pacemaker) that CELLS no longer has
  if (example.budPart) {
    for (const cell of design.cells) if (CELLS[cell.typeName].growsParts) cell.budPart = example.budPart;
  }
  return design;
}

// What an example wires to what, for the guide's wiring pictures: [{ from, to, link }], each end named by the
// neuron its cell holds, else its cell type; link is 'fibre' or 'vessel', and each pair is listed once.
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
  addPairs(design.vessels, 'vessel');
  return pairs;
}
