'use strict';
// Treatments: glands that change their own creature's cells while signalled. A Tanner crosslinks cells (stiffer
// bonds, less damage taken, but muscles in them move slower); a Resilin gland makes muscles springy: a resilin
// muscle held contracted charges up, and when it lets go it snaps open with a kick that strikes enemy cells
// touching it. Pure: no DOM.

const TREAT_TIME = 1.5;                                   // game s to treat one cell
const TREAT_REACH = 2;                                    // hexes from the gland that it can treat
const TANNED_STIFFNESS = 2.5;                             // share of its bond and angle stiffness a tanned cell has
const TANNED_DAMAGE_FACTOR = 0.4;                         // share of damage a tanned cell takes
const TANNED_RESIZE_RATE = 0.5;                           // share of its speed a tanned muscle or bloater keeps
const RESILIN_CHARGE_SIZE = 0.5;                          // below this size a resilin muscle charges up
const RESILIN_CHARGE_TIME = 1;                            // game s held contracted to charge fully
const RESILIN_KICK = 220;                                 // px/s × mass pushed into each neighbour at a full charge
const MIN_KICK_DISTANCE = 0.001;                          // px; a neighbour nearer than this gets no direction
const RESILIN_STRIKE_DAMAGE = 40;                         // health a full snap takes from each enemy cell it hits
const RESILIN_STRIKE_MARGIN = 6;                          // px added to the two radii: what the snap reaches

// What each treatment gland looks for and does, by the cell type's `treats` behaviour (data/cells.js).
const TREATMENTS = {
  tan: { canTreat: cell => !cell.tanned, apply: tanCell },
  resilin: { canTreat: cell => !cell.resilient && cell.type.resize === 'contract', apply: makeResilient },
};

// Every signalled, fed treatment gland works on its next cell; resilin muscles charge and snap.
function updateTreatments(world, dt) {
  for (const cell of world.cells) {
    if (cell.type.treats && isTreatmentGlandReady(cell)) treatStep(world, cell, dt);
    if (cell.resilient) updateResilinSpring(world, cell, dt);
  }
}

// signalled, fed enough and part of a creature that can act
function isTreatmentGlandReady(cell) {
  const canAct = !cell.creature.debris || cell.creature.launchedPart;
  return canAct && cell.signal > SIGNAL_ON && cell.efficiency > MIN_FIRING_EFFICIENCY;
}

// Treats the nearest cell the gland can treat, one every TREAT_TIME.
function treatStep(world, gland, dt) {
  const treatment = TREATMENTS[gland.type.treats];
  const target = nearestTreatableCell(gland, treatment.canTreat);
  if (!target) return;
  gland.treatProgress += dt / TREAT_TIME;
  if (gland.treatProgress < 1) return;
  gland.treatProgress = 0;
  treatment.apply(world, target);
}

// the creature's living cell nearest the gland (itself included) within TREAT_REACH hexes that the treatment can
// still change; ties go to the cell listed first
function nearestTreatableCell(gland, canTreat) {
  let nearest = null;
  let nearestDistance = TREAT_REACH + 1;
  for (const cell of gland.creature.cells) {
    if (cell.dead || !canTreat(cell)) continue;
    const distance = hexDistance(cell, gland);
    if (distance >= nearestDistance) continue;
    nearestDistance = distance;
    nearest = cell;
  }
  return nearest;
}

// Tanning: the cell takes less damage and moves slower, and its bonds (where both cells are tanned, since the weaker
// cell of a pair sets a bond) and the angle springs it holds get stiffer.
function tanCell(world, cell) {
  cell.tanned = true;
  cell.treatedDamageFactor = TANNED_DAMAGE_FACTOR;
  cell.resizeRateFactor = TANNED_RESIZE_RATE;
  for (const bond of world.bonds) {
    if (bond.first !== cell && bond.second !== cell) continue;
    bond.stiffness = BOND_STIFFNESS * Math.min(bondStrengthOf(bond.first), bondStrengthOf(bond.second));
  }
  for (const spring of world.angleSprings) {
    if (spring.pivot === cell) spring.stiffness *= TANNED_STIFFNESS;
  }
}

// a cell's bond strength, a tanned cell's raised
const bondStrengthOf = cell => cell.type.bondStrength * (cell.tanned ? TANNED_STIFFNESS : 1);

// marks a cell as treated by a Resilin gland
function makeResilient(world, cell) {
  cell.resilient = true;
}

// A resilin muscle charges while it is held contracted and signalled. When the signal stops, it springs back to full
// size at once, pushing every neighbour away from it and itself back, so the creature's momentum is kept.
function updateResilinSpring(world, cell, dt) {
  if (cell.signal > SIGNAL_ON) {
    if (cell.size < RESILIN_CHARGE_SIZE) cell.springCharge = Math.min(1, cell.springCharge + dt / RESILIN_CHARGE_TIME);
    return;
  }
  if (cell.springCharge <= 0) return;
  snapOpen(world, cell, cell.springCharge);
  cell.springCharge = 0;
}

// the muscle back to full size, a kick between it and each cell bonded to it, and a strike on the enemy cells that
// touch the muscle or those cells
function snapOpen(world, cell, charge) {
  cell.size = 1;
  cell.radius = CELL_RADIUS;
  const strikers = [cell];
  for (const bond of world.bonds) {
    const neighbour = bond.first === cell ? bond.second : bond.second === cell ? bond.first : null;
    if (!neighbour || neighbour.dead) continue;
    strikers.push(neighbour);
    const awayX = neighbour.x - cell.x;
    const awayY = neighbour.y - cell.y;
    const distance = vectorLength(awayX, awayY);
    if (distance < MIN_KICK_DISTANCE) continue;
    const impulse = RESILIN_KICK * charge / distance;
    neighbour.velocityX += awayX * impulse / neighbour.type.mass;
    neighbour.velocityY += awayY * impulse / neighbour.type.mass;
    cell.velocityX -= awayX * impulse / cell.type.mass;
    cell.velocityY -= awayY * impulse / cell.type.mass;
  }
  strikeEnemies(world, cell.creature, strikers, RESILIN_STRIKE_DAMAGE * charge);
}

// damage to every enemy cell (debris too) that touches one of the striking cells, once each
function strikeEnemies(world, creature, strikers, damage) {
  for (const other of world.creatures) {
    if (other.team === creature.team) continue;
    for (const target of other.cells) {
      if (target.dead) continue;
      const isTouched = strikers.some(striker => {
        const reach = striker.radius + target.radius + RESILIN_STRIKE_MARGIN;
        return distanceSquared(striker.x, striker.y, target.x, target.y) <= reach * reach;
      });
      if (isTouched) damageCell(target, damage);
    }
  }
}

registerSystem({ name: 'treatments', order: 64, switchable: true, update: updateTreatments });
