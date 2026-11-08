'use strict';
// Simple AI for creatures the player doesn't wire: sandbox enemies and a level's hunters swim at the nearest enemy
// and fire when close; a level's guards sleep until the player breaks the level's host rule, then hunt; a level's
// prey swims away from it, bending off the walls. Pure: no DOM.

const AI_ABILITY_RANGE = 170;                             // px between centres within which the AI fires
const POST_RADIUS = 40;                                   // px from its post within which a sleeping guard rests
const FLEE_RANGE = 260;                                   // px between centres within which prey notices an enemy
const FLEE_SPRINT_EFFORT = 2;                            // share of full free swimming while prey sprints away
const FLEE_TIRED_EFFORT = 0.3;                            // share while it is tired
const FLEE_SPRINT_SECONDS = 3;                            // game s of sprinting before prey tires
const FLEE_RECOVERY_RATE = 1;                             // game s of sprint won back per game s of not sprinting
const FLEE_WALL_MARGIN = 160;                             // px from a wall within which fleeing prey turns off it
const FLEE_WALL_WEIGHT = 1.5;                             // a wall's push right at it (the enemy's push is 1)

// Steers an AI creature by its behaviour: 'hunt' at the nearest enemy, 'flee' away from it, 'guard' hold still at
// its post until woken (guardAwake, set by the level's host rule in levels.js or by the player coming near in an
// adventure), then hunt.
function steerAiCreature(world, creature, dt) {
  if (creature.aiBehaviour === 'flee') fleeFromNearestEnemy(world, creature, dt);
  else if (creature.aiBehaviour === 'guard' && !creature.guardAwake) returnToPost(creature);
  else steerTowardNearestEnemy(world, creature);
}

// A sleeping guard swims back to its post (an adventure's sleepers have one), and holds still there.
function returnToPost(creature) {
  const post = creature.post;
  const distance = post ? vectorLength(post.x - creature.centerX, post.y - creature.centerY) : 0;
  if (distance < POST_RADIUS) {
    holdStill(creature);
    return;
  }
  creature.swimX = (post.x - creature.centerX) / distance;
  creature.swimY = (post.y - creature.centerY) / distance;
  creature.targetHeading = arcTangent2(creature.swimX, -creature.swimY);
  creature.abilityHeld = false;
}

// The nearest living creature of another team and its distance between centres; { target: null } if there is none.
// A launched Bud part counts while it still has fuel, so hunters chase decoys.
function nearestEnemy(world, creature) {
  let target = null;
  let targetDistance = Infinity;
  for (const other of world.creatures) {
    if (other.team === creature.team || (other.debris && !(other.launchedPart && other.fueled))) continue;
    const distance = vectorLength(other.centerX - creature.centerX, other.centerY - creature.centerY);
    if (distance >= targetDistance) continue;
    targetDistance = distance;
    target = other;
  }
  return { target, targetDistance };
}

// steers an AI creature at the nearest enemy, and holds its ability while one is in range
function steerTowardNearestEnemy(world, creature) {
  const { target, targetDistance } = nearestEnemy(world, creature);
  if (!target) {
    holdStill(creature);
    return;
  }
  const directionX = (target.centerX - creature.centerX) / targetDistance;
  const directionY = (target.centerY - creature.centerY) / targetDistance;
  creature.swimX = directionX;
  creature.swimY = directionY;
  creature.targetHeading = arcTangent2(directionX, -directionY);
  creature.abilityHeld = targetDistance < AI_ABILITY_RANGE;
}

// Prey: holds still until an enemy comes within FLEE_RANGE, then swims away from it, turning off any wall it nears.
// It sprints for FLEE_SPRINT_SECONDS, then tires and slows until its sprint is all back, so a hunter that keeps up
// catches it while it is tired, and a slow one finds it rested again.
function fleeFromNearestEnemy(world, creature, dt) {
  const { target, targetDistance } = nearestEnemy(world, creature);
  const isThreatened = !!target && targetDistance <= FLEE_RANGE;
  const isSprinting = isThreatened && !creature.fleeTired;
  creature.fleeSprintLeft = isSprinting ? creature.fleeSprintLeft - dt
    : Math.min(FLEE_SPRINT_SECONDS, creature.fleeSprintLeft + FLEE_RECOVERY_RATE * dt);
  if (creature.fleeSprintLeft <= 0) creature.fleeTired = true;
  if (creature.fleeSprintLeft >= FLEE_SPRINT_SECONDS) creature.fleeTired = false;
  if (!isThreatened) {
    holdStill(creature);
    return;
  }
  const effort = creature.fleeTired ? FLEE_TIRED_EFFORT : FLEE_SPRINT_EFFORT;
  const away = { x: (creature.centerX - target.centerX) / targetDistance,
    y: (creature.centerY - target.centerY) / targetDistance };
  const offWalls = wallPush(world, creature.centerX, creature.centerY);
  const wantedX = away.x + offWalls.x;
  const wantedY = away.y + offWalls.y;
  const length = vectorLength(wantedX, wantedY) || 1;
  creature.swimX = effort * wantedX / length;
  creature.swimY = effort * wantedY / length;
  creature.targetHeading = arcTangent2(wantedX, -wantedY);
  creature.abilityHeld = false;
}

// a push away from the walls near a point: up to FLEE_WALL_WEIGHT right at a wall, nothing FLEE_WALL_MARGIN off it
function wallPush(world, x, y) {
  const push = distance => FLEE_WALL_WEIGHT * Math.max(0, 1 - distance / FLEE_WALL_MARGIN);
  return { x: push(x) - push(world.width - x), y: push(y) - push(world.height - y) };
}
