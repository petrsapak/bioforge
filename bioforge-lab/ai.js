'use strict';
// Simple AI for sandbox enemies: swim at the nearest enemy and fire when close. Pure: no DOM.

const AI_ABILITY_RANGE = 170;                             // px between centres within which the AI fires

function steerTowardNearestEnemy(world, creature) {
  let target = null;
  let targetDistance = Infinity;
  for (const other of world.creatures) {
    if (other.team === creature.team || other.debris) continue;
    const distance = vectorLength(other.centerX - creature.centerX, other.centerY - creature.centerY);
    if (distance >= targetDistance) continue;
    targetDistance = distance;
    target = other;
  }
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
