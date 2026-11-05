'use strict';
// The tutorial's lessons: what each step says (on screen and spoken), what it points at, and what the player must do
// for it to move on (pure data; tutorial.js shows them). Each step's id names its voice file, audio/voice/<id>.mp3,
// which tools/make-voice.js makes with ElevenLabs.
//
// A lesson starts once the lesson named by `after` is done and the level named by `needsWin` is won. A lesson with a
// `level` chooses it and opens the Body view; it is skipped when that level is won already (except on a replay).
// Its `runStep` is the step that asks for the run: a player who leaves a run before winning goes back to it.
//
// While a step is on screen the rest of the game is locked: the mouse reaches only the bubble and, on a step that
// waits for the player to do something, its target (canTouch: true opens the target on a Next step too, to rest the
// mouse on it); the keys are locked except Esc and the step's keys (keys: ['2']).
//
// A step shows in the Lab, or with mode: 'level' during a level run; anywhere else the tutorial waits until the
// player is back. Back in the Lab from a won run, the run's steps are passed (the player chose Lab over Next).
// A step's target is what the spotlight shows: { element: id }, { cell: type } or { neuron: kind } (a dock button),
// { hexes: [[q, r], …] } (builder hexes), or none (the bubble in the middle). dim: false leaves the screen undimmed,
// for watching a run. waitFor is what moves it on: 'next' (its Next button) or a condition:
//   { kind: 'cellPicked', cell }              the cell type is chosen in the dock
//   { kind: 'neuronPicked', neuron }          the neuron is chosen in the dock
//   { kind: 'cellCount', cell, count }        the design has at least count cells of the type
//   { kind: 'view', layer }                   the builder shows the 'body' or 'nerve' view
//   { kind: 'neuronIn', neuron, cell }        a cell of the type holds the neuron
//   { kind: 'fibresTo', from, to, count }     fibres from cells of type from reach count cells of type to
//   { kind: 'fibresAcross', from, to }        every cell of type from has a fibre to a to cell on the other side
//   { kind: 'mode', mode }                    the game is in 'build' or 'level' mode
//   { kind: 'runEnded' }                      the level run is won or lost
//   { kind: 'levelWon', level }               the level is won
// skipIf takes the same conditions: a step whose condition holds when its turn comes is left out.

// the end of a lesson's run: a word on losing (until it is won), then on winning
function runResultSteps(lessonId, level, lostText) {
  return [
    {
      id: `${lessonId}-lost`, skipIf: { kind: 'levelWon', level }, mode: 'level', dim: false,
      target: { element: 'level-result' },
      text: lostText,
      waitFor: { kind: 'levelWon', level },
    },
    {
      id: `${lessonId}-won`, mode: 'level', dim: false, target: { element: 'level-result' },
      text: 'You made it! The stars count how fast you were and how small your creature was. Press Next, then ' +
        'Retry to beat them, or go back to the Lab.',
      waitFor: 'next',
    },
  ];
}

const TUTORIAL_LESSONS = [
  {
    id: 'first-stroke', level: 'first-stroke', runStep: 'first-stroke-run',
    steps: [
      {
        id: 'first-stroke-welcome',
        text: 'Welcome to the Lab. Build a creature from cells, wire up its nerves, and watch it come alive.',
        waitFor: 'next',
      },
      {
        id: 'first-stroke-nucleus', target: { hexes: [[0, 0]] },
        text: 'This is the Nucleus. Every creature has one, and everything you add grows out from it.',
        waitFor: 'next',
      },
      {
        id: 'first-stroke-goal', target: { element: 'level-buttons' },
        text: 'Your first level: swim into the ring ahead. To swim, your creature needs something that pushes water.',
        waitFor: 'next',
      },
      {
        id: 'first-stroke-pick-siphon', target: { cell: 'siphon' },
        text: 'This is the dock, with every cell in the game. The locked ones open in later levels. Pick the ' +
          'Siphon: it squirts water out of its back and pushes the body forward.',
        waitFor: { kind: 'cellPicked', cell: 'siphon' },
      },
      {
        id: 'first-stroke-place-siphons', target: { hexes: [[-1, 1], [0, 1]] },
        text: 'Click the two places behind the Nucleus to add a Siphon on each side. A right-click takes a cell away.',
        waitFor: { kind: 'cellCount', cell: 'siphon', count: 2 },
      },
      {
        id: 'first-stroke-still', target: { element: 'preview' },
        text: 'The Preview runs your creature while you build. A Siphon squirts when a nerve signal tells it to, so ' +
          'next comes the wiring.',
        waitFor: 'next',
      },
      {
        id: 'first-stroke-nerves', target: { element: 'layer-nerve' }, keys: ['2'],
        text: 'Open the Nerves view. This is where you wire the creature\'s brain. The 2 key opens it too.',
        waitFor: { kind: 'view', layer: 'nerve' },
      },
      {
        id: 'first-stroke-pick-pacemaker', target: { neuron: 'pacemaker' },
        text: 'Pick the Pacemaker. It sends out a pulse again and again, like a heartbeat.',
        waitFor: { kind: 'neuronPicked', neuron: 'pacemaker' },
      },
      {
        id: 'first-stroke-place-pacemaker', target: { hexes: [[0, 0]] },
        text: 'Click the Nucleus to put the Pacemaker in it.',
        waitFor: { kind: 'neuronIn', neuron: 'pacemaker', cell: 'nucleus' },
      },
      {
        id: 'first-stroke-fibres', target: { hexes: [[0, 0], [-1, 1], [0, 1]] },
        text: 'Now drag from the Nucleus to a Siphon, and then to the other one. Each drag lays a nerve fibre, and ' +
          'every pulse runs down it and fires the Siphon.',
        waitFor: { kind: 'fibresTo', from: 'nucleus', to: 'siphon', count: 2 },
      },
      {
        id: 'first-stroke-swims', target: { element: 'preview' },
        text: 'Look at the Preview: both Siphons fire together, so the creature swims straight ahead.',
        waitFor: 'next',
      },
      {
        id: 'first-stroke-run', target: { element: 'run-next-level' },
        text: 'Ready? Run the level.',
        waitFor: { kind: 'mode', mode: 'level' },
      },
      {
        id: 'first-stroke-watch', mode: 'level', dim: false,
        text: 'Watch it swim. The ring at the top is the goal.',
        waitFor: { kind: 'runEnded' },
      },
      ...runResultSteps('first-stroke', 'first-stroke', 'Go back to the Lab, check that a fibre runs to each ' +
        'Siphon, and run the level again.'),
    ],
  },
  {
    id: 'lighthouse', level: 'lighthouse', runStep: 'lighthouse-run', after: 'first-stroke', needsWin: 'first-stroke',
    steps: [
      {
        id: 'lighthouse-welcome',
        text: 'Level two: reach the light. Give your creature eyes, and it will find the light.',
        waitFor: 'next',
      },
      {
        id: 'lighthouse-pick-eye', target: { cell: 'lighteye' },
        text: 'Each level unlocks new pieces, and they glow green in the dock. Pick the Light eye: the more light ' +
          'falls on it, the stronger it fires.',
        waitFor: { kind: 'cellPicked', cell: 'lighteye' },
      },
      {
        id: 'lighthouse-place-eyes', target: { hexes: [[0, -1], [1, -1]] },
        text: 'Put two Light eyes at the front of the Nucleus, one on each side. Keep your Siphons at the back.',
        waitFor: { kind: 'cellCount', cell: 'lighteye', count: 2 },
      },
      {
        id: 'lighthouse-nerves', target: { element: 'layer-nerve' }, keys: ['2'],
        text: 'Open the Nerves view again.',
        waitFor: { kind: 'view', layer: 'nerve' },
      },
      {
        id: 'lighthouse-cross', target: { hexes: [[0, -1], [1, -1], [-1, 1], [0, 1]] },
        text: 'Here is the trick. Drag a fibre from each eye to the Siphon on the far side, so the wires cross. The ' +
          'eye nearer the light then pushes the far side harder, and that turns the creature toward the light.',
        waitFor: { kind: 'fibresAcross', from: 'lighteye', to: 'siphon' },
      },
      {
        id: 'lighthouse-hints', target: { element: 'dock' }, canTouch: true, keys: ['g'],
        text: 'Rest the mouse on any piece in the dock: its hint shows how to use it, with a live example. The Field ' +
          'guide, on the G key, has every piece in pictures.',
        waitFor: 'next',
      },
      {
        id: 'lighthouse-run', target: { element: 'run-next-level' },
        text: 'Run it, and watch where it goes.',
        waitFor: { kind: 'mode', mode: 'level' },
      },
      {
        id: 'lighthouse-signals', mode: 'level', dim: false, target: { element: 'hud-probes' },
        text: 'These are the signals. Each line is one cell, showing how hard it fires as the run goes on. When your ' +
          'creature does something strange, look here first. The buttons at the top pause the run, step it and ' +
          'slow it down.',
        waitFor: 'next',
      },
      {
        id: 'lighthouse-watch', mode: 'level', dim: false,
        text: 'Watch it turn toward the light.',
        waitFor: { kind: 'runEnded' },
      },
      ...runResultSteps('lighthouse', 'lighthouse', 'In the Lab, wire each eye to the Siphon on the other side, so ' +
        'the wires cross, and run it again.'),
    ],
  },
  {
    id: 'lab-tour', after: 'lighthouse', needsWin: 'lighthouse',
    steps: [
      {
        id: 'lab-tour-welcome',
        text: 'You have the basics. Here is the rest of the Lab.',
        waitFor: 'next',
      },
      {
        id: 'lab-tour-levels', target: { element: 'level-buttons' },
        text: 'Run level always runs the next level you haven\'t won. The Levels button above it lists every level, ' +
          'with its goal, its limits and a hint.',
        waitFor: 'next',
      },
      {
        id: 'lab-tour-limits', target: { element: 'budget' },
        text: 'Each level sets limits. Biomass and cells are counted up here, and the Nerves view counts neurons ' +
          'and fibre.',
        waitFor: 'next',
      },
      {
        id: 'lab-tour-templates', target: { element: 'show-library' },
        text: 'Templates keeps the creatures you save, and ready-made examples to learn from.',
        waitFor: 'next',
      },
      {
        id: 'lab-tour-sandbox', target: { element: 'start-sandbox' },
        text: 'The Sandbox drops your creature into open water with enemies and food, to try it out freely.',
        waitFor: 'next',
      },
      {
        id: 'lab-tour-menu',
        text: 'Escape opens the menu, with the settings and the Field guide, and H shows every key. That\'s all. ' +
          'Good luck in the Lab!',
        waitFor: 'next',
      },
    ],
  },
];
