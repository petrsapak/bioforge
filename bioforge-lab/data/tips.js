'use strict';
// Builder tooltips (pure data): how to use each cell type and neuron, and a live example build shown in a mini tank
// (createExampleRun in fieldguide.js, drawn by tipdemo.js). Example fields:
//   cells: [q, r, typeName, neuronKind, setting] for each cell, neuronKind and setting optional;
//   fibres: [fromQ, fromR, toQ, toR] for each fibre;
//   stimulus: what the water holds for its senses: 'light' (a light ahead to one side, put on the other side once
//   reached), 'food' (a speck placed the same way), 'enemy' (a dummy enemy just in front, there every other 2 s),
//   'key' (Space held every other 2 s, for a Command); left out: nothing;
//   dummyType: the enemy's cell type (default Tissue); dummyTouches: the enemy is held touching the creature;
//   fluidView: the fluid shown (1 + its index in FLUIDS: 1 = O2, 2 = sugar, 3 = waste,
//   4 = repair); startsHurt: cell types that start damaged; budPart: the part a Bud grows;
//   traces (neurons): the [q, r] cells whose signals are drawn as lanes under the tank.
// Hex neighbours of (0, 0): front (0, -1) and (1, -1), sides (-1, 0) and (1, 0), back (-1, 1) and (0, 1).

// two Siphons at the back, each wired from the cell at (q, r)
const fibresToBackSiphons = (q, r) => [[q, r, -1, 1], [q, r, 0, 1]];
// from the Eyespot at the front to each listed cell
const fibresFromEyespot = targets => targets.map(([q, r]) => [0, -1, q, r]);

const TIPS = {
  nucleus: {
    howToUse: 'Every creature has exactly one, placed for you. Keep it away from the front line and surround it ' +
      'with tough cells.',
    example: {
      cells: [
        [0, 0, 'nucleus'], [1, 0, 'shell'], [-1, 0, 'shell'], [0, 1, 'shell'], [0, -1, 'shell'], [1, -1, 'shell'],
        [-1, 1, 'shell'], [0, -2, 'thorn'], [2, -2, 'thorn'], [-1, -1, 'thorn'],
      ],
    },
  },
  tissue: {
    howToUse: 'Fill gaps and add bulk. Like any cell it can hold a neuron (Nerves view), and fibres run through it: ' +
      'here a Tissue holds the Pacemaker that pulses the Siphons.',
    example: {
      cells: [
        [0, 0, 'nucleus'], [-1, 0, 'gill'], [1, 0, 'fat'], [0, -1, 'tissue'], [1, -1, 'tissue'],
        [-1, 1, 'siphon'], [0, 1, 'tissue', 'pacemaker', 1.4], [0, 2, 'siphon'],
      ],
      fibres: [[0, 1, -1, 1], [0, 1, 0, 2]],
    },
  },
  shell: {
    howToUse: 'Put it where hits land: the front and around the Nucleus. It is heavy, so too much makes you slow.',
    example: {
      cells: [
        [0, 0, 'nucleus'], [0, -1, 'shell'], [1, -1, 'shell'], [-1, 0, 'shell'], [0, -2, 'thorn'], [1, -2, 'thorn'],
        [0, 1, 'tissue'],
      ],
    },
  },
  joint: {
    howToUse: 'Place it between the body and a tail or limb. Everything behind it can swing. A fin of Joints ' +
      'behind the muscles follows each stroke late and pushes the water back.',
    example: {
      cells: [
        [0, 0, 'nucleus'], [-1, 0, 'gill'], [1, 0, 'fat'], [0, 1, 'joint'], [0, 2, 'tissue'], [0, 3, 'tissue'],
        [-1, 1, 'tissue', 'pacemaker', 1], [-1, 2, 'muscle'], [-1, 3, 'muscle'],
      ],
      fibres: [[-1, 1, -1, 2], [-1, 1, -1, 3]],
    },
  },
  cilia: {
    howToUse: 'Put them on the sides and back, as many on the left as on the right: Cilia on one side turn the ' +
      'body. They beat by themselves, with no nerve signal, but need O₂ and sugar from the body (a Gill and a Fat ' +
      'or a Mouth somewhere in it); unfed, they swim no better than a plain cell.',
    example: {
      cells: [
        [0, 0, 'nucleus'], [0, -1, 'gill'], [1, -1, 'gill'], [-1, 0, 'fat'], [1, 0, 'fat'], [-1, 1, 'cilia'],
        [0, 1, 'cilia'],
      ],
    },
  },
  eyespot: {
    howToUse: 'Place it on the edge facing the enemy and lay fibres from it to weapons (Nerves view): they fire ' +
      'whenever an enemy comes near, and stop when it leaves. It is on or off: it says something is near, not ' +
      'where.',
    example: {
      cells: [
        [0, 0, 'nucleus'], [0, -1, 'eyespot'], [1, -1, 'nettle'], [-1, 0, 'nettle'], [-1, 1, 'gill'], [1, 0, 'fat'],
      ],
      fibres: fibresFromEyespot([[1, -1], [-1, 0]]),
      stimulus: 'enemy',
    },
  },
  lighteye: {
    howToUse: 'Put two on the front, left and right, and lay a fibre from each across to a Siphon on the other side ' +
      '(Nerves view). The eye nearer the light then drives the far Siphon harder, which turns the creature toward ' +
      'the light: here it chases a light going round it, and in the Sandbox it follows the mouse. The light ' +
      'reaches 450 px and is brighter closer in, so the creature speeds up as it nears. Wired to the same side, ' +
      'it runs away instead. With Muscles, wire each eye to a Muscle on its own side: a Muscle held shut turns ' +
      'the body toward it (the Light eel in Templates).',
    example: {
      cells: [
        [0, 0, 'nucleus'], [0, -1, 'lighteye'], [1, -1, 'lighteye'], [-1, 0, 'gill'], [1, 0, 'fat'],
        [-1, 1, 'siphon'], [0, 1, 'siphon'],
      ],
      fibres: [[0, -1, 0, 1], [1, -1, -1, 1]],
      stimulus: 'light',
    },
  },
  nose: {
    howToUse: 'Put two on the front, left and right, and lay a fibre from each across to a Siphon on the other side ' +
      '(Nerves view), as with Light eyes: the creature then swims from speck to speck. It smells only the nearest ' +
      'speck, so where food is far apart it stops; a Mouth with a Fat beside it eats what it reaches.',
    example: {
      cells: [
        [0, 0, 'nucleus'], [0, -1, 'nose'], [1, -1, 'nose'], [-1, 0, 'gill'], [1, 0, 'fat'],
        [-1, 1, 'siphon'], [0, 1, 'siphon'],
      ],
      fibres: [[0, -1, 0, 1], [1, -1, -1, 1]],
      stimulus: 'food',
    },
  },
  muscle: {
    howToUse: 'Contracts while signalled, and a weak signal still pulls (a quarter signal pulls at half strength). ' +
      'To swim, put rows of Muscles on both sides behind the head and a fin of Joints behind them, and make the ' +
      'sides take turns: a Pacemaker on one side and an Inhibitor of it on the other, about 2 Hz. A Muscle held ' +
      'shut for a second or more turns the body toward its side; a beating one doesn\'t steer. The Wiggler, the ' +
      'Paddler and the Light eel in Templates swim on Muscles.',
    example: {
      cells: [
        [0, 0, 'nucleus', 'pacemaker', 2.2], [1, 0, 'tissue', 'inhibitor'], [0, -1, 'tissue'], [1, -1, 'tissue'],
        [-1, 0, 'tissue'], [-1, 1, 'muscle'], [0, 1, 'muscle'], [-2, 2, 'muscle'], [-1, 2, 'tissue'],
        [0, 2, 'muscle'], [-2, 3, 'joint'], [-1, 3, 'joint'], [-3, 4, 'joint'], [-2, 4, 'joint'], [-1, 4, 'joint'],
      ],
      fibres: [[0, 0, -1, 0], [-1, 0, -1, 1], [-1, 1, -2, 2], [0, 0, 1, 0], [1, 0, 0, 1], [0, 1, 0, 2]],
    },
  },
  bloater: {
    howToUse: 'Needs a nerve signal and fuel. On the surface its swelling shoves enemies away; inside, it pushes ' +
      'the body apart. In a crevice, a pair side by side swells against both walls and grips the rock.',
    example: {
      cells: [
        [0, 0, 'nucleus'], [0, -1, 'eyespot'], [1, -1, 'thorn'], [-1, 0, 'bloater'], [1, 0, 'bloater'],
        [-1, 1, 'gill'], [0, 1, 'fat'],
      ],
      fibres: fibresFromEyespot([[-1, 0], [1, 0]]),
      stimulus: 'enemy',
    },
  },
  siphon: {
    howToUse: 'Needs a nerve signal and fuel. Place it at the back; it always pushes forward, as hard as its ' +
      'signal. Two at the back, pulsed by a Pacemaker in the Nucleus, swim straight. It burns fuel fast, so give ' +
      'it a Fat or an Air sac.',
    example: {
      cells: [
        [0, 0, 'nucleus', 'pacemaker', 1.4], [-1, 0, 'gill'], [1, 0, 'fat'], [-1, 1, 'siphon'], [0, 1, 'siphon'],
      ],
      fibres: fibresToBackSiphons(0, 0),
    },
  },
  nettle: {
    howToUse: 'Needs a nerve signal and fuel. Place it at the front or sides; it stings every enemy cell in a ' +
      'short range. An Eyespot fires it only while an enemy is near, so it burns fuel only then.',
    example: {
      cells: [
        [0, 0, 'nucleus'], [0, -1, 'eyespot'], [-1, 0, 'nettle'], [1, -1, 'nettle'], [-1, 1, 'gill'], [1, 0, 'fat'],
      ],
      fibres: fibresFromEyespot([[1, -1], [-1, 0]]),
      stimulus: 'enemy',
    },
  },
  snare: {
    howToUse: 'Put it on the surface and give it a nerve signal (an Eyespot) and fuel. It aims at the nearest ' +
      'enemy and pulls what it catches toward itself, into your Thorns and Nettles. Heavy enemies pull you too.',
    example: {
      cells: [
        [0, 0, 'nucleus'], [0, -1, 'eyespot'], [1, -1, 'snare'], [-1, 0, 'thorn'], [-1, 1, 'gill'], [1, 0, 'fat'],
      ],
      fibres: fibresFromEyespot([[1, -1]]),
      stimulus: 'enemy',
    },
  },
  spitter: {
    howToUse: 'Put it on the surface with a nerve signal and fuel. It aims by itself at the nearest enemy in ' +
      'range, and each spit kicks you back. Several Spitters on one Eyespot fire a volley; an Inhibitor in one ' +
      'keeps it spitting.',
    example: {
      cells: [
        [0, 0, 'nucleus'], [0, -1, 'eyespot'], [1, -1, 'spitter'], [-1, 0, 'spitter'], [-1, 1, 'gill'], [1, 0, 'fat'],
      ],
      fibres: fibresFromEyespot([[1, -1], [-1, 0]]),
      stimulus: 'enemy',
    },
  },
  thorn: {
    howToUse: 'Place it on the outside. It needs no signal and no fuel. Swimming into enemies makes it hit ' +
      'harder.',
    example: {
      cells: [
        [0, 0, 'nucleus'], [0, -1, 'thorn'], [1, -1, 'thorn'], [-1, 0, 'cilia'], [1, 0, 'cilia'], [-1, 1, 'fat'],
        [0, 1, 'gill'],
      ],
    },
  },
  bud: {
    howToUse: 'Put it on the surface, click it in the Lab, then click a part on the Templates screen (T) to ' +
      'assign it. The body feeds it O₂ and sugar while the part grows; a nerve signal (an Eyespot, or a slow ' +
      'Pacemaker) shoots the finished part away from the body, stocked with fuel. Thorns on the part hit hard; ' +
      'crossed Light eyes and Siphons on it make it home in on a light.',
    example: {
      cells: [
        [0, 0, 'nucleus'], [0, -1, 'bud'], [1, -1, 'tissue', 'pacemaker', 0.2], [-1, 0, 'gill'], [1, 0, 'fat'],
        [0, 1, 'heart', 'inhibitor'],
      ],
      fibres: [[1, -1, 0, -1]],
      budPart: {
        name: 'Spike',
        cells: [
          { q: 0, r: 0, typeName: 'thorn' },
          { q: 1, r: -1, typeName: 'thorn' },
          { q: 0, r: -1, typeName: 'thorn' },
        ],
      },
    },
  },
  gill: {
    howToUse: 'Put it anywhere in the body. Its O₂ spreads from cell to cell to everything that burns fuel; a ' +
      'beating Heart spreads it faster.',
    example: {
      cells: [
        [0, 0, 'nucleus'], [-1, 0, 'gill'], [1, 0, 'gill'], [0, 1, 'heart', 'inhibitor'],
        [0, 2, 'tissue', 'pacemaker', 1.4], [-1, 2, 'muscle'], [-1, 3, 'muscle'], [0, 3, 'tissue'],
      ],
      fibres: [[0, 2, -1, 2], [0, 2, -1, 3]],
      fluidView: 1,
    },
  },
  mouth: {
    howToUse: 'Put it anywhere: the body eats the yellow food specks it swims over. To bite enemies and debris it ' +
      'must be on the surface. Add Fat beside it to store what it eats.',
    example: {
      cells: [
        [0, 0, 'nucleus'], [0, -1, 'mouth'], [0, 1, 'fat'], [-1, 0, 'tissue'], [1, 0, 'tissue'],
      ],
      fluidView: 2,
    },
  },
  heart: {
    howToUse: `Give it a nerve signal and it beats, pumping blood between every cell within ${HEART_REACH} steps ` +
      'of it, as hard as the signal. An Inhibitor in it keeps it beating; a Pacemaker beats it in pulses for half ' +
      'the fuel, and a fibre from the Light eyes beats it only while the Siphons work. Two Hearts over the same ' +
      'cells add up, to a limit.',
    example: {
      cells: [
        [0, 0, 'nucleus'], [0, -1, 'gill'], [-1, 0, 'heart', 'inhibitor'], [0, 1, 'tissue'], [0, 2, 'tissue'],
        [0, 3, 'tissue'], [0, 4, 'muscle'], [1, 3, 'tissue', 'pacemaker', 1.4],
      ],
      fibres: [[1, 3, 0, 4]],
      fluidView: 1,
    },
  },
  airsac: {
    howToUse: 'Put it near Gills and the cells that need lots of O₂. It fills while you rest and drains ' +
      'during heavy work.',
    example: {
      cells: [
        [0, 0, 'nucleus'], [-1, 0, 'gill'], [0, -1, 'airsac'], [1, -1, 'nettle'], [-1, -1, 'nettle'],
        [0, -2, 'eyespot'],
      ],
      fibres: [[0, -2, 1, -1], [0, -2, -1, -1]],
      stimulus: 'enemy',
      fluidView: 1,
    },
  },
  fat: {
    howToUse: 'Put it in the body near the cells that burn fuel. It is your main sugar store for long fights; ' +
      'what the Mouth eats is shared over the body, and a Fat takes the most of it. In a level with a kit, leftover ' +
      'Fat goes only into Fat cells.',
    example: {
      cells: [
        [0, 0, 'nucleus'], [0, 1, 'fat'], [-1, 1, 'muscle'], [-1, 2, 'muscle'], [0, 2, 'muscle'],
        [1, 1, 'tissue', 'pacemaker', 1.4], [-1, 0, 'gill'],
      ],
      fibres: [[1, 1, 0, 2], [1, 1, -1, 2], [1, 1, -1, 1]],
      fluidView: 2,
    },
  },
  pore: {
    howToUse: 'Must be on the surface. Waste from the cells that burn fuel spreads to it; without one it builds ' +
      'up and poisons them (dashed ring).',
    example: {
      cells: [
        [0, 0, 'nucleus'], [0, 1, 'tissue', 'pacemaker', 1.4], [-1, 2, 'muscle'], [0, 2, 'muscle'], [0, 3, 'pore'],
        [-1, 0, 'gill'], [1, 0, 'fat'],
      ],
      fibres: [[0, 1, -1, 2], [0, 1, 0, 2]],
      fluidView: 3,
    },
  },
  mender: {
    howToUse: 'Put it near the cells you want healed. It works by itself, with no nerve signal. Repair fluid ' +
      'spreads from cell to cell. Destroyed cells grow back if they would touch the body.',
    example: {
      cells: [
        [0, 0, 'nucleus'], [0, 1, 'mender'], [0, -1, 'shell'], [1, -1, 'shell'], [-1, 0, 'gill'], [1, 0, 'fat'],
        [-1, 1, 'heart', 'inhibitor'],
      ],
      fluidView: 4,
      startsHurt: ['shell'],
    },
  },
  acid: {
    howToUse: 'Put it on the surface where it will touch the enemy, and wire it to an Eyespot so it fires only ' +
      'when something is near. Use it to open shells; protease or weapons finish the soft cells.',
    example: {
      cells: [[0, 0, 'nucleus'], [0, -1, 'eyespot'], [1, -1, 'acid'], [-1, 0, 'acid'], [-1, 1, 'gill'], [1, 0, 'fat']],
      fibres: fibresFromEyespot([[1, -1], [-1, 0]]),
      stimulus: 'enemy',
      dummyType: 'shell',
      dummyTouches: true,
    },
  },
  protease: {
    howToUse: 'Put it on the surface where it will touch prey, and wire it to an Eyespot. What it digests becomes ' +
      'sugar in the gland, which seeps on to your other cells. Hard cells need acid first.',
    example: {
      cells: [
        [0, 0, 'nucleus'], [0, -1, 'eyespot'], [1, -1, 'protease'], [-1, 0, 'protease'], [-1, 1, 'gill'],
        [1, 0, 'fat'],
      ],
      fibres: fibresFromEyespot([[1, -1], [-1, 0]]),
      stimulus: 'enemy',
      dummyTouches: true,
      fluidView: 2,
    },
  },
  mineralizer: {
    howToUse: 'Give it mineral (leftover in a kit, or mineral specks a Mouth eats) and a nerve signal: a ' +
      'Pacemaker or an Inhibitor in it keeps it working. Put it among the cells you want armoured: it hardens the ' +
      'nearest ones first, itself included.',
    example: {
      cells: [
        [0, -2, 'tissue'], [1, -2, 'tissue'], [1, -1, 'tissue'], [-1, -1, 'tissue'],
        [0, -1, 'mineralizer', 'inhibitor'], [0, 0, 'nucleus'], [-1, 0, 'tissue'], [1, 0, 'gill'], [-1, 1, 'fat'],
      ],
    },
  },
  photophore: {
    howToUse: 'Wire it like any action: an Inhibitor in it keeps it lit, a Pacemaker makes it blink, an Eyespot ' +
      'lights it when something is near. Prey and hunters with Light eyes swim to it, so put what should meet ' +
      'them (acid, protease, a Mouth, Thorns) right beside it.',
    example: {
      cells: [
        [0, 0, 'nucleus'], [0, -1, 'photophore', 'pacemaker', 0.5], [1, -1, 'protease'], [-1, 0, 'protease'],
        [1, 0, 'fat'], [-1, 1, 'gill'],
      ],
    },
  },
};

// The body every neuron example shares: a Nucleus with a Gill and a Fat beside it to fuel the Muscles, two Muscles
// down each side behind it, and two Tissue cells at the front (front left at 0, -1 and front right at 1, -1) for the
// example's neurons. Both sides pull alike, so the body doesn't turn.
const NEURON_EXAMPLE_BODY = [
  [0, 0, 'nucleus'], [-1, 0, 'gill'], [1, 0, 'fat'], [-1, 1, 'muscle'], [0, 1, 'muscle'], [-2, 2, 'muscle'],
  [-1, 2, 'tissue'], [0, 2, 'muscle'],
];
const LEFT_MUSCLES = [[-1, 1], [-2, 2]];
const RIGHT_MUSCLES = [[0, 1], [0, 2]];
// fibres from the cell at (q, r) to each [q, r] in targets
const fibresTo = (q, r, targets) => targets.map(([toQ, toR]) => [q, r, toQ, toR]);
// a neuron example's cells: the shared body, and what sits at the front left and front right (Tissue by default)
const neuronExampleCells = (frontLeft = ['tissue'], frontRight = ['tissue']) =>
  [...NEURON_EXAMPLE_BODY, [0, -1, ...frontLeft], [1, -1, ...frontRight]];

const NEURON_TIPS = {
  pacemaker: {
    howToUse: 'Lay fibres from it to Muscles or Siphons (Nerves view): they work and rest at its rate, all at the ' +
      'same moment, however long the fibres. Click the cell to set the rate. With an Inhibitor of it on the other ' +
      'side, a tail swings both ways.',
    example: {
      cells: neuronExampleCells(['tissue', 'pacemaker']),
      fibres: fibresTo(0, -1, [...LEFT_MUSCLES, ...RIGHT_MUSCLES]),
      traces: [[0, -1], [-1, 1]],
    },
  },
  command: {
    howToUse: 'A Sandbox piece for trying things out: lay fibres from it to what should act, and hold its key. ' +
      'Click the cell and press a key to bind it (Space by default). Levels don\'t have it, since a creature ' +
      'there acts on its own; the enemies\' Commands fire when one is close to you.',
    example: {
      cells: neuronExampleCells(['tissue', 'command']),
      fibres: fibresTo(0, -1, [...LEFT_MUSCLES, ...RIGHT_MUSCLES]),
      traces: [[0, -1], [-1, 1]],
      stimulus: 'key',
    },
  },
  ganglion: {
    howToUse: 'Put it between a signal and what it drives, when on and off is too abrupt: the Muscles then ease ' +
      'in and out instead of snapping. It makes the signal late, too.',
    example: {
      cells: neuronExampleCells(['tissue', 'ganglion'], ['tissue', 'pacemaker', 0.5]),
      fibres: [[1, -1, 0, -1], ...fibresTo(0, -1, [...LEFT_MUSCLES, ...RIGHT_MUSCLES])],
      traces: [[1, -1], [0, -1]],
    },
  },
  delay: {
    howToUse: 'Put it between a signal and a second group of Muscles: that group moves after the first, which ' +
      'sends a wave down a tail (about 0.1 s per row of Muscles). A long one keeps a sense\'s signal going after ' +
      'it stops. Click the cell to set the delay.',
    example: {
      cells: neuronExampleCells(['tissue', 'delay'], ['tissue', 'pacemaker', 0.5]),
      fibres: [[1, -1, 0, -1], ...fibresTo(0, -1, [...LEFT_MUSCLES, ...RIGHT_MUSCLES])],
      traces: [[1, -1], [0, -1]],
    },
  },
  inhibitor: {
    howToUse: 'Feed it a Pacemaker and lay fibres from it to the Muscles on the other side of a tail: the two ' +
      'sides then take turns, and the tail swings both ways. With nothing wired into it, it is always on: the ' +
      'easy way to keep a Heart or a gland working.',
    example: {
      cells: neuronExampleCells(['tissue', 'pacemaker', 1], ['tissue', 'inhibitor']),
      fibres: [...fibresTo(0, -1, LEFT_MUSCLES), [0, -1, 1, -1], ...fibresTo(1, -1, RIGHT_MUSCLES)],
      traces: [[0, -1], [1, -1]],
    },
  },
  synapse: {
    howToUse: 'Lay fibres from two or more signals into it. Threshold 1 fires on any of them (OR); threshold 2 ' +
      'only while two are on together (AND), such as both Light eyes. Click the cell to set the threshold. Here ' +
      'two Pacemakers at different rates are on together only now and then.',
    example: {
      cells: [[0, 0, 'nucleus', 'synapse', 2],
        ...neuronExampleCells(['tissue', 'pacemaker', 0.5], ['tissue', 'pacemaker', 1]).slice(1)],
      fibres: [[0, -1, 0, 0], [1, -1, 0, 0], ...fibresTo(0, 0, [...LEFT_MUSCLES, ...RIGHT_MUSCLES])],
      traces: [[0, -1], [1, -1], [0, 0]],
    },
  },
  latch: {
    howToUse: 'Lay a fibre from a sense into it, and it remembers: the first time the sense fires, the Latch ' +
      'turns on and stays on after the sense goes quiet, until the next time flips it off. A Light eye into a ' +
      'Latch waits for a flash, then swims for good.',
    example: {
      cells: neuronExampleCells(['eyespot'], ['tissue', 'latch']),
      fibres: [[0, -1, 1, -1], ...fibresTo(1, -1, [...LEFT_MUSCLES, ...RIGHT_MUSCLES])],
      traces: [[0, -1], [1, -1]],
      stimulus: 'enemy',
    },
  },
};
