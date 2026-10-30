'use strict';
// The template library window's saved entries (My creatures and My parts), kept in localStorage (browser only).
// Entries are { name, isCreature, cells } (see design.js); the editing rules for them are in builder.js.

// Bioforge Moba and Lab before 2026-10-28 kept the library here, in the old format. Pages opened from disk can share
// storage, so Lab reads that list once to carry it over, and never writes to it (Moba still uses it).
const OLD_LIBRARY_STORAGE_KEY = 'bioforge-templates';
const THUMBNAIL_SIZE = 80;                                // px
const THUMBNAIL_MAX_SCALE = 3;

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

function saveLibrary(library) {
  writeStorage('library', library);
}

// Fills My creatures and My parts with one row per entry. actions: { use(entry), rename(entry), remove(entry),
// startDrag(entry) }. Returns the rows, each with its entry.
function showLibrary(library, actions) {
  const creaturesBox = byId('my-creatures');
  const partsBox = byId('my-parts');
  creaturesBox.innerHTML = library.some(entry => entry.isCreature)
    ? ''
    : '<div class="help">No creatures saved yet: right-click the Nucleus to save one.</div>';
  partsBox.innerHTML = library.some(entry => !entry.isCreature) ? '' : '<div class="help">Nothing saved yet.</div>';
  return library.map(entry => {
    const row = makeLibraryRow(entry, actions);
    (entry.isCreature ? creaturesBox : partsBox).appendChild(row);
    return { entry, row };
  });
}

function makeLibraryRow(entry, actions) {
  const row = document.createElement('div');
  const thumbnail = document.createElement('canvas');
  const label = document.createElement('span');
  const renameButton = makeRowButton('✎', 'Rename', () => actions.rename(entry));
  const deleteButton = makeRowButton('✕', 'Delete', () => actions.remove(entry));
  row.className = 'library-row';
  row.title = entry.isCreature
    ? 'Click to load this creature'
    : 'Click to stamp this part onto your creature, or drag it onto a Bud to make the Bud grow it';
  thumbnail.width = THUMBNAIL_SIZE;
  thumbnail.height = THUMBNAIL_SIZE;
  drawThumbnail(thumbnail, entry);
  label.textContent = `${entry.name} (${entry.cells.length}${entry.isCreature ? ', creature' : ''})`;
  row.onclick = () => actions.use(entry);
  row.onmousedown = event => {                            // dragging a part onto a Bud
    if (event.button !== 0 || (event.target.closest && event.target.closest('button'))) return;
    actions.startDrag(entry);
    event.preventDefault();
  };
  for (const child of [thumbnail, label, renameButton, deleteButton]) row.appendChild(child);
  return row;
}

function makeRowButton(text, title, onClick) {
  const button = document.createElement('button');
  button.className = 'small';
  button.textContent = text;
  button.title = title;
  button.onclick = event => {
    event.stopPropagation();                              // don't use the row's entry as well
    onClick();
  };
  return button;
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
