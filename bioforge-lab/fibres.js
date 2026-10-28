'use strict';
// Nerve fibre geometry: a fibre runs from cell centre to cell centre, through the cells between its two ends. Routing,
// units, adding a design's fibres to a creature, and cutting fibres whose cells are gone. Pure: no DOM.
// A design fibre is { from: { q, r }, to: { q, r } }: it carries the signal of the cell at `from` to the cell at `to`.
// The cells it passes through only carry it; they don't take its signal.

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

// walks back from the end cell to the start cell
function traceRoute(cameFrom, endKey) {
  const hexes = [endKey];
  for (let key = cameFrom.get(endKey); key; key = cameFrom.get(key)) hexes.unshift(key);
  return { hexes, units: hexes.length - 1 };
}

// total fibre units of a design's fibres routed through its cells; fibres without a route count nothing
function fibreUnits(design) {
  return routedUnits(design.cells, design.fibres || []);
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
    const route = routeFibre(areaFor(from.budParent), from, to);
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
