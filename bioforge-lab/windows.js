'use strict';
// DOM helpers shared by the browser files, floating windows, and the menu tree's open branches, remembered per
// browser (browser only).

const STORAGE_PREFIX = 'bioforge-lab-';                   // every key Lab keeps in localStorage starts with this
const WINDOW_MIN_VISIBLE_WIDTH = 60;                      // px of a dragged window kept on screen
const WINDOW_MIN_VISIBLE_HEIGHT = 30;                     // px

const byId = id => document.getElementById(id);

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const escapeHtml = text => String(text).replace(/[&<>"]/g, character => HTML_ESCAPES[character]);

// Where settings and progress are kept: the desktop build's save file (desktop/preload.js gives it localStorage's
// getItem and setItem), or the browser's localStorage.
const savedStore = () => window.desktopSaves || localStorage;

// a value saved with writeStorage, or fallback if there is none (or storage is blocked)
function readStorage(name, fallback) {
  try {
    const saved = savedStore().getItem(STORAGE_PREFIX + name);
    return saved === null ? fallback : JSON.parse(saved);
  } catch (error) {
    return fallback;
  }
}

// keeps a value under name, read back with readStorage
function writeStorage(name, value) {
  try {
    savedStore().setItem(STORAGE_PREFIX + name, JSON.stringify(value));
  } catch (error) {
    // storage blocked (private mode, file:// rules): the setting just isn't remembered
  }
}

// A window dragged by its handle and resized from its corner. Its position, size and collapsed state are remembered
// under 'window-' + name, apart from any other setting. Returns save(), to call after changing the window from code.
function makeFloating(windowElement, handle, name) {
  const storageName = 'window-' + name;
  restoreWindow(windowElement, readStorage(storageName, null));
  let drag = null;
  handle.addEventListener('mousedown', event => {
    if (event.target.closest && event.target.closest('button')) return;
    drag = {
      mouseX: event.clientX,
      mouseY: event.clientY,
      left: windowElement.offsetLeft,
      top: windowElement.offsetTop,
    };
    event.preventDefault();
  });
  addEventListener('mousemove', event => {
    if (!drag) return;
    const left = drag.left + event.clientX - drag.mouseX;
    const top = drag.top + event.clientY - drag.mouseY;
    windowElement.style.left = Math.max(0, Math.min(innerWidth - WINDOW_MIN_VISIBLE_WIDTH, left)) + 'px';
    windowElement.style.top = Math.max(0, Math.min(innerHeight - WINDOW_MIN_VISIBLE_HEIGHT, top)) + 'px';
    windowElement.style.right = 'auto';
  });
  const save = () => saveWindow(windowElement, storageName);
  addEventListener('mouseup', () => {
    drag = null;
    save();
  });
  return save;
}

function restoreWindow(windowElement, saved) {
  if (!saved) return;
  Object.assign(windowElement.style, {
    left: saved.left + 'px',
    top: saved.top + 'px',
    right: 'auto',
    width: saved.width + 'px',
    height: saved.height ? saved.height + 'px' : '',
  });
  windowElement.classList.toggle('collapsed', !!saved.collapsed);
}

function saveWindow(windowElement, storageName) {
  if (!windowElement.offsetWidth) return;                 // hidden: keep what was saved
  writeStorage(storageName, {
    left: windowElement.offsetLeft,
    top: windowElement.offsetTop,
    width: parseFloat(windowElement.style.width) || windowElement.offsetWidth,
    height: parseFloat(windowElement.style.height) || 0,
    collapsed: windowElement.classList.contains('collapsed'),
  });
}

// A floating window whose –/+ button hides its body. Returns a function telling whether it is collapsed now.
function makeCollapsible(windowElement, handle, button, name) {
  const save = makeFloating(windowElement, handle, name);
  const isCollapsed = () => windowElement.classList.contains('collapsed');
  const showState = () => {
    button.textContent = isCollapsed() ? '+' : '–';
  };
  showState();
  button.onclick = () => {
    windowElement.classList.toggle('collapsed');
    showState();
    save();
  };
  return isCollapsed;
}

