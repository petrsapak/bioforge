'use strict';
// Terrain: a level's rock and currents. Rock is built of hex tiles on the cells' own grid; cells pressed against it
// are pushed out, and held by friction the harder they press. A current is a box of moving water. Pure: no DOM.

const ROCK_STIFFNESS = 4000;                              // push per px a cell sinks into rock
const ROCK_DAMPING = 20;                                  // push per px/s a cell moves into rock
const ROCK_FRICTION = 0.8;                                // most sideways hold, as a share of the push
const ROCK_GRIP_DAMPING = 60;                             // sideways hold per px/s of sliding, up to that most
const ROCK_REACH = 2.5 * CELL_RADIUS;                     // px: the biggest cell radius that rock is checked against
const ROCK_BUCKET_SIZE = 40;                              // px: the side of the squares rock edges are sorted into
const ROCK_BUCKET_ROW = 100000;                           // bucket keys: column + row * this
const ROCK_BUCKET_OFFSET = 1000;                          // buckets: added to columns and rows to keep them positive
const SAME_CONTACT_COSINE = 0.5;                          // contacts whose normals are closer than 60° are one wall

// The corners of a rock hex round its centre (px), pointy side up: the edges between them face its six neighbours.
const ROCK_CORNER = 2 * CELL_RADIUS / Math.sqrt(3);       // px from the centre to a corner
const ROCK_CORNERS = [[0, -ROCK_CORNER], [CELL_RADIUS, -ROCK_CORNER / 2], [CELL_RADIUS, ROCK_CORNER / 2],
  [0, ROCK_CORNER], [-CELL_RADIUS, ROCK_CORNER / 2], [-CELL_RADIUS, -ROCK_CORNER / 2]];
// each edge: the neighbour it faces (axial step) and its two corners (indexes into ROCK_CORNERS)
const ROCK_EDGES = [[[1, -1], 0, 1], [[1, 0], 1, 2], [[0, 1], 2, 3], [[-1, 1], 3, 4], [[-1, 0], 4, 5],
  [[0, -1], 5, 0]];

// The terrain of a level: rock tiles filling the boxes ({ x, y, width, height } in px: every grid hex whose centre
// lies inside), and currents ({ x, y, width, height, flowX, flowY }: water in the box moves at flow px/s).
function createTerrain(rockBoxes = [], currents = []) {
  const tiles = rockTilesInBoxes(rockBoxes);
  const tileKeys = new Set(tiles.map(([q, r]) => hexKey(q, r)));
  const edges = exposedRockEdges(tiles, tileKeys);
  return { tiles, edges, buckets: sortEdgesIntoBuckets(edges), currents };
}

// every grid hex [q, r] whose centre lies inside one of the boxes, row by row
function rockTilesInBoxes(boxes) {
  const tiles = [];
  const seen = new Set();
  for (const box of boxes) {
    const firstRow = Math.ceil(box.y / HEX_SPACING_Y);
    const lastRow = Math.floor((box.y + box.height) / HEX_SPACING_Y);
    for (let r = firstRow; r <= lastRow; r++) {
      const firstQ = Math.ceil(box.x / HEX_SPACING_X - r / 2);
      const lastQ = Math.floor((box.x + box.width) / HEX_SPACING_X - r / 2);
      for (let q = firstQ; q <= lastQ; q++) {
        if (seen.has(hexKey(q, r))) continue;
        seen.add(hexKey(q, r));
        tiles.push([q, r]);
      }
    }
  }
  return tiles;
}

// The rock's outline: every tile edge with water on the other side, as a segment (px) with its outward normal (and
// the segment's direction and 1 / its length squared, for measuring contacts quickly).
function exposedRockEdges(tiles, tileKeys) {
  const edges = [];
  for (const [q, r] of tiles) {
    const [centerX, centerY] = hexToPixel(q, r);
    for (const [[stepQ, stepR], fromCorner, toCorner] of ROCK_EDGES) {
      if (tileKeys.has(hexKey(q + stepQ, r + stepR))) continue;
      const [stepX, stepY] = hexToPixel(stepQ, stepR);
      const fromX = centerX + ROCK_CORNERS[fromCorner][0];
      const fromY = centerY + ROCK_CORNERS[fromCorner][1];
      const toX = centerX + ROCK_CORNERS[toCorner][0];
      const toY = centerY + ROCK_CORNERS[toCorner][1];
      const alongX = toX - fromX;
      const alongY = toY - fromY;
      const inverseLengthSquared = 1 / (alongX * alongX + alongY * alongY);
      edges.push({ fromX, fromY, toX, toY, alongX, alongY, inverseLengthSquared,
        normalX: stepX / HEX_SPACING_X, normalY: stepY / HEX_SPACING_X });
    }
  }
  return edges;
}

const rockBucketKey = (column, row) => column + ROCK_BUCKET_OFFSET + (row + ROCK_BUCKET_OFFSET) * ROCK_BUCKET_ROW;

// Sorts the edges into squares of ROCK_BUCKET_SIZE, each edge into every square within ROCK_REACH of it, so a cell
// only looks at the edges in its own square.
function sortEdgesIntoBuckets(edges) {
  const buckets = new Map();
  for (const edge of edges) {
    const firstColumn = Math.floor((Math.min(edge.fromX, edge.toX) - ROCK_REACH) / ROCK_BUCKET_SIZE);
    const lastColumn = Math.floor((Math.max(edge.fromX, edge.toX) + ROCK_REACH) / ROCK_BUCKET_SIZE);
    const firstRow = Math.floor((Math.min(edge.fromY, edge.toY) - ROCK_REACH) / ROCK_BUCKET_SIZE);
    const lastRow = Math.floor((Math.max(edge.fromY, edge.toY) + ROCK_REACH) / ROCK_BUCKET_SIZE);
    for (let row = firstRow; row <= lastRow; row++) {
      for (let column = firstColumn; column <= lastColumn; column++) {
        const key = rockBucketKey(column, row);
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(edge);
      }
    }
  }
  return buckets;
}

// Sets each cell's water velocity (px/s): that of the current it is in, or still water.
function measureWaterFlow(world) {
  const currents = world.terrain ? world.terrain.currents : [];
  for (const cell of world.cells) {
    cell.waterVelocityX = 0;
    cell.waterVelocityY = 0;
    for (const current of currents) {
      if (cell.x < current.x || cell.x > current.x + current.width) continue;
      if (cell.y < current.y || cell.y > current.y + current.height) continue;
      cell.waterVelocityX = current.flowX;
      cell.waterVelocityY = current.flowY;
    }
  }
}

// Pushes every cell out of the rock it sinks into, and holds it against sliding along the rock, more the harder
// it presses: a swollen Bloater wedged in a crevice grips. Touching edges along one wall count once.
function applyRockForces(world) {
  if (!world.terrain || world.terrain.edges.length === 0) return;
  const contacts = [];
  for (const cell of world.cells) {
    if (cell.creature.anchored) continue;
    const column = Math.floor(cell.x / ROCK_BUCKET_SIZE);
    const row = Math.floor(cell.y / ROCK_BUCKET_SIZE);
    const edges = world.terrain.buckets.get(rockBucketKey(column, row));
    if (!edges) continue;
    contacts.length = 0;
    for (const edge of edges) {
      const contact = measureRockContact(cell, edge);
      if (contact) contacts.push(contact);
    }
    for (const contact of distinctWalls(contacts)) pushOffRock(cell, contact);
  }
}

// How deep the cell sinks past this edge, and the way out: { depth (px), normalX, normalY }, or null if it doesn't.
// The distance from the edge's line comes first: it rules out nearly every edge cheaply.
function measureRockContact(cell, edge) {
  const fromOffsetX = cell.x - edge.fromX;
  const fromOffsetY = cell.y - edge.fromY;
  const outside = fromOffsetX * edge.normalX + fromOffsetY * edge.normalY;
  if (outside <= 0 || outside >= cell.radius) return null;   // behind this edge (another faces the cell), or clear
  const along = (fromOffsetX * edge.alongX + fromOffsetY * edge.alongY) * edge.inverseLengthSquared;
  const share = Math.max(0, Math.min(1, along));            // where along the edge the nearest point is, 0..1
  const offsetX = fromOffsetX - edge.alongX * share;
  const offsetY = fromOffsetY - edge.alongY * share;
  const distance = vectorLength(offsetX, offsetY);
  if (distance >= cell.radius) return null;
  return { depth: cell.radius - distance, normalX: offsetX / distance, normalY: offsetY / distance };
}

// The deepest contact of each wall: a contact pointing within 60° of a deeper one is the same wall, met where two
// tile edges join, and would push twice.
function distinctWalls(contacts) {
  if (contacts.length < 2) return contacts;
  const sorted = [...contacts].sort((first, second) => second.depth - first.depth);
  const walls = [];
  for (const contact of sorted) {
    const isSameWall = walls.some(wall =>
      wall.normalX * contact.normalX + wall.normalY * contact.normalY > SAME_CONTACT_COSINE);
    if (!isSameWall) walls.push(contact);
  }
  return walls;
}

// The rock's push on the cell: out along the normal, and friction against sliding along it.
function pushOffRock(cell, contact) {
  const { depth, normalX, normalY } = contact;
  const inwardSpeed = -(cell.velocityX * normalX + cell.velocityY * normalY);
  const push = Math.max(0, ROCK_STIFFNESS * depth + ROCK_DAMPING * Math.max(0, inwardSpeed));
  const slideSpeed = cell.velocityX * -normalY + cell.velocityY * normalX;
  const hold = Math.min(ROCK_GRIP_DAMPING * Math.abs(slideSpeed), ROCK_FRICTION * push) * Math.sign(slideSpeed);
  cell.forceX += push * normalX + hold * normalY;
  cell.forceY += push * normalY - hold * normalX;
}
