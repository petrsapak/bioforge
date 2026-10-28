'use strict';
// The design being edited in the builder, and every editing rule: placing and removing cells, Bud parts and their aim,
// Command keys, stamping saved parts, and saving a selection. Pure: no DOM, so the rules are tested in Node.
// Cells that aren't joined to the Nucleus are only planned: they cost nothing and stay out of the creature.

const BUD_AIM_HANDLE_RADIUS = 12;                         // grid px around an aim arrow's tip that grab it
const BUD_AIM_ARROW_LENGTH = 18;                          // grid px
const MIN_AIM_DRAG = 2;                                   // grid px the aim tip must be dragged to count
const NAME_MAX_LENGTH = 40;                               // characters in a saved name

const keyOfCell = cell => hexKey(cell.q, cell.r);
// biomass shown to the half point
const formatBiomass = value => String(Math.round(value * 2) / 2);
// a count of 60° steps wrapped into 0..5
const wrapTurns = turns => (turns % 6 + 6) % 6;

// ---------- The edited design ----------
// The one place an edited design is built. Its cells are copies, so the source design stays as it was.
// biomassLimit: RULES.budget, or Infinity while building without a limit.
function createEditedDesign(cells, biomassLimit = RULES.budget) {
  return {
    cells: new Map(cells.map(cell => [keyOfCell(cell), { ...cell }])),
    biomassLimit,
  };
}

function joinedKeys(edited) {
  return hexesReachableFromNucleus(key => edited.cells.has(key));
}

// the cells joined to the Nucleus: the creature that is spawned
function bodyCells(edited) {
  const joined = joinedKeys(edited);
  return [...edited.cells.values()].filter(cell => joined.has(keyOfCell(cell)));
}

function plannedKeys(edited) {
  const joined = joinedKeys(edited);
  return [...edited.cells.keys()].filter(key => !joined.has(key));
}

function bodyDesign(edited) {
  return { cells: bodyCells(edited) };
}

function bodyCost(edited) {
  return designCost(bodyDesign(edited));
}

// the body's cost if these cells were added on free hexes; the design itself is left as it was
function costWithAdded(edited, cells) {
  for (const cell of cells) edited.cells.set(keyOfCell(cell), cell);
  const cost = bodyCost(edited);
  for (const cell of cells) edited.cells.delete(keyOfCell(cell));
  return cost;
}

// ---------- Cells ----------
// A cell can go on a free grid hex that no Bud part needs. Off the body it is only planned; joining the body must
// fit the biomass limit.
function canPlaceCell(edited, q, r, typeName) {
  const key = hexKey(q, r);
  if (!isInGrid(q, r) || edited.cells.has(key) || reservedHexes(edited).has(key)) return false;
  return costWithAdded(edited, [createDesignCell(q, r, typeName)]) <= edited.biomassLimit;
}

function placeCell(edited, q, r, typeName) {
  edited.cells.set(hexKey(q, r), createDesignCell(q, r, typeName));
}

// removes the cell on (q, r), except the Nucleus; cells cut off from the Nucleus stay, as planned cells
function removeCell(edited, q, r) {
  const cell = edited.cells.get(hexKey(q, r));
  if (!cell || CELLS[cell.typeName].isNucleus) return;
  edited.cells.delete(hexKey(q, r));
}

// binds a Command to a number key; pressing its key again unbinds it (it then fires on Space)
function toggleCommandKey(edited, key, digit) {
  const command = edited.cells.get(key);
  if (command.boundKey === digit) delete command.boundKey;
  else command.boundKey = digit;
}

// ---------- Bud parts ----------
// hexes that Buds' parts will grow on (skipKey: a Bud to leave out)
function reservedHexes(edited, skipKey = null) {
  const cells = bodyCells(edited);
  const reserved = new Set();
  for (const bud of cells) {
    if (!bud.budPart || keyOfCell(bud) === skipKey) continue;
    for (const partCell of planBudPart(cells, bud).cells) reserved.add(keyOfCell(partCell));
  }
  return reserved;
}

// The Bud's part turned by rotation with its anchor on (q, r): its cells, its offset from the Bud, and the problem
// if it can't go there ('' if it can).
function budPartPlacement(edited, budKey, rotation, q, r) {
  const bud = edited.cells.get(budKey);
  const cells = bud.budPart.cells.map(partCell => {
    const [turnedQ, turnedR] = rotateHex(partCell.q, partCell.r, rotation);
    return createDesignCell(q + turnedQ, r + turnedR, partCell.typeName);
  });
  const otherParts = reservedHexes(edited, budKey);
  let problem = '';
  if (cells.some(cell => !isInGrid(cell.q, cell.r))) problem = 'Part of it is off the grid.';
  else if (cells.some(cell => edited.cells.has(keyOfCell(cell)))) problem = 'It covers cells of the body.';
  else if (cells.some(cell => otherParts.has(keyOfCell(cell)))) problem = "It covers another Bud's part.";
  else if (!hangsOnBud(bud, cells)) problem = 'It must touch the Bud, with every cell connected to it.';
  return { cells, problem, offset: [q - bud.q, r - bud.r] };
}

// every cell of the part can be reached from the Bud by stepping through cells of the part
function hangsOnBud(bud, partCells) {
  const partKeys = new Set(partCells.map(keyOfCell));
  const reached = new Set();
  const queue = [[bud.q, bud.r]];
  while (queue.length) {
    const [q, r] = queue.pop();
    for (const [stepQ, stepR] of HEX_NEIGHBOURS) {
      const key = hexKey(q + stepQ, r + stepR);
      if (!partKeys.has(key) || reached.has(key)) continue;
      reached.add(key);
      queue.push([q + stepQ, r + stepR]);
    }
  }
  return reached.size === partKeys.size;
}

// puts the Bud's part on (q, r) turned by rotation if it fits; returns the problem otherwise ('' = moved)
function moveBudPart(edited, budKey, rotation, q, r) {
  const placement = budPartPlacement(edited, budKey, rotation, q, r);
  if (placement.problem) return placement.problem;
  const bud = edited.cells.get(budKey);
  bud.partRotation = wrapTurns(rotation);
  bud.partOffset = placement.offset;
  return '';
}

// where the Bud's part sits now, also while it is still on its automatic spot
function currentBudPart(edited, budKey) {
  const bud = edited.cells.get(budKey);
  const plan = planBudPart(bodyCells(edited), bud);
  return { q: bud.q, r: bud.r, rotation: plan.rotation, offset: bud.partOffset || plan.offset };
}

// Gives the Bud a part from the library, on the automatic spot next to the Bud. Returns the problem ('' = done).
function giveBudPart(edited, budKey, template) {
  if (template.isCreature || template.cells.some(cell => CELLS[cell.typeName].growsParts)) {
    return 'A Bud can only grow a part without a Nucleus or another Bud.';
  }
  const bud = edited.cells.get(budKey);
  bud.budPart = {
    name: template.name,
    cells: template.cells.map(cell => createDesignCell(cell.q, cell.r, cell.typeName)),
  };
  delete bud.partOffset;
  delete bud.partRotation;
  const plan = planBudPart(bodyCells(edited), bud);
  if (plan.offset) {
    bud.partOffset = plan.offset;
    bud.partRotation = wrapTurns(plan.rotation);
  }
  return '';
}

// turns the Bud's part by steps of 60° around the Bud; returns the problem ('' = turned)
function turnBudPart(edited, budKey, steps) {
  const part = currentBudPart(edited, budKey);
  if (!part.offset) return '';
  const [turnedQ, turnedR] = rotateHex(part.offset[0], part.offset[1], steps);
  return moveBudPart(edited, budKey, part.rotation + steps, part.q + turnedQ, part.r + turnedR);
}

// aims the Bud's launch from the Bud toward a point (grid px)
function aimBudPart(edited, budKey, pointX, pointY) {
  const bud = edited.cells.get(budKey);
  const [budX, budY] = hexToPixel(bud.q, bud.r);
  const offsetX = pointX - budX;
  const offsetY = pointY - budY;
  if (offsetX * offsetX + offsetY * offsetY <= MIN_AIM_DRAG * MIN_AIM_DRAG) return;
  bud.partAim = arcTangent2(offsetX, -offsetY);
}

function resetBudAim(edited, budKey) {
  delete edited.cells.get(budKey).partAim;
}

// The Bud's aim arrow in grid px: from just past the far end of its part, along its launch direction. null if the
// Bud has no part that can grow.
function budAimArrow(cells, bud) {
  const plan = planBudPart(cells, bud);
  if (!plan.cells.length) return null;
  const [directionX, directionY] = plan.direction;
  const along = (q, r) => {
    const [x, y] = hexToPixel(q, r);
    return x * directionX + y * directionY;
  };
  const farEnd = Math.max(...plan.cells.map(cell => along(cell.q, cell.r)));
  const [budX, budY] = hexToPixel(bud.q, bud.r);
  const start = Math.max(CELL_RADIUS, farEnd - along(bud.q, bud.r) + CELL_RADIUS);
  return {
    directionX,
    directionY,
    startX: budX + directionX * start,
    startY: budY + directionY * start,
    tipX: budX + directionX * (start + BUD_AIM_ARROW_LENGTH),
    tipY: budY + directionY * (start + BUD_AIM_ARROW_LENGTH),
  };
}

// What the mouse grabs on hex (q, r) at point (grid px): the focused Bud's aim arrow tip ({ budKey, isAim: true }),
// a cell of a Bud's part ({ budKey, grab: the cell's offset from the part's anchor, rotation }), or null.
function budHandleAt(edited, q, r, point, focusKey) {
  const cells = bodyCells(edited);
  const focusedBud = cells.find(cell => keyOfCell(cell) === focusKey && cell.budPart);
  const arrow = focusedBud && point && budAimArrow(cells, focusedBud);
  if (arrow && distanceSquared(point[0], point[1], arrow.tipX, arrow.tipY) < square(BUD_AIM_HANDLE_RADIUS)) {
    return { budKey: focusKey, isAim: true };
  }
  for (const bud of cells) {
    if (!bud.budPart) continue;
    const plan = planBudPart(cells, bud);
    if (!plan.offset || !plan.cells.some(cell => cell.q === q && cell.r === r)) continue;
    const grab = [q - bud.q - plan.offset[0], r - bud.r - plan.offset[1]];
    return { budKey: keyOfCell(bud), grab, rotation: plan.rotation };
  }
  return null;
}

// ---------- Stamping saved parts ----------
// A stamp is a saved part being placed: { template, rotation }.
// Its cells turned and moved to (q, r), leaving out hexes already taken, and the problem if it can't go there.
function stampPlacement(edited, stamp, q, r) {
  const cells = stamp.template.cells
    .map(cell => turnTemplateCell(cell, stamp.rotation, q, r))
    .filter(cell => !edited.cells.has(keyOfCell(cell)));
  const reserved = reservedHexes(edited);
  let problem = '';
  if (!cells.length) problem = 'Every hex there is already taken.';
  else if (cells.some(cell => !isInGrid(cell.q, cell.r))) problem = 'Part of it is off the grid.';
  else if (cells.some(cell => reserved.has(keyOfCell(cell)))) problem = "It covers hexes kept free for a Bud's part.";
  else {
    const costNow = bodyCost(edited);
    const costAfter = costWithAdded(edited, cells);
    if (costAfter > edited.biomassLimit) {
      problem = `Not enough biomass: it costs ${formatBiomass(costAfter - costNow)}, ` +
        `you have ${formatBiomass(RULES.budget - costNow)} left.`;
    }
  }
  return { cells, problem };
}

// a saved cell turned by steps of 60° around the template's anchor and moved to (q, r); its Bud part turns with it
function turnTemplateCell(cell, steps, q, r) {
  const [turnedQ, turnedR] = rotateHex(cell.q, cell.r, steps);
  const turned = { ...cell, q: q + turnedQ, r: r + turnedR };
  if (cell.partRotation !== undefined) turned.partRotation = cell.partRotation + steps;
  if (cell.partOffset) turned.partOffset = rotateHex(cell.partOffset[0], cell.partOffset[1], steps);
  if (cell.partAim !== undefined) turned.partAim = cell.partAim + steps * Math.PI / 3;
  return turned;
}

// puts the stamp down on (q, r); returns the problem ('' = placed)
function placeStamp(edited, stamp, q, r) {
  const placement = stampPlacement(edited, stamp, q, r);
  if (placement.problem) return placement.problem;
  for (const cell of placement.cells) edited.cells.set(keyOfCell(cell), cell);
  return '';
}

// ---------- The library ----------
// A library entry from the selected cells (null if none). A selection with the Nucleus is a whole creature and is
// saved as it is; a part is saved around the cell nearest its middle, so that its stamp hangs under the cursor.
function templateFromSelection(edited, selectedKeys, name) {
  const cells = [...selectedKeys].filter(key => edited.cells.has(key)).map(key => edited.cells.get(key));
  if (!cells.length) return null;
  const isCreature = cells.some(cell => CELLS[cell.typeName].isNucleus);
  const anchor = isCreature ? { q: 0, r: 0 } : cellNearestMiddle(cells);
  return {
    name: cleanName(name),
    isCreature,
    cells: cells.map(cell => ({ ...cell, q: cell.q - anchor.q, r: cell.r - anchor.r })),
  };
}

// the cell nearest the cells' middle (the first one on a tie)
function cellNearestMiddle(cells) {
  const points = cells.map(cell => hexToPixel(cell.q, cell.r));
  const middleX = points.reduce((sum, [x]) => sum + x, 0) / points.length;
  const middleY = points.reduce((sum, [, y]) => sum + y, 0) / points.length;
  let nearest = 0;
  points.forEach(([x, y], i) => {
    const [nearestX, nearestY] = points[nearest];
    if (distanceSquared(x, y, middleX, middleY) < distanceSquared(nearestX, nearestY, middleX, middleY)) nearest = i;
  });
  return cells[nearest];
}

const cleanName = name => String(name).trim().slice(0, NAME_MAX_LENGTH);

// Adds the entry to the library, replacing an entry of the same kind with the same name.
// Returns the entry it replaced, or null.
function storeTemplate(library, entry) {
  const index = library.findIndex(other => other.name === entry.name && other.isCreature === entry.isCreature);
  if (index < 0) {
    library.push(entry);
    return null;
  }
  const replaced = library[index];
  library[index] = entry;
  return replaced;
}
