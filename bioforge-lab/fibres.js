'use strict';
// Nerve fibre geometry: a fibre runs from cell centre to cell centre, through the cells between its two ends. Routing,
// units, side-by-side lanes for drawing, adding a design's fibres to a creature, and cutting fibres whose cells are
// gone. Pure: no DOM.
// A design fibre is { from: { q, r }, to: { q, r } }: it carries the signal of the cell at `from` to the cell at `to`.
// A fibre the player laid by hand also has via: [{ q, r }, ...], the cells it runs through between its ends, in
// order; one without via takes the shortest route. The cells it passes through only carry it; they don't take its
// signal.

const FIBRE_LANE_GAP = 2.2;                               // px between fibres side by side in one cell
const FIBRE_LANE_SPREAD = 6.5;                            // px: the outermost lane's furthest distance from a centre
const FIBRE_MITER_LIMIT = 2;                              // times the lane offset a corner may stick out
const FIBRE_LANE_ORDER = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6];   // lanes tried, from the centre outward
const LINK_END_GAP = 0.45 * CELL_RADIUS;                  // px from a drawn fibre's or vessel's end to its cell's middle
const LINK_CORNER_STEPS = 6;                              // straight pieces a rounded bend inside a cell is drawn with
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

// a fibre or vessel with every hex it names ({ q, r }: its ends, and a fibre's via cells) moved by place
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

// total units of links ({ from, to }: fibres or vessels) routed through these cells; unroutable links count nothing
function routedUnits(cells, links) {
  const area = createRouteArea(cells);
  return links.reduce((sum, link) => {
    const route = routeFibre(area, link.from, link.to);
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
// Side-by-side lanes for drawing fibres, so that fibres sharing a cell run next to each other instead of on top of
// each other. paths: one per fibre, its stops from start to end as { node, x, y } (node: anything that names the
// cell, the same for every fibre through it). Returns one { points, lane, colorIndex } per path: its line shifted
// sideways into its lane, and a colour (an index) that no earlier fibre through one of its cells has, while the
// palette (paletteSize colours) lasts.
function layOutFibreLanes(paths, paletteSize) {
  const nodeIds = new Map();
  const idOf = node => {
    if (!nodeIds.has(node)) nodeIds.set(node, nodeIds.size);
    return nodeIds.get(node);
  };
  const placed = [];
  for (const path of paths) {
    const ids = path.map(stop => idOf(stop.node));
    const fibre = { cells: new Set(ids), edges: fibreEdges(ids), lane: 0, colorIndex: 0 };
    const sharing = placed.filter(other => ids.some(id => other.cells.has(id)));
    const freeLane = FIBRE_LANE_ORDER.find(lane => isLaneFree(fibre, lane, sharing));
    fibre.lane = freeLane === undefined ? 0 : freeLane;
    fibre.colorIndex = firstFreeColor(sharing, paletteSize, placed.length);
    placed.push(fibre);
  }
  const widestLane = Math.max(1, ...placed.map(fibre => Math.abs(fibre.lane)));
  const gap = Math.min(FIBRE_LANE_GAP, FIBRE_LANE_SPREAD / widestLane);
  return paths.map((path, i) => ({
    points: offsetPolyline(path, placed[i].lane * gap),
    lane: placed[i].lane,
    colorIndex: placed[i].colorIndex,
  }));
}

// The sides between a path's stops, by a key the same either way round, each with +1 if the path runs from the lower
// id to the higher one and -1 if the other way.
function fibreEdges(ids) {
  const edges = new Map();
  for (let i = 1; i < ids.length; i++) {
    const low = Math.min(ids[i - 1], ids[i]);
    const high = Math.max(ids[i - 1], ids[i]);
    edges.set(low + '-' + high, ids[i - 1] === low ? 1 : -1);
  }
  return edges;
}

// Fibres sharing a cell keep different lanes. A lane counts to the left of the way a fibre runs, so on a shared side
// two fibres running opposite ways also collide when one's lane is minus the other's.
function isLaneFree(fibre, lane, sharing) {
  return sharing.every(other => {
    if (other.lane === lane) return false;
    for (const [edge, direction] of fibre.edges) {
      if (other.edges.has(edge) && other.edges.get(edge) * other.lane === direction * lane) return false;
    }
    return true;
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

// The path's stops ({ x, y }) as [x, y] points moved sideways by offset px, to the left of the way it runs; corners
// are mitred, so the shifted lines stay parallel to the centre line.
function offsetPolyline(path, offset) {
  const normals = [];
  for (let i = 1; i < path.length; i++) {
    const deltaX = path[i].x - path[i - 1].x;
    const deltaY = path[i].y - path[i - 1].y;
    const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY) || 1;
    normals.push([deltaY / length, -deltaX / length]);
  }
  return path.map((stop, i) => {
    const before = normals[i - 1] || normals[i];
    const after = normals[i] || normals[i - 1];
    if (!before) return [stop.x, stop.y];
    const sumX = before[0] + after[0];
    const sumY = before[1] + after[1];
    const sumLength = Math.sqrt(sumX * sumX + sumY * sumY);
    if (sumLength < 0.1) return [stop.x + before[0] * offset, stop.y + before[1] * offset];
    const stretch = Math.min(FIBRE_MITER_LIMIT, 2 / sumLength);
    return [stop.x + sumX / sumLength * offset * stretch, stop.y + sumY / sumLength * offset * stretch];
  });
}

// The line a fibre or vessel is drawn along, from its points ([x, y]: its cells' centres, or its lane beside them).
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
