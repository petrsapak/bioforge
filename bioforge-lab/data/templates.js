'use strict';
// Built-in creature designs (pure data). A design is { cells: [{ q, r, typeName }] }: hex coordinates and the cell
// type's name (the full format is in design.js).

// [[q, r, typeName], ...] -> design cells
const blueprintFromList = list => list.map(([q, r, typeName]) => ({ q, r, typeName }));
const designFromList = list => ({ cells: blueprintFromList(list) });

// Hex art: one letter per cell, each row shifted half a cell from the row above; N = the nucleus.
const ART_CELL_CODES = {
  N: 'nucleus', t: 'tissue', S: 'shell', j: 'joint', c: 'cilia', n: 'nerve', g: 'ganglion', p: 'pacemaker',
  k: 'command', e: 'eyespot', m: 'muscle', b: 'bloater', s: 'siphon', x: 'nettle', T: 'thorn', G: 'gill', M: 'mouth',
  h: 'heart', v: 'valve', a: 'airsac', f: 'fat', o: 'pore', r: 'mender', d: 'adrenal', H: 'snare', P: 'spitter',
};

function designFromArt(rows) {
  const placed = [];
  let nucleusColumn = 0;
  let nucleusRow = 0;
  rows.forEach((row, rowIndex) => [...row].forEach((letter, column) => {
    if (!ART_CELL_CODES[letter]) return;
    placed.push([column, rowIndex, ART_CELL_CODES[letter]]);
    if (letter !== 'N') return;
    nucleusColumn = column;
    nucleusRow = rowIndex;
  }));
  const toHex = ([column, rowIndex, typeName]) => {
    const r = rowIndex - nucleusRow;
    return [(column - nucleusColumn - r) / 2, r, typeName];
  };
  return designFromList(placed.map(toHex));
}

const designCost = design => design.cells.reduce((sum, cell) => sum + CELLS[cell.typeName].cost, 0);

const TEMPLATES = {
  wiggler: designFromList([
    [0, 0, 'nucleus'], [0, -1, 'thorn'], [1, -1, 'mouth'], [-1, 0, 'gill'], [1, 0, 'heart'], [1, 1, 'pore'],
    [-1, 1, 'muscle'], [0, 1, 'bloater'], [-2, 2, 'muscle'], [-1, 2, 'pacemaker'], [0, 2, 'bloater'],
    [-2, 3, 'muscle'], [-1, 3, 'bloater'], [-2, 4, 'joint'], [2, 0, 'fat'],
  ]),
  squirter: designFromList([
    [0, 0, 'nucleus'], [0, -1, 'thorn'], [1, -1, 'mouth'], [-1, 0, 'shell'], [1, 0, 'shell'],
    [0, 1, 'command'], [-1, 1, 'siphon'], [1, 1, 'gill'], [-1, 2, 'siphon'], [0, 2, 'siphon'], [1, 2, 'pore'],
    [-2, 2, 'fat'],
  ]),
  nettler: designFromList([
    [0, 0, 'nucleus'], [0, -1, 'eyespot'], [1, -1, 'nettle'], [-1, 0, 'nettle'], [-1, -1, 'nettle'], [1, 0, 'nettle'],
    [-1, 1, 'gill'], [0, 1, 'pore'], [1, 1, 'heart'],
  ]),
  puffer: designFromList([
    [0, 0, 'nucleus'], [0, -1, 'eyespot'], [1, -1, 'bloater'], [1, 0, 'bloater'], [0, 1, 'bloater'],
    [-1, 1, 'bloater'], [-1, 0, 'bloater'], [0, -2, 'thorn'], [2, -1, 'thorn'], [1, 1, 'thorn'], [-1, -1, 'thorn'],
    [-1, 2, 'gill'], [-2, 1, 'pore'], [0, 2, 'fat'],
  ]),
  starter: designFromList([
    [0, 0, 'nucleus'], [0, -1, 'thorn'], [1, -1, 'mouth'], [-1, 0, 'gill'], [1, 0, 'tissue'],
    [-1, 1, 'cilia'], [0, 1, 'cilia'], [-1, 2, 'pore'],
  ]),
  // the smallest prey, weaker than the starter: mote is harmless and runs when hurt, nipper has one thorn
  mote: designFromList([[0, 0, 'nucleus'], [0, -1, 'mouth'], [1, 0, 'gill'], [0, 1, 'cilia'], [-1, 1, 'pore']]),
  nipper: designFromList([
    [0, 0, 'nucleus'], [0, -1, 'thorn'], [1, -1, 'mouth'], [-1, 0, 'gill'], [0, 1, 'cilia'], [-1, 1, 'pore'],
  ]),
  // showcase builds, drawn as hex art (see designFromArt); they cost more than the starting biomass
  eel: designFromArt([
    '    T M T',
    '   x e e x',
    '  G f N f G',
    '   a h r f',
    '  c f d k c',
    '   o t t o',
    '    p t t',
    '     m b',
    '    m b',
    '     p b',
    '    m b',
    '     b m',
    '    b p',
    '     b m',
    '    b m',
    '     j',
    '    T']),
  jelly: designFromArt([
    '   M x e x M',
    '    G t f t G',
    '   b p h a p b',
    '  b t r N f t b',
    '   b p f t p b',
    '    b b o b b',
    '   j   j   j',
    '    j   j   j',
    '   j   j   j',
    '    j   j   j',
    '   T   T   T']),
  manta: designFromArt([
    '          T M T',
    '         G h r G',
    '  T b p b p N p b p b T',
    '   m m m m f a f m m m m',
    '          t k t',
    '         o s s o',
    '          c d c',
    '           j j',
    '            T']),
  crab: designFromArt([
    '  T           T',
    ' b m         m b',
    '  b m       m b',
    '   b m T M T m b',
    '    j k S S k j',
    '   G S S N S S G',
    '    a h r f h o',
    '   c t s k s t c',
    '    o   s s   o']),
};

// small builds that fit RULES' budget (from Bioforge Arena's heroes)
Object.assign(TEMPLATES, {
  // Space: siphon dash into its thorns
  lancer: designFromArt(['   T T T', '  S G N G S', '   c h f c', '  c k s k c', '   o s o']),
  // its eyespot stings everything close
  stinger: designFromArt([' x x e x x', '  G f N h G', '   c c c c', '    o   o']),
  // Space: four acid spitters
  spitter: designFromArt(['   P k k P', '  P G N G P', '   f h a f', '  c c o c c']),
  // Space: snares pull foes onto its thorns
  snarer: designFromArt(['   T T T', '  H k N k H', '   G h f G', '  c c o c c']),
});

// The designs above are written in the format from before the nerve layer (Nerve, Pacemaker, Ganglion and Command
// cells, wired by touch); they are converted to neurons and fibres here (see upgradeToNerveLayer in design.js).
for (const name of Object.keys(TEMPLATES)) TEMPLATES[name] = upgradeToNerveLayer(TEMPLATES[name]);
