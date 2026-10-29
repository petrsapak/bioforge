'use strict';
// Metabolism: Fat cells turn sugar they have no room for into fat, and fat back into sugar when they run low; and a
// level's kit fills a new creature's stores with what the body didn't use. Pure: no DOM.

const FAT_CELL_CAPACITY = 10;                             // fat a Fat cell stores
const FAT_SUGAR_YIELD = 2;                                // sugar one fat turns back into
const FAT_STORE_COST = 2.5;                               // sugar it takes to make one fat (a fifth is lost)
const FAT_STORE_FILL = 0.9;                               // share of its sugar room above which a cell stores fat
const FAT_RELEASE_FILL = 0.5;                             // share of its sugar room below which it burns fat
const FAT_RATE = 0.25;                                    // fat per second a cell makes, or turns back into sugar

// Every cell that stores fat: nearly full of sugar, it turns the spare into fat; under half full, it turns fat back
// into sugar. The gap between the two fills keeps a cell from flipping back and forth.
function updateFatStores(world, dt) {
  for (const cell of world.cells) {
    if (!cell.type.fatCapacity) continue;
    storeSpareSugar(cell, dt);
    releaseFat(cell, dt);
  }
}

// turns the sugar above FAT_STORE_FILL into fat, while there is room for it
function storeSpareSugar(cell, dt) {
  const spareSugar = cell.fluids[FLUID_SUGAR] - FAT_STORE_FILL * cell.fluidCapacity[FLUID_SUGAR];
  const fatMade = Math.min(FAT_RATE * dt, spareSugar / FAT_STORE_COST, cell.type.fatCapacity - cell.fat);
  if (fatMade <= 0) return;
  cell.fat += fatMade;
  cell.fluids[FLUID_SUGAR] -= fatMade * FAT_STORE_COST;
}

// turns fat into sugar until the cell is FAT_RELEASE_FILL full of sugar again
function releaseFat(cell, dt) {
  const missingSugar = FAT_RELEASE_FILL * cell.fluidCapacity[FLUID_SUGAR] - cell.fluids[FLUID_SUGAR];
  const fatUsed = Math.min(FAT_RATE * dt, missingSugar / FAT_SUGAR_YIELD, cell.fat);
  if (fatUsed <= 0) return;
  cell.fat -= fatUsed;
  cell.fluids[FLUID_SUGAR] += fatUsed * FAT_SUGAR_YIELD;
}

// Fills a new creature's stores from a kit's leftovers ({ sugar, fat }): the sugar spread so that every cell is
// equally full, the fat the same over the cells that store fat. Any beyond the body's room is lost. Mouths start
// empty, ready to eat. O2 comes from the water and is left as it was.
function stockReserves(creature, reserves) {
  fillEvenly(creature.cells, sugarRoom, reserves.sugar, (cell, amount) => {
    cell.fluids[FLUID_SUGAR] = amount;
  });
  fillEvenly(creature.cells, cell => cell.type.fatCapacity, reserves.fat, (cell, amount) => {
    cell.fat = amount;
  });
}

// the sugar a cell keeps as a store: none in a Mouth, which only takes food in
const sugarRoom = cell => (cell.type.eatsFood ? 0 : cell.fluidCapacity[FLUID_SUGAR]);

// shares a total out over cells in proportion to their room, filling each to the same share of it
function fillEvenly(cells, roomOf, total, setAmount) {
  const room = cells.reduce((sum, cell) => sum + roomOf(cell), 0);
  const share = room ? Math.min(1, total / room) : 0;
  for (const cell of cells) setAmount(cell, roomOf(cell) * share);
}

// the reserves a creature can hold: its sugar room (none in Mouths), and its fat room (Fat cells)
function reserveRoom(cellTypes) {
  const sugarRoomOf = cellType => (cellType.eatsFood ? 0 : fluidCapacityOf(cellType, FLUIDS[FLUID_SUGAR]));
  return {
    sugar: cellTypes.reduce((sum, cellType) => sum + sugarRoomOf(cellType), 0),
    fat: cellTypes.reduce((sum, cellType) => sum + cellType.fatCapacity, 0),
  };
}

registerSystem({ name: 'metabolism', order: 57, switchable: true, update: updateFatStores });
