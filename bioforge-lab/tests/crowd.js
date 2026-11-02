'use strict';
// Crowds and violent kicks (user, 2026-11-02: in the Sandbox, around 25 enemies "everything disappears"): a creature
// thrown far faster than it swims slows down instead of blowing up, and a crowd of Crabs keeps every number finite.
const { load } = require('./load');
const { check, done } = require('./check');
const { X: sim } = load({}, ['newWorld', 'spawn', 'step', 'TEMPLATES', 'MAX_STEP_TIME']);

const KICK_SPEED = 3000;                                  // px/s, as a creature spawned into another gets thrown
const CROWD_SIZE = 12;                                    // Crabs; 8 blew the world up before the drag cap
const SECONDS_PER_SPAWN = 0.5;                            // game s between spawns, as clicks come

const isFinitePlace = cell => [cell.x, cell.y, cell.velocityX, cell.velocityY].every(Number.isFinite);
const fastestSpeed = creature => Math.max(...creature.cells.map(cell => Math.hypot(cell.velocityX, cell.velocityY)));

// steps the world on by this many game seconds
function run(world, seconds) {
  const steps = Math.round(seconds / sim.MAX_STEP_TIME);
  for (let i = 0; i < steps; i++) sim.step(world, sim.MAX_STEP_TIME, { ability: false, heldKeys: new Set() });
}

// ---------- One kick ----------
const kickWorld = sim.newWorld(4000, 4000);
const kicked = sim.spawn(kickWorld, sim.TEMPLATES.crab, 2000, 2000, 0, 1);
for (const cell of kicked.cells) cell.velocityX = KICK_SPEED;
run(kickWorld, 1);
check(`a Crab thrown at ${KICK_SPEED} px/s stays in one piece and slows down`,
  kicked.cells.every(isFinitePlace) && fastestSpeed(kicked) < KICK_SPEED,
  `fastest ${fastestSpeed(kicked).toFixed(0)} px/s`);

// ---------- A crowd ----------
const crowdWorld = sim.newWorld(1600, 900);
sim.spawn(crowdWorld, sim.TEMPLATES.jet, 800, 800, 0, 0).autonomous = true;
let seed = 1;
const nextFraction = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
for (let i = 0; i < CROWD_SIZE; i++) {
  const x = 300 + nextFraction() * 1000;
  const y = 150 + nextFraction() * 600;
  sim.spawn(crowdWorld, sim.TEMPLATES.crab, x, y, nextFraction() * 6, 1);
  run(crowdWorld, SECONDS_PER_SPAWN);
}
check(`${CROWD_SIZE} Crabs spawned on top of each other keep every cell's place a number`,
  crowdWorld.cells.every(isFinitePlace), `${crowdWorld.cells.filter(cell => !isFinitePlace(cell)).length} bad cells`);

done();
