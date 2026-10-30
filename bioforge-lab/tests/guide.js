'use strict';
// The field guide: every cell type and neuron has its entry and its notes, every link goes to an entry that is
// there, the numbers come from the game's data; then the app (fake DOM) opens it from the menu, with G at the cell
// in hand, follows a link, filters the list and closes it with Esc.
const { load } = require('./load');
const { startApp } = require('./dom');
const { check, done } = require('./check');
const { X: sim } = load({}, ['CELLS', 'NEURONS', 'GUIDE_CELLS', 'GUIDE_NEURONS', 'GUIDE_TOPICS', 'GUIDE_TERMS',
  'guideSections', 'guideEntries', 'findGuideEntry', 'relatedGuideEntry', 'cellFacts', 'neuronFacts', 'TIPS',
  'NEURON_TIPS', 'EYESPOT_RANGE', 'NETTLE_DAMAGE', 'CHAPTER_NAMES', 'LEVELS', 'cellStats', 'exampleWiring',
  'showsHormones']);

// ---------- The entries ----------
const entries = sim.guideEntries();
const ids = entries.map(entry => entry.id);
check('every cell type has an entry and notes',
  Object.keys(sim.CELLS).every(typeName => ids.includes('cell:' + typeName) && sim.GUIDE_CELLS[typeName]),
  Object.keys(sim.CELLS).filter(typeName => !sim.GUIDE_CELLS[typeName]).join(' '));
check('every neuron has an entry and notes',
  Object.keys(sim.NEURONS).every(kind => ids.includes('neuron:' + kind) && sim.GUIDE_NEURONS[kind]));
check('there are no notes for cells or neurons the game doesn\'t have',
  Object.keys(sim.GUIDE_CELLS).every(typeName => sim.CELLS[typeName]) &&
  Object.keys(sim.GUIDE_NEURONS).every(kind => sim.NEURONS[kind]));
check('no entry is listed twice', new Set(ids).size === ids.length);
const linked = [
  ...Object.values(sim.GUIDE_CELLS).flatMap(notes => notes.pairs),
  ...Object.values(sim.GUIDE_NEURONS).flatMap(notes => notes.pairs),
  ...sim.GUIDE_TOPICS.flatMap(topic => topic.related),
];
const broken = linked.filter(name => !sim.relatedGuideEntry(name));
check('every "works well with" and related link opens an entry', broken.length === 0, broken.join(' '));
const chapters = [...Object.values(sim.GUIDE_CELLS), ...Object.values(sim.GUIDE_NEURONS), ...sim.GUIDE_TOPICS]
  .map(notes => notes.chapter);
check('every chapter named is one the game has (0: none yet)',
  chapters.every(chapter => chapter === 0 || sim.CHAPTER_NAMES[chapter]));
check('every topic has words and an example',
  sim.GUIDE_TOPICS.every(topic => topic.paragraphs.length && topic.example && topic.title));
check('the glossary has terms with meanings', sim.GUIDE_TERMS.length > 10 &&
  sim.GUIDE_TERMS.every(([term, meaning]) => term && meaning));

// ---------- The facts come from the game's numbers ----------
const factOf = (facts, label) => (facts.find(([name]) => name === label) || [])[1] || '';
check('a cell\'s facts give its recipe and health',
  factOf(sim.cellFacts('thorn'), 'Built from') === '2 Protein, 1 Mineral' &&
  factOf(sim.cellFacts('thorn'), 'Health') === String(sim.CELLS.thorn.health));
check('an Eyespot\'s reach is the sim\'s',
  factOf(sim.cellFacts('eyespot'), 'Senses').includes(`${sim.EYESPOT_RANGE} px`));
check('a Nettle\'s sting is the sim\'s', factOf(sim.cellFacts('nettle'), 'Sting').startsWith(`${sim.NETTLE_DAMAGE} `));
check('a gland says which hormone it makes', factOf(sim.cellFacts('calmgland'), 'Makes') === 'Calm');
check('every cell has facts with no blanks or undefined',
  Object.keys(sim.CELLS).every(typeName => sim.cellFacts(typeName).every(([label, value]) =>
    label && value && !value.includes('undefined') && !value.includes('NaN'))));
check('a neuron\'s setting gives its range', factOf(sim.neuronFacts('delay'), 'Delay').includes('0.25–3 s'));

// ---------- The pictures' data ----------
const thornStats = sim.cellStats('thorn');
check('a cell\'s stats give its recipe as materials, and shares between 0 and 1',
  thornStats.recipe.map(material => `${material.amount} ${material.name}`).join(', ') === '2 Protein, 1 Mineral' &&
  Object.keys(sim.CELLS).every(typeName => {
    const stats = sim.cellStats(typeName);
    return stats.health.share > 0 && stats.health.share <= 1 && stats.burn.share >= 0 && stats.burn.share <= 1;
  }));
const eyeWiring = sim.exampleWiring(sim.TIPS.lighteye.example);
check('the Light eye\'s example wiring is eye → Siphon, listed once',
  eyeWiring.length === 1 && eyeWiring[0].from === 'lighteye' && eyeWiring[0].to === 'siphon' &&
  eyeWiring[0].link === 'fibre', JSON.stringify(eyeWiring));
const allWiring = [...Object.values(sim.TIPS), ...Object.values(sim.NEURON_TIPS)]
  .flatMap(tip => sim.exampleWiring(tip.example));
check('every example\'s wiring names cells and neurons the guide has pages for',
  allWiring.every(pair => sim.relatedGuideEntry(pair.from) && sim.relatedGuideEntry(pair.to)),
  JSON.stringify(allWiring.filter(pair => !sim.relatedGuideEntry(pair.from) || !sim.relatedGuideEntry(pair.to))));
check('every topic runs the example of a cell or neuron that has one',
  sim.GUIDE_TOPICS.every(topic => sim.TIPS[topic.demo] || sim.NEURON_TIPS[topic.demo]));
check('every glossary term has a picture of a cell or neuron',
  sim.GUIDE_TERMS.every(([, , picture]) => sim.CELLS[picture] || sim.NEURONS[picture]));
check('the hormone glands and the Receptor show the hormone lens, a Muscle doesn\'t',
  ['adrenal', 'calmgland', 'fedgland', 'starvedgland', 'receptor'].every(sim.showsHormones) &&
  !sim.showsHormones('muscle') && !sim.showsHormones('latch'));

// ---------- In the app ----------
const { byId, fire, runFrames } = startApp(['clear', 'starter'], {}, { atMainMenu: true });
const pressKey = key => {
  fire('window', 'keydown', { key });
  fire('window', 'keyup', { key });
};
runFrames(2);
byId('menu-guide').onclick({});
runFrames(3);
check('Field guide on the main menu opens the guide at its first topic',
  byId('guide-sheet').style.display === 'flex' && byId('guide-title').textContent === 'You program, it acts');
check('its list holds every entry', (byId('guide-list').innerHTML.match(/data-guide=/g) || []).length ===
  entries.length);
byId('guide-sheet').onclick({ target: { closest: () => ({ dataset: { guide: 'cell:photophore' } }) } });
runFrames(5);
check('a link opens its entry, with its facts and its example tank',
  byId('guide-title').textContent === 'Photophore' && byId('guide-body').innerHTML.includes('guide-facts') &&
  byId('guide-body').innerHTML.includes('guide-demo'));
byId('guide-filter').value = 'gland';
byId('guide-filter').oninput();
const shown = byId('guide-list').innerHTML;
check('the filter keeps only the entries whose name matches',
  shown.includes('Calm gland') && !shown.includes('>Muscle<'));
pressKey('Escape');
check('Esc closes the guide and leaves the main menu up', byId('guide-sheet').style.display === 'none' &&
  byId('menu-sheet').style.display === 'flex');
byId('menu-guide').onclick({});
check('opened again, the guide is where it was left', byId('guide-title').textContent === 'Photophore');
pressKey('Escape');

{ // G in the builder: the guide at the cell a click would place
  const builder = startApp(['clear', 'starter']);
  builder.runFrames(3);
  builder.fire('window', 'keydown', { key: 'g' });
  builder.runFrames(2);
  const typeName = builder.readGlobal('START_CELL_TYPE');
  check('G in the builder opens the guide at the cell type in hand',
    builder.byId('guide-sheet').style.display === 'flex' &&
    builder.byId('guide-title').textContent === sim.CELLS[typeName].name);
  builder.fire('window', 'keydown', { key: 'Escape' });
  check('and Esc closes it without opening the menu', builder.byId('guide-sheet').style.display === 'none' &&
    builder.byId('menu-sheet').style.display === 'none');
}

done();
