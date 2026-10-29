'use strict';
// Cell types (pure data). Field meanings:
//   category, name, health, color, description: what the builder shows
//   cost: biomass, all of it Protein; or recipe: the materials it is built from ({ protein, fat, mineral },
//     data/materials.js), and its cost is their sum. A recipe with mineral makes a hard cell (secretions.js)
//   mass; stiffness (angle springs); bondStrength (bond springs, the weaker cell of a pair counts);
//   swimPower (free swimming force); damageFactor (share of damage taken: 0.5 = half)
//   senses: what the cell feels, as a nerve signal its fibres carry: 'enemy' (an enemy cell is near, on or off) or
//     'light' (graded: how far the light lies on the cell's side of the body, fading with distance) or 'food' (the
//     same for the nearest food speck)
//   fuelBurn: O2 + sugar burned per second at full work (each unit burned becomes one unit of waste)
//   oxygenCapacity, sugarCapacity: how much the cell holds; fatCapacity: how much fat it stores (metabolism.js);
//   mineralCapacity: how much mineral it stores (a kit's leftover mineral and eaten mineral specks go there)
// Behaviours: what the cell does in each system. The systems read these, never the type's name.
//   isNucleus: the creature dies with it
//   work (fluid): how hard it works, which sets its fuel use: 'graded' (with its signal), 'onSignal' (fully while
//     signalled), 'snare' (signalled or holding a line), 'swimming' (while the creature swims), 'always',
//     'refillRepair' (until its repair fluid is nearly full), 'growPart' (while its Bud part is unfinished)
//   product (fluid): what its burned fuel turns into: 'repair', 'adrenaline' or 'budPart'
//   breathes: makes O2 from the water; dumpsWaste: dumps waste into the water from the surface
//   pumps: pumps the vessels it sits on (Heart); gatesFlow: lets fluid through only while signalled, both between
//     touching cells and along a vessel that runs through it (Valve)
//   eatsFood: takes in food specks; bites: bites cells it touches; spiked: damages enemy cells it hits
//   beats: pushes the creature forward, always (Cilia); jets: pushes the creature forward while signalled (Siphon)
//   resize: 'contract' or 'swell' with its signal; trigger: what a signal fires: 'nettle', 'snare' or 'spit'
//   growsParts: grows a saved part (Bud); rebuildsCells: regrows lost cells from repair fluid (Mender)
//   secretes (secretions.js): what it puts on touching enemy cells while signalled: 'acid' or 'protease';
//   mineralizes: while signalled, spends its stored mineral to harden its creature's cells near it
// Builder hints (design.js): needsSignal: does nothing without a nerve signal; isWeapon: can hurt other creatures;
//   storesSugar: a sugar reservoir (Fat); storesMineral: a mineral store
// Cells that burn no fuel are pipes: they pass O2 and sugar on to their neighbours but hold only a little.
const PIPE_CAPACITY = 0.3;

function cellType(definition) {
  const pipeOrStore = definition.fuelBurn ? 1 : PIPE_CAPACITY;
  const recipe = definition.recipe || { protein: definition.cost };
  return {
    mass: 1,
    stiffness: 1,
    bondStrength: 1,
    swimPower: 1,
    damageFactor: 1,
    fuelBurn: 0,
    oxygenCapacity: pipeOrStore,
    sugarCapacity: pipeOrStore,
    fatCapacity: 0,
    mineralCapacity: 0,
    ...definition,
    recipe,
    cost: Object.values(recipe).reduce((sum, amount) => sum + amount, 0),
  };
}

const CELLS = {
  nucleus: cellType({
    category: 'Body', name: 'Nucleus', cost: 0, health: 80, mass: 1.5, swimPower: 2, oxygenCapacity: 3,
    sugarCapacity: 3, color: '#e8c547', isNucleus: true,
    description: 'If it dies, the creature dies. Parts cut off from it float away and rot. Holds a small store of ' +
      'O₂ and sugar.',
  }),
  tissue: cellType({
    category: 'Body', name: 'Tissue', cost: 1, health: 30, color: '#7c8a6e',
    description: 'Cheap filler. Holds shape, and can hold a neuron like any cell.',
  }),
  shell: cellType({
    category: 'Body', name: 'Shell', recipe: { protein: 1, mineral: 1 }, health: 90, mass: 2, stiffness: 2,
    bondStrength: 2, swimPower: 0.5, damageFactor: 0.5, color: '#c9c2b0',
    description: 'Armour. Takes half damage, and thorns and nettle stings barely scratch it. Very stiff and ' +
      'heavy. Built with mineral, so acid eats it.',
  }),
  joint: cellType({
    category: 'Body', name: 'Joint', cost: 1, health: 25, mass: 0.8, stiffness: 0.03, bondStrength: 0.35,
    color: '#9fb58a',
    description: 'A soft hinge. The body bends here, so tails and tentacles flop.',
  }),
  cilia: cellType({
    category: 'Body', name: 'Cilia', cost: 2, health: 20, mass: 0.6, fuelBurn: 0.05, color: '#6ac9a0',
    work: 'swimming', beats: true,
    description: 'Beating hairs push the creature forward from where they sit, while fed O₂ and sugar. Cilia on ' +
      'one side turn it.',
  }),
  eyespot: cellType({
    category: 'Sense', name: 'Eyespot', cost: 3, health: 20, senses: 'enemy', color: '#4fd1c5',
    description: 'Signals while an enemy cell is near it. Lay fibres from it to the cells that should react.',
  }),
  lighteye: cellType({
    category: 'Sense', name: 'Light eye', cost: 3, health: 20, senses: 'light', color: '#f0c96a',
    description: 'Signals how far the light lies on its side of the body: strongest when the light is straight out ' +
      'from it, weakest when it is across the body, and fainter the farther the light is, until nothing past its ' +
      'reach. In the Sandbox the mouse is the light.',
  }),
  nose: cellType({
    category: 'Sense', name: 'Nose', cost: 3, health: 20, senses: 'food', color: '#c98ad8',
    description: 'Smells the nearest food speck: signals how far it lies on its side of the body, like a Light eye ' +
      `sees the light, and stronger the closer it is, up to ${NOSE_RANGE} px away.`,
  }),
  muscle: cellType({
    category: 'Action', name: 'Muscle', cost: 3, health: 30, mass: 1.2, stiffness: 0.05, fuelBurn: 0.1,
    color: '#d9544f', work: 'graded', resize: 'contract', needsSignal: true,
    description: 'Contracts to 30% size on a nerve signal, bending the body. A tail swept fast through the water ' +
      'pushes the creature along. Burns fuel.',
  }),
  bloater: cellType({
    category: 'Action', name: 'Bloater', cost: 3, health: 30, fuelBurn: 0.1, color: '#b77ee0',
    work: 'graded', resize: 'swell', needsSignal: true, isWeapon: true,
    description: 'Swells to 180% size on a nerve signal, shoving enemies away. Burns fuel.',
  }),
  siphon: cellType({
    category: 'Action', name: 'Siphon', cost: 4, health: 25, fuelBurn: 0.15, color: '#5fb8e8',
    work: 'graded', jets: true, needsSignal: true,
    description: 'Squirts water backwards on a nerve signal, pushing the creature forward. Thirsty.',
  }),
  nettle: cellType({
    category: 'Action', name: 'Nettle', cost: 5, health: 25, fuelBurn: 0.12, color: '#a7b8ff',
    work: 'onSignal', trigger: 'nettle', needsSignal: true, isWeapon: true,
    description: 'On a nerve signal, stings every enemy cell close to it. Burns fuel while signalled.',
  }),
  snare: cellType({
    category: 'Action', name: 'Snare', cost: 5, health: 30, fuelBurn: 0.1, color: '#b07a48',
    work: 'snare', trigger: 'snare', needsSignal: true, isWeapon: true,
    description: `On a nerve signal, shoots a sticky line up to ${SNARE_LENGTH} px at the nearest enemy. If it ` +
      `catches a cell, it reels that enemy in for ${SNARE_HOLD_TIME} s. Burns fuel while firing and holding.`,
  }),
  spitter: cellType({
    category: 'Action', name: 'Spitter', cost: 4, health: 25, fuelBurn: 0.12, color: '#c4ff5a',
    work: 'onSignal', trigger: 'spit', needsSignal: true, isWeapon: true,
    description: `While signalled, spits an acid glob every ${SPIT_COOLDOWN} s at the nearest enemy within ` +
      `${SPIT_RANGE} px (straight out if none). Burns fuel while signalled.`,
  }),
  thorn: cellType({
    category: 'Action', name: 'Thorn', recipe: { protein: 2, mineral: 1 }, health: 35, color: '#8fd16a', spiked: true,
    isWeapon: true,
    description: 'Damages enemy cells it hits. Faster hits hurt more. Needs no fuel. Built with mineral, so acid ' +
      'eats it.',
  }),
  bud: cellType({
    category: 'Action', name: 'Bud', cost: 4, health: 30, fuelBurn: 0.4, color: '#c8e07a',
    work: 'growPart', product: 'budPart', growsParts: true, needsSignal: true,
    description: 'Grows a saved part on its outer side from O₂ and sugar. A nerve signal shoots the finished ' +
      'part away from the body, then it grows a new one. The part has its own nerves and fluids: with a Pacemaker ' +
      'or Eyespot, Fat, Gills and working cells it moves and stings on its own until its fuel runs out, then ' +
      'rots.',
  }),
  gill: cellType({
    category: 'Fluid', name: 'Gill', cost: 2, health: 20, mass: 0.8, oxygenCapacity: 1, color: '#e07a8a',
    breathes: true,
    description: 'Makes O₂ from the water, more while swimming fast. Works anywhere in the body.',
  }),
  mouth: cellType({
    category: 'Fluid', name: 'Mouth', cost: 2, health: 35, sugarCapacity: 2, color: '#d98a6a',
    eatsFood: true, bites: true, isWeapon: true,
    description: 'Eats food specks that touch the body, and bites enemies and debris it touches, for sugar. ' +
      'Leaves food alone while full. Mineral specks go to a Mineralizer with room.',
  }),
  heart: cellType({
    category: 'Fluid', name: 'Heart', cost: 3, health: 30, fuelBurn: 0.04, color: '#b8243a', work: 'always',
    pumps: true,
    description: 'Pumps blood along every vessel it sits on (Vessels view): while fed, a vessel carries about ' +
      `${Math.round((VESSEL_IDLE_CONDUCTANCE + VESSEL_PUMP_CONDUCTANCE) / VESSEL_IDLE_CONDUCTANCE)}x more. ` +
      'Without vessels it does nothing. Burns a little fuel.',
  }),
  valve: cellType({
    category: 'Fluid', name: 'Valve', cost: 2, health: 25, color: '#7d97a8', gatesFlow: true,
    needsSignal: true,
    description: 'Lets no fluid through unless it gets a nerve signal, neither to its neighbours nor along a ' +
      'vessel that runs through it. Wall off a reservoir with Valves to release it on command.',
  }),
  airsac: cellType({
    category: 'Fluid', name: 'Air sac', cost: 2, health: 25, oxygenCapacity: 10, color: '#e8a0a8',
    description: 'Reservoir. Holds 10x the O₂ of a working cell.',
  }),
  fat: cellType({
    category: 'Fluid', name: 'Fat', recipe: { protein: 1, fat: 1 }, health: 30, mass: 1.3, sugarCapacity: 10,
    fatCapacity: FAT_CELL_CAPACITY, color: '#f0e0a0', storesSugar: true,
    description: 'Reservoir. Holds 10x the sugar of a working cell. Plain cells only pass sugar along, so this ' +
      `is where food ends up. Where metabolism runs, it also stores up to ${FAT_CELL_CAPACITY} fat: sugar it has ` +
      `no room for becomes fat, and when its sugar runs low each fat turns back into ${FAT_SUGAR_YIELD} sugar.`,
  }),
  pore: cellType({
    category: 'Fluid', name: 'Pore', cost: 2, health: 20, color: '#7a6a48', dumpsWaste: true,
    description: 'Dumps waste into the water. Must be on the surface. Working cells full of waste are poisoned.',
  }),
  mender: cellType({
    category: 'Gland', name: 'Mender', cost: 4, health: 25, fuelBurn: 0.12, color: '#58d858',
    work: 'refillRepair', product: 'repair', rebuildsCells: true,
    description: 'Turns O₂ and sugar into repair fluid. Damaged cells that receive it heal, and lost cells ' +
      'regrow one at a time, nearest the Mender first.',
  }),
  adrenal: cellType({
    category: 'Gland', name: 'Adrenal', cost: 3, health: 25, fuelBurn: 0.2, color: '#e04090',
    work: 'onSignal', product: 'adrenaline', needsSignal: true,
    description: 'On a nerve signal, turns sugar into adrenaline. Muscles, cilia, siphons, bloaters and nettles ' +
      'that receive it work up to 80% harder.',
  }),
  acid: cellType({
    category: 'Gland', name: 'Acid gland', cost: 3, health: 25, fuelBurn: 0.12, color: '#ff7a3c',
    work: 'onSignal', secretes: 'acid', needsSignal: true, isWeapon: true,
    description: 'On a nerve signal, dissolves the enemy cells it touches. It eats hard cells (Shell, Thorns, ' +
      'cells a Mineralizer hardened) fast, soft ones only slowly. Never hurts your own cells. Burns fuel while ' +
      'signalled.',
  }),
  protease: cellType({
    category: 'Gland', name: 'Protease gland', cost: 3, health: 25, fuelBurn: 0.12, sugarCapacity: 3,
    color: '#e8b04a', work: 'onSignal', secretes: 'protease', needsSignal: true, isWeapon: true,
    description: 'On a nerve signal, digests the soft enemy cells and debris it touches, and takes in sugar ' +
      'from them. It can\'t touch hard cells (Shell, Thorns, hardened cells). Never hurts your own cells. Burns ' +
      'fuel while signalled.',
  }),
  mineralizer: cellType({
    category: 'Gland', name: 'Mineralizer', cost: 3, health: 25, fuelBurn: 0.1, color: '#8fb0c8',
    mineralCapacity: MINERALIZER_CAPACITY, work: 'onSignal', mineralizes: true, needsSignal: true,
    storesMineral: true,
    description: `Stores up to ${MINERALIZER_CAPACITY} mineral: a kit's leftover mineral, and mineral specks a ` +
      `Mouth eats. On a nerve signal it spends one every ${MINERALIZE_TIME} s to harden its own cells, nearest ` +
      `first, up to ${MINERALIZE_REACH} cells away. A hardened cell takes half damage, but acid eats it.`,
  }),
};
