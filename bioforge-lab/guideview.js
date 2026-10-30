'use strict';
// The field guide sheet: a list of every cell, neuron, topic and glossary term down the left, each with its picture,
// and a filter; the chosen entry on the right, told in pictures first: the cell or neuron with its live example tank
// (tipdemo.js, with the hormone lens for hormones), its cost, health and fuel as pips and bars, the example's wiring
// as icons joined by moving fibres and vessels, then the words: how to use it, what to watch out for, and what it
// works with as picture tiles. Opened from the menus, G in the builder and the clicked cell's card; Esc or ✕ closes
// it (browser only). The entries are built in fieldguide.js.

const GUIDE_START_ENTRY = 'topic:programming';
const GUIDE_LIST_ICON_SIZE = 22;                          // px: an icon in the list down the left
const GUIDE_HERO_ICON_SIZE = 56;                          // px: the picture at the top of a page
const GUIDE_WIRE_ICON_SIZE = 34;                          // px: an icon in a wiring picture
const GUIDE_TILE_ICON_SIZE = 40;                          // px: an icon on a "works well with" tile
const GUIDE_CHIP_ICON_SIZE = 18;                          // px: an icon on a "read more" chip
const GUIDE_ICON_SHARPNESS = 2;                           // icons are drawn this many times bigger, for sharp screens
// a cell drawn this much bigger than in the dock fills its box as a neuron badge does; a spiked cell (the Thorn)
// less, so its spike stays in the box
const GUIDE_CELL_ICON_FILL = 1.5;
const GUIDE_SPIKED_ICON_FILL = 1.1;
const GUIDE_STATS_SHOWN = ['Built from', 'Health', 'Burns'];   // facts drawn as pips and bars, not table rows

// the drawn icons as image URLs, by name and size, drawn once each
const guideIconUrls = new Map();

// what guideview.js keeps in the app
function createGuideState() {
  return { isOpen: false, entryId: GUIDE_START_ENTRY, filter: '' };
}

const isGuideOpen = app => app.guide.isOpen;

function setUpGuide(app) {
  const sheet = byId('guide-sheet');
  // links anywhere in the sheet carry the entry they open in data-guide
  sheet.onclick = event => {
    if (event.target === sheet) {
      closeGuide(app);
      return;
    }
    const link = event.target.closest && event.target.closest('[data-guide]');
    if (link) showGuideEntry(app, link.dataset.guide);
  };
  byId('guide-close').onclick = () => closeGuide(app);
  const filter = byId('guide-filter');
  filter.oninput = () => {
    app.guide.filter = filter.value;
    showGuideList(app);
  };
  filter.onkeydown = event => {
    if (event.key === 'Escape') closeGuide(app);
  };
}

// opens the guide at an entry (an id such as 'cell:muscle'), or where it was last left
function openGuide(app, entryId = app.guide.entryId) {
  app.guide.isOpen = true;
  hideTooltip(app);
  byId('guide-sheet').style.display = 'flex';
  playSound(app, 'open');
  showGuideEntry(app, findGuideEntry(entryId) ? entryId : GUIDE_START_ENTRY);
}

function closeGuide(app) {
  if (!app.guide.isOpen) return;
  app.guide.isOpen = false;
  byId('guide-sheet').style.display = 'none';
  stopDemo();
}

// G in the builder: the guide at the clicked cell, else at what a click would place (a cell type or a neuron)
function openGuideFromBuilder(app) {
  const focused = app.focusKey && app.edited.cells.get(app.focusKey);
  if (focused) openGuide(app, `cell:${focused.typeName}`);
  else if (app.layer === 'nerve') openGuide(app, `neuron:${app.selectedNeuron}`);
  else openGuide(app, `cell:${app.selectedType}`);
}

// the list down the left: every section's entries that match the filter, each with its picture, the shown one marked
function showGuideList(app) {
  const words = app.guide.filter.trim().toLowerCase();
  const html = guideSections().map(section => {
    const entries = section.entries.filter(entry => !words || entry.name.toLowerCase().includes(words));
    if (!entries.length) return '';
    const links = entries.map(entry => {
      const selected = entry.id === app.guide.entryId ? ' selected' : '';
      const icon = guideIconHtml(entryPicture(entry), GUIDE_LIST_ICON_SIZE);
      return `<button class="guide-link${selected}" data-guide="${entry.id}">${icon}` +
        `<span>${escapeHtml(entry.name)}</span></button>`;
    }).join('');
    return `<div class="guide-section">${section.title}</div>${links}`;
  }).join('');
  byId('guide-list').innerHTML = html || '<div class="dim">Nothing by that name.</div>';
}

// shows one entry on the right, and starts its example tank if it has one
function showGuideEntry(app, entryId) {
  const entry = findGuideEntry(entryId);
  if (!entry) return;
  app.guide.entryId = entryId;
  stopDemo();
  byId('guide-title').textContent = entry.name;
  byId('guide-body').innerHTML = guidePageHtml(entry);
  byId('guide-body').scrollTop = 0;
  showGuideList(app);
  startGuideDemo(entryDemo(entry));
}

// the cell type or neuron an entry is drawn by: its own, a topic's demo, or none for the glossary
function entryPicture(entry) {
  if (entry.kind === 'cell' || entry.kind === 'neuron') return entry.key;
  if (entry.kind === 'topic') return guideTopic(entry.key).demo;
  return '';
}

// the cell type or neuron whose example tank an entry runs, or '' for none
function entryDemo(entry) {
  const name = entryPicture(entry);
  return TIPS[name] || NEURON_TIPS[name] ? name : '';
}

// runs the example of a cell type or neuron in the page's tank, with the hormone lens if it is about hormones
function startGuideDemo(name) {
  const canvas = byId('guide-demo');
  const options = { showsLens: showsHormones(name) };
  if (TIPS[name]) startDemo(name, canvas, options);
  else if (NEURON_TIPS[name]) startNeuronDemo(name, canvas, byId('guide-traces'), options);
}

const guideTopic = id => GUIDE_TOPICS.find(topic => topic.id === id);

// the right-hand page of an entry, by its kind
function guidePageHtml(entry) {
  if (entry.kind === 'cell') return cellPageHtml(entry.key);
  if (entry.kind === 'neuron') return neuronPageHtml(entry.key);
  if (entry.kind === 'topic') return topicPageHtml(guideTopic(entry.key));
  return glossaryHtml();
}

function cellPageHtml(typeName) {
  const type = CELLS[typeName];
  const notes = GUIDE_CELLS[typeName];
  const tip = TIPS[typeName];
  const otherFacts = cellFacts(typeName).filter(([label]) => !GUIDE_STATS_SHOWN.includes(label));
  return heroHtml(typeName, `${type.category} cell`, type.color, type.description,
    cellStatsHtml(cellStats(typeName)) + factsHtml(otherFacts), tip ? demoHtml(false, typeName) : '') +
    (tip ? wiringHtml(tip.example) + guideParagraph('How to use it', tip.howToUse) : '') +
    watchHtml(notes.watch) +
    tilesHtml('Works well with', notes.pairs) +
    chipsHtml('Read more', topicsAbout(typeName)) +
    chapterHtml(notes.chapter);
}

function neuronPageHtml(kind) {
  const type = NEURONS[kind];
  const notes = GUIDE_NEURONS[kind];
  const tip = NEURON_TIPS[kind];
  return heroHtml(kind, `Neuron ${escapeHtml(type.symbol)}`, type.color, type.description,
    neuronStatsHtml(kind), tip ? demoHtml(true, kind) : '') +
    (tip ? wiringHtml(tip.example) + guideParagraph('How to use it', tip.howToUse) : '') +
    watchHtml(notes.watch) +
    tilesHtml('Works well with', notes.pairs) +
    chipsHtml('Read more', topicsAbout(kind)) +
    chapterHtml(notes.chapter);
}

// a topic: its first paragraph beside the demo's tank, the rest under it, the example and the cells it is about
function topicPageHtml(topic) {
  const [first, ...rest] = topic.paragraphs;
  const demo = entryDemo({ kind: 'topic', key: topic.id });
  const exampleTip = TIPS[demo] || NEURON_TIPS[demo];
  return heroHtml(topic.demo, 'How it works', '', first, '', demo ? demoHtml(!!NEURON_TIPS[demo], demo) : '') +
    rest.map(text => `<p>${escapeHtml(text)}</p>`).join('') +
    `<div class="guide-example"><b>Example</b> ${escapeHtml(topic.example)}</div>` +
    (exampleTip ? wiringHtml(exampleTip.example) : '') +
    tilesHtml('Cells and neurons', topic.related) +
    chapterHtml(topic.chapter);
}

// every term as a card with its picture
function glossaryHtml() {
  const cards = GUIDE_TERMS.map(([term, meaning, picture]) => `<div class="guide-term">` +
    guideIconHtml(picture, GUIDE_TILE_ICON_SIZE) +
    `<div><b>${escapeHtml(term)}</b><span>${escapeHtml(meaning)}</span></div></div>`);
  return `<div class="guide-terms">${cards.join('')}</div>`;
}

// The top of a page: the big picture, the kind, the main text and what goes under it (stats) on the left, the
// example tank on the right.
function heroHtml(picture, kind, color, text, under, demo) {
  const kindStyle = color ? ` style="color:${color}"` : '';
  return '<div class="guide-hero"><div class="guide-hero-main">' +
    `<div class="guide-badge">${guideIconHtml(picture, GUIDE_HERO_ICON_SIZE)}` +
    `<div><div class="guide-kind"${kindStyle}>${kind}</div><p>${escapeHtml(text)}</p></div></div>` +
    `${under}</div>${demo}</div>`;
}

// the example tank (and a neuron's signal lanes under it), started by showGuideEntry, with a line on what is ringed
function demoHtml(withTraces, name) {
  const lens = showsHormones(name) ? ' Hormones show as glowing clouds.' : '';
  return `<div class="guide-demo"><canvas id="guide-demo" width="${DEMO_WIDTH}" height="${DEMO_HEIGHT}"></canvas>` +
    (withTraces ? `<canvas id="guide-traces" width="${DEMO_WIDTH}" height="0"></canvas>` : '') +
    `<div class="guide-caption">Live: the ringed cells are the ${escapeHtml(guideName(name))}.${lens}</div></div>`;
}

// a cell type's recipe as coloured pips, and its health and fuel burn as bars against the most any cell has
function cellStatsHtml(stats) {
  const pips = stats.recipe.flatMap(material => Array.from({ length: material.amount }, () =>
    `<i class="guide-pip" style="background:${material.color}" title="${material.name}"></i>`)).join('');
  const recipeText = stats.recipe.map(material => `${material.amount} ${material.name}`).join(', ');
  const burnText = stats.burn.share
    ? `${stats.burn.value} O₂ and sugar per s, ${stats.burn.when || 'while working'}`
    : 'nothing: it only passes O₂ and sugar on';
  return '<div class="guide-stats">' +
    statHtml('Built from', `<span class="guide-pips">${pips}</span>`,
      recipeText || 'nothing: it comes with every creature') +
    statHtml('Health', barHtml(stats.health.share, 'health'), stats.health.value) +
    statHtml('Burns', barHtml(stats.burn.share, 'burn'), burnText) +
    '</div>';
}

// a neuron's inputs, and its setting as a slider showing its range and where a new one starts
function neuronStatsHtml(kind) {
  const setting = NEURONS[kind].setting;
  const [inputs, settingFact] = neuronFacts(kind);
  let html = statHtml(inputs[0], '', inputs[1]);
  if (setting) {
    const share = (setting.start - setting.min) / (setting.max - setting.min);
    const slider = `<span class="guide-slider"><i style="left:${(share * 100).toFixed(1)}%"></i></span>`;
    html += statHtml(settingFact[0], slider, settingFact[1]);
  }
  return `<div class="guide-stats">${html}</div>`;
}

// one row of the stats: label, picture, words (across the picture's place when there is none)
function statHtml(label, picture, text) {
  const wordy = picture ? '' : ' wordy';
  return `<div class="guide-stat${wordy}"><span class="guide-stat-label">${escapeHtml(label)}</span>${picture}` +
    `<span class="guide-stat-text">${escapeHtml(String(text))}</span></div>`;
}

function barHtml(share, kind) {
  return `<span class="guide-bar ${kind}"><i style="width:${(share * 100).toFixed(1)}%"></i></span>`;
}

function factsHtml(facts) {
  if (!facts.length) return '';
  const rows = facts.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`);
  return `<table class="guide-facts">${rows.join('')}</table>`;
}

// The example's wiring as pictures: each pair of ends joined by a fibre (signals flowing along it) or a vessel. The
// ends open their own pages.
function wiringHtml(example) {
  const pairs = exampleWiring(example);
  if (!pairs.length) return '';
  const rows = pairs.map(({ from, to, link }) => '<div class="guide-wire">' + wireEndHtml(from) +
    `<span class="guide-wire-line ${link}" title="${link === 'fibre' ? 'Fibre' : 'Vessel'}"></span>` +
    wireEndHtml(to) + '</div>');
  return `<div class="guide-heading">Wiring in the example</div><div class="guide-wires">${rows.join('')}</div>`;
}

function wireEndHtml(name) {
  const entry = relatedGuideEntry(name);
  const attribute = entry ? ` data-guide="${entry.id}"` : '';
  return `<button class="guide-wire-end"${attribute}>${guideIconHtml(name, GUIDE_WIRE_ICON_SIZE)}` +
    `<span>${escapeHtml(guideName(name))}</span></button>`;
}

function guideParagraph(heading, text) {
  return `<div class="guide-heading">${heading}</div><p>${escapeHtml(text)}</p>`;
}

function watchHtml(text) {
  return `<div class="guide-watch"><b>Watch out</b>${escapeHtml(text)}</div>`;
}

// a row of picture tiles linking to cell types and neurons; nothing if there are none
function tilesHtml(heading, names) {
  const tiles = names.map(name => [name, relatedGuideEntry(name)]).filter(([, entry]) => entry)
    .map(([name, entry]) => `<button class="guide-tile" data-guide="${entry.id}">` +
      `${guideIconHtml(name, GUIDE_TILE_ICON_SIZE)}<span>${escapeHtml(entry.name)}</span></button>`);
  if (!tiles.length) return '';
  return `<div class="guide-heading">${heading}</div><div class="guide-tiles">${tiles.join('')}</div>`;
}

// a row of small chips linking to topics, each with its topic's picture; nothing if there are none
function chipsHtml(heading, topicIds) {
  const chips = topicIds.map(id => findGuideEntry('topic:' + id)).filter(Boolean)
    .map(entry => `<button class="guide-chip" data-guide="${entry.id}">` +
      `${guideIconHtml(entryPicture(entry), GUIDE_CHIP_ICON_SIZE)}${escapeHtml(entry.name)}</button>`);
  if (!chips.length) return '';
  return `<div class="guide-heading">${heading}</div><div class="guide-chips">${chips.join('')}</div>`;
}

// which chapter first asks for it
function chapterHtml(chapter) {
  const text = chapter
    ? `First asked for in chapter ${chapter}, ${CHAPTER_NAMES[chapter]}.`
    : 'No level asks for it yet: try it in the Sandbox.';
  return `<div class="guide-chapter">${text}</div>`;
}

// the ids of the topics that name this cell type or neuron among their related ones
function topicsAbout(name) {
  return GUIDE_TOPICS.filter(topic => topic.related.includes(name)).map(topic => topic.id);
}

// A cell type or neuron drawn as an <img> size px square, or an empty box of that size where it can't be drawn
// (no name, or a canvas that can't make images, as in the tests).
function guideIconHtml(name, size) {
  const url = name ? guideIconUrl(name, size) : '';
  const box = `width="${size}" height="${size}"`;
  if (!url) return `<span class="guide-icon" style="width:${size}px;height:${size}px"></span>`;
  return `<img class="guide-icon" src="${url}" ${box} alt="">`;
}

// draws a cell type or neuron once at a size, and keeps the image's URL
function guideIconUrl(name, size) {
  const cacheKey = `${name}@${size}`;
  if (guideIconUrls.has(cacheKey)) return guideIconUrls.get(cacheKey);
  const canvas = document.createElement('canvas');
  canvas.width = size * GUIDE_ICON_SHARPNESS;
  canvas.height = size * GUIDE_ICON_SHARPNESS;
  const context = canvas.getContext && canvas.getContext('2d');
  let url = '';
  if (context && typeof canvas.toDataURL === 'function') {
    context.scale(GUIDE_ICON_SHARPNESS, GUIDE_ICON_SHARPNESS);
    context.translate(size / 2, size / 2);
    const fill = CELLS[name] && CELLS[name].spiked ? GUIDE_SPIKED_ICON_FILL : GUIDE_CELL_ICON_FILL;
    if (CELLS[name]) drawCellIcon(context, name, iconZoom(size) * fill);
    else if (NEURONS[name]) drawNeuronIcon(context, name, iconZoom(size));
    url = canvas.toDataURL();
  }
  guideIconUrls.set(cacheKey, url);
  return url;
}
