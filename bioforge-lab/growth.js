'use strict';
// Growth: Buds grow a saved part and launch it; Menders regrow lost cells of the design. Pure: no DOM.

const BUD_FUEL_PER_BIOMASS = 0.05;                        // fuel a Bud burns per biomass of part it grows
const BUD_LAUNCH_SPEED = 260;                             // px/s
const BUD_COOLDOWN = 1;                                   // s before a Bud starts regrowing after a launch
const GROWN_CELL_START_SIZE = 0.3;                        // a new cell starts this small and swells to size
const REGROW_RATE = 0.08;                                 // repair fluid per second a Mender puts toward regrowth
const REGROW_FLUID_PER_BIOMASS = 0.2;                     // repair fluid needed per biomass of the lost cell
const REGROW_START_HEALTH = 0.25;                         // share of full health a regrown cell starts with

// ---------- Bud part placement ----------
// Where a Bud grows its part: where the player placed it (bud.partOffset = part anchor relative to the Bud,
// bud.partRotation = turn),
// or by default turned so the part's front (top in the builder) points away from the body, attached on the Bud's most
// outward free side. Hexes the body already uses are skipped. Cells come in growth order, nearest the Bud first.
// designCells and bud use the saved design format ({ q, r, typeName, budPart, partRotation, partOffset, partAim }).
function planBudPart(designCells, bud) {
  const occupied = new Set(designCells.map(cell => hexKey(cell.q, cell.r)));
  const freeSides = HEX_NEIGHBOURS.filter(([stepQ, stepR]) => !occupied.has(hexKey(bud.q + stepQ, bud.r + stepR)));
  if (!bud.budPart || !freeSides.length) {
    const blockedCount = bud.budPart ? bud.budPart.cells.length : 0;
    return { cells: [], blockedCount, direction: [0, -1], rotation: bud.partRotation || 0 };
  }
  const { directionX, directionY, rotation } = budPartDirection(designCells, bud);
  const turnedCells = bud.budPart.cells.map(cell => {
    const [q, r] = rotateHex(cell.q, cell.r, rotation);
    return { ...cell, q, r };
  });
  const [anchorQ, anchorR] = bud.partOffset
    ? [bud.q + bud.partOffset[0], bud.r + bud.partOffset[1]]
    : defaultPartAnchor(bud, freeSides, turnedCells, directionX, directionY);
  const placedCells = new Map(turnedCells
    .map(cell => ({ ...cell, q: cell.q + anchorQ, r: cell.r + anchorR }))
    .filter(cell => !occupied.has(hexKey(cell.q, cell.r)))
    .map(cell => [hexKey(cell.q, cell.r), cell]));
  const growthOrder = cellsReachableFrom(bud, placedCells);
  // direction in the rest frame: the player's aim (radians clockwise from the front) or where the part's front points
  const aim = bud.partAim !== undefined ? bud.partAim : rotation * Math.PI / 3;
  return {
    cells: growthOrder,
    blockedCount: bud.budPart.cells.length - growthOrder.length,
    direction: [sine(aim), -cosine(aim)],
    rotation,
    offset: [anchorQ - bud.q, anchorR - bud.r],
    fibres: placePartFibres(bud.budPart.fibres || [], rotation, anchorQ, anchorR),
  };
}

// the part's fibres turned and moved with its cells
function placePartFibres(fibres, rotation, anchorQ, anchorR) {
  const place = ({ q, r }) => {
    const [turnedQ, turnedR] = rotateHex(q, r, rotation);
    return { q: turnedQ + anchorQ, r: turnedR + anchorR };
  };
  return fibres.map(fibre => moveLink(fibre, place));
}

// the direction the part points: turned by the player, or away from the body's middle
function budPartDirection(designCells, bud) {
  if (bud.partRotation !== undefined) {
    const rotation = bud.partRotation;
    return { directionX: sine(rotation * Math.PI / 3), directionY: -cosine(rotation * Math.PI / 3), rotation };
  }
  let middleX = 0;
  let middleY = 0;
  for (const cell of designCells) {
    const [x, y] = hexToPixel(cell.q, cell.r);
    middleX += x / designCells.length;
    middleY += y / designCells.length;
  }
  const [budX, budY] = hexToPixel(bud.q, bud.r);
  let directionX = budX - middleX;
  let directionY = budY - middleY;
  const length = vectorLength(directionX, directionY);
  if (length < 1e-6) {
    directionX = 0;
    directionY = -1;
  } else {
    directionX /= length;
    directionY /= length;
  }
  const rotation = Math.round(arcTangent2(directionX, -directionY) / (Math.PI / 3));
  return { directionX, directionY, rotation };
}

// the part's anchor so that its backmost cell sits on the Bud's most outward free side
function defaultPartAnchor(bud, freeSides, turnedCells, directionX, directionY) {
  const outward = (q, r) => {
    const [x, y] = hexToPixel(q, r);
    return x * directionX + y * directionY;
  };
  const [sideQ, sideR] = freeSides.reduce((best, side) => outward(...side) > outward(...best) ? side : best);
  const back = turnedCells.reduce((best, cell) => outward(cell.q, cell.r) < outward(best.q, best.r) ? cell : best);
  return [bud.q + sideQ - back.q, bud.r + sideR - back.r];
}

// the cells of placedCells (Map by hex key) connected to the Bud through each other, nearest first
function cellsReachableFrom(bud, placedCells) {
  const seen = new Set([hexKey(bud.q, bud.r)]);
  const order = [];
  const queue = [[bud.q, bud.r]];
  while (queue.length) {
    const [q, r] = queue.shift();
    for (const [stepQ, stepR] of HEX_NEIGHBOURS) {
      const neighbourKey = hexKey(q + stepQ, r + stepR);
      if (!placedCells.has(neighbourKey) || seen.has(neighbourKey)) continue;
      seen.add(neighbourKey);
      order.push(placedCells.get(neighbourKey));
      queue.push([q + stepQ, r + stepR]);
    }
  }
  return order;
}

// a Bud's growth state: what it will grow, in order, and how far it has got
function newBudGrowth(designCells, bud) {
  return { plan: planBudPart(designCells, bud), progress: 0, grownCount: 0, done: false };
}

// ---------- Growing cells ----------
// Adds one cell to a living creature next to its existing neighbours; it starts small and swells to size.
// bud: the Bud whose part this cell belongs to, or null for a regrown body cell.
function growCell(world, creature, blueprintCell, bud) {
  const neighbours = HEX_NEIGHBOURS
    .map(([stepQ, stepR]) => liveCellAt(creature, blueprintCell.q + stepQ, blueprintCell.r + stepR))
    .filter(Boolean);
  if (!neighbours.length) return null;
  const cell = createCell(blueprintCell.typeName, blueprintCell.q, blueprintCell.r, creature);
  const anchor = neighbours[0];
  const cos = cosine(creature.heading);
  const sin = sine(creature.heading);
  const localX = cell.restX - anchor.restX;
  const localY = cell.restY - anchor.restY;
  cell.x = anchor.x + localX * cos - localY * sin;
  cell.y = anchor.y + localX * sin + localY * cos;
  cell.velocityX = anchor.velocityX;
  cell.velocityY = anchor.velocityY;
  cell.fluids = new Array(FLUID_COUNT).fill(0);
  cell.size = GROWN_CELL_START_SIZE;
  cell.radius = CELL_RADIUS * GROWN_CELL_START_SIZE;
  cell.budParent = bud;
  if (blueprintCell.neuron) cell.neuron = { ...blueprintCell.neuron };
  // the body fills the growing part through every cell it touches (the Bud too); cut when the part is launched
  for (const neighbour of neighbours) {
    addBond(world, cell, neighbour);
    addFluidLink(world, cell, neighbour);
  }
  addAngleSpringsAround(world, cell, neighbours);
  for (const neighbour of neighbours) {
    for (const [stepQ, stepR] of HEX_NEIGHBOURS) {
      const other = liveCellAt(creature, neighbour.q + stepQ, neighbour.r + stepR);
      if (other) addAngleSpring(world, neighbour, cell, other);
    }
  }
  creature.cells.push(cell);
  world.cells.push(cell);
  creature.cellsByHex.set(hexKey(blueprintCell.q, blueprintCell.r), cell);
  updateRestFrame(creature);
  markSurface(world, creature);
  return cell;
}

// ---------- Buds ----------
// Cuts a Bud's finished part loose and shoots it the way its front points, turned with the creature's heading (not
// from where the soft part happens to flop). The whole part gets one velocity so it flies without spinning; the body
// recoils.
function releaseBudPart(world, creature, bud) {
  const part = new Set(creature.cells.filter(cell => cell.budParent === bud));
  if (!part.size) return;
  const crossesCut = (first, second) => part.has(first) !== part.has(second);
  world.bonds = world.bonds.filter(bond => !crossesCut(bond.first, bond.second));
  world.angleSprings = world.angleSprings.filter(spring =>
    !crossesCut(spring.pivot, spring.first) && !crossesCut(spring.pivot, spring.second));
  world.fluidLinks = world.fluidLinks.filter(link => !crossesCut(link.first, link.second));
  creature.cells = creature.cells.filter(cell => !part.has(cell));
  const [aimX, aimY] = bud.budGrowth.plan.direction;
  const launched = createCreature(creature.team, [...part], {
    debris: true,
    launchedPart: true,
    launchAim: arcTangent2(aimX, -aimY),
  });
  let partMass = 0;
  let momentumX = 0;
  let momentumY = 0;
  let bodyMass = 0;
  for (const cell of part) {
    cell.creature = launched;
    cell.budParent = null;
    partMass += cell.type.mass;
    momentumX += cell.velocityX * cell.type.mass;
    momentumY += cell.velocityY * cell.type.mass;
  }
  for (const cell of creature.cells) bodyMass += cell.type.mass;
  const cos = cosine(creature.heading);
  const sin = sine(creature.heading);
  const launchX = aimX * cos - aimY * sin;
  const launchY = aimX * sin + aimY * cos;
  for (const cell of part) {
    cell.velocityX = momentumX / partMass + launchX * BUD_LAUNCH_SPEED;
    cell.velocityY = momentumY / partMass + launchY * BUD_LAUNCH_SPEED;
  }
  for (const cell of creature.cells) {
    cell.velocityX -= launchX * BUD_LAUNCH_SPEED * partMass / bodyMass;
    cell.velocityY -= launchY * BUD_LAUNCH_SPEED * partMass / bodyMass;
  }
  updateRestFrame(launched);
  markSurface(world, launched);
  updateRestFrame(creature);
  markSurface(world, creature);
  world.creatures.push(launched);
  bud.cooldown = BUD_COOLDOWN;
  bud.budGrowth.progress = 0;
  bud.budGrowth.done = false;
  spawnSparks(world, bud.x, bud.y, bud.type.color, 6);
}

// Buds turn burned fuel into their part one cell at a time; a nerve signal launches the finished part.
function updateBuds(world) {
  for (const cell of [...world.cells]) {
    if (!cell.type.growsParts || !cell.budGrowth || cell.creature.debris || cell.dead) continue;
    const growth = cell.budGrowth;
    const creature = cell.creature;
    const nextCell = growth.plan.cells.find(planned => !liveCellAt(creature, planned.q, planned.r));
    growth.done = !nextCell;
    if (nextCell && growth.progress >= BUD_FUEL_PER_BIOMASS * CELLS[nextCell.typeName].cost) {
      growth.progress -= BUD_FUEL_PER_BIOMASS * CELLS[nextCell.typeName].cost;
      growCell(world, creature, nextCell, cell);
      connectFibres(world, creature, growth.plan.fibres);
    }
    growth.grownCount = growth.plan.cells.filter(planned => liveCellAt(creature, planned.q, planned.r)).length;
    if (growth.done && growth.grownCount && cell.signal > SIGNAL_ON && cell.cooldown <= 0) {
      releaseBudPart(world, creature, cell);
    }
  }
}

// ---------- Regrowth ----------
// Menders pool repair fluid and rebuild the missing design cell nearest a Mender that touches the body, one at a
// time; it swells to size from a quarter of its health and repair fluid heals the rest.
function updateRegrowth(world, dt) {
  for (const creature of world.creatures) {
    if (creature.debris || !creature.design) continue;
    const menders = creature.cells.filter(cell => cell.type.rebuildsCells && !cell.budParent);
    const isBodyCell = (q, r) => {
      const cell = liveCellAt(creature, q, r);
      return cell && !cell.budParent;
    };
    const missing = creature.design.filter(planned =>
      !liveCellAt(creature, planned.q, planned.r) &&
      HEX_NEIGHBOURS.some(([stepQ, stepR]) => isBodyCell(planned.q + stepQ, planned.r + stepR)));
    if (!menders.length || !missing.length) {
      creature.regrowthPool = 0;
      continue;
    }
    for (const mender of menders) {
      const drawn = Math.min(mender.fluids[FLUID_REPAIR], REGROW_RATE * dt);
      mender.fluids[FLUID_REPAIR] -= drawn;
      creature.regrowthPool += drawn;
    }
    const distanceToMender = planned => Math.min(...menders.map(mender => hexDistance(mender, planned)));
    const nextCell = missing.reduce((best, planned) =>
      distanceToMender(planned) < distanceToMender(best) ? planned : best);
    const cost = REGROW_FLUID_PER_BIOMASS * CELLS[nextCell.typeName].cost;
    if (creature.regrowthPool < cost) continue;
    const cell = regrowCell(world, creature, nextCell);
    if (!cell) continue;
    creature.regrowthPool -= cost;
    cell.health = cell.maxHealth * REGROW_START_HEALTH;
  }
}

// grows the design's cell back onto the body, with its key binding and Bud part
function regrowCell(world, creature, blueprintCell) {
  const cell = growCell(world, creature, blueprintCell, null);
  if (!cell) return null;
  if (blueprintCell.boundKey) cell.boundKey = blueprintCell.boundKey;
  if (cell.type.growsParts && blueprintCell.budPart) cell.budGrowth = newBudGrowth(creature.design, blueprintCell);
  connectFibres(world, creature, creature.designFibres);
  connectVessels(world, creature, creature.designVessels);
  spawnSparks(world, cell.x, cell.y, CELLS.mender.color, 6);
  return cell;
}

registerSystem({ name: 'buds', order: 80, switchable: false, update: updateBuds });
registerSystem({ name: 'regrow', order: 90, switchable: true, update: updateRegrowth });
