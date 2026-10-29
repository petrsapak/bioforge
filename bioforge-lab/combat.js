'use strict';
// Combat: damage, thorn and mouth hits on contact, aiming, snare lines and spitter globs. Pure: no DOM.

const THORN_DAMAGE = 5;
const THORN_SPEED_DAMAGE = 0.06;                          // extra damage per px/s of impact speed
const THORN_COOLDOWN = 0.3;                               // s
const BITE_DAMAGE = 3;
const BITE_SUGAR = 0.5;                                   // sugar a mouth gets per bite
const BITE_COOLDOWN = 0.4;                                // s
const NETTLE_RANGE = 45;                                  // px
const NETTLE_DAMAGE = 4;                                  // per sting, at full power
const NETTLE_COOLDOWN = 0.5;                              // s
const NETTLE_ZAP_TIME = 0.15;                             // s a sting's spark line shows
const SNARE_LENGTH = 200;                                 // px the line reaches
const SNARE_SPEED = 700;                                  // px/s the line flies
const SNARE_PULL_STIFFNESS = 60;                          // pull per px of stretch
const SNARE_MAX_PULL = 1500;
const SNARE_RECOIL_SHARE = 0.3;                           // share of the pull the snare itself feels
const SNARE_REEL_SPEED = 150;                             // px/s the line shortens while holding
const SNARE_MIN_LENGTH = 3 * CELL_RADIUS;                 // px
const SNARE_HOLD_TIME = 2.5;                              // s
const SNARE_COOLDOWN = 1.5;                               // s pause after letting go
const SNARE_HIT_DAMAGE = 2;
const SPIT_DAMAGE = 6;
const SPIT_SPEED = 450;                                   // px/s
const SPIT_RANGE = 280;                                   // px
const SPIT_COOLDOWN = 0.7;                                // s between globs
const SPIT_RECOIL = 40;                                   // px/s the spitter is pushed back
const HIT_MARGIN = 4;                                     // px added to a cell's radius for line and glob hits
const HARD_CELL_STING_SHARE = 0.25;                       // share of a thorn hit or nettle sting a hard cell feels

// inflicts damage on a cell, scaled by its armour: its type's, and half again once a Mineralizer hardened it
function damageCell(cell, damage) {
  if (cell.dead) return;
  const hardening = cell.mineralized ? MINERALIZED_DAMAGE_FACTOR : 1;
  cell.health -= damage * cell.type.damageFactor * hardening;
  cell.hitFlash = HIT_FLASH_TIME;
}

// two touching cells of enemy creatures: thorns hurt harder at speed, mouths bite and gain sugar
function applyContactHits(world, firstCell, secondCell) {
  const relativeVelocityX = secondCell.velocityX - firstCell.velocityX;
  const relativeVelocityY = secondCell.velocityY - firstCell.velocityY;
  const impactSpeed = vectorLength(relativeVelocityX, relativeVelocityY);
  applyThornHit(world, firstCell, secondCell, impactSpeed);
  applyThornHit(world, secondCell, firstCell, impactSpeed);
  applyBite(world, firstCell, secondCell);
  applyBite(world, secondCell, firstCell);
}

// a thorn hit, harder at speed; hard cells feel less of it
function applyThornHit(world, thorn, target, impactSpeed) {
  if (!thorn.type.spiked || thorn.cooldown > 0 || thorn.dead) return;
  thorn.cooldown = THORN_COOLDOWN;
  damageCell(target, (THORN_DAMAGE + THORN_SPEED_DAMAGE * impactSpeed) * stingShare(target));
  spawnSparks(world, (thorn.x + target.x) / 2, (thorn.y + target.y) / 2, '#ffffff', 4);
}

function applyBite(world, mouth, target) {
  if (!mouth.type.bites || mouth.cooldown > 0 || mouth.dead) return;
  if (mouth.creature.debris && !mouth.creature.launchedPart) return;
  mouth.cooldown = BITE_COOLDOWN;
  damageCell(target, BITE_DAMAGE);
  const sugar = mouth.fluids[FLUID_SUGAR] + BITE_SUGAR;
  mouth.fluids[FLUID_SUGAR] = Math.min(mouth.fluidCapacity[FLUID_SUGAR], sugar);
  spawnSparks(world, (mouth.x + target.x) / 2, (mouth.y + target.y) / 2, FLUIDS[FLUID_SUGAR].color, 3);
}

// Hard cells (Shell, Thorns, hardened cells) blunt thorns and nettle stings, on top of their armour: shell beats
// spikes, and acid (secretions.js) beats shell.
const stingShare = target => (isHardCell(target) ? HARD_CELL_STING_SHARE : 1);

// unit vector from the cell to the nearest enemy cell within range, or straight out from its body if there is none
function aimAtNearestEnemy(world, cell, range) {
  let nearest = null;
  let nearestDistanceSquared = range * range;
  for (const other of world.creatures) {
    if (other.team === cell.creature.team || (other.debris && !other.launchedPart)) continue;
    for (const otherCell of other.cells) {
      const otherDistanceSquared = distanceSquared(cell.x, cell.y, otherCell.x, otherCell.y);
      if (otherDistanceSquared >= nearestDistanceSquared) continue;
      nearestDistanceSquared = otherDistanceSquared;
      nearest = otherCell;
    }
  }
  const directionX = nearest ? nearest.x - cell.x : cell.x - cell.creature.centerX;
  const directionY = nearest ? nearest.y - cell.y : cell.y - cell.creature.centerY;
  const length = vectorLength(directionX, directionY) || 1;
  return [directionX / length, directionY / length];
}

// a nettle stings every enemy cell within reach; hard cells feel less of it
function fireNettle(world, nettle, power) {
  let hitSomething = false;
  for (const other of world.creatures) {
    if (other.team === nettle.creature.team) continue;
    for (const otherCell of other.cells) {
      if (distanceSquared(nettle.x, nettle.y, otherCell.x, otherCell.y) > NETTLE_RANGE * NETTLE_RANGE) continue;
      damageCell(otherCell, NETTLE_DAMAGE * power * stingShare(otherCell));
      hitSomething = true;
      const zap = { fromX: nettle.x, fromY: nettle.y, toX: otherCell.x, toY: otherCell.y, lifetime: NETTLE_ZAP_TIME };
      world.zaps.push(zap);
    }
  }
  if (hitSomething) nettle.cooldown = NETTLE_COOLDOWN;
}

function launchSnare(world, snare) {
  const [directionX, directionY] = aimAtNearestEnemy(world, snare, SNARE_LENGTH);
  snare.snareLine = {
    x: snare.x,
    y: snare.y,
    velocityX: directionX * SNARE_SPEED,
    velocityY: directionY * SNARE_SPEED,
    target: null,
    restLength: 0,
    timeLeft: 0,
  };
}

// The line flies out until it sticks to an enemy cell or runs out of reach. A caught cell is reeled in (the pull itself
// is in the physics) until the hold time is up, the line is stretched to twice its reach, or either end dies.
function updateSnareLine(world, snare, dt) {
  const line = snare.snareLine;
  if (!line.target) {
    flySnareLine(world, snare, line, dt);
    return;
  }
  line.timeLeft -= dt;
  line.restLength = Math.max(SNARE_MIN_LENGTH, line.restLength - SNARE_REEL_SPEED * dt);
  const stretched = vectorLength(line.target.x - snare.x, line.target.y - snare.y) > 2 * SNARE_LENGTH;
  if (line.timeLeft > 0 && !line.target.dead && !stretched) return;
  snare.snareLine = null;
  snare.cooldown = SNARE_COOLDOWN;
}

function flySnareLine(world, snare, line, dt) {
  line.x += line.velocityX * dt;
  line.y += line.velocityY * dt;
  for (const other of world.creatures) {
    if (other.team === snare.creature.team) continue;
    for (const otherCell of other.cells) {
      if (distanceSquared(line.x, line.y, otherCell.x, otherCell.y) >= square(otherCell.radius + HIT_MARGIN)) continue;
      line.target = otherCell;
      line.timeLeft = SNARE_HOLD_TIME;
      line.restLength = vectorLength(otherCell.x - snare.x, otherCell.y - snare.y);
      damageCell(otherCell, SNARE_HIT_DAMAGE);
      spawnSparks(world, otherCell.x, otherCell.y, snare.type.color, 4);
      return;
    }
  }
  if (vectorLength(line.x - snare.x, line.y - snare.y) <= SNARE_LENGTH) return;
  snare.snareLine = null;
  snare.cooldown = SNARE_COOLDOWN / 2;
}

function spitGlob(world, spitter, power) {
  const [directionX, directionY] = aimAtNearestEnemy(world, spitter, SPIT_RANGE);
  world.globs.push({
    x: spitter.x + directionX * spitter.radius,
    y: spitter.y + directionY * spitter.radius,
    velocityX: spitter.velocityX + directionX * SPIT_SPEED,
    velocityY: spitter.velocityY + directionY * SPIT_SPEED,
    team: spitter.creature.team,
    lifetime: SPIT_RANGE / SPIT_SPEED,
    damage: SPIT_DAMAGE * power,
  });
  spitter.velocityX -= directionX * SPIT_RECOIL;
  spitter.velocityY -= directionY * SPIT_RECOIL;
  spitter.cooldown = SPIT_COOLDOWN;
}

// Globs fly straight and burst on the first cell of another team they touch.
function updateGlobs(world, dt) {
  world.globs = world.globs.filter(glob => {
    glob.x += glob.velocityX * dt;
    glob.y += glob.velocityY * dt;
    glob.lifetime -= dt;
    return !globHitSomething(world, glob) && glob.lifetime > 0;
  });
}

function globHitSomething(world, glob) {
  for (const other of world.creatures) {
    const bounds = other.bounds;
    if (other.team === glob.team || !bounds) continue;
    if (glob.x < bounds.minX - HIT_MARGIN || glob.x > bounds.maxX + HIT_MARGIN) continue;
    if (glob.y < bounds.minY - HIT_MARGIN || glob.y > bounds.maxY + HIT_MARGIN) continue;
    for (const otherCell of other.cells) {
      if (distanceSquared(glob.x, glob.y, otherCell.x, otherCell.y) >= square(otherCell.radius + HIT_MARGIN)) continue;
      damageCell(otherCell, glob.damage);
      spawnSparks(world, glob.x, glob.y, CELLS.spitter.color, 5);
      return true;
    }
  }
  return false;
}

registerSystem({ name: 'projectiles', order: 70, switchable: false, update: updateGlobs });
