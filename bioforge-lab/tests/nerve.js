'use strict';
// The nerve layer (sim only): neuron truth tables, a pulse crossing all its fibres at once, fibre routing and units,
// fibres cut with their cells, old designs converted to neurons and fibres.
const { load } = require('./load');
const { check, done } = require('./check');
const { X: sim } = load({}, ['newWorld', 'spawn', 'step', 'createNeuron', 'createDesignCell', 'createRouteArea',
  'routeFibre', 'fibreUnits', 'upgradeToNerveLayer', 'hexKey', 'TEMPLATES', 'NERVE_SUBSTEPS', 'fibreRoute',
  'layOutFibreLanes', 'placePartFibres', 'smoothLinkLine', 'LINK_END_GAP']);

const STEP = 1 / 40;                                      // game s per step
const cellAt = (creature, q, r) => creature.cells.find(cell => cell.q === q && cell.r === r);
const fibre = (fromQ, fromR, toQ, toR) => ({ from: { q: fromQ, r: fromR }, to: { q: toQ, r: toR } });

// A test rig: the Nucleus, Command neurons on keys 1 and 2, and a logic cell below them that both feed.
// Only the nerve system runs, so fuel plays no part.
function createLogicRig(logicNeuron) {
  const cells = [
    sim.createDesignCell(0, 0, 'nucleus'),
    sim.createDesignCell(1, 0, 'tissue', { neuron: sim.createNeuron('command'), boundKey: '1' }),
    sim.createDesignCell(-1, 0, 'tissue', { neuron: sim.createNeuron('command'), boundKey: '2' }),
    sim.createDesignCell(0, 1, 'tissue', logicNeuron ? { neuron: logicNeuron } : {}),
  ];
  const world = sim.newWorld(600, 600, { systems: ['nerve'] });
  const creature = sim.spawn(world, { cells, fibres: [fibre(1, 0, 0, 1), fibre(-1, 0, 0, 1)] }, 300, 300, 0, 0);
  creature.aiControlled = false;
  const press = (keys, steps = 2) => {
    const input = { swimX: 0, swimY: 0, ability: false, heldKeys: new Set(keys) };
    for (let i = 0; i < steps; i++) sim.step(world, STEP, input);
    return cellAt(creature, 0, 1).signal;
  };
  return { world, creature, press };
}

// the logic cell's signal for each input pair: [none, key 1, key 2, both]
const truthTable = neuron => {
  const rig = createLogicRig(neuron);
  return [[], ['1'], ['2'], ['1', '2']].map(keys => rig.press(keys)).join(',');
};
const synapseWith = threshold => ({ ...sim.createNeuron('synapse'), setting: threshold });
check('a plain cell relays the sum, clamped to 1', truthTable(null) === '0,1,1,1', truthTable(null));
check('Synapse with threshold 1 is OR', truthTable(synapseWith(1)) === '0,1,1,1');
check('Synapse with threshold 2 is AND', truthTable(synapseWith(2)) === '0,0,0,1', truthTable(synapseWith(2)));
check('Inhibitor is NOT (of the sum)', truthTable(sim.createNeuron('inhibitor')) === '1,0,0,0');

{ // Latch: each new pulse flips it; holding the key doesn't flip it again
  const rig = createLogicRig(sim.createNeuron('latch'));
  const states = [rig.press(['1']), rig.press(['1'], 10), rig.press([]), rig.press(['1']), rig.press([])];
  check('Latch flips on each new pulse and holds', states.join(',') === '1,1,1,0,0', states.join(','));
}

{ // Ganglion: rises slowly toward its input
  const rig = createLogicRig(sim.createNeuron('ganglion'));
  const afterOneStep = rig.press(['1'], 1);
  const afterTwoSeconds = rig.press(['1'], 80);
  check('Ganglion follows its input slowly',
    afterOneStep > 0 && afterOneStep < 0.2 && afterTwoSeconds > 0.95, `${afterOneStep} then ${afterTwoSeconds}`);
}

{ // Delay: the input unchanged but late, both on the way up and on the way down
  const rig = createLogicRig({ kind: 'delay', setting: 0.5 });
  const beforeTheDelay = rig.press(['1'], 18);            // 0.45 s
  const afterTheDelay = rig.press(['1'], 4);              // 0.55 s
  const heldOnAfterRelease = rig.press([], 18);
  const offAfterRelease = rig.press([], 4);
  check('Delay passes its input on 0.5 s late', [beforeTheDelay, afterTheDelay, heldOnAfterRelease,
    offAfterRelease].join(',') === '0,1,1,0', [beforeTheDelay, afterTheDelay, heldOnAfterRelease,
    offAfterRelease].join(','));
  const steadyRig = createLogicRig({ kind: 'delay', setting: 3 });
  steadyRig.press(['1'], 400);
  const delayLine = cellAt(steadyRig.creature, 0, 1).delayLine;
  check('a steady input keeps the Delay\'s memory small', delayLine.changes.length <= 2,
    delayLine.changes.length + ' entries');
}

{ // Pacemaker: on and off at its rate, whatever its inputs
  const cells = [sim.createDesignCell(0, 0, 'nucleus', { neuron: { kind: 'pacemaker', setting: 2 } })];
  const world = sim.newWorld(600, 600, { systems: ['nerve'] });
  const creature = sim.spawn(world, { cells, fibres: [] }, 300, 300, 0, 0);
  let flips = 0;
  let previous = 0;
  for (let i = 0; i < 80; i++) {
    sim.step(world, STEP, { swimX: 0, swimY: 0, ability: false });
    const signal = creature.cells[0].signal;
    if (signal !== previous) flips++;
    previous = signal;
  }
  check('a 2 Hz Pacemaker flips about 8 times in 2 s', flips >= 7 && flips <= 9, `flips ${flips}`);
}

{ // Pacemaker halves: a Muscle on it is driven exactly half the time, even at 1.6 Hz, where a cycle is 25 game steps
  // (the old sine test counted its zeros as off, and the Muscle read only a game step's last nerve step)
  for (const rate of [1.4, 1.6, 2, 3.2]) {
    const cells = [sim.createDesignCell(0, 0, 'nucleus', { neuron: { kind: 'pacemaker', setting: rate } }),
      sim.createDesignCell(0, 1, 'muscle')];
    const world = sim.newWorld(600, 600, { systems: ['nerve'] });
    const creature = sim.spawn(world, { cells, fibres: [fibre(0, 0, 0, 1)] }, 300, 300, 0, 0);
    const muscle = cellAt(creature, 0, 1);
    let driven = 0;
    const steps = 400;                                    // 10 game s: a whole number of cycles at each rate
    for (let i = 0; i < steps; i++) {
      sim.step(world, STEP, { swimX: 0, swimY: 0, ability: false });
      driven += muscle.stepSignal;
    }
    check(`a Muscle on a ${rate} Hz Pacemaker is driven half the time`, Math.abs(driven / steps - 0.5) < 0.002,
      `${(100 * driven / steps).toFixed(2)}%`);
  }
}

{ // a pulse reaches every wired cell at once: a chain of 5 fibres from a Command, laid end first so the fibre order
  // doesn't help, and two branches of different lengths
  const cells = [sim.createDesignCell(0, 0, 'nucleus', { neuron: sim.createNeuron('command') })];
  const fibres = [];
  for (let i = 5; i >= 1; i--) {
    cells.push(sim.createDesignCell(i, 0, 'tissue'));
    fibres.push(fibre(i - 1, 0, i, 0));
  }
  cells.push(sim.createDesignCell(0, 1, 'tissue'));
  fibres.push(fibre(0, 0, 0, 1));
  const world = sim.newWorld(600, 600, { systems: ['nerve'] });
  const creature = sim.spawn(world, { cells, fibres }, 300, 300, 0, 0);
  const signals = () => creature.cells.map(cell => cell.signal);
  sim.step(world, STEP, { swimX: 0, swimY: 0, ability: true });
  const firstStep = creature.cells.map(cell => cell.stepSignal);
  check('a pulse reaches every wired cell in the same nerve step, however many fibres away',
    firstStep.every(share => share === 1), firstStep.join(' '));
  sim.step(world, STEP, { swimX: 0, swimY: 0, ability: false });
  check('and leaves them all at once', signals().every(signal => signal === 0), signals().join(' '));
}

{ // a loop is the only wiring that takes time: a plain cell feeding an Inhibitor that feeds it back flips every
  // nerve step
  const cells = [sim.createDesignCell(0, 0, 'nucleus', { neuron: sim.createNeuron('inhibitor') }),
    sim.createDesignCell(1, 0, 'tissue')];
  const world = sim.newWorld(600, 600, { systems: ['nerve'] });
  const creature = sim.spawn(world, { cells, fibres: [fibre(0, 0, 1, 0), fibre(1, 0, 0, 0)] }, 300, 300, 0, 0);
  sim.step(world, STEP, { swimX: 0, swimY: 0, ability: false });
  const share = creature.cells[0].stepSignal;
  check('a loop through an Inhibitor flips each nerve step (on half the game step)', share === 0.5, `${share}`);
}

{ // routing and units: centre to centre, through the cells between
  const row = [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }];
  const area = sim.createRouteArea(row);
  const neighbours = sim.routeFibre(area, row[0], row[1]);
  const acrossOne = sim.routeFibre(area, row[0], row[2]);
  check('neighbours: 1 unit, straight from centre to centre', neighbours.units === 1 && neighbours.hexes.length === 2);
  check('across one cell: 2 units, through its centre',
    acrossOne.units === 2 && acrossOne.hexes.join(' ') === '0,0 1,0 2,0');
  check('a cell to itself has no route', sim.routeFibre(area, row[0], row[0]) === null);
  check('no route to a hex without a cell', sim.routeFibre(area, row[0], { q: 5, r: 5 }) === null);
  const design = { cells: row.map(({ q, r }) => sim.createDesignCell(q, r, 'tissue')), fibres: [fibre(0, 0, 2, 0)] };
  check('fibreUnits adds up the routes', sim.fibreUnits(design) === 2);
}

{ // a fibre with via cells runs through exactly those
  const cells = [[0, 0], [1, 0], [1, -1], [0, -1], [2, -1]].map(([q, r]) => sim.createDesignCell(q, r, 'tissue'));
  const area = sim.createRouteArea(cells);
  const roundabout = { ...fibre(0, 0, 1, 0), via: [{ q: 0, r: -1 }, { q: 1, r: -1 }] };
  check('the route runs through its via cells', sim.fibreRoute(area, roundabout).hexes.join(' ') ===
    '0,0 0,-1 1,-1 1,0' && sim.fibreRoute(area, roundabout).units === 3);
  check('via cells that don\'t touch give no route',
    sim.fibreRoute(area, { ...fibre(0, 0, 1, 0), via: [{ q: 2, r: -1 }] }) === null);
  check('a via cell that is gone gives no route',
    sim.fibreRoute(area, { ...fibre(0, 0, 1, 0), via: [{ q: 0, r: 1 }] }) === null);
  const world = sim.newWorld(600, 600, { systems: ['nerve'] });
  sim.spawn(world, { cells: [sim.createDesignCell(0, 0, 'nucleus'), ...cells.slice(1)], fibres: [roundabout] },
    300, 300, 0, 0);
  check('a creature\'s fibre runs through its via cells', world.fibres.length === 1 &&
    world.fibres[0].path.map(cell => cell.q + ',' + cell.r).join(' ') === '0,0 0,-1 1,-1 1,0');
  const placed = sim.placePartFibres([roundabout], 3, 5, 5)[0];
  check('a Bud part turns a fibre\'s via cells with it', placed.via.length === 2 &&
    sim.fibreRoute(sim.createRouteArea([placed.from, ...placed.via, placed.to]), placed) !== null);
}

{ // lanes: fibres sharing a side, either way round, never share a line
  const stop = (node, x) => ({ node, x, y: 0 });
  const there = [stop('a', 0), stop('b', 10)];
  const back = [stop('b', 10), stop('a', 0)];
  const [first, second] = sim.layOutFibreLanes([there, back], 8);
  check('a fibre alone keeps the centre line', sim.layOutFibreLanes([there], 8)[0].points[0][1] === 0);
  check('a fibre running back along it takes another line',
    Math.abs(first.points[0][1] - second.points[1][1]) > 1, `${first.points[0][1]} ${second.points[1][1]}`);
  check('the colours run out gracefully',
    sim.layOutFibreLanes(Array.from({ length: 10 }, () => there), 3).every(entry => entry.colorIndex < 3));
}

{ // the drawn line: straight across each border, curved inside the cells between, its ends short of the end cells'
  // middles (user, 2026-10-30: the nerves and vessels "don't fit together")
  const bend = [[0, 0], [20, 0], [30, 17]];
  const line = sim.smoothLinkLine(bend);
  const distanceFrom = ([x, y], [otherX, otherY]) => Math.hypot(x - otherX, y - otherY);
  const isOnLine = target => line.some(point => distanceFrom(point, target) < 1e-9);
  check("it starts and ends the end gap short of the end cells' middles",
    Math.abs(distanceFrom(line[0], bend[0]) - sim.LINK_END_GAP) < 1e-9 &&
    Math.abs(distanceFrom(line[line.length - 1], bend[2]) - sim.LINK_END_GAP) < 1e-9);
  check("it crosses each border halfway between two cells' middles", isOnLine([10, 0]) && isOnLine([25, 8.5]));
  check('and bends inside the cell between instead of turning at its middle',
    line.every(point => distanceFrom(point, bend[1]) > 2));
  const neighbours = sim.smoothLinkLine([[0, 0], [4, 0]]);
  check('on a short side its ends keep a line between them',
    neighbours.length === 2 && neighbours[1][0] > neighbours[0][0]);
}

{ // a fibre is cut when a cell it runs through dies, and only then
  // a row (0,0) (1,0) (2,0) with a top row (1,-1) (2,-1) that keeps (2,0) joined; the fibre runs through (1,0)
  const spawnAndKill = (killQ, killR) => {
    const list = [[0, 0, 'nucleus'], [1, 0, 'tissue'], [2, 0, 'tissue'], [1, -1, 'tissue'], [2, -1, 'tissue']];
    const cells = list.map(([q, r, typeName]) => sim.createDesignCell(q, r, typeName));
    const world = sim.newWorld(600, 600, { systems: ['nerve'] });
    const creature = sim.spawn(world, { cells, fibres: [fibre(0, 0, 2, 0)] }, 300, 300, 0, 0);
    const runsThroughMiddle = world.fibres[0].path.map(cell => cell.q + ',' + cell.r).join(' ') === '0,0 1,0 2,0';
    cellAt(creature, killQ, killR).health = 0;
    sim.step(world, STEP, { swimX: 0, swimY: 0, ability: false });
    return { runsThroughMiddle, fibreCount: world.fibres.length };
  };
  const killedOnRoute = spawnAndKill(1, 0);
  check('killing a cell the fibre runs through cuts it',
    killedOnRoute.runsThroughMiddle && killedOnRoute.fibreCount === 0);
  check('killing a cell beside its route leaves it', spawnAndKill(1, -1).fibreCount === 1);
}

{ // designs from before the nerve layer are converted
  // a Pacemaker cell beside the Nucleus, touching a column of Muscles, in the old format
  const wiggler = sim.upgradeToNerveLayer({ cells: [[0, 0, 'nucleus'], [1, 0, 'pacemaker'], [1, 1, 'muscle'],
    [1, 2, 'muscle']].map(([q, r, typeName]) => sim.createDesignCell(q, r, typeName)) });
  check('built-in designs have no Pacemaker, Command, Ganglion or Nerve cells',
    Object.values(sim.TEMPLATES).every(design =>
      design.cells.every(cell => !['pacemaker', 'command', 'ganglion', 'nerve'].includes(cell.typeName))));
  check('a Pacemaker cell became Tissue with a Pacemaker neuron, wired by fibres',
    wiggler.cells.some(cell => cell.typeName === 'tissue' && cell.neuron && cell.neuron.kind === 'pacemaker') &&
    wiggler.fibres.length > 0);
  // the muscle at (-1, 0) touches only the Nucleus, which never carried signals
  const old = { cells: [[0, 0, 'nucleus'], [1, 0, 'command'], [2, 0, 'nerve'], [3, 0, 'muscle'], [-1, 0, 'muscle']]
    .map(([q, r, typeName]) => sim.createDesignCell(q, r, typeName)) };
  const upgraded = sim.upgradeToNerveLayer(old);
  const laid = upgraded.fibres.map(({ from, to }) => `${from.q},${from.r}>${to.q},${to.r}`).join(' ');
  check('touch-wiring becomes fibres outward from the source, only through cells that carried signals',
    laid === '1,0>2,0 2,0>3,0', laid);
  check('a converted design is left alone', sim.upgradeToNerveLayer(upgraded) === upgraded);
  const world = sim.newWorld(1200, 1200);
  const creature = sim.spawn(world, wiggler, 600, 600, 0, 0);
  let musclesFired = false;
  for (let i = 0; i < 80; i++) {
    sim.step(world, STEP, { swimX: 0, swimY: 0, ability: false });
    if (creature.cells.some(cell => cell.typeName === 'muscle' && cell.signal > 0.5)) musclesFired = true;
  }
  check("the converted design's Pacemaker drives its muscles", musclesFired);
}

done();
