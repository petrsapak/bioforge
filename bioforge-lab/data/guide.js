'use strict';
// The field guide's own words (pure data): for each cell type and neuron, the chapter that first asks for it, what
// it goes well with and what to watch out for; the topics on how the game's systems work, with examples; and the
// glossary. What each cell does and its numbers come from data/cells.js and the systems (fieldguide.js), so they
// can't drift from the game. No level solutions. Field meanings:
//   cells / neurons: { chapter (0: no chapter asks for it yet, only the Sandbox), pairs (cell types or neuron kinds
//     it works well with), watch (what to watch out for) }
//   topics: { id, title, chapter, demo (the cell type or neuron whose example tank the page runs, and its icon),
//     paragraphs, example (a short build in words), related (cell types and neurons) }
//   terms: [term, meaning, icon (a cell type or neuron drawn beside it)]

const GUIDE_CELLS = {
  nucleus: { chapter: 1, pairs: ['shell', 'tissue'],
    watch: 'Everything cut off from it floats away as debris and rots. Keep it inside the body, not at the front.' },
  tissue: { chapter: 1, pairs: ['nucleus'],
    watch: 'Cheap, but every cell adds weight: a fat body swims slower and turns slower.' },
  shell: { chapter: 5, pairs: ['nucleus', 'thorn', 'mineralizer'],
    watch: 'Heavy and stiff, so a shelled body swims slowly. Acid eats it fast: a shell is no answer to an Acid ' +
      'gland.' },
  joint: { chapter: 0, pairs: ['muscle'],
    watch: 'A body with joints bends where they are: good for a tail, bad for a body that must stay straight.' },
  cilia: { chapter: 0, pairs: ['heart', 'fat'],
    watch: 'They always beat, so they can\'t be switched off, and they burn fuel all the time.' },
  eyespot: { chapter: 1, pairs: ['nettle', 'acid', 'protease', 'siphon'],
    watch: 'It is on or off, nothing between: it says something is near, not where. Use Light eyes or a Nose to ' +
      'steer.' },
  lighteye: { chapter: 1, pairs: ['siphon', 'synapse', 'inhibitor'],
    watch: 'Wire each eye to the Siphon on the far side to turn toward the light, to the same side to turn away. ' +
      'An uneven body curves past what the eyes are aiming at.' },
  nose: { chapter: 4, pairs: ['mouth', 'siphon', 'fedgland'],
    watch: 'It smells only the nearest speck, so it can be pulled about between two.' },
  receptor: { chapter: 6, pairs: ['synapse', 'inhibitor', 'siphon'],
    watch: 'Hormones rise and fall slowly, so its signal does too. A Synapse after it makes a clean on and off.' },
  muscle: { chapter: 1, pairs: ['pacemaker', 'inhibitor', 'joint', 'resilin'],
    watch: 'A muscle only bends the body. Swimming with muscles needs a wave along a tail, which is touchy: try the ' +
      'rate in small steps.' },
  bloater: { chapter: 0, pairs: ['eyespot', 'command'],
    watch: 'Burns fuel while swollen. Swelling shoves your own cells too.' },
  siphon: { chapter: 1, pairs: ['lighteye', 'nose', 'pacemaker', 'heart'],
    watch: 'Thirsty: a Siphon far from O₂ and sugar soon starves and stops. Put them at the back, one on each ' +
      'side.' },
  nettle: { chapter: 0, pairs: ['eyespot', 'heart'],
    watch: 'Stings barely scratch hard cells. A Nettle burns fuel all the time it is signalled.' },
  snare: { chapter: 0, pairs: ['eyespot', 'protease', 'nettle'],
    watch: 'It holds for a few seconds, then needs a pause before it can shoot again.' },
  spitter: { chapter: 0, pairs: ['eyespot', 'command'],
    watch: 'It pushes you back each time it spits.' },
  thorn: { chapter: 5, pairs: ['siphon', 'shell'],
    watch: 'Its damage comes from speed: a creature that slows to a stop on its target barely hurts it.' },
  photophore: { chapter: 5, pairs: ['protease', 'mouth', 'pacemaker', 'eyespot'],
    watch: 'It lures anything with Light eyes, hunters too. Your own Light eyes ignore it.' },
  bud: { chapter: 0, pairs: ['heart', 'fat'],
    watch: 'Growing a part takes O₂ and sugar for every bit of biomass it holds.' },
  gill: { chapter: 3, pairs: ['heart', 'siphon'],
    watch: 'It makes O₂ only; sugar has to come from your kit, Fat or food.' },
  mouth: { chapter: 4, pairs: ['nose', 'fat', 'photophore'],
    watch: 'It eats only what touches it, so put it where the body meets food first: usually the front.' },
  heart: { chapter: 3, pairs: ['gill', 'fat', 'siphon', 'valve'],
    watch: 'It pumps only the vessels it sits on, and only while it is fed itself.' },
  valve: { chapter: 3, pairs: ['heart', 'pacemaker'],
    watch: 'Shut by default: a Valve without a signal is a wall.' },
  airsac: { chapter: 3, pairs: ['heart', 'gill'],
    watch: 'It only stores O₂: it doesn\'t make any.' },
  fat: { chapter: 3, pairs: ['heart', 'fedgland', 'starvedgland', 'mouth'],
    watch: 'Plain cells only pass sugar on, holding little, so cells far from a Fat run dry first.' },
  pore: { chapter: 3, pairs: ['heart'],
    watch: 'It must touch the water: one buried inside the body dumps nothing.' },
  mender: { chapter: 0, pairs: ['heart', 'fat'],
    watch: 'Repair fluid seeps slowly, so a Mender heals its neighbours first.' },
  adrenal: { chapter: 6, pairs: ['eyespot', 'lighteye', 'latch', 'siphon', 'heart'],
    watch: 'Adrenaline fades in a few seconds, and it makes everything burn more fuel while it lasts.' },
  calmgland: { chapter: 6, pairs: ['receptor', 'pacemaker', 'synapse'],
    watch: 'Calm lasts a long time. It slows your Pacemakers and raises your own thresholds too, and its cloud in ' +
      'the water calms whoever swims through it.' },
  fedgland: { chapter: 6, pairs: ['nose', 'mouth', 'fat', 'receptor'],
    watch: 'Fed left on keeps storing, even when you need the sugar: switch it off when food runs out.' },
  starvedgland: { chapter: 6, pairs: ['receptor', 'inhibitor', 'fat'],
    watch: 'Starved cancels Fed. It saves fuel, but a starved body is a slow body.' },
  acid: { chapter: 5, pairs: ['eyespot', 'protease', 'photophore'],
    watch: 'Slow on soft cells. Pair it with protease to finish what it opens.' },
  protease: { chapter: 5, pairs: ['eyespot', 'acid', 'photophore', 'snare'],
    watch: 'It can\'t touch hard cells. What it digests becomes sugar in the gland.' },
  tanner: { chapter: 6, pairs: ['inhibitor', 'shell', 'muscle'],
    watch: 'Tanned muscles move at half speed, so tan the hide, not the tail.' },
  resilin: { chapter: 6, pairs: ['muscle', 'pacemaker', 'inhibitor'],
    watch: 'A springy muscle must be held contracted to charge: a fast Pacemaker never charges it.' },
  mineralizer: { chapter: 5, pairs: ['mouth', 'pacemaker', 'shell'],
    watch: 'It needs mineral: leftover in the kit or mineral specks eaten by a Mouth.' },
};

const GUIDE_NEURONS = {
  pacemaker: { chapter: 1, pairs: ['muscle', 'siphon', 'valve', 'resilin'],
    watch: 'Calm slows it and adrenaline speeds it up, so a mood changes your rhythm.' },
  command: { chapter: 1, pairs: ['nettle', 'bloater', 'spitter'],
    watch: 'It acts only while a key is held, so a creature that must act on its own needs a sense or a ' +
      'Pacemaker instead.' },
  ganglion: { chapter: 0, pairs: ['lighteye', 'siphon'],
    watch: 'Smoothing makes a signal late: a smoothed tail swims slower.' },
  delay: { chapter: 2, pairs: ['lighteye', 'inhibitor', 'muscle'],
    watch: 'It delays the signal, not just its start: a long delay keeps acting on what has already stopped.' },
  inhibitor: { chapter: 2, pairs: ['lighteye', 'siphon', 'photophore'],
    watch: 'With nothing wired into it, it is always on: the easy way to keep a gland or a Photophore working.' },
  synapse: { chapter: 2, pairs: ['lighteye', 'receptor', 'siphon'],
    watch: 'Moods move its threshold: adrenaline lowers it, Calm raises it.' },
  latch: { chapter: 2, pairs: ['lighteye', 'adrenal'],
    watch: 'Each pulse flips it, so a flickering input flips it more than once.' },
};

const GUIDE_TOPICS = [
  {
    id: 'programming', title: 'You program, it acts', chapter: 1,
    demo: 'pacemaker',
    paragraphs: [
      'You don\'t steer your creature. You build it, wire it, and let it go: it acts on its senses and its nerves ' +
        'alone. A level is won by the design, not by your reflexes.',
      'Build in three layers: Body (1) for the cells, Nerves (2) for neurons and fibres, Vessels (3) for blood. ' +
        'The test tank under the grid runs the design while you build, so every change shows at once.',
    ],
    example: 'A Nucleus with two Siphons behind it and a Pacemaker in the Nucleus wired to both swims in a straight ' +
      'line, pulse by pulse.',
    related: ['nucleus', 'siphon', 'pacemaker'],
  },
  {
    id: 'signals', title: 'Signals and fibres', chapter: 1,
    demo: 'lighteye',
    paragraphs: [
      'A signal is a number from 0 (off) to 1 (on). Senses make signals, fibres carry them from cell centre to ' +
        'cell centre, and actions (Siphons, Muscles, glands) do their thing while their signal is on.',
      'A cell adds up every fibre coming into it. A plain cell passes the sum on; a cell with a neuron lets the ' +
        'neuron decide. Each fibre takes one nerve step, so long chains are a little late.',
      'Fibres cost units, and a level may give you few: put the neuron where its fibres stay short.',
    ],
    example: 'Light eye → Siphon on the far side, for both eyes: the eye nearer the light pushes the far side ' +
      'harder, so the body turns toward the light (Braitenberg\'s vehicle).',
    related: ['lighteye', 'eyespot', 'synapse', 'inhibitor'],
  },
  {
    id: 'senses', title: 'Senses', chapter: 1,
    demo: 'nose',
    paragraphs: [
      'An Eyespot is on or off: an enemy is near, or not. A Light eye and a Nose are graded: how far the light or ' +
        'the nearest food lies on their side of the body, stronger the nearer it is. A Receptor reads a hormone ' +
        'inside its own cell.',
      'Where a sense sits matters as much as what it is: a Light eye on the left sees more of a light on the left.',
    ],
    example: 'Two Light eyes into a Synapse at threshold 1.5: on only when the light is near and straight ahead, ' +
      'a way to stop short of it.',
    related: ['eyespot', 'lighteye', 'nose', 'receptor'],
  },
  {
    id: 'logic', title: 'Memory and logic', chapter: 2,
    demo: 'latch',
    paragraphs: [
      'Neurons sit inside cells, one per cell. An Inhibitor is NOT, a Synapse is OR or AND by its threshold, a ' +
        'Latch remembers, a Delay waits, a Pacemaker keeps time by itself.',
      'Wire a neuron into another to build behaviour: "swim until the light comes on" is a Light eye into an ' +
        'Inhibitor into the Siphons.',
    ],
    example: 'Light eyes into a Latch in the Nucleus, the Nucleus to both Siphons: wait still in the dark until the ' +
      'first flash, then swim for good.',
    related: ['inhibitor', 'synapse', 'latch', 'delay', 'pacemaker'],
  },
  {
    id: 'fuel', title: 'Fuel: O₂, sugar and waste', chapter: 3,
    demo: 'gill',
    paragraphs: [
      'Working cells burn O₂ and sugar, and every unit burned becomes waste. A cell short of fuel works weaker ' +
        'and then starves (darkened). A cell full of waste is poisoned and loses health.',
      'Fluids seep from cell to cell, fuller to emptier. Plain cells hold little and only pass fluids on, so the ' +
        'cells far from a Gill or a Fat run dry first.',
      'Gills make O₂ from the water, Fat and Air sacs store sugar and O₂, Pores dump waste at the surface.',
    ],
    example: 'Watch the O₂, Sugar and Waste bars while a run goes on; Shift+1–9 shows each fluid on the cells.',
    related: ['gill', 'fat', 'airsac', 'pore'],
  },
  {
    id: 'blood', title: 'Blood: vessels and the Heart', chapter: 3,
    demo: 'heart',
    paragraphs: [
      'Seeping is slow. A vessel (Vessels view, drag from cell to cell) carries every fluid along it, and much ' +
        'faster while a fed Heart sits on it. A Valve on a vessel shuts it until it gets a signal.',
      'Hormones ride in the blood too, so a Heart spreads a mood evenly through the body.',
    ],
    example: 'A Heart beside a Gill, with vessels to each Siphon: the thirsty Siphons stay fed on a long swim.',
    related: ['heart', 'valve', 'gill', 'siphon'],
  },
  {
    id: 'materials', title: 'Materials and kits', chapter: 4,
    demo: 'mouth',
    paragraphs: [
      'From chapter 4 a level gives a kit of materials instead of a budget: Protein, Sugar, Fat and Mineral. ' +
        'Cells are built from their recipe, and whatever you don\'t spend becomes the creature\'s starting ' +
        'reserves. A bigger body, or more fuel to run it: that is the trade.',
      'A Mouth eats food specks into sugar; a Fat stores spare sugar as fat and turns it back when sugar runs low.',
    ],
    example: 'Leave 4 sugar unspent and put a Fat in the middle: the reserve lasts a long level.',
    related: ['mouth', 'fat', 'nose'],
  },
  {
    id: 'armour', title: 'Armour and secretions', chapter: 5,
    demo: 'acid',
    paragraphs: [
      'Cells built with mineral are hard: they take less damage, and thorns and stings barely scratch them. Acid ' +
        'eats hard cells fast and soft ones slowly; protease digests soft cells and can\'t touch hard ones. A ' +
        'Mineralizer hardens your own cells from stored mineral.',
      'Glands work by touch while signalled, so they go where the body meets its target, fired by an Eyespot.',
    ],
    example: 'Acid, protease, acid across the front: the acid opens the Shell, the protease eats what is behind it.',
    related: ['shell', 'acid', 'protease', 'mineralizer', 'thorn'],
  },
  {
    id: 'light', title: 'Light and lures', chapter: 5,
    demo: 'photophore',
    paragraphs: [
      'A level may have a light, fixed, moving, blinking or carried by a creature. A lit Photophore is a light ' +
        'too: other creatures\' Light eyes see the brightest light in reach, the level\'s or a Photophore\'s.',
      'So light is a signal others read. A creature that follows light can be led, and one that hunts by light ' +
        'can be fooled, by wiring when your Photophore glows.',
    ],
    example: 'A Photophore held on by an Inhibitor, wrapped in protease: prey with Light eyes swims straight into ' +
      'the glands (the anglerfish).',
    related: ['photophore', 'lighteye', 'protease'],
  },
  {
    id: 'moods', title: 'Hormones and moods', chapter: 6,
    demo: 'adrenal',
    paragraphs: [
      'Glands turn sugar into hormones, which seep through the body and ride in the blood. A cell\'s mood comes ' +
        'from what it holds: Adrenaline lowers Synapse thresholds, speeds Pacemakers and makes actions work ' +
        'harder; Calm raises thresholds, slows Pacemakers and saves fuel; Fed makes Fat store sooner and without ' +
        'loss; Starved makes Fat give sugar back and saves fuel, and cancels Fed.',
      'A Receptor turns a hormone back into a nerve signal, so a mood can switch behaviour where no fibre reaches.',
      'Press C to see the hormones: each cell glows with the hormones it holds.',
    ],
    example: 'A Nose into a Fed gland: food in reach means store. A Receptor for Fed holding an Inhibitor, into a ' +
      'Starved gland: no Fed means give the stores back.',
    related: ['adrenal', 'calmgland', 'fedgland', 'starvedgland', 'receptor', 'synapse'],
  },
  {
    id: 'scent', title: 'Hormones in the water', chapter: 6,
    demo: 'calmgland',
    paragraphs: [
      'Every cell gives off a scent of the hormones it holds into the water around it, without losing them, and ' +
        'takes in a hormone the water holds more of than it does. The clouds spread and fade; adrenaline\'s ' +
        'fades fast, Calm\'s lingers.',
      'So moods are catching. A creature in your Calm cloud is calmed, its Synapses harder to set off, and an ' +
        'enemy\'s Adrenaline reaches your Receptors. With C on you see the clouds in the water.',
    ],
    example: 'Wait out of an enemy\'s reach with Calm glands on until its threshold rises, then go in.',
    related: ['calmgland', 'adrenal', 'receptor', 'synapse'],
  },
  {
    id: 'treatments', title: 'Tanning and resilin', chapter: 6,
    demo: 'resilin',
    paragraphs: [
      'The Tanner and the Resilin gland change your own cells, one at a time, nearest first, while signalled. ' +
        'Tanned cells are stiffer and take less damage (and blunt stings), but tanned muscles move slowly. A ' +
        'resilin muscle charges while held contracted and snaps open on release, striking what it touches.',
    ],
    example: 'A Muscle at the front with a 0.5 Hz Pacemaker and a Resilin gland held on beside it: a strike every ' +
      'two seconds.',
    related: ['tanner', 'resilin', 'muscle'],
  },
];

const GUIDE_TERMS = [
  ['Biomass', 'What a cell costs to build. Chapters 1–3 give a budget of it; later a kit of materials.', 'tissue'],
  ['Kit', 'The materials a level gives you. What you don\'t build with becomes your starting reserves.', 'fat'],
  ['Signal', 'A number from 0 (off) to 1 (on) that a cell carries on the nerve layer. Above a half counts as on.',
    'command'],
  ['Fibre', 'A nerve line from one cell to another, carrying the first cell\'s signal. Each step costs a unit.',
    'lighteye'],
  ['Neuron', 'The logic one cell can hold: Pacemaker, Command, Ganglion, Delay, Inhibitor, Synapse or Latch.', 'latch'],
  ['Threshold', 'The sum of inputs a Synapse needs to be on. Adrenaline lowers it, Calm raises it.', 'synapse'],
  ['Vessel', 'A blood line through the body. It carries fluids fast while a fed Heart pumps it.', 'heart'],
  ['Seeping', 'Fluids moving slowly from a fuller cell to an emptier neighbour, without vessels.', 'airsac'],
  ['Starving', 'A working cell short of O₂ or sugar: it works weaker, and a Photophore goes dark.', 'siphon'],
  ['Poisoned', 'A working cell too full of waste: it loses health until a Pore takes the waste away.', 'pore'],
  ['Hard cell', 'A cell built with mineral or hardened by a Mineralizer. Acid eats it; protease can\'t.', 'shell'],
  ['Debris', 'Cells cut off from their Nucleus. They float, rot, and can be eaten.', 'nucleus'],
  ['Mood', 'What the hormones in a cell do to it: thresholds, clocks, fuel burn and fat storage.', 'calmgland'],
  ['Scent', 'The hormones a creature leaves in the water. Other creatures take them in.', 'adrenal'],
  ['Lure', 'A lit Photophore, which other creatures\' Light eyes follow.', 'photophore'],
  ['Par', 'The time and biomass a level\'s stars ask for.', 'pacemaker'],
];
