'use strict';
// The design being edited in the builder, and every editing rule: placing and removing cells, Bud parts and their aim,
// neurons, fibres and Command keys, vessels, stamping saved parts, and saving a selection. Pure: no DOM, so the rules
// are tested in Node. Cells that aren't joined to the Nucleus are only planned: they cost nothing and stay out of the
// creature, and so do fibres and vessels to or from them.

const BUD_AIM_HANDLE_RADIUS = 12;                         // grid px around an aim arrow's tip that grab it
const BUD_AIM_ARROW_LENGTH = 18;                          // grid px
const MIN_AIM_DRAG = 2;                                   // grid px the aim tip must be dragged to count
const NAME_MAX_LENGTH = 40;                               // characters in a saved name
const NEURON_PICK_RADIUS = 6;                             // grid px around a cell's centre that pick its neuron
const FIBRE_PICK_DISTANCE = 3;                            // grid px from a fibre's line that pick the fibre
const VESSEL_PICK_DISTANCE = 5;                           // grid px from a vessel's line that pick the vessel
const STROKE_SAMPLE_SPACING = HEX_SPACING_X / 4;          // grid px between the points a painting drag is read at

const keyOfCell = cell => hexKey(cell.q, cell.r);
// biomass shown to the half point
const formatBiomass = value => String(Math.round(value * 2) / 2);
// a count of 60° steps wrapped into 0..5
const wrapTurns = turns => (turns % 6 + 6) % 6;

// ---------- The edited design ----------
// The one place an edited design is built from a design ({ cells, fibres, vessels }). Its cells, fibres and vessels
// are copies, so the source design stays as it was. biomassLimit: RULES.budget, or Infinity while building without a
// limit. kit: the chosen level's material kit, which takes the budget's place (unless the limit is Infinity).
function createEditedDesign(design, biomassLimit = RULES.budget, kit = null) {
  return {
    cells: new Map(design.cells.map(cell => [keyOfCell(cell), { ...cell }])),
    fibres: (design.fibres || []).map(copyLink),
    vessels: (design.vessels || []).map(copyLink),
    biomassLimit,
    kit,
  };
}

// a copy of a fibre or vessel ({ from, to }, and a fibre's via cells if it has them)
function copyLink(link) {
  const copy = { from: { ...link.from }, to: { ...link.to } };
  if (link.via) copy.via = link.via.map(point => ({ ...point }));
  return copy;
}

const fibreStartKey = fibre => hexKey(fibre.from.q, fibre.from.r);
const fibreEndKey = fibre => hexKey(fibre.to.q, fibre.to.r);
// whether a fibre or vessel has both ends among these hex keys
const isLinkWithin = (link, keys) => keys.has(fibreStartKey(link)) && keys.has(fibreEndKey(link));
// the link, without its via cells if one of them is not among these hex keys (it then takes the shortest route)
function keepViaWithin(link, keys) {
  if (link.via && !link.via.every(point => keys.has(hexKey(point.q, point.r)))) delete link.via;
  return link;
}
// whether a vessel runs between these two hex keys, either way round
const isVesselBetween = (vessel, firstKey, secondKey) =>
  (fibreStartKey(vessel) === firstKey && fibreEndKey(vessel) === secondKey) ||
  (fibreStartKey(vessel) === secondKey && fibreEndKey(vessel) === firstKey);

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

// the creature that is spawned: the joined cells and the fibres and vessels between them
function bodyDesign(edited) {
  const joined = joinedKeys(edited);
  return {
    cells: bodyCells(edited),
    fibres: edited.fibres.filter(fibre => isLinkWithin(fibre, joined)),
    vessels: edited.vessels.filter(vessel => isLinkWithin(vessel, joined)),
  };
}

function bodyCost(edited) {
  return designCost(bodyDesign(edited));
}

// what measure(body) gives if these cells were added on free hexes; the design itself is left as it was
function measureWithAdded(edited, cells, measure) {
  for (const cell of cells) edited.cells.set(keyOfCell(cell), cell);
  const result = measure(bodyDesign(edited));
  for (const cell of cells) edited.cells.delete(keyOfCell(cell));
  return result;
}

// the body's cost if these cells were added on free hexes
function costWithAdded(edited, cells) {
  return measureWithAdded(edited, cells, designCost);
}

// whether the edited design is held to a material kit rather than a biomass budget
const usesKit = edited => !!edited.kit && edited.biomassLimit !== Infinity;

// what the body would lack of the kit with these cells added ('' = they fit, or there is no kit)
function kitShortfallWithAdded(edited, cells) {
  return usesKit(edited) ? measureWithAdded(edited, cells, body => kitShortfall(body, edited.kit)) : '';
}

// ---------- Cells ----------
// A cell can go on a free grid hex that no Bud part needs. Off the body it is only planned; joining the body must
// fit the biomass limit, or the kit.
function canPlaceCell(edited, q, r, typeName) {
  const key = hexKey(q, r);
  if (!isInGrid(q, r) || edited.cells.has(key) || reservedHexes(edited).has(key)) return false;
  const added = [createDesignCell(q, r, typeName)];
  if (usesKit(edited)) return !kitShortfallWithAdded(edited, added);
  return costWithAdded(edited, added) <= edited.biomassLimit;
}

function placeCell(edited, q, r, typeName) {
  edited.cells.set(hexKey(q, r), createDesignCell(q, r, typeName));
}

// Removes the cell on (q, r) with its neuron, fibres and vessels, except the Nucleus. Cells cut off from the Nucleus
// stay, as planned cells. A fibre laid through the cell keeps its ends and takes the shortest route again.
function removeCell(edited, q, r) {
  const key = hexKey(q, r);
  const cell = edited.cells.get(key);
  if (!cell || CELLS[cell.typeName].isNucleus) return;
  edited.cells.delete(key);
  const isElsewhere = link => fibreStartKey(link) !== key && fibreEndKey(link) !== key;
  edited.fibres = edited.fibres.filter(isElsewhere);
  edited.vessels = edited.vessels.filter(isElsewhere);
  for (const fibre of edited.fibres) {
    if (fibre.via && fibre.via.some(point => hexKey(point.q, point.r) === key)) delete fibre.via;
  }
}

// ---------- Symmetry ----------
// A mirror axis runs through the Nucleus at a multiple of 30° (its number of turns, 0–5, clockwise on screen from
// the horizontal; 3 is the front-to-back line). Only those angles map every hex onto a hex.
const MIRROR_AXIS_COUNT = 6;
const FRONT_TO_BACK_AXIS = 3;

// the hex of the design's Nucleus, which the mirror axes run through
function mirrorCentre(edited) {
  for (const cell of edited.cells.values()) {
    if (CELLS[cell.typeName].isNucleus) return [cell.q, cell.r];
  }
  return [0, 0];
}

// (q, r) mirrored across one axis through the centre: flipped top to bottom, then turned twice the axis angle
function mirrorHex(q, r, axisTurns, [centreQ, centreR]) {
  const offsetQ = q - centreQ;
  const offsetR = r - centreR;
  const [turnedQ, turnedR] = rotateHex(offsetQ + offsetR, -offsetR, axisTurns);
  return [centreQ + turnedQ, centreR + turnedR];
}

// (q, r) and all its mirror images across the axes and their combinations, (q, r) first, each hex once
function mirrorImages(edited, q, r, axes) {
  const centre = mirrorCentre(edited);
  const images = [[q, r]];
  const seen = new Set([hexKey(q, r)]);
  for (let i = 0; i < images.length; i++) {
    for (const axisTurns of axes) {
      const image = mirrorHex(images[i][0], images[i][1], axisTurns, centre);
      if (seen.has(hexKey(...image))) continue;
      seen.add(hexKey(...image));
      images.push(image);
    }
  }
  return images;
}

// Where a click on (q, r) puts cells with the axes on: (q, r) and each free mirror image. Images on another cell or
// a Bud part's hex are skipped; the whole group must fit the biomass limit or the kit. Empty if it can't be placed.
function mirroredPlacement(edited, q, r, typeName, axes) {
  if (!canPlaceCell(edited, q, r, typeName)) return [];
  const reserved = reservedHexes(edited);
  const hexes = mirrorImages(edited, q, r, axes).filter(([imageQ, imageR]) => isInGrid(imageQ, imageR) &&
    !edited.cells.has(hexKey(imageQ, imageR)) && !reserved.has(hexKey(imageQ, imageR)));
  const added = hexes.map(([imageQ, imageR]) => createDesignCell(imageQ, imageR, typeName));
  const fits = usesKit(edited) ? !kitShortfallWithAdded(edited, added)
    : costWithAdded(edited, added) <= edited.biomassLimit;
  return fits ? hexes : [];
}

// places the chosen cell on (q, r) and on its free mirror images; the number of cells placed (0: it didn't fit)
function placeMirrored(edited, q, r, typeName, axes) {
  const hexes = mirroredPlacement(edited, q, r, typeName, axes);
  for (const [imageQ, imageR] of hexes) placeCell(edited, imageQ, imageR, typeName);
  return hexes.length;
}

// removes the cell on (q, r) and the cells of its type on its mirror images; the number of cells removed
function removeMirrored(edited, q, r, axes) {
  const cell = edited.cells.get(hexKey(q, r));
  if (!cell || CELLS[cell.typeName].isNucleus) return 0;
  const twins = mirrorImages(edited, q, r, axes).filter(([imageQ, imageR]) => {
    const image = edited.cells.get(hexKey(imageQ, imageR));
    return image && typeOfCell(image) === typeOfCell(cell);
  });
  for (const [imageQ, imageR] of twins) removeCell(edited, imageQ, imageR);
  return twins.length;
}

// the hexes a stroke from one grid point to another passes over, in order, each once (a fast drag skips hexes
// between two mouse moves otherwise)
function hexesAlongStroke([fromX, fromY], [toX, toY]) {
  const length = Math.sqrt((toX - fromX) * (toX - fromX) + (toY - fromY) * (toY - fromY));
  const steps = Math.max(1, Math.ceil(length / STROKE_SAMPLE_SPACING));
  const hexes = [];
  const seen = new Set();
  for (let i = 0; i <= steps; i++) {
    const hex = pixelToHex(fromX + (toX - fromX) * i / steps, fromY + (toY - fromY) * i / steps);
    if (seen.has(hexKey(...hex))) continue;
    seen.add(hexKey(...hex));
    hexes.push(hex);
  }
  return hexes;
}

// ---------- The nerve layer ----------
// puts a neuron of this kind into the cell (replacing any other kind)
function placeNeuron(edited, key, kind) {
  const cell = edited.cells.get(key);
  if (!cell || (cell.neuron && cell.neuron.kind === kind)) return;
  cell.neuron = createNeuron(kind);
}

// takes the cell's neuron out, with a Command's key binding
function removeNeuron(edited, key) {
  const cell = edited.cells.get(key);
  if (!cell) return;
  delete cell.neuron;
  delete cell.boundKey;
}

// the hormones a Receptor can sense, as their fluid channels (data/fluids.js)
const HORMONES = FLUIDS.filter(fluid => fluid.layer === 'chemical');

// sets which hormone the Receptor at key senses; the default one is left out of the design
function setSensedHormone(edited, key, hormoneId) {
  const cell = edited.cells.get(key);
  if (!cell || CELLS[cell.typeName].senses !== 'hormone' || !HORMONES.some(fluid => fluid.id === hormoneId)) return;
  if (hormoneId === DEFAULT_SENSED_HORMONE) delete cell.sensedHormone;
  else cell.sensedHormone = hormoneId;
}

// moves the cell's neuron setting by steps of its step size, within its limits
function changeNeuronSetting(edited, key, steps) {
  const neuron = edited.cells.get(key).neuron;
  const setting = NEURONS[neuron.kind].setting;
  if (!setting) return;
  const value = neuron.setting + steps * setting.step;
  neuron.setting = Math.round(Math.max(setting.min, Math.min(setting.max, value)) * 100) / 100;
}

// Lays a fibre from one cell to another, or removes it if it is already there. viaKeys: the hex keys of the cells it
// runs through between its ends, as the player drew it (null: the shortest route). A fibre already there on another
// route is moved onto this one instead. Returns what happened: 'laid', 'rerouted', 'removed', or '' when there is
// nothing to do (the same cell, or a hex without a cell).
function toggleFibre(edited, fromKey, toKey, viaKeys = null) {
  const toggle = planFibreToggle(edited, fromKey, toKey, viaKeys);
  if (toggle.result === 'laid') edited.fibres.push(toggle.fibre);
  if (toggle.result === 'removed') edited.fibres.splice(toggle.index, 1);
  if (toggle.result === 'rerouted') edited.fibres[toggle.index] = toggle.fibre;
  return toggle.result;
}

// What toggleFibre would do, without doing it: { result, fibre (the new one), index (of the one already there) }.
function planFibreToggle(edited, fromKey, toKey, viaKeys = null) {
  if (fromKey === toKey || !edited.cells.has(fromKey) || !edited.cells.has(toKey)) return { result: '' };
  const fibre = { from: parseHexKey(fromKey), to: parseHexKey(toKey) };
  if (viaKeys) fibre.via = viaKeys.map(parseHexKey);
  const index = edited.fibres.findIndex(other => fibreStartKey(other) === fromKey && fibreEndKey(other) === toKey);
  if (index < 0) return { result: 'laid', fibre };
  const area = createRouteArea(bodyCells(edited));
  const oldRoute = fibreRoute(area, edited.fibres[index]);
  const newRoute = fibreRoute(area, fibre);
  const isSameRoute = !viaKeys || !oldRoute || !newRoute || oldRoute.hexes.join() === newRoute.hexes.join();
  return { result: isSameRoute ? 'removed' : 'rerouted', fibre, index };
}

// The route a fibre being drawn takes after the mouse moves onto the cell at key: pathKeys (its hex keys so far, from
// its start) with the cell added if it touches the last one, cut back to it if the path already runs through it,
// or joined to it by the shortest way round the path's own cells if the mouse skipped cells. Hexes outside the body
// leave the path as it was.
function extendFibrePath(edited, pathKeys, key) {
  const lastKey = pathKeys[pathKeys.length - 1];
  const bodyKeys = createRouteArea(bodyCells(edited));
  if (key === lastKey || !bodyKeys.has(key)) return pathKeys;
  const index = pathKeys.indexOf(key);
  if (index >= 0) return pathKeys.slice(0, index + 1);
  if (areHexNeighbours(parseHexKey(lastKey), parseHexKey(key))) return [...pathKeys, key];
  const earlier = new Set(pathKeys.slice(0, -1));
  const freeArea = new Set([...bodyKeys].filter(bodyKey => !earlier.has(bodyKey)));
  const detour = routeFibre(freeArea, parseHexKey(lastKey), parseHexKey(key));
  return detour ? [...pathKeys, ...detour.hexes.slice(1)] : pathKeys;
}

// the body's fibres with their routes through the body's cells: [{ fibre, route }]
function routedBodyFibres(edited) {
  const body = bodyDesign(edited);
  const area = createRouteArea(body.cells);
  return body.fibres
    .map(fibre => ({ fibre, route: fibreRoute(area, fibre) }))
    .filter(({ route }) => route);
}

// The body's fibres for drawing, side by side where they share cells (see layOutFibreLanes): [{ fibre, route,
// points (grid px), lane, colorIndex }]. paletteSize: how many fibre colours there are to share out.
function laidOutBodyFibres(edited, paletteSize = 1) {
  const routed = routedBodyFibres(edited);
  const paths = routed.map(({ route }) => route.hexes.map(key => {
    const { q, r } = parseHexKey(key);
    const [x, y] = hexToPixel(q, r);
    return { node: key, x, y };
  }));
  const lanes = layOutFibreLanes(paths, paletteSize);
  return routed.map((entry, i) => ({ ...entry, ...lanes[i] }));
}

// links (fibres or vessels) with their routes through these cells; links without a route are left out
function routeLinks(cells, links) {
  const area = createRouteArea(cells);
  return links
    .map(link => ({ link, route: routeFibre(area, link.from, link.to) }))
    .filter(({ route }) => route);
}

// how much of the nerve limits the body uses
function nerveUsage(edited) {
  const body = bodyDesign(edited);
  return { neurons: body.cells.filter(cell => cell.neuron).length, units: fibreUnits(body) };
}

// removes this fibre (an entry of edited.fibres)
function removeFibre(edited, fibre) {
  edited.fibres = edited.fibres.filter(other => other !== fibre);
}

// What a right-click at a grid point takes out in the Nerve view: { neuronKey } or { fibre }, or null. Near a cell's
// centre its neuron wins; elsewhere the nearest fibre line within reach (the one drawn last, on top, when tied); and
// anywhere else on a cell with a neuron, that neuron.
function nerveRemovalTarget(edited, [x, y]) {
  const [q, r] = pixelToHex(x, y);
  const key = hexKey(q, r);
  const cell = edited.cells.get(key);
  const [centerX, centerY] = hexToPixel(q, r);
  const hasNeuron = !!cell && !!cell.neuron;
  if (hasNeuron && distanceSquared(x, y, centerX, centerY) <= square(NEURON_PICK_RADIUS)) return { neuronKey: key };
  const laidOut = laidOutBodyFibres(edited).map(({ fibre, points }) => ({ link: fibre, points }));
  const nearest = nearestLink(laidOut, x, y, FIBRE_PICK_DISTANCE);
  if (nearest) return { fibre: nearest };
  return hasNeuron ? { neuronKey: key } : null;
}

// The link whose route passes nearest the grid point (x, y), within reach; the one drawn last, on top, when tied.
// routed: [{ link, route }]. null if none is in reach.
function nearestRoutedLink(routed, x, y, reach) {
  const drawn = routed.map(({ link, route }) => ({
    link,
    points: route.hexes.map(routeKey => {
      const point = parseHexKey(routeKey);
      return hexToPixel(point.q, point.r);
    }),
  }));
  return nearestLink(drawn, x, y, reach);
}

// The link whose drawn line passes nearest the grid point (x, y), within reach; the one drawn last when tied.
// drawn: [{ link, points ([x, y] grid px) }]. null if none is in reach.
function nearestLink(drawn, x, y, reach) {
  let nearest = null;
  let nearestDistance = reach;
  for (const { link, points } of drawn) {
    for (let i = 1; i < points.length; i++) {
      const distance = distanceToSegment(x, y, points[i - 1], points[i]);
      if (distance <= nearestDistance) {
        nearest = link;
        nearestDistance = distance;
      }
    }
  }
  return nearest;
}

// ---------- The vascular layer ----------
// Lays a vessel between two cells, or removes the one already there (either way round). Returns what happened:
// 'laid', 'removed', or '' when there is nothing to do (the same cell, or a hex without a cell).
function toggleVessel(edited, fromKey, toKey) {
  if (fromKey === toKey || !edited.cells.has(fromKey) || !edited.cells.has(toKey)) return '';
  const index = edited.vessels.findIndex(vessel => isVesselBetween(vessel, fromKey, toKey));
  if (index >= 0) {
    edited.vessels.splice(index, 1);
    return 'removed';
  }
  edited.vessels.push({ from: parseHexKey(fromKey), to: parseHexKey(toKey) });
  return 'laid';
}

// the body's vessels with their routes through the body's cells, for drawing: [{ link, route }]
function routedBodyVessels(edited) {
  const body = bodyDesign(edited);
  return routeLinks(body.cells, body.vessels);
}

// vessel units the body uses
function vesselUsage(edited) {
  return vesselUnits(bodyDesign(edited));
}

// removes this vessel (an entry of edited.vessels)
function removeVessel(edited, vessel) {
  edited.vessels = edited.vessels.filter(other => other !== vessel);
}

// the vessel a right-click at a grid point takes out in the Vessels view, or null
function vesselRemovalTarget(edited, [x, y]) {
  return nearestRoutedLink(routedBodyVessels(edited), x, y, VESSEL_PICK_DISTANCE);
}

// grid px from a point to the line segment between two points
function distanceToSegment(x, y, [fromX, fromY], [toX, toY]) {
  const lengthSquared = distanceSquared(fromX, fromY, toX, toY);
  if (!lengthSquared) return Math.sqrt(distanceSquared(x, y, fromX, fromY));
  const along = clamp01(((x - fromX) * (toX - fromX) + (y - fromY) * (toY - fromY)) / lengthSquared);
  return Math.sqrt(distanceSquared(x, y, fromX + (toX - fromX) * along, fromY + (toY - fromY) * along));
}

// fibres into and out of a cell
function fibresAt(edited, key) {
  return {
    incoming: edited.fibres.filter(fibre => fibreEndKey(fibre) === key).length,
    outgoing: edited.fibres.filter(fibre => fibreStartKey(fibre) === key).length,
  };
}

// binds a Command to a key ('a'–'z' or '0'–'9'); pressing its key again unbinds it (it then fires on Space)
function toggleCommandKey(edited, key, commandKey) {
  const command = edited.cells.get(key);
  if (command.boundKey === commandKey) delete command.boundKey;
  else command.boundKey = commandKey;
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
    cells: template.cells.map(partCellOf),
    fibres: (template.fibres || []).map(copyLink),
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

// a library cell as a cell of a Bud part: its place, type and neuron (a part has no key bindings or parts of its own)
function partCellOf({ q, r, typeName, neuron }) {
  return createDesignCell(q, r, typeName, neuron ? { neuron } : {});
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
// Its cells turned and moved to (q, r), leaving out hexes already taken, its fibres and vessels between the cells
// that are placed, and the problem if it can't go there.
function stampPlacement(edited, stamp, q, r) {
  const cells = stamp.template.cells
    .map(cell => turnTemplateCell(cell, stamp.rotation, q, r))
    .filter(cell => !edited.cells.has(keyOfCell(cell)));
  const placedKeys = new Set(cells.map(keyOfCell));
  const fibres = placeStampLinks(stamp.template.fibres, stamp.rotation, q, r, placedKeys);
  const vessels = placeStampLinks(stamp.template.vessels, stamp.rotation, q, r, placedKeys);
  const reserved = reservedHexes(edited);
  let problem = '';
  if (!cells.length) problem = 'Every hex there is already taken.';
  else if (cells.some(cell => !isInGrid(cell.q, cell.r))) problem = 'Part of it is off the grid.';
  else if (cells.some(cell => reserved.has(keyOfCell(cell)))) problem = "It covers hexes kept free for a Bud's part.";
  else if (usesKit(edited)) {
    const shortfall = kitShortfallWithAdded(edited, cells);
    if (shortfall) problem = shortfall + '.';
  } else {
    const costNow = bodyCost(edited);
    const costAfter = costWithAdded(edited, cells);
    if (costAfter > edited.biomassLimit) {
      problem = `Not enough biomass: it costs ${formatBiomass(costAfter - costNow)}, ` +
        `you have ${formatBiomass(edited.biomassLimit - costNow)} left.`;
    }
  }
  return { cells, fibres, vessels, problem };
}

// a stamp's fibres or vessels turned and moved with its cells, keeping those between cells that are placed
function placeStampLinks(links, rotation, q, r, placedKeys) {
  const place = point => {
    const turned = turnTemplateCell(point, rotation, q, r);
    return { q: turned.q, r: turned.r };
  };
  return (links || [])
    .map(link => moveLink(link, place))
    .filter(link => isLinkWithin(link, placedKeys))
    .map(link => keepViaWithin(link, placedKeys));
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
  edited.fibres.push(...placement.fibres);
  edited.vessels.push(...placement.vessels);
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
  const shift = ({ q, r }) => ({ q: q - anchor.q, r: r - anchor.r });
  const selected = new Set(selectedKeys);
  const shiftLinks = links => links
    .filter(link => isLinkWithin(link, selected))
    .map(link => keepViaWithin(moveLink(link, shift), selected));
  return {
    name: cleanName(name),
    isCreature,
    cells: cells.map(cell => ({ ...cell, ...shift(cell) })),
    fibres: shiftLinks(edited.fibres),
    vessels: shiftLinks(edited.vessels),
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
