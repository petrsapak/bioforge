'use strict';
// The help texts stay true to the game: a level's brief and hint, and the tutorial's words for it, name only the
// cells and neurons the dock has by that level, and only levels that come before it; no help text anywhere names a
// piece or level the game no longer has.
const { load } = require('./load');
const { check, done } = require('./check');
const { X: sim } = load({}, ['CELLS', 'NEURONS', 'LEVELS', 'levelUnlocks', 'adventureUnlocks', 'TIPS', 'NEURON_TIPS',
  'GUIDE_CELLS', 'GUIDE_NEURONS', 'GUIDE_TOPICS', 'GUIDE_TERMS', 'TUTORIAL_LESSONS']);

// pieces and levels taken out of the game, which old help texts may still name
const GONE_NAMES = ['Valve', 'Vessel', 'Moth', 'Resilin', 'Snap', 'Tanner', 'Tanned hide'];

// whether the text names the thing: the name as a whole word, or its plural (Siphons, Light eyes, Noses)
function names(text, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}(s|es)?\\b`).test(text);
}

// the cells and neurons a text names, as [type name or kind, shown name]
function piecesNamed(text) {
  const pieces = [
    ...Object.entries(sim.CELLS).map(([typeName, cellType]) => [typeName, cellType.name]),
    ...Object.entries(sim.NEURONS).map(([kind, neuron]) => [kind, neuron.name]),
  ];
  return pieces.filter(([, name]) => names(text, name));
}

// every level with the texts a player reads while on it: its brief and hint, and its tutorial lesson's steps (the
// Lab tour, which has no level of its own, belongs to the level it waits for)
function levelTexts() {
  return sim.LEVELS.map(level => {
    const lessons = sim.TUTORIAL_LESSONS.filter(lesson => (lesson.level || lesson.needsWin) === level.id);
    const steps = lessons.flatMap(lesson => lesson.steps.map(step => step.text));
    return { level, texts: [level.brief, level.hint, ...steps] };
  });
}

// every help text not tied to one level: cell and neuron descriptions, hover hints and the field guide
function generalTexts() {
  return [
    ...Object.values(sim.CELLS).map(cellType => cellType.description),
    ...Object.values(sim.NEURONS).map(neuron => neuron.description),
    ...Object.values(sim.TIPS).map(tip => tip.howToUse),
    ...Object.values(sim.NEURON_TIPS).map(tip => tip.howToUse),
    ...Object.values(sim.GUIDE_CELLS).map(notes => notes.watch),
    ...Object.values(sim.GUIDE_NEURONS).map(notes => notes.watch),
    ...sim.GUIDE_TOPICS.flatMap(topic => [...topic.paragraphs, topic.example]),
    ...sim.GUIDE_TERMS.map(([, meaning]) => meaning),
  ].filter(Boolean);
}

// ---------- Each level's texts name only what the player has there ----------
const perLevel = levelTexts();
check('every level has a brief and a hint', perLevel.every(({ level }) => level.brief && level.hint),
  perLevel.filter(({ level }) => !level.brief || !level.hint).map(({ level }) => level.id).join(', '));
check('the tutorial has words for levels 1 and 2', perLevel[0].texts.length > 2 && perLevel[1].texts.length > 2);

const lockedNamed = perLevel.flatMap(({ level, texts }) => {
  // an adventure's dock has its own list (adventure.js), not what the levels before it bring
  const unlocked = level.adventure ? sim.adventureUnlocks(level.adventure.cells, level.adventure.neurons)
    : sim.levelUnlocks(level);
  const isOpen = typeName => unlocked.cells.has(typeName) || unlocked.neurons.has(typeName);
  return texts.flatMap(text => piecesNamed(text).filter(([typeName]) => !isOpen(typeName))
    .map(([, name]) => `${level.id}: ${name}`));
});
check('a level\'s brief, hint and tutorial name only cells and neurons its dock has', lockedNamed.length === 0,
  [...new Set(lockedNamed)].join(', '));

const laterNamed = perLevel.flatMap(({ level, texts }, index) => sim.LEVELS.slice(index + 1)
  .filter(later => texts.some(text => names(text, later.name)))
  .map(later => `${level.id}: ${later.name}`));
check('a level\'s texts name only levels before it', laterNamed.length === 0, laterNamed.join(', '));

// ---------- Nothing names what is gone ----------
const allTexts = [...perLevel.flatMap(({ texts }) => texts), ...generalTexts()];
const goneNamed = GONE_NAMES.filter(name => allTexts.some(text => names(text, name)));
// the level briefing lists each new piece with its summary (data/guide.js): one short line
const BRIEFING_SUMMARY_LENGTH = 60;                       // characters
const levelPieces = sim.LEVELS.flatMap(level => [
  ...level.unlocks.cells.map(typeName => [typeName, sim.GUIDE_CELLS[typeName]]),
  ...level.unlocks.neurons.map(kind => [kind, sim.GUIDE_NEURONS[kind]]),
]);
const unsummed = levelPieces.filter(([, words]) => !words || !words.summary ||
  words.summary.length > BRIEFING_SUMMARY_LENGTH);
check('every piece a level brings has a summary of one short line for the briefing', unsummed.length === 0,
  unsummed.map(([name]) => name).join(', '));
check('no help text names a piece or level the game no longer has', goneNamed.length === 0, goneNamed.join(', '));
check('no gone name is a piece or level again',
  GONE_NAMES.every(name => piecesNamed(name).length === 0 && !sim.LEVELS.some(level => level.name === name)));

done();
