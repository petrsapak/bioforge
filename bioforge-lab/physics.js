'use strict';
// Physics: steering input, spring forces, water drag, collisions and integration. Pure: no DOM.

const PHYSICS_SUBSTEPS = 4;                               // physics steps per game step, for stable springs
const BOND_STIFFNESS = 2500;                              // spring force per px of stretch, times bondStrength
const BOND_DAMPING = 20;                                  // spring force per px/s of closing speed
const ANGLE_STIFFNESS = 150000;                           // angle spring torque per radian, before the cell's stiffness
const COLLISION_STIFFNESS = 4000;                         // push per px of overlap between creatures
const WATER_DRAG = 1.0;                                   // drag force per px/s, on every cell
const MEMBRANE_DRAG = 4;                                  // extra drag on sideways motion of the outer membrane
const SWIM_FORCE = 90;                                    // force per unit of swim power
const CILIA_SWIM_POWER = 2.5;                             // extra swim power of a fed cilia cell
const TURN_STIFFNESS = 10;                                // turning torque per radian of heading error
const TURN_DAMPING = 5;                                   // turning torque per rad/s of spin
const SIPHON_FORCE = 600;                                 // thrust of a fully signalled siphon
const TURN_RATE = 2.5;                                    // rad/s, car-style steering
const WALL_BOUNCE = 0.3;                                  // share of speed kept when a cell hits the world's edge

// ---------- Input ----------
// Sets each creature's wanted swimming direction, heading and ability from the AI, the autopilot or the player's input.
function applyInputs(world, dt, input) {
  for (const creature of world.creatures) {
    if (creature.debris) continue;
    if (creature.team !== 0 && world.enemiesIdle) holdStill(creature);
    else if (creature.aiControlled || creature.autopilot) steerTowardNearestEnemy(world, creature);
    else if (input && 'forward' in input) applyCarStyleInput(creature, input, dt);
    else if (input) applyDirectionInput(creature, input);
  }
}

function holdStill(creature) {
  creature.swimX = 0;
  creature.swimY = 0;
  creature.abilityHeld = false;
}

// turn rotates the heading, forward swims along it (negative = reverse without turning)
function applyCarStyleInput(creature, input, dt) {
  creature.abilityHeld = input.ability;
  creature.heldKeys = input.heldKeys;
  const turnStep = wrapAngle(creature.targetHeading + input.turn * TURN_RATE * dt - creature.heading);
  creature.targetHeading = creature.heading + Math.max(-1, Math.min(1, turnStep));
  creature.swimX = sine(creature.targetHeading) * input.forward;
  creature.swimY = -cosine(creature.targetHeading) * input.forward;
}

function applyDirectionInput(creature, input) {
  creature.swimX = input.swimX;
  creature.swimY = input.swimY;
  creature.abilityHeld = input.ability;
  creature.heldKeys = input.heldKeys;
  if (input.swimX || input.swimY) creature.targetHeading = arcTangent2(input.swimX, -input.swimY);
}

// ---------- Physics step ----------
function updatePhysics(world, dt) {
  const substep = dt / PHYSICS_SUBSTEPS;
  for (let i = 0; i < PHYSICS_SUBSTEPS; i++) {
    for (const creature of world.creatures) applySteering(creature);
    applyBondForces(world);
    applyAngleSpringForces(world);
    applyWaterDrag(world);
    applySnarePull(world);
    resolveCollisions(world);
    integrate(world, substep);
  }
}

// Measures the creature's centre and heading, then pushes its cells: swimming, turning and siphon thrust.
// A launched Bud part (drone) doesn't steer and gets no free swimming: only its own cilia and siphons push it,
// the way it was fired (launchAim, in its rest frame).
function applySteering(creature) {
  let mass = 0;
  let centerX = 0;
  let centerY = 0;
  for (const cell of creature.cells) {
    mass += cell.type.mass;
    centerX += cell.x * cell.type.mass;
    centerY += cell.y * cell.type.mass;
  }
  centerX /= mass;
  centerY /= mass;
  creature.centerX = centerX;
  creature.centerY = centerY;
  if (creature.debris && !creature.launchedPart) return;
  const isLaunchedPart = creature.debris;
  // heading: the rotation that best maps the design's rest shape onto the current shape
  let rotationSine = 0;
  let rotationCosine = 0;
  let angularMomentum = 0;
  let inertia = 0;
  for (const cell of creature.cells) {
    const restOffsetX = cell.restX - creature.restCenterX;
    const restOffsetY = cell.restY - creature.restCenterY;
    const offsetX = cell.x - centerX;
    const offsetY = cell.y - centerY;
    rotationSine += cell.type.mass * (restOffsetX * offsetY - restOffsetY * offsetX);
    rotationCosine += cell.type.mass * (restOffsetX * offsetX + restOffsetY * offsetY);
    angularMomentum += cell.type.mass * (offsetX * cell.velocityY - offsetY * cell.velocityX);
    inertia += cell.type.mass * (offsetX * offsetX + offsetY * offsetY);
  }
  creature.heading = arcTangent2(rotationSine, rotationCosine);
  const angularVelocity = angularMomentum / (inertia || 1);
  const headingError = wrapAngle(creature.targetHeading - creature.heading);
  const facing = creature.heading + creature.launchAim;
  const forwardX = sine(facing);
  const forwardY = -cosine(facing);
  if (isLaunchedPart) {
    creature.swimX = forwardX;
    creature.swimY = forwardY;
  }
  const turnTorque = isLaunchedPart ? 0 : TURN_STIFFNESS * headingError - TURN_DAMPING * angularVelocity;
  for (const cell of creature.cells) {
    const offsetX = cell.x - centerX;
    const offsetY = cell.y - centerY;
    const ciliaPower = cell.type.beats ? CILIA_SWIM_POWER * cell.efficiency * cell.adrenalineBoost : 0;
    const swimPower = (isLaunchedPart ? 0 : cell.type.swimPower) + ciliaPower;
    cell.forceX += cell.type.mass * turnTorque * -offsetY + SWIM_FORCE * swimPower * creature.swimX;
    cell.forceY += cell.type.mass * turnTorque * offsetX + SWIM_FORCE * swimPower * creature.swimY;
    if (cell.type.jets && cell.signal > 0) {
      const thrust = SIPHON_FORCE * clamp01(cell.signal) * cell.efficiency * cell.adrenalineBoost;
      cell.forceX += forwardX * thrust;
      cell.forceY += forwardY * thrust;
    }
  }
}

// Each bond is a damped spring holding two touching cells at their combined radius.
// On the outer membrane it also resists sideways motion through the water.
function applyBondForces(world) {
  for (const bond of world.bonds) {
    const { first, second } = bond;
    let directionX = second.x - first.x;
    let directionY = second.y - first.y;
    const distance = vectorLength(directionX, directionY) || MIN_DISTANCE;
    directionX /= distance;
    directionY /= distance;
    const relativeVelocityX = second.velocityX - first.velocityX;
    const relativeVelocityY = second.velocityY - first.velocityY;
    const stretch = distance - first.radius - second.radius;
    const closingSpeed = relativeVelocityX * directionX + relativeVelocityY * directionY;
    const force = bond.stiffness * stretch + BOND_DAMPING * closingSpeed;
    first.forceX += force * directionX;
    first.forceY += force * directionY;
    second.forceX -= force * directionX;
    second.forceY -= force * directionY;
    if (bond.onSurface) applyMembraneDrag(first, second, directionX, directionY);
  }
}

function applyMembraneDrag(first, second, directionX, directionY) {
  const normalX = -directionY;
  const normalY = directionX;
  const summedVelocityX = first.velocityX + second.velocityX;
  const summedVelocityY = first.velocityY + second.velocityY;
  const normalSpeed = (summedVelocityX * normalX + summedVelocityY * normalY) * 0.5;
  const dragForce = -MEMBRANE_DRAG * normalSpeed * 0.5;
  first.forceX += dragForce * normalX;
  first.forceY += dragForce * normalY;
  second.forceX += dragForce * normalX;
  second.forceY += dragForce * normalY;
}

// Each angle spring turns the two arms at its pivot back toward their rest angle.
function applyAngleSpringForces(world) {
  for (const spring of world.angleSprings) {
    const { pivot, first, second } = spring;
    const firstArmX = first.x - pivot.x;
    const firstArmY = first.y - pivot.y;
    const secondArmX = second.x - pivot.x;
    const secondArmY = second.y - pivot.y;
    const firstArmLength = vectorLength(firstArmX, firstArmY) || MIN_DISTANCE;
    const secondArmLength = vectorLength(secondArmX, secondArmY) || MIN_DISTANCE;
    const angle = arcTangent2(firstArmX * secondArmY - firstArmY * secondArmX,
      firstArmX * secondArmX + firstArmY * secondArmY);
    const angleError = wrapAngle(angle - spring.restAngle);
    const firstStrength = spring.stiffness * angleError / (firstArmLength * firstArmLength);
    const secondStrength = spring.stiffness * angleError / (secondArmLength * secondArmLength);
    // push each arm's tip sideways to close the error; the pivot takes the opposite push
    const firstPushX = -firstArmY * firstStrength;
    const firstPushY = firstArmX * firstStrength;
    const secondPushX = secondArmY * secondStrength;
    const secondPushY = -secondArmX * secondStrength;
    first.forceX += firstPushX;
    first.forceY += firstPushY;
    second.forceX += secondPushX;
    second.forceY += secondPushY;
    pivot.forceX -= firstPushX + secondPushX;
    pivot.forceY -= firstPushY + secondPushY;
  }
}

function applyWaterDrag(world) {
  for (const cell of world.cells) {
    cell.forceX -= WATER_DRAG * cell.velocityX;
    cell.forceY -= WATER_DRAG * cell.velocityY;
  }
}

// A Snare's line pulls its catch in hard; the Snare feels only part of it, so small prey comes to you.
function applySnarePull(world) {
  for (const cell of world.cells) {
    const target = cell.snareLine && cell.snareLine.target;
    if (!target || target.dead) continue;
    let directionX = cell.x - target.x;
    let directionY = cell.y - target.y;
    const distance = vectorLength(directionX, directionY) || MIN_DISTANCE;
    directionX /= distance;
    directionY /= distance;
    const stretch = Math.max(0, distance - cell.snareLine.restLength);
    const pull = Math.min(SNARE_MAX_PULL, SNARE_PULL_STIFFNESS * stretch) * cell.efficiency * cell.adrenalineBoost;
    target.forceX += pull * directionX;
    target.forceY += pull * directionY;
    cell.forceX -= SNARE_RECOIL_SHARE * pull * directionX;
    cell.forceY -= SNARE_RECOIL_SHARE * pull * directionY;
  }
}

// ---------- Collisions ----------
// Overlapping cells of different creatures push apart; between enemies, thorns and mouths also hit.
function resolveCollisions(world) {
  const creatures = world.creatures;
  for (const creature of creatures) creature.bounds = measureBounds(creature);
  for (let i = 0; i < creatures.length; i++) {
    for (let j = i + 1; j < creatures.length; j++) collideCreatures(world, creatures[i], creatures[j]);
  }
}

function measureBounds(creature) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const cell of creature.cells) {
    minX = Math.min(minX, cell.x - cell.radius);
    minY = Math.min(minY, cell.y - cell.radius);
    maxX = Math.max(maxX, cell.x + cell.radius);
    maxY = Math.max(maxY, cell.y + cell.radius);
  }
  return { minX, minY, maxX, maxY };
}

const boundsOverlap = (first, second) =>
  !(first.maxX < second.minX || second.maxX < first.minX || first.maxY < second.minY || second.maxY < first.minY);

const cellOutsideBounds = (cell, bounds) =>
  cell.x + cell.radius < bounds.minX || cell.x - cell.radius > bounds.maxX ||
  cell.y + cell.radius < bounds.minY || cell.y - cell.radius > bounds.maxY;

function collideCreatures(world, firstCreature, secondCreature) {
  const otherBounds = secondCreature.bounds;
  if (!boundsOverlap(firstCreature.bounds, otherBounds)) return;
  const hostile = firstCreature.team !== secondCreature.team;
  for (const ownCell of firstCreature.cells) {
    if (cellOutsideBounds(ownCell, otherBounds)) continue;
    for (const otherCell of secondCreature.cells) {
      const offsetX = otherCell.x - ownCell.x;
      const offsetY = otherCell.y - ownCell.y;
      const touchDistance = ownCell.radius + otherCell.radius;
      if (offsetX * offsetX + offsetY * offsetY >= touchDistance * touchDistance) continue;
      const distance = vectorLength(offsetX, offsetY) || MIN_DISTANCE;
      const normalX = offsetX / distance;
      const normalY = offsetY / distance;
      const force = COLLISION_STIFFNESS * (touchDistance - distance);
      ownCell.forceX -= force * normalX;
      ownCell.forceY -= force * normalY;
      otherCell.forceX += force * normalX;
      otherCell.forceY += force * normalY;
      if (hostile) applyContactHits(world, ownCell, otherCell);
    }
  }
}

// ---------- Integration ----------
// Moves every cell by its velocity (semi-implicit Euler) and bounces it off the world's edges.
function integrate(world, dt) {
  for (const cell of world.cells) {
    const mass = cell.type.mass;
    cell.velocityX += cell.forceX / mass * dt;
    cell.velocityY += cell.forceY / mass * dt;
    cell.x += cell.velocityX * dt;
    cell.y += cell.velocityY * dt;
    cell.forceX = 0;
    cell.forceY = 0;
    bounceOffWalls(world, cell);
  }
}

function bounceOffWalls(world, cell) {
  if (cell.x < cell.radius) {
    cell.x = cell.radius;
    cell.velocityX = Math.abs(cell.velocityX) * WALL_BOUNCE;
  }
  if (cell.x > world.width - cell.radius) {
    cell.x = world.width - cell.radius;
    cell.velocityX = -Math.abs(cell.velocityX) * WALL_BOUNCE;
  }
  if (cell.y < cell.radius) {
    cell.y = cell.radius;
    cell.velocityY = Math.abs(cell.velocityY) * WALL_BOUNCE;
  }
  if (cell.y > world.height - cell.radius) {
    cell.y = world.height - cell.radius;
    cell.velocityY = -Math.abs(cell.velocityY) * WALL_BOUNCE;
  }
}

registerSystem({ name: 'input', order: 10, switchable: false, update: applyInputs });
registerSystem({ name: 'physics', order: 20, switchable: false, update: updatePhysics });
