'use strict';
// What the game keeps beyond its settings: the save's version and the steps that upgrade older saves, the games
// (each with its own creatures, level results and saved run), the state Continue picks up (the builder's design,
// the chosen level, a running level or Sandbox), and creature files (pure).

const SAVE_VERSION = 3;                                   // the save's format; a new one adds a step to SAVE_UPGRADES
// kept per game; the rest is shared
const GAME_KEYS = ['continue', 'level-results', 'library', 'quicksave', 'tutorial', 'briefed-levels'];
const CREATURE_FILE_KIND = 'bioforge-lab-creature';       // marks a JSON file as a creature saved by this game
const CREATURE_FILE_VERSION = 1;                          // the creature file's format
const CREATURE_FILE_EXTENSION = '.bioforge.json';

// Steps from one save version to the next: SAVE_UPGRADES[i] turns a save of version i into version i + 1.
// read(name, fallback) and write(name, value) reach the stored values (readStorage and writeStorage in the game).
const SAVE_UPGRADES = [
  // 0 → 1 (2026-10-30): the library is stored in the current design format, which loadLibrary used to convert to
  // every time it read the library
  (read, write) => {
    const library = read('library', null);
    if (Array.isArray(library)) write('library', library.map(migrateLibraryEntry));
  },
  // 1 → 2 (2026-10-30): the save became profiles; what there was moves into the first one, "Player"
  (read, write) => {
    for (const name of GAME_KEYS) {
      const value = read(name, null);
      if (value === null) continue;
      write(`profile-1-${name}`, value);
      write(name, null);
    }
    write('profiles', { list: [{ id: 1, name: 'Player' }], current: 1, nextId: 2 });
  },
  // 2 → 3 (2026-11-01): profiles became games, numbered instead of named; each keeps its id and its values
  (read, write) => {
    const profiles = read('profiles', null);
    if (!profiles) return;
    for (const profile of profiles.list) {
      for (const name of GAME_KEYS) {
        const value = read(`profile-${profile.id}-${name}`, null);
        if (value === null) continue;
        write(gameKey(profile.id, name), value);
        write(`profile-${profile.id}-${name}`, null);
      }
    }
    write('games', { list: profiles.list.map(profile => ({ id: profile.id, playedAt: 0 })),
      current: profiles.current, nextId: profiles.nextId });
    write('profiles', null);
  },
];

// Brings the stored save up to SAVE_VERSION; a save from a newer game is left as it is. Returns the version found.
function upgradeStoredSave(read, write) {
  const version = read('save-version', 0);
  if (version >= SAVE_VERSION) return version;
  for (let i = version; i < SAVE_VERSION; i++) SAVE_UPGRADES[i](read, write);
  write('save-version', SAVE_VERSION);
  return version;
}

// ---------- Games ----------
// The one place the game list is built: one game, not played yet. list: [{ id, playedAt }] in the order they were
// started, playedAt in ms since 1970 (0: not yet); current: the id of the game playing; nextId: the id the next new
// game gets (ids are never reused, so a deleted game's saves can't come back under a new one).
function createGames() {
  return { list: [{ id: 1, playedAt: 0 }], current: 1, nextId: 2 };
}

// the storage name a game's value is kept under
const gameKey = (id, name) => `game-${id}-${name}`;

// the storage name a value is kept under: the current game's own for GAME_KEYS, the shared one otherwise
function storageName(games, name) {
  return games && GAME_KEYS.includes(name) ? gameKey(games.current, name) : name;
}

const currentGame = games => games.list.find(game => game.id === games.current);

// what the Load game screen calls a game
const gameName = game => `Game ${game.id}`;

// the games with a new one added and made current, played at playedAt
function addGame(games, playedAt) {
  const id = games.nextId;
  return { list: [...games.list, { id, playedAt }], current: id, nextId: id + 1 };
}

// the games with this one current and played at playedAt; an unknown id changes nothing
function switchGame(games, id, playedAt) {
  if (!games.list.some(game => game.id === id)) return games;
  return { ...games, current: id, list: games.list.map(game => (game.id === id ? { ...game, playedAt } : game)) };
}

// The games without this one. Deleting the current game makes the one played last current; deleting the last one
// leaves a new game, not played yet, so there is always a game to keep the Lab in.
function removeGame(games, id) {
  const list = games.list.filter(game => game.id !== id);
  if (!list.length) return addGame({ ...games, list }, 0);
  if (games.current !== id) return { ...games, list };
  const latest = list.reduce((best, game) => (game.playedAt > best.playedAt ? game : best));
  return { ...games, list, current: latest.id };
}

// the games, the one played last first (ties: the newer game first)
function gamesByLastPlayed(games) {
  return [...games.list].sort((first, second) => second.playedAt - first.playedAt || second.id - first.id);
}

// What the Load game screen says about one game, from its saved values: levelsWon and stars over all levels; chapter:
// the chapter of the first level not won yet (null once all are won); creatures: how many it keeps; leftIn: the name
// of the level it was left in, or null (the Lab with no level); design: the creature left in the Lab, or null.
function gameSummary(resumeState, levelResults, library) {
  const results = levelResults || {};
  const won = LEVELS.filter(level => results[level.id]);
  const nextLevel = LEVELS.find(level => !results[level.id]);
  const state = readResumeState(resumeState);
  const leftInLevel = state && LEVELS.find(level => level.id === state.levelId);
  return {
    levelsWon: won.length,
    stars: won.reduce((sum, level) => sum + (results[level.id].stars || 0), 0),
    chapter: nextLevel ? nextLevel.chapter : null,
    creatures: Array.isArray(library) ? library.filter(entry => entry.isCreature).length : 0,
    leftIn: leftInLevel ? leftInLevel.name : null,
    design: state ? state.design : null,
  };
}

// whether a game has nothing saved yet, so New game can use it instead of adding another
const isUnplayedGame = (resumeState, levelResults, library) => !resumeState &&
  !Object.keys(levelResults || {}).length && !(Array.isArray(library) && library.length);

// ---------- Continue ----------
// The one place the state Continue picks up is built. design: the builder's design as a library entry; levelId: the
// chosen level's id, or null in free build; run: savedRun()'s result for a running level or Sandbox, or null.
function createResumeState(design, levelId, run = null) {
  return { version: SAVE_VERSION, gameVersion: GAME_VERSION, design, levelId, run };
}

// every object of the game's data that a running world points at, so that a restored world points at the same ones
function runDataIndex() {
  return indexDataObjects({ CELLS, NEURONS, MATERIALS, FLUIDS, RULES, LEVELS, LEVEL_CREATURES, TEMPLATES });
}

// A running level or Sandbox as plain data. mode: 'level' or 'sandbox'; run: the level run, or the Sandbox's
// { world, player }; levelDesign: the design a level runs (for Retry and the score). The snapshot is kept as one JSON
// text: it nests deeply, and the desktop save file is written indented.
function savedRun(mode, run, levelDesign) {
  const levelKey = mode === 'level' ? levelFingerprint(run.level) : null;
  return { mode, levelDesign, levelKey, snapshot: JSON.stringify(takeSnapshot(run, runDataIndex())) };
}

// the level run or the Sandbox's { world, player } that savedRun kept
function restoredRun(saved) {
  return restoreSnapshot(JSON.parse(saved.snapshot), runDataIndex());
}

// A short text that changes whenever the level's data does (FNV-1a over its JSON). A run keeps its own state per
// creature, pickup and wave in the level's order, so it can't go on in a level whose data changed under it.
function levelFingerprint(level) {
  const text = JSON.stringify(level);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return hash.toString(16);
}

// The saved resume state, ready to use, or null if there is none or it can't be read. Its design is brought to the
// current format. A run saved by another version of the game, or in a level whose data has changed since, is
// dropped, since the sim may have changed under it; the design and the level stay.
function readResumeState(saved) {
  if (!saved || typeof saved !== 'object' || !(saved.version <= SAVE_VERSION)) return null;
  const design = saved.design && checkedDesign(saved.design);
  if (!design) return null;
  const level = LEVELS.find(entry => entry.id === saved.levelId);
  const levelId = level ? level.id : null;
  const isLevelRunUsable = run => !!level && run.levelKey === levelFingerprint(level);
  const isRunUsable = !!saved.run && saved.gameVersion === GAME_VERSION &&
    (saved.run.mode !== 'level' || isLevelRunUsable(saved.run));
  return createResumeState(design, levelId, isRunUsable ? saved.run : null);
}

// ---------- Creature files ----------
// a library entry as the text of a creature file
function creatureFileText(entry) {
  const creature = { name: entry.name, cells: entry.cells, fibres: entry.fibres || [] };
  return JSON.stringify({ kind: CREATURE_FILE_KIND, version: CREATURE_FILE_VERSION, gameVersion: GAME_VERSION,
    creature });
}

// the file name a creature is saved under: its name, with only letters, digits, spaces, - and _
function creatureFileName(entry) {
  const safeName = entry.name.replace(/[^A-Za-z0-9 _-]/g, '').trim() || 'creature';
  return safeName + CREATURE_FILE_EXTENSION;
}

// The library entry in a creature file's text: { entry }, or { problem } saying why it can't be loaded.
function readCreatureFile(text) {
  let file = null;
  try {
    file = JSON.parse(text);
  } catch (error) {
    return { problem: "That file isn't a creature file." };
  }
  if (!file || file.kind !== CREATURE_FILE_KIND || !file.creature) {
    return { problem: "That file isn't a Bioforge Lab creature." };
  }
  if (!(file.version <= CREATURE_FILE_VERSION)) {
    return { problem: 'That creature was saved by a newer version of the game.' };
  }
  const entry = checkedDesign(file.creature);
  if (!entry) return { problem: "That creature file is damaged, or uses cells this game doesn't have." };
  return { entry };
}

// A saved design ({ name, cells, fibres }) as a library entry in the current format, or null if it is
// damaged: no cells, a cell off the grid, or a cell type or neuron this game doesn't have.
function checkedDesign(saved) {
  if (!Array.isArray(saved.cells) || !saved.cells.length) return null;
  let entry = null;
  try {
    entry = migrateLibraryEntry({ ...saved, name: saved.name || '', isCreature: true });
  } catch (error) {
    return null;
  }
  if (!entry.cells.every(isKnownCell)) return null;
  entry.isCreature = entry.cells.some(cell => CELLS[cell.typeName].isNucleus);
  return entry;
}

// whether a design cell, and the cells of the part its Bud grows, use only what this game has
function isKnownCell(cell) {
  if (!cell || !Number.isInteger(cell.q) || !Number.isInteger(cell.r)) return false;
  if (!Object.hasOwn(CELLS, cell.typeName)) return false;
  if (cell.neuron && !Object.hasOwn(NEURONS, cell.neuron.kind)) return false;
  return !cell.budPart || (Array.isArray(cell.budPart.cells) && cell.budPart.cells.every(isKnownCell));
}
