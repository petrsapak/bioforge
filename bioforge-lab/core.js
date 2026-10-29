'use strict';
// Simulation core: shared constants and math, the hex grid, the world, creatures and cells, the system list and step().
// Pure: no DOM, runs in the browser and in Node.

// ---------- Geometry ----------
const CELL_RADIUS = 10;                                   // px
const HEX_SPACING_X = 2 * CELL_RADIUS;                    // px between hex centres along a row
const HEX_SPACING_Y = CELL_RADIUS * Math.sqrt(3);         // px between rows
const GRID_RADIUS = 30;                                   // builder grid radius, in hexes
const TAU = Math.PI * 2;
// the six neighbours of a hex, as axial offsets [q, r]
const HEX_NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];
// one offset per neighbour pair, so every pair of touching cells is visited once
const HEX_FORWARD_NEIGHBOURS = [[1, 0], [0, 1], [-1, 1]];
const MIN_DISTANCE = 1e-6;                                // px, stands in for zero lengths to avoid dividing by zero

const HIT_FLASH_TIME = 0.12;                              // s a hit cell flashes white

// ---------- Math and hex helpers ----------
const hexKey = (q, r) => q + ',' + r;
const hexToPixel = (q, r) => [HEX_SPACING_X * (q + r / 2), HEX_SPACING_Y * r];
// Math.hypot is several times slower
const vectorLength = (x, y) => Math.sqrt(x * x + y * y);
const clamp01 = value => Math.max(0, Math.min(1, value));
const square = value => value * value;
const distanceSquared = (firstX, firstY, secondX, secondY) => square(secondX - firstX) + square(secondY - firstY);
// angle wrapped into [-π, π)
const wrapAngle = angle => ((angle + Math.PI) % TAU + TAU) % TAU - Math.PI;
const hexDistance = (first, second) =>
  (Math.abs(first.q - second.q) + Math.abs(first.r - second.r) + Math.abs(first.q + first.r - second.q - second.r)) / 2;
const areHexNeighbours = (first, second) => hexDistance(first, second) === 1;

// the hex (q, r) turned by steps of 60° clockwise around the origin
function rotateHex(q, r, steps) {
  const turns = (steps % 6 + 6) % 6;
  for (let i = 0; i < turns; i++) [q, r] = [-r, q + r];
  return [q, r];
}

// ---------- World ----------
const TEST_TANK_FEED_RATE = 0.15;                         // sugar per second the test tank's water gives a Mouth
const DEFAULT_SEED = 1;
const LIGHT_RANGE = 450;                                  // px a light reaches; Light eyes beyond it see nothing

// a light that Light eyes see (nerve.js): where it is, and how far it reaches (px)
function createLight(x, y, range = LIGHT_RANGE) {
  return { x, y, range };
}

// options: systems (the switchable systems that run, default RULES.systems), seed (the random generator's start),
// and any world field below to override
function newWorld(width, height, options = {}) {
  const { systems = RULES.systems, seed = DEFAULT_SEED, ...overrides } = options;
  return {


    width,
    height,
    time: 0,
    cells: [],
    creatures: [],
    bonds: [],                                            // springs between touching cells
    angleSprings: [],                                     // keep chains of cells from folding
    fluidLinks: [],                                       // fluids move only along these, one per touching pair
    fibres: [],                                           // nerve fibres (fibres.js); signals travel only along these
    vessels: [],                                          // blood vessels (vascular.js)
    globs: [],
    zaps: [],
    sparks: [],
    food: [],
    foodTimer: 0,
    foodSupply: createFoodSupply(),                       // food.js: how much food there is and where it appears
    flowTimer: 0,
    randomState: seed | 0,                                // the seeded random generator; see randomFraction()
    waterFeedRate: 0,                                     // sugar per second Mouths take straight from the water
    seepFactor: 1,                                        // share of the usual seeping and unpumped vessel flow
    spaceFiresAllSources: false,                          // Space fires every signal source, to try a design out
    enemiesIdle: false,                                   // sandbox: enemies hold still
    light: null,                                          // createLight(): what Light eyes see (sandbox: the mouse)
    systems: new Set(systems),
    ...overrides,
  };
}

// The world's next random number in [0, 1). The sim uses only this, never Math.random, so that the same seed always
// gives the same run.
function randomFraction(world) {
  const [nextState, fraction] = nextRandom(world.randomState);
  world.randomState = nextState;
  return fraction;
}

// The builder preview and the tooltip demos: no food specks, so the water feeds Mouths instead, and Space fires
// every signal source so the design can be tried out.
function newTestTank(width, height) {
  return newWorld(width, height, {
    systems: RULES.systems.filter(name => name !== 'food'),
    waterFeedRate: TEST_TANK_FEED_RATE,
    spaceFiresAllSources: true,
  });
}

// ---------- Creatures and cells ----------
// The one place a creature object is built; options override the defaults.
function createCreature(team, cells, options = {}) {
  return {
    team,
    cells,
    alive: true,
    aiControlled: false,
    autonomous: false,                                    // moves only by its own cells: no free swimming or turning
    resting: false,                                       // a sandbox enemy holding still: its cilia rest too
    debris: false,                                       // a piece cut off from its nucleus, or a launched Bud part
    launchedPart: false,                                  // a Bud part fired from its parent
    fueled: false,                                        // launched part: still carries O2 and sugar
    heading: 0,                                           // radians clockwise from up
    targetHeading: 0,
    launchAim: 0,                                         // launched part: its firing direction in its rest frame
    swimX: 0,                                             // wanted swimming direction
    swimY: 0,
    abilityHeld: false,                                   // Space, or the AI's wish to fire
    heldKeys: null,                                       // letter and number keys held, for bound Commands
    centerX: 0,
    centerY: 0,
    restCenterX: 0,                                       // mass centre of the design, in grid px
    restCenterY: 0,
    nucleus: null,
    cellsByHex: null,
    design: null,                                         // the design's cells, for regrowing lost ones
    designFibres: [],                                     // the design's fibres, reconnected when cells regrow
    designVessels: [],                                    // the design's vessels, reconnected when cells regrow
    bounds: null,                                         // { minX, minY, maxX, maxY }, updated by the physics
    regrowthPool: 0,                                      // repair fluid saved up for the next regrown cell
    foodEaten: 0,                                         // food specks its Mouths have taken in
    spawnHealth: 0,                                       // total health at spawn, for the HUD
    ...options,
  };
}

// The one place a cell object is built.
function createCell(typeName, q, r, creature) {
  const type = CELLS[typeName];
  const [restX, restY] = hexToPixel(q, r);
  return {
    typeName,
    type,
    q,
    r,
    restX,                                                // position in the design, grid px
    restY,
    x: 0,
    y: 0,
    velocityX: 0,
    velocityY: 0,
    forceX: 0,
    forceY: 0,
    health: type.health,
    maxHealth: type.health,
    signal: 0,                                            // nerve signal level
    nerveInput: 0,                                        // what the fibres and the cell's sense deliver this step
    senseOutput: 0,                                       // sense organs: what they feel this step
    neuron: null,                                         // the neuron inside the cell: { kind, setting }
    neuronMemory: 0,                                      // state a neuron keeps between nerve steps
    delayLine: null,                                      // a Delay neuron's past inputs (nerve.js), made on first use
    size: 1,                                             // muscles shrink, bloaters swell
    radius: CELL_RADIUS,
    cooldown: 0,
    hitFlash: 0,
    creature,
    dead: false,
    fluidCapacity: FLUIDS.map(fluid => fluidCapacityOf(type, fluid)),
    fluids: FLUIDS.map(fluid => fluidCapacityOf(type, fluid) * fluid.startFill),
    efficiency: 1,                                        // share of its fuel demand it got
    adrenalineBoost: 1,
    onSurface: false,                                     // touches the water
    skinNeighbours: [],                                   // the cells next to it along the skin
    fat: 0,                                               // fat stored in the cell (metabolism.js)
    starving: false,
    poisoned: false,
    boundKey: null,                                       // Command: the key it fires on ('a'–'z', '0'–'9')
    budGrowth: null,                                      // Bud: { plan, progress, grownCount, done }
    budParent: null,                                      // a cell of a growing Bud part: its Bud
    snareLine: null,
  };
}

// a creature built from a design at (x, y), turned by angle (radians clockwise from up)
function spawn(world, design, x, y, angle, team) {
  const creature = createCreature(team, [], {
    aiControlled: team !== 0,
    heading: angle,
    targetHeading: angle,
    centerX: x,
    centerY: y,
    cellsByHex: new Map(),
    design: design.cells,
    designFibres: design.fibres || [],
    designVessels: design.vessels || [],
  });
  const cos = cosine(angle);
  const sin = sine(angle);
  for (const blueprintCell of design.cells) {
    const cell = createCell(blueprintCell.typeName, blueprintCell.q, blueprintCell.r, creature);
    if (blueprintCell.boundKey) cell.boundKey = blueprintCell.boundKey;
    if (blueprintCell.neuron) cell.neuron = { ...blueprintCell.neuron };
    if (cell.type.growsParts && blueprintCell.budPart) cell.budGrowth = newBudGrowth(design.cells, blueprintCell);
    creature.cells.push(cell);
    world.cells.push(cell);
    creature.cellsByHex.set(hexKey(blueprintCell.q, blueprintCell.r), cell);
  }
  updateRestFrame(creature);
  for (const cell of creature.cells) {
    const localX = cell.restX - creature.restCenterX;
    const localY = cell.restY - creature.restCenterY;
    cell.x = x + localX * cos - localY * sin;
    cell.y = y + localX * sin + localY * cos;
  }
  for (const cell of creature.cells) {
    for (const [stepQ, stepR] of HEX_FORWARD_NEIGHBOURS) {
      const neighbour = creature.cellsByHex.get(hexKey(cell.q + stepQ, cell.r + stepR));
      if (!neighbour) continue;
      addBond(world, cell, neighbour);
      addFluidLink(world, cell, neighbour);
    }
  }
  for (const cell of creature.cells) {
    const neighbours = HEX_NEIGHBOURS
      .map(([stepQ, stepR]) => creature.cellsByHex.get(hexKey(cell.q + stepQ, cell.r + stepR)))
      .filter(Boolean);
    addAngleSpringsAround(world, cell, neighbours);
  }
  connectFibres(world, creature, creature.designFibres);
  connectVessels(world, creature, creature.designVessels);
  world.creatures.push(creature);
  markSurface(world, creature);
  return creature;
}

// a spring between two touching cells; the weaker cell sets its strength
function addBond(world, first, second) {
  const stiffness = BOND_STIFFNESS * Math.min(first.type.bondStrength, second.type.bondStrength);
  world.bonds.push({ first, second, stiffness, onSurface: false });
}

function addFluidLink(world, first, second) {
  world.fluidLinks.push({ first, second, open: true, conductance: FLOW_CONDUCTANCE });
}

// an angle spring at pivot for every pair of its neighbours
function addAngleSpringsAround(world, pivot, neighbours) {
  for (let i = 0; i < neighbours.length; i++) {
    for (let j = i + 1; j < neighbours.length; j++) addAngleSpring(world, pivot, neighbours[i], neighbours[j]);
  }
}

// holds the angle at pivot between two of its neighbours that don't touch each other (keeps chains from folding)
function addAngleSpring(world, pivot, first, second) {
  if (areHexNeighbours(first, second)) return;
  const firstArmX = first.restX - pivot.restX;
  const firstArmY = first.restY - pivot.restY;
  const secondArmX = second.restX - pivot.restX;
  const secondArmY = second.restY - pivot.restY;
  const restAngle = arcTangent2(firstArmX * secondArmY - firstArmY * secondArmX,
    firstArmX * secondArmX + firstArmY * secondArmY);
  world.angleSprings.push({ pivot, first, second, restAngle, stiffness: ANGLE_STIFFNESS * pivot.type.stiffness });
}

// the creature's living cell at (q, r), if any
function liveCellAt(creature, q, r) {
  const cell = creature.cellsByHex && creature.cellsByHex.get(hexKey(q, r));
  return cell && !cell.dead && cell.creature === creature ? cell : null;
}

// mass centre of the design (used to measure the creature's heading), and its nucleus
function updateRestFrame(creature) {
  let mass = 0;
  let weightedX = 0;
  let weightedY = 0;
  for (const cell of creature.cells) {
    mass += cell.type.mass;
    weightedX += cell.restX * cell.type.mass;
    weightedY += cell.restY * cell.type.mass;
  }
  creature.restCenterX = weightedX / mass;
  creature.restCenterY = weightedY / mass;
  creature.nucleus = creature.cells.find(cell => cell.type.isNucleus) || null;
}

// A bond is on the outer membrane if fewer than two cells close a triangle over it; its cells touch the water.
// Each skin cell also learns its neighbours along the skin, from which the water drag finds the skin's direction.
function markSurface(world, creature) {
  const neighboursOf = new Map(creature.cells.map(cell => [cell, new Set()]));
  const ownBonds = world.bonds.filter(bond => bond.first.creature === creature);
  for (const cell of creature.cells) {
    cell.onSurface = creature.cells.length < 3;
    cell.skinNeighbours = [];
  }
  for (const bond of ownBonds) {
    neighboursOf.get(bond.first).add(bond.second);
    neighboursOf.get(bond.second).add(bond.first);
  }
  for (const bond of ownBonds) {
    let sharedNeighbours = 0;
    for (const cell of neighboursOf.get(bond.first)) {
      if (neighboursOf.get(bond.second).has(cell)) sharedNeighbours++;
    }
    bond.onSurface = sharedNeighbours < 2;
    if (!bond.onSurface) continue;
    bond.first.onSurface = true;
    bond.second.onSurface = true;
    bond.first.skinNeighbours.push(bond.second);
    bond.second.skinNeighbours.push(bond.first);
  }
}

// take a creature, its springs and its fluid links out of the world
function removeCreature(world, creature) {
  const belongs = cell => cell.creature === creature;
  world.cells = world.cells.filter(cell => !belongs(cell));
  world.bonds = world.bonds.filter(bond => !belongs(bond.first));
  world.angleSprings = world.angleSprings.filter(spring => !belongs(spring.pivot));
  world.fluidLinks = world.fluidLinks.filter(link => !belongs(link.first));
  world.fibres = world.fibres.filter(fibre => !belongs(fibre.from) && !belongs(fibre.to));
  world.vessels = world.vessels.filter(vessel => !belongs(vessel.first));
  world.creatures = world.creatures.filter(other => other !== creature);
}

function spawnSparks(world, x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const angle = randomFraction(world) * TAU;
    const speed = 40 + randomFraction(world) * 140;
    const lifetime = 0.3 + randomFraction(world) * 0.4;
    const velocityX = cosine(angle) * speed;
    const velocityY = sine(angle) * speed;
    world.sparks.push({ x, y, velocityX, velocityY, lifetime, color });
  }
}

// ---------- Death ----------
// Removes dead cells and splits creatures into connected pieces. Pieces without the nucleus become debris.
function removeDeadCells(world) {
  if (!world.cells.some(cell => cell.health <= 0)) return;
  const damagedCreatures = new Set();
  for (const cell of world.cells) {
    if (cell.health > 0) continue;
    cell.dead = true;
    damagedCreatures.add(cell.creature);
    spawnSparks(world, cell.x, cell.y, cell.type.color, 10);
    runCellDeathHooks(world, cell);
  }
  world.cells = world.cells.filter(cell => !cell.dead);
  world.bonds = world.bonds.filter(bond => !bond.first.dead && !bond.second.dead);
  world.angleSprings = world.angleSprings.filter(spring =>
    !spring.pivot.dead && !spring.first.dead && !spring.second.dead);
  world.fluidLinks = world.fluidLinks.filter(link => !link.first.dead && !link.second.dead);
  for (const creature of damagedCreatures) splitIntoPieces(world, creature);
  cutBrokenFibres(world);
  cutBrokenVessels(world);
  world.creatures = world.creatures.filter(creature => creature.alive && creature.cells.length);
}

// The piece holding a living nucleus stays the creature; every other connected piece becomes debris.
function splitIntoPieces(world, creature) {
  const livingCells = creature.cells.filter(cell => !cell.dead);
  const neighboursOf = new Map(livingCells.map(cell => [cell, []]));
  for (const bond of world.bonds) {
    if (bond.first.creature !== creature) continue;
    neighboursOf.get(bond.first).push(bond.second);
    neighboursOf.get(bond.second).push(bond.first);
  }
  const nucleusAlive = creature.nucleus && !creature.nucleus.dead;
  const roots = nucleusAlive ? [creature.nucleus, ...livingCells] : livingCells;
  const seen = new Set();
  const pieces = [];
  for (const root of roots) {
    if (seen.has(root)) continue;
    const piece = [root];
    seen.add(root);
    for (let i = 0; i < piece.length; i++) {
      for (const neighbour of neighboursOf.get(piece[i])) {
        if (seen.has(neighbour)) continue;
        seen.add(neighbour);
        piece.push(neighbour);
      }
    }
    pieces.push(piece);
  }
  const keptPiece = nucleusAlive && !creature.debris ? pieces.shift() : null;
  creature.cells = keptPiece || [];
  if (!keptPiece) creature.alive = false;
  for (const piece of pieces) {
    const debris = createCreature(creature.debris ? creature.team : -1, piece, {
      debris: true,
      launchedPart: creature.launchedPart,
      launchAim: creature.launchAim,
    });
    for (const cell of piece) cell.creature = debris;
    updateRestFrame(debris);
    markSurface(world, debris);
    world.creatures.push(debris);
  }
  if (!keptPiece) return;
  updateRestFrame(creature);
  markSurface(world, creature);
}

// ---------- Systems ----------
// Each system file registers its update with an order number; step() runs them in that order.
// Switchable systems run only when the world's system list names them (RULES.systems, or a level's list).
// A system may also give onCellDeath(world, cell), called for every cell that dies while the system is on.
const SYSTEMS = [];

function registerSystem(system) {
  SYSTEMS.push(system);
  SYSTEMS.sort((first, second) => first.order - second.order);
}

function isSystemOn(world, system) {
  return !system.switchable || world.systems.has(system.name);
}

// input: { swimX, swimY } (direction) or { forward, turn } (car-style), plus ability and heldKeys
function step(world, dt, input) {
  for (const system of SYSTEMS) {
    if (isSystemOn(world, system)) system.update(world, dt, input);
  }
}

function runCellDeathHooks(world, cell) {
  for (const system of SYSTEMS) {
    if (system.onCellDeath && isSystemOn(world, system)) system.onCellDeath(world, cell);
  }
}

function advanceClock(world, dt) {
  world.time += dt;
}

function updateParticles(world, dt) {
  for (const spark of world.sparks) {
    spark.x += spark.velocityX * dt;
    spark.y += spark.velocityY * dt;
    spark.lifetime -= dt;
    spark.velocityX *= 0.9;
    spark.velocityY *= 0.9;
  }
  world.sparks = world.sparks.filter(spark => spark.lifetime > 0);
  for (const zap of world.zaps) zap.lifetime -= dt;
  world.zaps = world.zaps.filter(zap => zap.lifetime > 0);
}

registerSystem({ name: 'clock', order: 30, switchable: false, update: advanceClock });
registerSystem({ name: 'cleanup', order: 110, switchable: false, update: removeDeadCells });
registerSystem({ name: 'particles', order: 120, switchable: false, update: updateParticles });
