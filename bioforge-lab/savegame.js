'use strict';
// What the game keeps beyond its settings: the save's version and the steps that upgrade older saves, the players'
// profiles, the state Continue picks up (the builder's design, the chosen level, a running level or Sandbox), and
// creature files (pure).

const SAVE_VERSION = 2;                                   // the save's format; a new one adds a step to SAVE_UPGRADES
const PROFILE_KEYS = ['continue', 'level-results', 'library', 'quicksave'];   // kept per profile; the rest is shared
const FIRST_PROFILE_NAME = 'Player';                      // the profile an older save moves into
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
  // 1 → 2 (2026-10-30): the save became profiles; what there was moves into the first one
  (read, write) => {
    for (const name of PROFILE_KEYS) {
      const value = read(name, null);
      if (value === null) continue;
      write(profileKey(1, name), value);
      write(name, null);
    }
    write('profiles', createProfiles());
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

// ---------- Profiles ----------
// The one place the profile list is built: one profile, the first player's. list: [{ id, name }] in the order they
// were added; current: the id of the profile playing; nextId: the id the next new profile gets (ids are never reused,
// so a deleted profile's saves can't come back under a new one).
function createProfiles() {
  return { list: [{ id: 1, name: FIRST_PROFILE_NAME }], current: 1, nextId: 2 };
}

// the storage name a profile's value is kept under
const profileKey = (id, name) => `profile-${id}-${name}`;

// the storage name a value is kept under: the current profile's own for PROFILE_KEYS, the shared one otherwise
function storageName(profiles, name) {
  return profiles && PROFILE_KEYS.includes(name) ? profileKey(profiles.current, name) : name;
}

const currentProfile = profiles => profiles.list.find(profile => profile.id === profiles.current);

// the profiles with a new one added and made current
function addProfile(profiles, name) {
  const id = profiles.nextId;
  return { list: [...profiles.list, { id, name }], current: id, nextId: id + 1 };
}

function renameProfile(profiles, id, name) {
  return { ...profiles, list: profiles.list.map(profile => (profile.id === id ? { ...profile, name } : profile)) };
}

function switchProfile(profiles, id) {
  return profiles.list.some(profile => profile.id === id) ? { ...profiles, current: id } : profiles;
}

// The profiles without this one; the last one can't go. Deleting the current profile makes the first one current.
function removeProfile(profiles, id) {
  if (profiles.list.length <= 1) return profiles;
  const list = profiles.list.filter(profile => profile.id !== id);
  return { ...profiles, list, current: profiles.current === id ? list[0].id : profiles.current };
}

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
  return { mode, levelDesign, snapshot: JSON.stringify(takeSnapshot(run, runDataIndex())) };
}

// the level run or the Sandbox's { world, player } that savedRun kept
function restoredRun(saved) {
  return restoreSnapshot(JSON.parse(saved.snapshot), runDataIndex());
}

// The saved resume state, ready to use, or null if there is none or it can't be read. Its design is brought to the
// current format. A run saved by another version of the game is dropped, since the sim may have changed under it;
// the design and the level stay.
function readResumeState(saved) {
  if (!saved || typeof saved !== 'object' || !(saved.version <= SAVE_VERSION)) return null;
  const design = saved.design && checkedDesign(saved.design);
  if (!design) return null;
  const levelId = LEVELS.some(level => level.id === saved.levelId) ? saved.levelId : null;
  const isRunUsable = !!saved.run && saved.gameVersion === GAME_VERSION && (saved.run.mode !== 'level' || levelId);
  return createResumeState(design, levelId, isRunUsable ? saved.run : null);
}

// ---------- Creature files ----------
// a library entry as the text of a creature file
function creatureFileText(entry) {
  const creature = { name: entry.name, cells: entry.cells, fibres: entry.fibres || [], vessels: entry.vessels || [] };
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

// A saved design ({ name, cells, fibres, vessels }) as a library entry in the current format, or null if it is
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
