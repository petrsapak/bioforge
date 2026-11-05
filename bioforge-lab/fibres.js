'use strict';
// Nerve fibre geometry: a fibre runs from cell centre to cell centre, through the cells between its two ends. Routing,
// units, side-by-side lanes for drawing, adding a design's fibres to a creature, and cutting fibres whose cells are
// gone. Pure: no DOM.
// A design fibre is { from: { q, r }, to: { q, r } }: it carries the signal of the cell at `from` to the cell at `to`.
// A fibre the player laid by hand also has via: [{ q, r }, ...], the cells it runs through between its ends, in
// order; one without via takes the shortest route. The cells it passes through only carry it; they don't take its
// signal.

const FIBRE_LANE_GAP = 2.2;                               // px between fibres side by side across one side
const FIBRE_SIDE_SPREAD = 9;                              // px: the most room the fibres across one side take
const FIBRE_BEND_PULL = 0.5;                              // of a cell's middle-to-side, how far a fibre runs straight
const LINK_END_GAP = 0.45 * CELL_RADIUS;                  // px from a drawn link's end to its cell's middle
const LINK_CORNER_STEPS = 8;                              // straight pieces a rounded bend inside a cell is drawn with
const LINK_MAX_GAP_SHARE = 0.4;                           // of its first or last side, the most an end gap may take

// The cells a fibre may run through: their hex keys, in the order given, so routes come out the same on every run.
function createRouteArea(cells) {
  return new Set(cells.map(cell => hexKey(cell.q, cell.r)));
}

// The route of a fibre from cell `from` to cell `to` ({ q, r }) through the area's cells, by the fewest steps from
// neighbour to neighbour: { hexes (keys, from the start to the end), units (steps) }. null if there is no route.
function routeFibre(area, from, to) {
  const startKey = hexKey(from.q, from.r);
  const endKey = hexKey(to.q, to.r);
  if (startKey === endKey || !area.has(startKey) || !area.has(endKey)) return null;
  const cameFrom = new Map([[startKey, null]]);
  const queue = [from];
  for (let i = 0; i < queue.length; i++) {
    const { q, r } = queue[i];
    for (const [stepQ, stepR] of HEX_NEIGHBOURS) {
      const next = { q: q + stepQ, r: r + stepR };
      const nextKey = hexKey(next.q, next.r);
      if (!area.has(nextKey) || cameFrom.has(nextKey)) continue;
      cameFrom.set(nextKey, hexKey(q, r));
      if (nextKey === endKey) return traceRoute(cameFrom, endKey);
      queue.push(next);
    }
  }
  return null;
}

// The route of a fibre ({ from, to, via? }) through the area's cells: along its via cells if it has them, else the
// shortest. null if there is no route.
function fibreRoute(area, fibre) {
  if (!fibre.via) return routeFibre(area, fibre.from, fibre.to);
  return routeAlong(area, [fibre.from, ...fibre.via, fibre.to]);
}

// The route through these hexes ({ q, r }) in order: { hexes, units }, or null if one is not in the area, two in a
// row are not neighbours, or a hex comes twice.
function routeAlong(area, points) {
  const hexes = points.map(point => hexKey(point.q, point.r));
  if (new Set(hexes).size !== hexes.length || !hexes.every(key => area.has(key))) return null;
  for (let i = 1; i < points.length; i++) {
    if (!areHexNeighbours(points[i - 1], points[i])) return null;
  }
  return { hexes, units: hexes.length - 1 };
}

// a fibre with every hex it names ({ q, r }: its ends, and a fibre's via cells) moved by place
function moveLink(link, place) {
  const moved = { from: place(link.from), to: place(link.to) };
  if (link.via) moved.via = link.via.map(place);
  return moved;
}

// walks back from the end cell to the start cell
function traceRoute(cameFrom, endKey) {
  const hexes = [endKey];
  for (let key = cameFrom.get(endKey); key; key = cameFrom.get(key)) hexes.unshift(key);
  return { hexes, units: hexes.length - 1 };
}

// total fibre units of a design's fibres routed through its cells; fibres without a route count nothing
function fibreUnits(design) {
  const area = createRouteArea(design.cells);
  return (design.fibres || []).reduce((sum, fibre) => {
    const route = fibreRoute(area, fibre);
    return sum + (route ? route.units : 0);
  }, 0);
}

// Per group of the creature's living cells (the body, or one growing Bud part), the area its routes run through, made
// on first use. Returns a function from the group (a Bud, or null for the body) to its area.
function createGroupAreas(creature) {
  const areas = new Map();
  return group => {
    if (!areas.has(group)) {
      areas.set(group, createRouteArea(creature.cells.filter(cell => !cell.dead && cell.budParent === group)));
    }
    return areas.get(group);
  };
}

// the creature's living cells along a route, from its start to its end
function routeCells(creature, route) {
  return route.hexes.map(key => {
    const { q, r } = parseHexKey(key);
    return liveCellAt(creature, q, r);
  });
}

// ---------- Lanes ----------
// Where fibres run along each other. A fibre crosses each side between two cells square to it, and the fibres
// crossing one side lie side by side, spread evenly round the side's middle: a fibre alone crosses at the middle,
// two sit half a gap either side of it (user, 2026-11-05: "When I add another one the it will line up next to the
// first one and it will move the first one off the center"). Inside a cell a fibre bends from the side it comes in
// by to the side it leaves by, and its ends run square to its first and last side, stopping short of the end cells'
// middles. Fibres that run together keep their order all along, so they don't cross each other.
// paths: one per fibre, its stops from start to end as { node, x, y } (node: anything that names the cell, the same
// for every fibre through it). Returns one { line, colorIndex } per path: the [x, y] points it is drawn along, and a
// colour (an index) that no earlier fibre through one of its cells has, while the palette (paletteSize colours) lasts.
function layOutFibreLanes(paths, paletteSize) {
  const nodeIds = new Map();
  const idOf = node => {
    if (!nodeIds.has(node)) nodeIds.set(node, nodeIds.size);
    return nodeIds.get(node);
  };
  const walks = paths.map(path => ({ path, ids: path.map(stop => idOf(stop.node)) }));
  const offsets = sideOffsets(walks);
  const colorIndexes = fibreColors(walks, paletteSize);
  return walks.map(({ path }, i) => ({ line: laneLine(path, offsets[i]), colorIndex: colorIndexes[i] }));
}

// Each fibre's place on each side it crosses, in px from the side's middle to the left of the way the fibre runs.
// walks: [{ path, ids }]. Returns one list per fibre, with one offset per side it crosses.
function sideOffsets(walks) {
  const sides = new Map();
  walks.forEach((walk, walkIndex) => {
    for (let step = 0; step + 1 < walk.ids.length; step++) {
      const low = Math.min(walk.ids[step], walk.ids[step + 1]);
      const key = low + '-' + Math.max(walk.ids[step], walk.ids[step + 1]);
      if (!sides.has(key)) sides.set(key, []);
      sides.get(key).push({ walk, walkIndex, step, sense: walk.ids[step] === low ? 1 : -1 });
    }
  });
  const offsets = walks.map(({ ids }) => new Array(Math.max(0, ids.length - 1)).fill(0));
  for (const crossings of sides.values()) {
    crossings.sort((first, second) => compareOnSide(first, second) || first.walkIndex - second.walkIndex);
    const gap = crossings.length > 1 ? Math.min(FIBRE_LANE_GAP, FIBRE_SIDE_SPREAD / (crossings.length - 1)) : 0;
    crossings.forEach((crossing, i) => {
      offsets[crossing.walkIndex][crossing.step] = (i - (crossings.length - 1) / 2) * gap * crossing.sense;
    });
  }
  return offsets;
}

// Which of two fibres crossing one side lies further left, seen from the side's lower cell id toward its higher:
// positive when the first does, negative when the second does, 0 when nothing tells them apart. Both are followed
// past the side's higher cell, then past its lower one, until their routes part; the one that turns further left
// there (seen the way it is followed) lies on the left, so fibres running together keep one order and don't cross.
function compareOnSide(first, second) {
  for (const way of [1, -1]) {
    const turn = partingTurn(first, second, way);
    if (turn) return turn * way;
  }
  return 0;
}

// Where two crossings' fibres part, followed the given way past the side (1: past its higher cell, -1: past its
// lower): 1 if the first turns further left there, -1 if the second does, 0 if they end in the same cell.
function partingTurn(first, second, way) {
  for (let count = 1; ; count++) {
    const firstId = first.walk.ids[indexPastSide(first, way, count)];
    const secondId = second.walk.ids[indexPastSide(second, way, count)];
    if (firstId === undefined && secondId === undefined) return 0;
    if (firstId !== secondId) return Math.sign(leftTurn(first, way, count) - leftTurn(second, way, count));
  }
}

// The index in a crossing's path of the stop `count` cells past its side, followed the given way: 0 is the side's
// own cell on that way, -1 the cell on the other side of it. Beyond the path's ends the index has no stop.
function indexPastSide(crossing, way, count) {
  const along = crossing.sense * way;               // 1: in the fibre's own order, -1: against it
  const start = along > 0 ? crossing.step + 1 : crossing.step;
  return start + along * count;
}

// How far a fibre turns left on its way into the stop `count` cells past its side, followed the given way: from -1
// (a hard right) to 1 (a hard left), and 0 where it ends before it.
function leftTurn(crossing, way, count) {
  const path = crossing.walk.path;
  const next = path[indexPastSide(crossing, way, count)];
  if (!next) return 0;
  const here = path[indexPastSide(crossing, way, count - 1)];
  const before = path[indexPastSide(crossing, way, count - 2)];
  const inX = here.x - before.x;
  const inY = here.y - before.y;
  const outX = next.x - here.x;
  const outY = next.y - here.y;
  const lengths = Math.sqrt(inX * inX + inY * inY) * Math.sqrt(outX * outX + outY * outY) || 1;
  return (outX * inY - outY * inX) / lengths;
}

// a colour for each fibre that no earlier fibre through one of its cells has (see firstFreeColor)
function fibreColors(walks, paletteSize) {
  const placed = [];
  return walks.map(({ ids }) => {
    const sharing = placed.filter(other => ids.some(id => other.cells.has(id)));
    const colorIndex = firstFreeColor(sharing, paletteSize, placed.length);
    placed.push({ cells: new Set(ids), colorIndex });
    return colorIndex;
  });
}

// the lowest colour none of the sharing fibres has; once all are taken, the colours repeat in order
function firstFreeColor(sharing, paletteSize, fibreIndex) {
  const taken = new Set(sharing.map(other => other.colorIndex));
  for (let colorIndex = 0; colorIndex < paletteSize; colorIndex++) {
    if (!taken.has(colorIndex)) return colorIndex;
  }
  return fibreIndex % paletteSize;
}

// The line a fibre is drawn along in its lanes: square across each side at its offset there, bending inside the
// cells between, and running square into its first and last side from points short of its end cells' middles (see
// endRun). path: its stops ({ x, y }); offsets: px to the left of the way it runs, one per side it crosses.
function laneLine(path, offsets) {
  if (path.length < 2) return path.map(stop => [stop.x, stop.y]);
  const crossings = offsets.map((offset, step) => sideCrossing(path[step], path[step + 1], offset));
  const first = crossings[0];
  const last = crossings[crossings.length - 1];
  const line = [pointAlong(first, -endRun(first))];
  crossings.forEach((crossing, i) => {
    line.push(crossing.point);
    if (i + 1 < crossings.length) line.push(...bendBetween(crossing, crossings[i + 1]));
  });
  line.push(pointAlong(last, endRun(last)));
  return line;
}

// Where a fibre crosses the side between two neighbouring stops, offset px to the left of the way it runs:
// { point, direction (the way it runs, a unit vector), reach (px from either stop to the side) }.
function sideCrossing(from, to, offset) {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY) || 1;
  const directionX = deltaX / length;
  const directionY = deltaY / length;
  return {
    point: [(from.x + to.x) / 2 + directionY * offset, (from.y + to.y) / 2 - directionX * offset],
    direction: [directionX, directionY],
    reach: length / 2,
  };
}

// the point `distance` px from where a fibre crosses a side, the way it runs (back the other way when negative)
function pointAlong(crossing, distance) {
  return [crossing.point[0] + crossing.direction[0] * distance, crossing.point[1] + crossing.direction[1] * distance];
}

// how far a fibre's end runs into its end cell from the side: to LINK_END_GAP px short of the cell's middle, but
// keeping at least the share LINK_MAX_GAP_SHARE of the way between the two cells' middles as a gap
function endRun(crossing) {
  return crossing.reach - Math.min(LINK_END_GAP, 2 * crossing.reach * LINK_MAX_GAP_SHARE);
}

// the points of the curve inside a cell from where a fibre comes in (entry) to where it leaves (exit), square to
// both sides; the two crossing points themselves are left out
function bendBetween(entry, exit) {
  const pull = FIBRE_BEND_PULL * Math.min(entry.reach, exit.reach);
  const entryControl = pointAlong(entry, pull);
  const exitControl = pointAlong(exit, -pull);
  const points = [];
  for (let step = 1; step < LINK_CORNER_STEPS; step++) {
    points.push(cubicPoint(entry.point, entryControl, exitControl, exit.point, step / LINK_CORNER_STEPS));
  }
  return points;
}

// the point at `fraction` (0 to 1) along the curve from `start` to `end` pulled toward the two controls
function cubicPoint(start, startControl, endControl, end, fraction) {
  const rest = 1 - fraction;
  const weights = [rest * rest * rest, 3 * rest * rest * fraction, 3 * rest * fraction * fraction,
    fraction * fraction * fraction];
  const points = [start, startControl, endControl, end];
  return [0, 1].map(axis => points.reduce((sum, point, i) => sum + point[axis] * weights[i], 0));
}

// The line a fibre is drawn along, from its points ([x, y]: its cells' centres, or its lane beside them).
// It runs straight across the border between two cells and bends in a curve inside each cell it passes through,
// instead of turning a sharp corner at the cell's centre. Its ends stop `gap` px short of the end cells' centres, so
// they show beside the neuron or the cell's symbol instead of under it. Returns [x, y] points.
function smoothLinkLine(points, gap = LINK_END_GAP) {
  if (points.length < 2) return points.slice();
  const halfway = (first, second) => [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2];
  const line = [pointToward(points[0], points[1], gap)];
  for (let i = 1; i < points.length - 1; i++) {
    const enter = halfway(points[i - 1], points[i]);
    const leave = halfway(points[i], points[i + 1]);
    for (let step = 0; step <= LINK_CORNER_STEPS; step++) {
      line.push(quadraticPoint(enter, points[i], leave, step / LINK_CORNER_STEPS));
    }
  }
  line.push(pointToward(points[points.length - 1], points[points.length - 2], gap));
  return line;
}

// the point `distance` px from `from` toward `to`, but never more than a share of the way, so a short side keeps a line
function pointToward(from, to, distance) {
  const deltaX = to[0] - from[0];
  const deltaY = to[1] - from[1];
  const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  if (length === 0) return [from[0], from[1]];
  const share = Math.min(distance / length, LINK_MAX_GAP_SHARE);
  return [from[0] + deltaX * share, from[1] + deltaY * share];
}

// the point at `fraction` (0 to 1) along the curve from `start` to `end` pulled toward `control`
function quadraticPoint(start, control, end, fraction) {
  const rest = 1 - fraction;
  const startWeight = rest * rest;
  const controlWeight = 2 * rest * fraction;
  const endWeight = fraction * fraction;
  return [
    start[0] * startWeight + control[0] * controlWeight + end[0] * endWeight,
    start[1] * startWeight + control[1] * controlWeight + end[1] * endWeight,
  ];
}

// ---------- Fibres in the world ----------
// Adds the creature's missing fibres from a design fibre list: those whose two cells are both alive and in the same
// group (the body, or one growing Bud part), routed through that group's living cells. Called at spawn, and when cells
// grow or regrow. Fibres already there are kept.
function connectFibres(world, creature, designFibres) {
  if (!designFibres || !designFibres.length) return;
  const areaFor = createGroupAreas(creature);
  for (const designFibre of designFibres) {
    const from = liveCellAt(creature, designFibre.from.q, designFibre.from.r);
    const to = liveCellAt(creature, designFibre.to.q, designFibre.to.r);
    if (!from || !to || from.budParent !== to.budParent) continue;
    if (world.fibres.some(fibre => fibre.from === from && fibre.to === to)) continue;
    const route = fibreRoute(areaFor(from.budParent), designFibre);
    if (route) world.fibres.push(createFibre(from, to, routeCells(creature, route), route.units));
  }
}

// the one place a world fibre is built. path: the cells it runs through, from start to end; value: the signal it
// delivers this nerve step
function createFibre(from, to, path, units) {
  return { from, to, path, units, value: 0 };
}

// Removes fibres that lost a cell they run through (their start and end included), or whose cells were split into
// different creatures.
function cutBrokenFibres(world) {
  world.fibres = world.fibres.filter(fibre =>
    fibre.path.every(cell => !cell.dead && cell.creature === fibre.from.creature));
}
