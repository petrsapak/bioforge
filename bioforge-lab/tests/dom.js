'use strict';
// A fake browser for headless UI tests: elements made on demand by id, event listeners, a 2D context that ignores
// every drawing call, and a requestAnimationFrame queue that runFrames() steps at 16 ms per frame.
const vm = require('vm');
const { load } = require('./load');

const FRAME_MS = 16;                                      // ms per fake animation frame
const SCREEN_WIDTH = 1600;                                // px
const SCREEN_HEIGHT = 900;                                // px
const LEAVE_TITLE_FRAMES = 40;                            // frames for the title to dim to black (0.5 s) and close

// A 2D canvas context that accepts every call and property and draws nothing. A call returns the context itself, so
// what a call makes (a gradient) accepts calls too.
function createIgnoringContext() {
  // pixel data is real, so that code filling it in (the chemical lens) runs as in a browser
  const createImageData = (width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) });
  const context = new Proxy({ createImageData }, {
    get: (target, name) => (name in target ? target[name] : () => context),
    set: (target, name, value) => {
      target[name] = value;
      return true;
    },
  });
  return context;
}

// a fake element.classList over a Set
function createClassList() {
  const names = new Set();
  return {
    add: name => names.add(name),
    remove: name => names.delete(name),
    contains: name => names.has(name),
    toggle(name, force) {
      const isOn = force === undefined ? !names.has(name) : force;
      if (isOn) names.add(name);
      else names.delete(name);
      return isOn;
    },
  };
}

// listeners by target name ('window' or an element id) and event type
function createListeners() {
  const byTarget = new Map();
  const listKey = (target, type) => target + ':' + type;
  return {
    add(target, type, handler) {
      const key = listKey(target, type);
      if (!byTarget.has(key)) byTarget.set(key, []);
      byTarget.get(key).push(handler);
    },
    fire(target, type, event) {
      for (const handler of byTarget.get(listKey(target, type)) || []) handler(event);
    },
  };
}

// a fake element with a style, children, listeners and the shared 2D context
function createElement(id, listeners, context) {
  let html = '';
  return {
    id,
    style: { setProperty() {} },
    dataset: {},
    classList: createClassList(),
    get innerHTML() {
      return html;
    },
    set innerHTML(value) {                                // like a browser: new HTML replaces the children
      html = value;
      this.children = [];
    },
    // the fake keeps text and HTML as one string: setting either replaces the other, as in a browser
    get textContent() {
      return html;
    },
    set textContent(value) {
      html = String(value);
      this.children = [];
    },
    value: '',
    children: [],
    width: 0,
    height: 0,
    onclick: null,
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    addEventListener(type, handler) {
      listeners.add(id, type, handler);
    },
    getContext: () => context,
    querySelector: () => null,
    closest: () => null,
  };
}

// an event with the given fields that can be prevented and stopped
const fakeEvent = (fields = {}) => ({ preventDefault() {}, stopPropagation() {}, ...fields });

// a localStorage holding the given items (key -> text)
function createStorage(items) {
  return {
    items,
    getItem: key => (key in items ? items[key] : null),
    setItem: (key, value) => {
      items[key] = String(value);
    },
  };
}

// Starts the whole app in the fake browser (game.js boots it, since the fake has a `window`).
// templateNames: the built-in design buttons ([data-template]) to make; storedItems: what localStorage holds.
// The game starts at the main menu, and Free build closes it (after the screen dims, LEAVE_TITLE_FRAMES) unless
// options.atMainMenu keeps it open.
// options.window: more fields of window, such as the desktop build's desktopWindow.
function startApp(templateNames, storedItems = {}, options = {}) {
  const storage = createStorage(storedItems);
  const listeners = createListeners();
  const context2d = createIgnoringContext();
  const elements = new Map();
  const byId = id => {
    if (!elements.has(id)) elements.set(id, createElement(id, listeners, context2d));
    return elements.get(id);
  };
  const templateButtons = templateNames.map(name => {
    const button = createElement('template-' + name, listeners, context2d);
    button.dataset.template = name;
    button.textContent = name[0].toUpperCase() + name.slice(1);
    return button;
  });
  const document = {
    getElementById: byId,
    createElement: () => createElement('unnamed', listeners, context2d),
    querySelectorAll: selector => (selector === '[data-template]' ? templateButtons : []),
  };
  const frameQueue = [];
  let now = Date.now();
  const scope = load({
    document,
    window: { ...options.window },
    innerWidth: SCREEN_WIDTH,
    innerHeight: SCREEN_HEIGHT,
    performance: { now: () => now },
    requestAnimationFrame: callback => frameQueue.push(callback),
    addEventListener: (type, handler) => listeners.add('window', type, handler),
    localStorage: storage,
    prompt: () => null,
    confirm: () => true,
  });
  const runFrames = count => {
    for (let i = 0; i < count; i++) {
      now += FRAME_MS;
      frameQueue.shift()(now);
    }
  };
  const fire = (target, type, fields) => listeners.fire(target, type, fakeEvent(fields));
  const templateButton = name => templateButtons[templateNames.indexOf(name)];
  // a top-level name of the game's scripts (consts aren't properties of the global scope, so they are evaluated)
  const readGlobal = name => vm.runInContext(name, scope);
  if (!options.atMainMenu) {
    byId('menu-free-build').onclick({});
    runFrames(LEAVE_TITLE_FRAMES);
  }
  return { byId, fire, runFrames, templateButton, readGlobal, storage };
}


module.exports = { startApp, SCREEN_WIDTH, SCREEN_HEIGHT, LEAVE_TITLE_FRAMES };
