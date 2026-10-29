'use strict';
// Materials (pure data): what cells are built from and what a level's kit hands out. Each cell type has a recipe of
// these (data/cells.js); a kit's material that the body doesn't use becomes the creature's starting reserves
// (metabolism.js). Mineral and Nucleic join with chapters 5 and 7. Field meanings:
//   id, name, color: what the builder and the level card show
//   reserve: where the unspent part of a kit goes at the start of a run: 'sugar' (spread over the cells' sugar
//   stores), 'fat' (into Fat cells), or null (kept for nothing yet: growth, milestone 7)

function material(definition) {
  return { reserve: null, ...definition };
}

const MATERIALS = [
  material({ id: 'protein', name: 'Protein', color: '#d98a6a' }),
  material({ id: 'sugar', name: 'Sugar', color: '#ffd23f', reserve: 'sugar' }),
  material({ id: 'fat', name: 'Fat', color: '#f0e0a0', reserve: 'fat' }),
];
