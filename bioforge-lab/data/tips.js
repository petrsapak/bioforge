'use strict';
// Builder tooltips (pure data): how to use each cell type, and a live example build shown in a mini tank
// (tipdemo.js). Examples are written in the format from before the nerve layer (Pacemaker and Command cells, wired
// by touch); tipdemo.js converts them (see upgradeToNerveLayer in design.js). Example fields:
//   cells: [q, r, typeName] for each cell; spaceLabel: what the demo shows while it holds Space (every other second);
//   swims: swims forward; hasDummyEnemy: a dummy enemy just in front; fluidView: the fluid shown (1 = O2 ..
//   5 = adrenaline); startsHurt: cell types that start damaged; startsEmpty: cell types that start with no O2 or
//   sugar; budPart: the part a Bud grows
// Neuron examples (NEURON_TIPS) are in the current format: cells are [q, r, typeName, neuronKind, setting], with
// neuronKind and setting optional; fibres are [fromQ, fromR, toQ, toR]; traces lists the [q, r] cells whose
// signals are drawn as lanes under the tank.
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
    howToUse: 'Fill gaps and add bulk. Like any cell it can hold a neuron, and fibres run along its sides.',
    example: {
      cells: [
        [0, 0, 'nucleus'], [0, 1, 'tissue'], [0, 2, 'tissue'], [-1, 1, 'pacemaker'], [-1, 2, 'muscle'],
        [1, 0, 'command'], [1, 1, 'siphon'], [-1, 0, 'gill'], [1, -1, 'fat'],
      ],
      spaceLabel: 'Space held',
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
    howToUse: 'Place it between the body and a tail or limb. Everything behind it can swing.',
    example: {
      cells: [
        [0, 0, 'nucleus'], [0, 1, 'joint'], [0, 2, 'tissue'], [0, 3, 'tissue'], [-1, 1, 'pacemaker'],
        [-1, 2, 'muscle'], [-1, 3, 'muscle'], [-1, 0, 'gill'],
      ],
    },
  },
  cilia: {
    howToUse: 'Put them on the sides and back. They need O₂ and sugar from the body (a Gill and Fat or a Mouth ' +
      'somewhere in it), otherwise they swim no better than a plain cell.',
    example: {
      cells: [
        [0, 0, 'nucleus'], [-1, 0, 'gill'], [1, 0, 'fat'], [-1, 1, 'cilia'], [0, 1, 'cilia'], [1, -1, 'pore'],
      ],
      swims: true,
    },
  },
  eyespot: {
    howToUse: 'Place it on the edge facing the enemy and lay fibres from it to weapons (Nerve view). They then fire ' +
      'by themselves.',
    example: {
      cells: [
        [0, 0, 'nucleus'], [0, -1, 'eyespot'], [1, -1, 'nettle'], [-1, 0, 'nettle'], [-1, 1, 'gill'], [1, 0, 'fat'],
      ],
      spaceLabel: 'Enemy near',
      hasDummyEnemy: true,
    },
  },
  lighteye: {
    howToUse: 'Put two on the front, left and right, and lay a fibre from each across to a Siphon on the other side ' +
      '(Nerve view). The eye nearer the light then drives the far siphon harder, which turns the creature toward ' +
      'the light: it follows the mouse in the Sandbox. The light reaches 450 px (the dashed ring), and is brighter ' +
      'closer in, so the creature speeds up as it nears. Wired to the same side, it runs away instead.',
    example: {
      cells: [
        [0, 0, 'nucleus'], [0, -1, 'lighteye'], [1, -1, 'lighteye'], [-1, 0, 'gill'], [1, 0, 'fat'],
        [-1, 1, 'siphon'], [0, 1, 'siphon'],
      ],
      fibres: [[0, -1, 0, 1], [1, -1, -1, 1]],
      spaceLabel: 'Space held',
    },
  },
  muscle: {
    howToUse: 'Needs a nerve signal and O₂ and sugar from the body. Muscles on one side of a limb bend it to ' +
      'that side. To swim, line a long tail with muscles on both sides and make the sides take turns (a ' +
      'Pacemaker, and an Inhibitor of it); a wave running down the tail swims faster.',
    example: {
      cells: [
        [0, 0, 'nucleus'], [0, 1, 'tissue'], [0, 2, 'tissue'], [0, 3, 'tissue'], [-1, 1, 'pacemaker'],
        [-1, 2, 'muscle'], [-1, 3, 'muscle'], [-1, 4, 'muscle'], [-1, 0, 'gill'],
      ],
    },
  },
  bloater: {
    howToUse: 'Needs a nerve signal and fuel. On the surface its swelling hits enemies; inside, it pushes the ' +
      'body apart.',
    example: {
      cells: [
        [0, 0, 'nucleus'], [0, -1, 'eyespot'], [1, -1, 'bloater'], [1, 0, 'bloater'], [-1, 0, 'bloater'],
        [0, -2, 'thorn'], [2, -1, 'thorn'], [-1, -1, 'thorn'],
      ],
      spaceLabel: 'Enemy near',
      hasDummyEnemy: true,
    },
  },
  siphon: {
    howToUse: 'Needs a nerve signal and fuel. Place it at the back; it always pushes forward. It burns fuel fast, ' +
      'so give it a Fat or Air sac.',
    example: {
      cells: [
        [0, 0, 'nucleus'], [0, 1, 'command'], [-1, 2, 'siphon'], [0, 2, 'siphon'], [1, 1, 'fat'],
      ],
      spaceLabel: 'Space held',
    },
  },
  nettle: {
    howToUse: 'Needs a nerve signal and fuel. Place it at the front or sides; it stings every enemy cell in a ' +
      'short range.',
    example: {
      cells: [
        [0, 0, 'nucleus'], [0, -1, 'eyespot'], [-1, 0, 'nettle'], [1, -1, 'nettle'], [-1, 1, 'gill'], [1, 0, 'fat'],
      ],
      spaceLabel: 'Enemy near',
      hasDummyEnemy: true,
    },
  },
  snare: {
    howToUse: 'Put it on the surface and give it a nerve signal (Eyespot or Command) and fuel. It aims at the ' +
      'nearest enemy and pulls what it catches toward itself, into your Thorns and Nettles. Heavy enemies pull ' +
      'you too.',
    example: {
      cells: [
        [0, 0, 'nucleus'], [0, -1, 'eyespot'], [1, -1, 'snare'], [-1, 0, 'thorn'], [-1, 1, 'gill'], [1, 0, 'fat'],
      ],
      spaceLabel: 'Enemy near',
      hasDummyEnemy: true,
    },
  },
  spitter: {
    howToUse: 'Put it on the surface with a nerve signal and fuel. It aims by itself at the nearest enemy in ' +
      'range; several Spitters on one Command make a volley.',
    example: {
      cells: [
        [0, 0, 'nucleus'], [0, 1, 'command'], [1, -1, 'spitter'], [0, -1, 'spitter'], [-1, 1, 'gill'], [1, 0, 'fat'],
      ],
      spaceLabel: 'Space held',
      hasDummyEnemy: true,
    },
  },
  thorn: {
    howToUse: 'Place it on the outside. It needs no signal and no fuel. Swimming into enemies makes it hit ' +
      'harder.',
    example: {
      cells: [
        [0, 0, 'nucleus'], [0, -1, 'thorn'], [1, -1, 'thorn'], [-1, 1, 'cilia'], [0, 1, 'cilia'], [-1, 0, 'gill'],
        [1, 0, 'fat'],
      ],
      swims: true,
    },
  },
  bud: {
    howToUse: 'Put it on the surface, click it in the builder, then click a part in the Templates library to ' +
      'assign it. The body feeds it O₂ and sugar; fire it with a Command or Eyespot. The part grows facing away ' +
      'from the body; thorns on it hit hard.',
    example: {
      cells: [
        [0, 0, 'nucleus'], [0, -1, 'bud'], [1, -1, 'command'], [-1, 0, 'gill'], [1, 0, 'fat'], [0, 1, 'heart'],
      ],
      spaceLabel: 'Space held',
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
      'Heart nearby spreads it faster.',
    example: {
      cells: [
        [0, 0, 'nucleus'], [-1, 0, 'gill'], [1, 0, 'gill'], [0, 1, 'heart'], [0, 2, 'pacemaker'], [-1, 2, 'muscle'],
        [-1, 3, 'muscle'], [0, 3, 'tissue'],
      ],
      fluidView: 1,
    },
  },
  mouth: {
    howToUse: 'Put it anywhere: the body eats the yellow food specks it swims over. To bite enemies and debris it ' +
      'must be on the surface. Add Fat to store what it eats.',
    example: {
      cells: [
        [0, 0, 'nucleus'], [0, -1, 'mouth'], [0, 1, 'fat'], [-1, 0, 'tissue'], [1, 0, 'tissue'],
      ],
      fluidView: 2,
    },
  },
  heart: {
    howToUse: 'Lay vessels through it (Vessels view, V): each vessel it sits on carries blood fast between its two ' +
      'ends. Run them from the Gill and the Mouth to the cells that work hardest. More hearts on one vessel add up ' +
      'to a limit.',
    example: {
      cells: [
        [0, 0, 'nucleus'], [0, -1, 'gill'], [-1, 0, 'heart'], [0, 1, 'tissue'], [0, 2, 'tissue'], [0, 3, 'tissue'],
        [0, 4, 'muscle'], [1, 3, 'pacemaker'],
      ],
      vessels: [[0, -1, -1, 0], [-1, 0, 0, 4]],
      fluidView: 1,
    },
  },
  valve: {
    howToUse: 'Fluid cannot pass through it without a nerve signal. Make a reservoir touch the body only through ' +
      'Valves, then signal them to release it.',
    example: {
      cells: [
        [0, 0, 'nucleus'], [0, 1, 'command'], [1, 1, 'valve'], [2, 0, 'fat'], [-1, 2, 'siphon'], [0, 2, 'siphon'],
      ],
      spaceLabel: 'Space held',
      fluidView: 2,
      startsEmpty: ['siphon'],
    },
  },
  airsac: {
    howToUse: 'Put it near Gills and the cells that need lots of O₂. It fills while you are calm and drains ' +
      'during heavy work.',
    example: {
      cells: [
        [0, 0, 'nucleus'], [-1, 0, 'gill'], [0, -1, 'airsac'], [1, -1, 'nettle'], [0, -2, 'nettle'],
        [1, -2, 'eyespot'],
      ],
      spaceLabel: 'Enemy near',
      hasDummyEnemy: true,
      fluidView: 1,
    },
  },
  fat: {
    howToUse: 'Put it in the body near the cells that burn fuel. It is your main sugar store for long fights; ' +
      'what the Mouth eats collects here.',
    example: {
      cells: [
        [0, 0, 'nucleus'], [0, 1, 'fat'], [-1, 1, 'muscle'], [-1, 2, 'muscle'], [0, 2, 'muscle'], [1, 1, 'pacemaker'],
        [-1, 0, 'gill'],
      ],
      fluidView: 2,
    },
  },
  pore: {
    howToUse: 'Must be on the surface. Waste from the cells that burn fuel spreads to it; without one it builds ' +
      'up and poisons them (dashed ring).',
    example: {
      cells: [
        [0, 0, 'nucleus'], [0, 1, 'pacemaker'], [-1, 2, 'muscle'], [0, 2, 'muscle'], [0, 3, 'pore'], [-1, 0, 'gill'],
      ],
      fluidView: 3,
    },
  },
  mender: {
    howToUse: 'Put it near the cells you want healed. Repair fluid spreads from cell to cell. Destroyed cells ' +
      'grow back if they would touch the body.',
    example: {
      cells: [
        [0, 0, 'nucleus'], [0, 1, 'mender'], [0, -1, 'shell'], [1, -1, 'shell'], [-1, 0, 'gill'], [1, 0, 'fat'],
        [-1, 1, 'heart'],
      ],
      fluidView: 4,
      startsHurt: ['shell'],
    },
  },
  adrenal: {
    howToUse: 'Give it a nerve signal and sugar. Adrenaline spreads from cell to cell and fades; cells nearest ' +
      'the Adrenal get the most.',
    example: {
      cells: [
        [0, 0, 'nucleus'], [0, 1, 'command'], [1, 1, 'adrenal'], [1, 0, 'fat'], [0, 2, 'cilia'], [-1, 2, 'cilia'],
        [-1, 1, 'cilia'],
      ],
      spaceLabel: 'Space held',
      swims: true,
      fluidView: 5,
    },
  },
};

// The cells every neuron example shares: a Nucleus, a three-cell tail, a Gill and Fat to fuel the Muscles, and two
// Muscles down the tail's left side.
const NEURON_EXAMPLE_BODY = [
  [0, 0, 'nucleus'], [0, 1, 'tissue'], [0, 2, 'tissue'], [0, 3, 'tissue'], [-1, 0, 'gill'], [1, -1, 'fat'],
  [-1, 2, 'muscle'], [-1, 3, 'muscle'],
];
// fibres from the cell at (q, r) to both left Muscles
const fibresToLeftMuscles = (q, r) => [[q, r, -1, 2], [q, r, -1, 3]];

const NEURON_TIPS = {
  pacemaker: {
    howToUse: 'Lay fibres from it to Muscles (Nerve view): they then beat on their own, at its rate. Click the ' +
      'cell to set the rate. With an Inhibitor of it on the other side, a tail swings both ways.',
    example: {
      cells: [...NEURON_EXAMPLE_BODY, [-1, 1, 'tissue', 'pacemaker']],
      fibres: fibresToLeftMuscles(-1, 1),
      traces: [[-1, 1], [-1, 2]],
    },
  },
  command: {
    howToUse: 'Lay fibres from it to whatever should act on demand: a weapon, a Bloater, a burst of Muscles. ' +
      'Click the cell and press a key to bind it. In a level the AI presses it when an enemy is near.',
    example: {
      cells: [...NEURON_EXAMPLE_BODY, [-1, 1, 'tissue', 'command']],
      fibres: fibresToLeftMuscles(-1, 1),
      traces: [[-1, 1], [-1, 2]],
      spaceLabel: 'Space held',
    },
  },
  ganglion: {
    howToUse: 'Put it between a signal and what it drives, when on and off is too abrupt: the Muscles then ease ' +
      'in and out instead of snapping.',
    example: {
      cells: [...NEURON_EXAMPLE_BODY, [1, 0, 'tissue', 'command'], [-1, 1, 'tissue', 'ganglion']],
      fibres: [[1, 0, -1, 1], ...fibresToLeftMuscles(-1, 1)],
      traces: [[1, 0], [-1, 1]],
      spaceLabel: 'Space held',
    },
  },
  delay: {
    howToUse: 'Put it between a signal and a second group of Muscles: that group moves after the first, which ' +
      'sends a wave down a tail. Click the cell to set the delay.',
    example: {
      cells: [...NEURON_EXAMPLE_BODY, [1, 0, 'tissue', 'command'], [-1, 1, 'tissue', 'delay']],
      fibres: [[1, 0, -1, 1], ...fibresToLeftMuscles(-1, 1)],
      traces: [[1, 0], [-1, 1]],
      spaceLabel: 'Space held',
    },
  },
  inhibitor: {
    howToUse: 'Feed it a Pacemaker and lay fibres from it to the Muscles on the other side of a tail: the two ' +
      'sides then take turns, and the tail swings both ways.',
    example: {
      cells: [
        ...NEURON_EXAMPLE_BODY, [1, 1, 'muscle'], [1, 2, 'muscle'],
        [-1, 1, 'tissue', 'pacemaker', 1], [1, 0, 'tissue', 'inhibitor'],
      ],
      fibres: [...fibresToLeftMuscles(-1, 1), [-1, 1, 1, 0], [1, 0, 1, 1], [1, 0, 1, 2]],
      traces: [[-1, 1], [1, 0]],
    },
  },
  synapse: {
    howToUse: 'Lay fibres from two or more signals into it. Threshold 1 fires on any of them (OR); threshold 2 ' +
      'only while two are on together (AND), such as an Eyespot and a Command. Click the cell to set the threshold.',
    example: {
      cells: [
        ...NEURON_EXAMPLE_BODY, [1, 0, 'tissue', 'command'], [-1, 1, 'tissue', 'pacemaker', 1],
        [0, 1, 'tissue', 'synapse', 2],
      ],
      fibres: [[1, 0, 0, 1], [-1, 1, 0, 1], ...fibresToLeftMuscles(0, 1)],
      traces: [[1, 0], [-1, 1], [0, 1]],
      spaceLabel: 'Space held',
    },
  },
  latch: {
    howToUse: 'Lay a fibre from a Command into it to make a switch: one press turns the Muscles on, the next ' +
      'turns them off. Fed by a sense, it remembers that something happened.',
    example: {
      cells: [...NEURON_EXAMPLE_BODY, [1, 0, 'tissue', 'command'], [-1, 1, 'tissue', 'latch']],
      fibres: [[1, 0, -1, 1], ...fibresToLeftMuscles(-1, 1)],
      traces: [[1, 0], [-1, 1]],
      spaceLabel: 'Space held',
    },
  },
};
