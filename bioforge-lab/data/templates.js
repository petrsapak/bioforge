'use strict';
// Built-in creature designs (pure data). A design is { cells: [{ q, r, typeName }] }: hex coordinates and the cell
// type's name (the full format is in design.js).

// [[q, r, typeName], ...] -> design cells
const blueprintFromList = list => list.map(([q, r, typeName]) => ({ q, r, typeName }));
const designFromList = list => ({ cells: blueprintFromList(list) });
// [[fromQ, fromR, toQ, toR], ...] -> design fibres
const linksFromList = list => list.map(([fromQ, fromR, toQ, toR]) =>
  ({ from: { q: fromQ, r: fromR }, to: { q: toQ, r: toR } }));

// Hex art: one letter per cell, each row shifted half a cell from the row above; N = the nucleus.
const ART_CELL_CODES = {
  N: 'nucleus', t: 'tissue', S: 'shell', j: 'joint', c: 'cilia', n: 'nerve', g: 'ganglion', p: 'pacemaker',
  k: 'command', e: 'eyespot', m: 'muscle', b: 'bloater', s: 'siphon', x: 'nettle', T: 'thorn', G: 'gill', M: 'mouth',
  h: 'heart', a: 'airsac', f: 'fat', o: 'pore', r: 'mender', d: 'adrenal', H: 'snare', P: 'spitter',
};

// a design from hex art: rows of letters (ART_CELL_CODES), placed around the N
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

// the hex coordinates of the cell x cell widths from the midline (negative: left) in row r
function hexFromMidline(x, r) {
  return { q: x - r / 2, r };
}

// The design with a swimming tail added behind it, along the midline from firstRow: a row of three Tissues (a relay,
// a Pacemaker at the rate (Hz) and an Inhibitor of it), then muscleRows rows of Muscles at the sides (a Tissue spine
// between them on even rows), wired in a chain down each side, then a fin of Joints (fin: cells per row). rowDelay
// (s): a Delay neuron in every Muscle after the first row, so a wave runs down the tail.
function withMuscleTail(design, { firstRow, muscleRows, rate, rowDelay, fin }) {
  const cells = [...design.cells];
  const fibres = [...design.fibres];
  const add = (x, r, typeName, neuron = null) => {
    const { q } = hexFromMidline(x, r);
    cells.push(createDesignCell(q, r, typeName, neuron ? { neuron } : {}));
    return { q, r };
  };
  const pacemaker = add(0, firstRow, 'tissue', { ...createNeuron('pacemaker'), setting: rate });
  let left = add(-1, firstRow, 'tissue');
  let right = add(1, firstRow, 'tissue', createNeuron('inhibitor'));
  fibres.push({ from: pacemaker, to: left }, { from: pacemaker, to: right });
  for (let row = 0; row < muscleRows; row++) {
    const r = firstRow + 1 + row;
    const sideX = r % 2 === 0 ? 1 : 0.5;
    const neuron = () => (row > 0 && rowDelay ? { ...createNeuron('delay'), setting: rowDelay } : null);
    const leftMuscle = add(-sideX, r, 'muscle', neuron());
    const rightMuscle = add(sideX, r, 'muscle', neuron());
    if (r % 2 === 0) add(0, r, 'tissue');
    fibres.push({ from: left, to: leftMuscle }, { from: right, to: rightMuscle });
    left = leftMuscle;
    right = rightMuscle;
  }
  fin.forEach((width, index) => {
    for (let i = 0; i < width; i++) add(i - (width - 1) / 2, firstRow + 1 + muscleRows + index, 'joint');
  });
  return { ...design, cells, fibres };
}

// the design with every Pacemaker set to this rate (Hz)
function withPacemakerRate(design, rate) {
  const setRate = cell => (cell.neuron && cell.neuron.kind === 'pacemaker'
    ? { ...cell, neuron: { ...cell.neuron, setting: rate } } : cell);
  return { ...design, cells: design.cells.map(setRate) };
}

// the design with a Pacemaker at this rate (Hz) in its Nucleus (at 0, 0 in hex art), and a fibre from it to every
// cell that swells
function pulsedByNucleus(design, rate) {
  const nucleus = design.cells.find(cell => cell.q === 0 && cell.r === 0);
  const pacemaker = { ...nucleus, neuron: { ...createNeuron('pacemaker'), setting: rate } };
  const fibres = design.cells.filter(cell => CELLS[cell.typeName].resize === 'swell')
    .map(cell => ({ from: { q: nucleus.q, r: nucleus.r }, to: { q: cell.q, r: cell.r } }));
  return { ...design, cells: design.cells.map(cell => (cell === nucleus ? pacemaker : cell)), fibres };
}

// The Wiggler's and the Paddler's body: a Mouth, a Pore and two Gills at the head, two rows of Muscles with a Heart
// between them, and a fin of five Joints behind. It is mirror-symmetric
// (the Mouth, Pore and Heart weigh the same), so it swims straight. The Pacemaker in the
// Nucleus drives the left Muscles through the left Gill, and an Inhibitor in the right Gill drives the right ones, so
// the sides take turns and both are the same number of fibres from the beat. The Muscles bend the front, and the
// floppy fin follows late and pushes the water back: head first at about the Jet's speed (2.2 Hz). backDelay (s): a
// Delay neuron in each back-row Muscle, so a wave runs down the body to the fin, which swims about as fast as Cilia.
// isLean: Tissue in place of the Mouth, Pore, Gills and Heart, which only matter where it must eat and breathe, so
// it is built from Muscles, Joints and Tissue alone (Tail's dock).
function muscleFish(rate, backDelay, isLean = false) {
  const feeding = typeName => (isLean ? 'tissue' : typeName);
  const body = [[0, -1, feeding('mouth')], [1, -1, feeding('pore')], [-1, 0, feeding('gill')], [-1, 1, 'muscle'],
    [0, 1, 'muscle'], [-2, 2, 'muscle'], [-1, 2, feeding('heart')], [0, 2, 'muscle'], [-2, 3, 'joint'],
    [-1, 3, 'joint'], [-3, 4, 'joint'], [-2, 4, 'joint'], [-1, 4, 'joint']];
  const backRow = backDelay ? { neuron: { ...createNeuron('delay'), setting: backDelay } } : {};
  const isBackRowMuscle = (q, r) => r === 2 && (q === -2 || q === 0);
  return {
    cells: [
      createDesignCell(0, 0, 'nucleus', { neuron: { ...createNeuron('pacemaker'), setting: rate } }),
      createDesignCell(1, 0, feeding('gill'), { neuron: createNeuron('inhibitor') }),
      ...body.map(([q, r, typeName]) => createDesignCell(q, r, typeName, isBackRowMuscle(q, r) ? backRow : {})),
    ],
    fibres: linksFromList([[0, 0, -1, 0], [-1, 0, -1, 1], [-1, 1, -2, 2], [0, 0, 1, 0], [1, 0, 0, 1], [0, 1, 0, 2]]),
  };
}

// The Light eel: rests in the dark and swims to a light, on Muscles alone. Its Light eyes sit on the sides of its
// body, where a light to one side reaches one eye far more than the other. Each eye does two things:
// - it opens both tail gates (Synapses at threshold 1.5 in the Tissue beside the Nucleus), which pass the beat
//   (the Nucleus's Pacemaker on the left, its Inhibitor on the right) only while the eyes see enough light; each
//   tail row after the first beats rowDelay (s) after the row in front (Delay neurons), so a wave runs down it;
// - it holds the steering Muscle on its own side of the head shut, as hard as it sees, and a body turns toward the
//   side whose Muscles are held shut. The tail's Muscles let go on every beat, so they don't steer.
// Like the Seeker, it doesn't turn round for a light straight behind it.
function lightEel(rate, rowDelay) {
  const cells = [];
  const fibres = [];
  const add = (x, r, typeName, neuron = null) => {
    const { q } = hexFromMidline(x, r);
    cells.push(createDesignCell(q, r, typeName, neuron ? { neuron } : {}));
    return { q, r };
  };
  const wire = (from, to) => fibres.push({ from, to });
  const gate = () => ({ ...createNeuron('synapse'), setting: 1.5 });
  const nucleus = add(0, 0, 'nucleus', { ...createNeuron('pacemaker'), setting: rate });
  const leftGate = add(-1, 0, 'tissue', gate());
  const rightGate = add(1, 0, 'tissue', gate());
  const leftSteer = add(-2, 0, 'muscle');
  const rightSteer = add(2, 0, 'muscle');
  const leftEye = add(-1.5, 1, 'lighteye');
  add(-0.5, 1, 'tissue');
  const inverse = add(0.5, 1, 'tissue', createNeuron('inhibitor'));
  const rightEye = add(1.5, 1, 'lighteye');
  wire(nucleus, leftGate);
  wire(nucleus, inverse);
  wire(inverse, rightGate);
  for (const eye of [leftEye, rightEye]) {
    wire(eye, leftGate);
    wire(eye, rightGate);
  }
  wire(leftEye, leftSteer);
  wire(rightEye, rightSteer);
  let left = leftGate;
  let right = rightGate;
  for (let r = 2; r <= 4; r++) {
    const sideX = r % 2 === 0 ? 1 : 0.5;
    const delay = r > 2 ? { ...createNeuron('delay'), setting: rowDelay } : null;
    const leftMuscle = add(-sideX, r, 'muscle', delay);
    const rightMuscle = add(sideX, r, 'muscle', delay);
    if (r % 2 === 0) add(0, r, 'tissue');
    wire(left, leftMuscle);
    wire(right, rightMuscle);
    left = leftMuscle;
    right = rightMuscle;
  }
  [2, 3, 2].forEach((width, index) => {
    for (let i = 0; i < width; i++) add(i - (width - 1) / 2, 5 + index, 'joint');
  });
  return { cells, fibres };
}

const TEMPLATES = {
  // The default design: a Pacemaker in the Nucleus pulses two Siphons at the back, so it swims forward in pulses on
  // its own. Mouth, gill and heart feed the siphons, the Heart pumping blood between them all; the pore
  // lets out waste. Written in the current format.
  jet: {
    cells: [
      createDesignCell(0, 0, 'nucleus', { neuron: createNeuron('pacemaker') }),
      createDesignCell(0, -1, 'mouth'),
      createDesignCell(1, -1, 'gill'),
      createDesignCell(-1, 0, 'heart'),
      createDesignCell(1, 0, 'pore'),
      createDesignCell(-1, 1, 'siphon'),
      createDesignCell(0, 1, 'siphon'),
    ],
    fibres: [{ from: { q: 0, r: 0 }, to: { q: -1, r: 1 } }, { from: { q: 0, r: 0 }, to: { q: 0, r: 1 } }],
  },
  paddler: muscleFish(2.2, 0.1),
  leanPaddler: muscleFish(2.2, 0.1, true),
  // Follows the light (in the Sandbox, the mouse): each Light eye is wired across to the Siphon on the far side, so
  // the eye nearer the light drives the far siphon harder and turns the creature toward it (Braitenberg's vehicle).
  seeker: {
    cells: [
      createDesignCell(0, 0, 'nucleus'),
      createDesignCell(0, -1, 'lighteye'),
      createDesignCell(1, -1, 'lighteye'),
      createDesignCell(-1, 0, 'mouth'),
      createDesignCell(1, 0, 'gill'),
      createDesignCell(-1, 1, 'siphon'),
      createDesignCell(0, 1, 'siphon'),
      createDesignCell(1, 1, 'heart'),
      createDesignCell(-2, 1, 'pore'),
    ],
    fibres: [{ from: { q: 0, r: -1 }, to: { q: 0, r: 1 } }, { from: { q: 1, r: -1 }, to: { q: -1, r: 1 } }],
  },
  lightEel: lightEel(1.8, 0.1),
  wiggler: muscleFish(2.2, 0),
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
    // closes the soft gap in the crown: without it a ring of Mouths bites the front Bloater and Eyespot away and the
    // Nucleus rides in the hole, out of every Thorn's reach
    [1, -2, 'thorn'],
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
  // a wave runs down the tail: each Muscle row after the first beats 0.1 s after the row in front (Delay neurons)
  eel: withMuscleTail(upgradeToNerveLayer(designFromArt([
    '    T M T',
    '   x e e x',
    '  G f N f G',
    '   a h r f',
    '  c f d k c',
    '   o t t o'])), { firstRow: 4, muscleRows: 4, rate: 2, rowDelay: 0.1, fin: [2, 3, 2] }),
  // the Nucleus's Pacemaker swells the ring of Bloaters about once a second; a pulsing bell barely moves it, so it
  // drifts and stings what comes near
  jelly: pulsedByNucleus(designFromArt([
    '  M x e e x M',
    '   G t f t G',
    '  b t h a t b',
    ' b t f N f t b',
    '  b t f f t b',
    '   b b o b b',
    '  j   j j   j',
    ' j     j     j',
    '  j   j j   j',
    ' j     j     j',
    '  T   T T   T']), 1),
  // the wings flap together (Muscles in front, Bloaters behind), which looks the part but can't drive it: one
  // half-beat pushes the water as much as the other undoes. Its Cilia move it, and Space fires the jets.
  manta: withPacemakerRate(upgradeToNerveLayer(designFromArt([
    '          T M T',
    '         G h r G',
    '  T m p m p N p m p m T',
    ' j b b b b f f b b b b j',
    '          t k t',
    '         o s s o',
    '          c d c',
    '           j j',
    '            T'])), 2.4),
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

// The designs above were made while a Heart beat on its own. Now it beats only on a signal, so each Heart gets an
// Inhibitor, which keeps it beating (see upgradeToHeartAreas in design.js).
for (const name of Object.keys(TEMPLATES)) TEMPLATES[name] = upgradeToHeartAreas(TEMPLATES[name], true);

// The Templates screen's Examples tab, in groups: each example is a design above, with the name and the line shown
// on its card
const EXAMPLE_GROUPS = [
  {
    title: 'Small (fit the budget)',
    examples: [
      { template: 'jet', name: 'Jet',
        about: 'The starting creature: a Pacemaker pulses two siphons, so it swims on its own' },
      { template: 'paddler', name: 'Paddler',
        about: 'Muscle swimmer: the Wiggler with a Delay in each back Muscle, so a wave runs down to its fin' },
      { template: 'leanPaddler', name: 'Lean paddler',
        about: 'The Paddler with Tissue for its Mouth, Pore, Gills and Heart: Muscles, Joints and Tissue only' },
      { template: 'seeker', name: 'Seeker',
        about: 'Follows the mouse in the Sandbox: two Light eyes, each wired across to the far siphon' },
      { template: 'lightEel', name: 'Light eel',
        about: 'Rests in the dark and swims to the light (the mouse in the Sandbox): its Light eyes open its tail ' +
          'and hold the Muscle on their own side of the head shut, which turns it' },
      { template: 'lancer', name: 'Lancer',
        about: 'Thorn bruiser: Space fires the siphons for a dash into its thorns' },
      { template: 'stinger', name: 'Stinger', about: 'Nettle burst: its eyespot stings everything that comes close' },
      { template: 'spitter', name: 'Spitter', about: 'Ranged: Space fires four acid spitters' },
      { template: 'snarer', name: 'Snarer', about: 'Catcher: Space shoots two snares that pull foes onto its thorns' },
    ],
  },
  {
    title: 'Simple',
    examples: [
      { template: 'starter', name: 'Starter', about: 'Swims on cilia alone: no nerves to wire' },
      { template: 'wiggler', name: 'Wiggler', about: 'Two rows of Muscles take turns; a fin of Joints follows' },
      { template: 'squirter', name: 'Squirter', about: 'Space fires three siphons; shell on both sides' },
      { template: 'nettler', name: 'Nettler', about: 'An eyespot ringed with nettles' },
      { template: 'puffer', name: 'Puffer', about: 'A ball of bloaters behind a crown of thorns' },
    ],
  },
  {
    title: 'Showcase (over the budget: try them in the Sandbox)',
    examples: [
      { template: 'eel', name: 'Eel',
        about: 'A wave runs down its tail of Muscles (Delay neurons) to a Joint fin; eyespots fire the head nettles; ' +
          'Space releases adrenaline' },
      { template: 'jelly', name: 'Jelly',
        about: 'A ring of bloaters pulses the bell as it drifts; thorn tentacles trail behind; the eyespot ' +
          'cap stings' },
      { template: 'manta', name: 'Manta',
        about: 'Both wings flap, muscles in front and bloaters behind; cilia carry it; Space fires the jets and ' +
          'adrenaline' },
      { template: 'crab', name: 'Crab',
        about: 'Space snaps both pincers shut and fires the back jets; shell carapace' },
    ],
  },
];
