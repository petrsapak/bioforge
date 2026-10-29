'use strict';
// Metabolism and feeding (milestone 4): Fat cells store and release fat, material kits and their reserves, the
// builder held to a kit, the Nose, counting what is eaten, and the food supply's settings.
const { load } = require('./load');
const { check, done } = require('./check');
const { X: sim } = load({}, ['newWorld', 'spawn', 'step', 'updateFatStores', 'createDesignCell', 'kitShortfall',
  'kitReserves', 'designMaterials', 'buildCheck', 'levelLimits', 'startLevel', 'LEVELS', 'createEditedDesign',
  'canPlaceCell', 'foodSmelled', 'createFoodSupply', 'FLUID_SUGAR', 'FAT_STORE_COST', 'FAT_SUGAR_YIELD', 'FAT_RATE',
  'CELLS']);

const cell = (q, r, typeName, extra = {}) => sim.createDesignCell(q, r, typeName, extra);
const fibre = (fromQ, fromR, toQ, toR) => ({ from: { q: fromQ, r: fromR }, to: { q: toQ, r: toR } });
const near = (value, expected) => Math.abs(value - expected) < 1e-9;
const sugarOf = creatureCell => creatureCell.fluids[sim.FLUID_SUGAR];
const noInput = { swimX: 0, swimY: 0, ability: false };

// ---------- Fat cells ----------
// a Nucleus with a Fat cell beside it, in still water
function fatCreature(systems) {
  const world = sim.newWorld(400, 400, { systems });
  const creature = sim.spawn(world, { cells: [cell(0, 0, 'nucleus'), cell(1, 0, 'fat')] }, 200, 200, 0, 0);
  return { world, fat: creature.cells[1] };
}

const full = fatCreature(['metabolism']);
full.fat.fluids[sim.FLUID_SUGAR] = 10;
sim.updateFatStores(full.world, 1);
check('a Fat cell full of sugar turns the spare into fat, at its rate and cost',
  near(full.fat.fat, sim.FAT_RATE) && near(sugarOf(full.fat), 10 - sim.FAT_RATE * sim.FAT_STORE_COST),
  `fat ${full.fat.fat}, sugar ${sugarOf(full.fat)}`);

const hungry = fatCreature(['metabolism']);
hungry.fat.fluids[sim.FLUID_SUGAR] = 0;
hungry.fat.fat = 5;
sim.updateFatStores(hungry.world, 1);
check('a Fat cell low on sugar turns fat back into sugar',
  near(hungry.fat.fat, 5 - sim.FAT_RATE) && near(sugarOf(hungry.fat), sim.FAT_RATE * sim.FAT_SUGAR_YIELD),
  `fat ${hungry.fat.fat}, sugar ${sugarOf(hungry.fat)}`);

const halfFull = fatCreature(['metabolism']);
halfFull.fat.fluids[sim.FLUID_SUGAR] = 7;
halfFull.fat.fat = 5;
sim.updateFatStores(halfFull.world, 1);
check('between half and nine tenths full of sugar, a Fat cell leaves its fat alone',
  halfFull.fat.fat === 5 && sugarOf(halfFull.fat) === 7);

const switchedOff = fatCreature(['fluid']);
switchedOff.fat.fluids[sim.FLUID_SUGAR] = 0;
switchedOff.fat.fat = 5;
for (let i = 0; i < 40; i++) sim.step(switchedOff.world, 1 / 40, noInput);
check('with metabolism off, fat stays fat', switchedOff.fat.fat === 5);

// ---------- Kits ----------
const fatBody = { cells: [cell(0, 0, 'nucleus'), cell(1, 0, 'fat'), cell(-1, 0, 'fat'), cell(0, 1, 'tissue')] };
const materials = sim.designMaterials(fatBody);
check('a design\'s materials add up its cells\' recipes: a Fat takes one protein and one fat',
  materials.protein === 3 && materials.fat === 2 && materials.sugar === 0, JSON.stringify(materials));
check('a kit short of a material says which, and by how much',
  sim.kitShortfall(fatBody, { protein: 10, sugar: 5, fat: 1 }) === 'Not enough fat: it needs 2, the kit has 1',
  sim.kitShortfall(fatBody, { protein: 10, sugar: 5, fat: 1 }));
check('with a kit, the budget no longer counts: only the kit and the other limits do',
  sim.buildCheck(fatBody, { ...sim.levelLimits(sim.LEVELS[0]), budget: 0, kit: { protein: 3, fat: 2 } }) === '');
const reserves = sim.kitReserves(fatBody, { protein: 10, sugar: 4, fat: 7 });
check('a kit\'s leftover sugar and fat become reserves; leftover protein does not',
  reserves.sugar === 4 && reserves.fat === 5, JSON.stringify(reserves));

// Packed lunch's reference: the kit's 4 sugar spread over the body, its fat (7, less 1 for the Fat cell) in the Fat
const lunch = sim.LEVELS.find(level => level.id === 'packed-lunch');
const lunchDesign = { cells: [cell(0, 0, 'nucleus'), cell(0, -1, 'lighteye'), cell(1, -1, 'lighteye'),
  cell(-1, 1, 'siphon'), cell(0, 1, 'siphon'), cell(-1, 0, 'fat'), cell(1, 0, 'gill'), cell(-1, 2, 'pore')],
fibres: [fibre(0, -1, 0, 1), fibre(1, -1, -1, 1)] };
const lunchRun = sim.startLevel(lunch, lunchDesign);
const totalSugar = lunchRun.player.cells.reduce((sum, creatureCell) => sum + sugarOf(creatureCell), 0);
const fatCell = lunchRun.player.cells.find(creatureCell => creatureCell.type.fatCapacity);
const fills = lunchRun.player.cells.map(creatureCell =>
  sugarOf(creatureCell) / creatureCell.fluidCapacity[sim.FLUID_SUGAR]);
check('a kit level starts the creature with its leftovers: the sugar evenly spread, the fat in the Fat cell',
  near(totalSugar, 4) && fatCell.fat === 6 && fills.every(fill => near(fill, fills[0])),
  `sugar ${totalSugar.toFixed(3)}, fat ${fatCell.fat}`);

const grazing = sim.LEVELS.find(level => level.id === 'grazing');
const grazingRun = sim.startLevel(grazing, { cells: [cell(0, 0, 'nucleus'), cell(1, 0, 'mouth')] });
check('a Mouth starts a kit level empty, ready to eat', sugarOf(grazingRun.player.cells[1]) === 0);
check('a level\'s fixed food specks are in the water from the start',
  grazingRun.world.food.length === grazing.food.specks.length);

// ---------- The builder ----------
const kitEdited = sim.createEditedDesign({ cells: [cell(0, 0, 'nucleus')], fibres: [] }, 50, { protein: 4, fat: 0 });
check('held to a kit, the builder takes cells the kit can pay for and refuses those it can\'t: too much protein, ' +
  'or fat it doesn\'t have', sim.canPlaceCell(kitEdited, 1, 0, 'tissue') &&
  !sim.canPlaceCell(kitEdited, 1, 0, 'nettle') && !sim.canPlaceCell(kitEdited, 1, 0, 'fat'));
const unlimitedKit = sim.createEditedDesign({ cells: [cell(0, 0, 'nucleus')], fibres: [] }, Infinity,
  { protein: 0, fat: 0 });
check('building without a limit ignores the kit', sim.canPlaceCell(unlimitedKit, 1, 0, 'fat'));

// ---------- The Nose ----------
function noseWorld(speck) {
  const world = sim.newWorld(600, 600, { systems: ['nerve', 'food'] });
  const creature = sim.spawn(world, { cells: [cell(0, 0, 'nucleus'), cell(0, -1, 'nose'), cell(1, -1, 'nose')] },
    300, 300, 0, 0);
  world.food = speck ? [speck] : [];
  return { world, left: creature.cells[1], right: creature.cells[2] };
}
const leftSpeck = noseWorld({ x: 150, y: 250 });
check('the Nose on the side of a speck smells it more than its twin',
  sim.foodSmelled(leftSpeck.world, leftSpeck.left) > sim.foodSmelled(leftSpeck.world, leftSpeck.right) &&
  sim.foodSmelled(leftSpeck.world, leftSpeck.right) > 0);
const farSpeck = noseWorld({ x: 300, y: -200 });
check('a Nose smells nothing past its range, or with no food', sim.foodSmelled(farSpeck.world, farSpeck.left) === 0 &&
  sim.foodSmelled(noseWorld(null).world, noseWorld(null).left) === 0);

// ---------- Eating and the food supply ----------
const eatWorld = sim.newWorld(400, 400,
  { systems: ['fluid', 'food'], foodSupply: sim.createFoodSupply({ maxCount: 0 }) });
const eater = sim.spawn(eatWorld, { cells: [cell(0, 0, 'nucleus'), cell(1, 0, 'mouth')] }, 200, 200, 0, 0);
eater.cells[1].fluids[sim.FLUID_SUGAR] = 0;
eatWorld.food = [{ x: eater.cells[1].x, y: eater.cells[1].y }];
sim.step(eatWorld, 1 / 40, noInput);
check('a creature counts the specks its Mouth eats', eater.foodEaten === 1 && eatWorld.food.length === 0);

const endingSupply = sim.newWorld(600, 600, { systems: ['food'],
  foodSupply: sim.createFoodSupply({ maxCount: 50, interval: 0.5, until: 2 }) });
for (let i = 0; i < 200; i++) sim.step(endingSupply, 1 / 40, noInput);
check('no new specks appear after the supply\'s end time', endingSupply.food.length === 4, endingSupply.food.length);

const lit = sim.newWorld(1400, 800, { systems: ['food'], foodSupply: sim.createFoodSupply({ nearLight: 120 }),
  light: { x: 300, y: 300, range: 450 } });
for (let i = 0; i < 400; i++) sim.step(lit, 1 / 40, noInput);
check('a supply near the light puts its specks within reach of it', lit.food.length > 5 &&
  lit.food.every(speck => Math.hypot(speck.x - 300, speck.y - 300) <= 120 + 1));
const dark = sim.newWorld(1400, 800, { systems: ['food'], foodSupply: sim.createFoodSupply({ nearLight: 120 }) });
for (let i = 0; i < 400; i++) sim.step(dark, 1 / 40, noInput);
check('and none while there is no light', dark.food.length === 0);

done();
