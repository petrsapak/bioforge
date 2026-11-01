'use strict';
// The Templates screen (browser only): a sheet over the Lab, opened and closed like the field guide, with the
// tabs My creatures, My parts and Examples down the left and the open tab's cards, with pictures, on the right;
// saving the Lab's creature into My creatures; and the saved library, kept in storage.
// Entries are { name, isCreature, cells, fibres } (see design.js); the editing rules for them are in
// builder.js.

// Bioforge Moba and Lab before 2026-10-28 kept the library here, in the old format. Pages opened from disk can share
// storage, so Lab reads that list once to carry it over, and never writes to it (Moba still uses it).
const OLD_LIBRARY_STORAGE_KEY = 'bioforge-templates';
const THUMBNAIL_WIDTH = 200;                              // px drawn (the card scales it to its width)
const THUMBNAIL_HEIGHT = 140;                             // px drawn
const THUMBNAIL_MAX_SCALE = 4;                            // thumbnail px per grid px, so tiny parts aren't blown up
const LIBRARY_TABS = ['creatures', 'parts', 'examples'];
const LIBRARY_TAB_TITLES = { creatures: 'My creatures', parts: 'My parts', examples: 'Examples' };
const LIBRARY_TAB_HELP = {
  creatures: 'Click a creature to load it into the Lab (it replaces the design). Saving under a name that is ' +
    'taken asks before it overwrites. Ctrl+S saves too, from the Lab.',
  parts: 'Ctrl+click cells in the Lab, then right-click them to save a part. Click a part to stamp it onto your ' +
    'creature (Q/E turn it, Esc puts it away). With a Bud clicked, the part goes to the Bud, which grows it.',
  examples: 'Click one to load it into the Lab (it replaces the design).',
};

// the saved library, carried over from the old list the first time
function loadLibrary() {
  const saved = readStorage('library', null);
  if (saved) return saved.map(migrateLibraryEntry);
  try {
    const old = JSON.parse(localStorage.getItem(OLD_LIBRARY_STORAGE_KEY)) || [];
    return old.map(migrateLibraryEntry);
  } catch (error) {
    return [];
  }
}

// writes the library to storage
function saveLibrary(library) {
  writeStorage('library', library);
}

// ---------- The screen ----------
// wires the tabs, the filter, the Save and Import buttons and closing, and opens the tab used last (Examples for a
// player with no creatures yet)
function setUpLibrary(app) {
  for (const tab of LIBRARY_TABS) byId('library-tab-' + tab).onclick = () => showLibraryTab(app, tab);
  byId('library-save').onclick = () => saveBuilderCreature(app);
  byId('library-import').onclick = () => chooseCreatureFile();
  byId('show-library').onclick = () => toggleLibrary(app);
  byId('library-close').onclick = () => closeLibrary(app);
  byId('library-sheet').onclick = event => {
    if (event.target === byId('library-sheet')) closeLibrary(app);   // a click beside the screen
  };
  const filter = byId('library-filter');
  filter.oninput = () => {
    app.libraryFilter = filter.value;
    showLibraryCards(app);
  };
  filter.onkeydown = event => {
    if (event.key === 'Escape') closeLibrary(app);
  };
  const stored = readStorage('library-tab', null);
  const hasCreatures = app.library.some(entry => entry.isCreature);
  showLibraryTab(app, LIBRARY_TABS.includes(stored) ? stored : hasCreatures ? 'creatures' : 'examples');
}

const isLibraryOpen = app => byId('library-sheet').style.display === 'flex';

// opens the Templates screen over the Lab, at the tab it was left on
function openLibrary(app) {
  if (app.mode !== 'build') return;
  hideTooltip(app);
  byId('library-sheet').style.display = 'flex';
  byId('show-library').classList.add('selected');
  playSound(app, 'open');
  showLibraryCards(app);
}

// hides the Templates screen
function closeLibrary(app) {
  byId('library-sheet').style.display = 'none';
  byId('show-library').classList.remove('selected');
}

// the Templates button and T in the Lab: opens the screen, or closes it
function toggleLibrary(app) {
  if (isLibraryOpen(app)) closeLibrary(app);
  else openLibrary(app);
}

// opens one of the tabs and remembers it
function showLibraryTab(app, tab) {
  app.libraryTab = tab;
  writeStorage('library-tab', tab);
  showLibraryCards(app);
}

// fills the open tab with its cards (those whose name has the filter's words), and the tabs with their counts
function showLibraryCards(app) {
  const tab = app.libraryTab;
  const creatureCount = app.library.filter(entry => entry.isCreature).length;
  byId('library-tab-creatures').innerHTML = `My creatures <span class="count">${creatureCount}</span>`;
  byId('library-tab-parts').innerHTML = `My parts <span class="count">${app.library.length - creatureCount}</span>`;
  for (const name of LIBRARY_TABS) byId('library-tab-' + name).classList.toggle('selected', name === tab);
  byId('library-title').textContent = LIBRARY_TAB_TITLES[tab];
  byId('library-actions').style.display = tab === 'examples' ? 'none' : '';
  byId('library-save').style.display = tab === 'creatures' ? '' : 'none';
  byId('library-help').textContent = LIBRARY_TAB_HELP[tab];
  const box = byId('library-cards');
  box.innerHTML = '';
  app.libraryCards = tab === 'examples' ? showExampleCards(app, box) : showOwnCards(app, box, tab === 'creatures');
  showLibraryMarks(app);
}

// whether a name has the filter's words in it (any name, with no filter)
function matchesLibraryFilter(app, name) {
  const words = (app.libraryFilter || '').trim().toLowerCase();
  return !words || name.toLowerCase().includes(words);
}

// the player's own creatures or parts, each with Rename, Export and Delete; a note when there are none
function showOwnCards(app, box, isCreature) {
  const kept = app.library.filter(entry => entry.isCreature === isCreature);
  const entries = kept.filter(entry => matchesLibraryFilter(app, entry.name));
  if (!kept.length) {
    box.innerHTML = isCreature
      ? '<div class="library-empty">No creatures yet. Save this creature keeps the one in the Lab here.</div>'
      : '<div class="library-empty">No parts yet. Ctrl+click cells in the Lab, then right-click them.</div>';
  } else if (!entries.length) {
    box.innerHTML = '<div class="library-empty">Nothing by that name.</div>';
  }
  return entries.map(entry => {
    const card = makeLibraryCard(entry, entry.name, isCreature ? 'Click to load this creature'
      : 'Click to stamp this part onto your creature, or, with a Bud clicked, to make the Bud grow it');
    const buttons = document.createElement('div');
    buttons.className = 'card-buttons';
    buttons.appendChild(makeCardButton('✎', 'Rename', () => renameLibraryEntry(app, entry)));
    buttons.appendChild(makeCardButton('⤓', 'Export to a file, to back it up or share it',
      () => exportLibraryEntry(entry)));
    buttons.appendChild(makeCardButton('✕', 'Delete', () => removeLibraryEntry(app, entry)));
    card.element.appendChild(buttons);
    card.element.onclick = () => useLibraryEntry(app, entry);
    box.appendChild(card.element);
    return card;
  });
}

// the built-in designs (EXAMPLE_GROUPS in data/templates.js), under their group titles, each with its line under
// its name
function showExampleCards(app, box) {
  const cards = EXAMPLE_GROUPS.flatMap(group => {
    const examples = group.examples.filter(example => matchesLibraryFilter(app, example.name));
    if (!examples.length) return [];
    const heading = document.createElement('div');
    heading.className = 'library-heading';
    heading.textContent = group.title;
    box.appendChild(heading);
    return examples.map(example => {
      const card = makeLibraryCard(TEMPLATES[example.template], example.name, example.about);
      const about = document.createElement('div');
      about.className = 'card-about';
      about.textContent = example.about;
      card.element.appendChild(about);
      card.element.dataset.template = example.template;
      card.element.onclick = () => {
        loadDesign(app, TEMPLATES[example.template], example.name, '');
        closeLibrary(app);
      };
      box.appendChild(card.element);
      return card;
    });
  });
  if (!cards.length) box.innerHTML = '<div class="library-empty">Nothing by that name.</div>';
  return cards;
}

// One card: the picture, the name, its size, and a badge for a creature that breaks the limits. Returns
// { entry, element, badge }.
function makeLibraryCard(entry, name, title) {
  const element = document.createElement('div');
  const thumbnail = document.createElement('canvas');
  const label = document.createElement('div');
  const size = document.createElement('div');
  const badge = document.createElement('div');
  element.className = 'library-card';
  element.title = title;
  thumbnail.width = THUMBNAIL_WIDTH;
  thumbnail.height = THUMBNAIL_HEIGHT;
  drawThumbnail(thumbnail, entry);
  label.className = 'card-name';
  label.textContent = name;
  size.className = 'card-size';
  size.textContent = `${entry.cells.length} cell${entry.cells.length === 1 ? '' : 's'} · ` +
    `${formatBiomass(designCost(entry))} biomass`;
  badge.className = 'card-badge';
  badge.textContent = 'Over the limits';
  for (const child of [thumbnail, label, size, badge]) element.appendChild(child);
  return { entry, element, badge };
}

// a small button on a card; its click doesn't reach the card
function makeCardButton(text, title, onClick) {
  const button = document.createElement('button');
  button.className = 'small';
  button.textContent = text;
  button.title = title;
  button.onclick = event => {
    event.stopPropagation();                              // don't use the card's entry as well
    onClick();
  };
  return button;
}

// Marks the part held as a stamp, and badges the creatures that break the chosen level's limits (the badge says
// why). Called whenever the panel is drawn, as the limits change with the level and Unlimited biomass.
function showLibraryMarks(app) {
  const isUnlimited = app.edited.biomassLimit === Infinity;              // the Sandbox takes any size
  const limits = isUnlimited ? { ...chosenLimits(app), budget: Infinity, kit: null } : chosenLimits(app);
  for (const { entry, element, badge } of app.libraryCards) {
    element.classList.toggle('selected', !!app.stamp && app.stamp.template === entry);
    const problem = entry.isCreature === false ? null : buildCheck(entry, limits);
    badge.style.display = problem ? '' : 'none';
    badge.title = problem || '';
  }
}

// a small picture of an entry: one dot per cell, in the cell's colour
function drawThumbnail(canvas, entry) {
  const context = canvas.getContext('2d');
  const points = entry.cells.map(cell => hexToPixel(cell.q, cell.r));
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  const scale = Math.min(THUMBNAIL_MAX_SCALE, (canvas.width - 8) / (right - left + 2 * CELL_RADIUS),
    (canvas.height - 8) / (bottom - top + 2 * CELL_RADIUS));
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.translate(canvas.width / 2, canvas.height / 2);
  context.scale(scale, scale);
  context.translate(-(left + right) / 2, -(top + bottom) / 2);
  entry.cells.forEach((cell, i) => {
    context.fillStyle = CELLS[cell.typeName].color;
    fillCircle(context, points[i][0], points[i][1], CELL_RADIUS * 0.9);
  });
  context.restore();
}

// ---------- Using the library ----------
// A creature replaces the design. A part goes to the clicked Bud, or else is picked up as a stamp (clicking the stamp
// in hand again puts it down). Either way the screen closes, to show the Lab.
function useLibraryEntry(app, entry) {
  closeLibrary(app);
  if (entry.isCreature) {
    loadDesign(app, entry, entry.name, entry.name);
    return;
  }
  const focused = app.focusKey && app.edited.cells.get(app.focusKey);
  if (focused && CELLS[focused.typeName].growsParts) {
    showProblem(app, giveBudPart(app.edited, app.focusKey, entry));
    return;
  }
  app.stamp = app.stamp && app.stamp.template === entry ? null : { template: entry, rotation: 0 };
  refreshPanel(app);
}

// Save this creature (the button, the Lab's Esc menu, Ctrl+S): asks for a name, then keeps the Lab's whole
// design in My creatures. A name another saved creature has asks before overwriting it; the creature's own name
// (the one it was loaded or saved as) just saves again.
function saveBuilderCreature(app) {
  const creatureCount = app.library.filter(entry => entry.isCreature).length;
  askForName({ title: 'Save this creature', text: 'It goes into My creatures, on the Templates screen.',
    confirmLabel: 'Save' }, app.lastLoadedName || `Creature ${creatureCount + 1}`, typed => {
    const name = cleanName(typed);
    if (!name) return;
    const store = () => {
      storeTemplate(app.library, { ...builderDesignEntry(app), name });
      app.lastLoadedName = name;
      app.libraryTab = 'creatures';
      saveAndShowLibrary(app);
      showMessage(`Saved "${name}" in My creatures.`);
      playSound(app, 'place');
    };
    const isTaken = app.library.some(entry => entry.isCreature && entry.name === name);
    if (!isTaken || name === app.lastLoadedName) {
      store();
      return;
    }
    askToConfirm({ title: 'Overwrite it?', text: `My creatures already has "${name}". Saving replaces it.`,
      confirmLabel: 'Overwrite', isDangerous: true }, store);
  });
}

// asks for a new name in the game's own box; an empty name keeps the old one
function renameLibraryEntry(app, entry) {
  const kind = entry.isCreature ? 'creature' : 'part';
  askForName({ title: `Rename this ${kind}`, text: `A new name for "${entry.name}".`, confirmLabel: 'Rename' },
    entry.name, name => {
      if (!cleanName(name)) return;
      entry.name = cleanName(name);
      saveAndShowLibrary(app);
    });
}

// asks, then deletes a library entry
function removeLibraryEntry(app, entry) {
  const kind = entry.isCreature ? 'creature' : 'part';
  askToConfirm({
    title: `Delete this ${kind}?`,
    text: `"${entry.name}" leaves ${entry.isCreature ? 'My creatures' : 'My parts'} for good.`,
    confirmLabel: 'Delete',
    isDangerous: true,
  }, () => {
    app.library = app.library.filter(other => other !== entry);
    if (app.stamp && app.stamp.template === entry) app.stamp = null;
    saveAndShowLibrary(app);
  });
}

// saves the library and shows it again
function saveAndShowLibrary(app) {
  saveLibrary(app.library);
  showLibraryTab(app, app.libraryTab);
  refreshPanel(app);
}
