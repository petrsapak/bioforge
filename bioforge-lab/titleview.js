'use strict';
// The title screen: the living scene (titlescene.js) drawn full screen behind the main menu, with a camera drifting
// from creature to creature, and the screen dimming to black and back when the player goes from the title into the
// lab or back (browser only).

const TITLE_VIEW_WIDTH = 1150;                            // px of water across the screen
const TITLE_FOCUS_TIME = 11;                              // real s the camera follows one subject
const TITLE_CAMERA_EASE = 0.35;                           // share per real s of the way to the subject the camera goes
const TITLE_SUBJECT_SHIFT = 0.17;                         // share of the screen's width the subject sits right of the
                                                          // middle, clear of the menu on the left
const TITLE_BACKGROUND = '#0a171d';
const FADE_INTO_TITLE = 0.35;                             // real s to black when the main menu opens over the game
const FADE_FROM_BLACK_AT_START = 1.4;                     // real s from black to the title when the game starts
const FADE_OUT_OF_TITLE = 0.5;                            // real s from the title to black
const FADE_INTO_LAB = 0.9;                                // real s from black to the lab

// what titleview.js keeps in the app
function createTitleView() {
  return {
    scene: null,                                          // the living scene, made when the title first shows
    cameraX: 0,                                           // px in the water: the middle of the screen
    cameraY: 0,
    focusIndex: 0,                                        // which of titleSubjects() the camera follows
    focusTime: 0,                                         // real s it has followed it
    fade: { opacity: 0, from: 0, to: 0, duration: 0, elapsed: 0, then: null },   // the black over the screen
  };
}

// the title is shown while the main menu is open
const isTitleShown = app => app.menu.open === 'main';

// makes the scene the first time, with the camera on the light
function wakeTitleScene(app) {
  const title = app.title;
  if (title.scene) return;
  title.scene = createTitleScene();
  title.cameraX = title.scene.world.light.x;
  title.cameraY = title.scene.world.light.y;
}

// One frame of the title: the scene steps in real time and is drawn under the menu.
function runTitleFrame(app, dt) {
  wakeTitleScene(app);
  const scene = app.title.scene;
  const stepCount = Math.ceil(dt / SANDBOX_MAX_STEP - 1e-6);
  for (let i = 0; i < stepCount; i++) stepTitleScene(scene, dt / stepCount);
  moveTitleCamera(app, dt);
  drawTitleScene(app);
}

// The camera eases toward its subject and moves on to the next one after a while, never showing past the walls.
function moveTitleCamera(app, dt) {
  const title = app.title;
  const subjects = titleSubjects(title.scene);
  title.focusTime += dt;
  if (title.focusTime > TITLE_FOCUS_TIME) {
    title.focusTime = 0;
    title.focusIndex++;
  }
  const subject = subjects[title.focusIndex % subjects.length];
  const share = 1 - Math.exp(-TITLE_CAMERA_EASE * dt);
  const { scale } = titleView(app);
  const subjectShift = TITLE_SUBJECT_SHIFT * app.canvas.width / scale;
  title.cameraX += (subject.x - subjectShift - title.cameraX) * share;
  title.cameraY += (subject.y - title.cameraY) * share;
  const world = title.scene.world;
  const halfWidth = app.canvas.width / scale / 2;
  const halfHeight = app.canvas.height / scale / 2;
  title.cameraX = Math.max(halfWidth, Math.min(world.width - halfWidth, title.cameraX));
  title.cameraY = Math.max(halfHeight, Math.min(world.height - halfHeight, title.cameraY));
}

// how big the water is drawn: TITLE_VIEW_WIDTH across, but never so small that the screen shows past the walls
function titleView(app) {
  const world = app.title.scene.world;
  const scale = Math.max(app.canvas.width / TITLE_VIEW_WIDTH, app.canvas.width / world.width,
    app.canvas.height / world.height);
  return { scale };
}

// the water with its drifting motes, then the light, the nerves and the creatures, all through the camera
function drawTitleScene(app) {
  const context = app.context;
  const title = app.title;
  const world = title.scene.world;
  const { scale } = titleView(app);
  const width = app.canvas.width;
  const height = app.canvas.height;
  drawWater(context, world, width, height, title.cameraX * scale, title.cameraY * scale, TITLE_BACKGROUND);
  const halfWidth = width / scale / 2;
  const halfHeight = height / scale / 2;
  context.save();
  context.translate(width / 2, height / 2);
  context.scale(scale, scale);
  context.translate(-title.cameraX, -title.cameraY);
  drawLight(context, world.light, false);
  drawWorldFibres(context, world);
  drawWorld(context, world, 0, { minX: title.cameraX - halfWidth, maxX: title.cameraX + halfWidth,
    minY: title.cameraY - halfHeight, maxY: title.cameraY + halfHeight }, false);
  context.restore();
}

// ---------- Dimming ----------
// Fades the black over the screen to an opacity (0 clear, 1 black) over some real seconds, then calls then().
function fadeScreen(app, to, duration, then = null) {
  const fade = app.title.fade;
  Object.assign(fade, { from: fade.opacity, to, duration, elapsed: 0, then });
}

// whether the screen is dimming toward an action that hasn't run yet (a fade that only clears the screen doesn't count)
const isDimmingToAction = app => app.title.fade.then !== null;

// moves the fade on by a frame, and shows it
function updateScreenFade(app, dt) {
  const fade = app.title.fade;
  if (fade.opacity !== fade.to) {
    fade.elapsed += dt;
    const progress = fade.duration > 0 ? Math.min(1, fade.elapsed / fade.duration) : 1;
    const eased = progress * progress * (3 - 2 * progress);
    fade.opacity = progress >= 1 ? fade.to : fade.from + (fade.to - fade.from) * eased;
  }
  const overlay = byId('screen-fade');
  overlay.style.opacity = String(fade.opacity);
  overlay.style.display = fade.opacity > 0 ? 'block' : 'none';
  if (fade.opacity !== fade.to || !fade.then) return;
  const then = fade.then;
  fade.then = null;
  then();
}

// From the title into the lab: a soft sound, the screen dims to black, the action runs (the menu closes, the lab
// or the run is set up), and the lab fades in. Clicks during the dimming are ignored.
function leaveTitle(app, action) {
  if (app.title.fade.then) return;
  playSound(app, 'enterLab');
  byId('menu-sheet').classList.add('leaving');
  fadeScreen(app, 1, FADE_OUT_OF_TITLE, () => {
    byId('menu-sheet').classList.remove('leaving');
    action();
    fadeScreen(app, 0, FADE_INTO_LAB);
  });
}

// From the game back to the title: the screen dims, the title opens behind the black, and it fades in.
function enterTitle(app, showMenu) {
  if (app.title.fade.then) return;
  fadeScreen(app, 1, FADE_INTO_TITLE, () => {
    showMenu();
    fadeScreen(app, 0, FADE_FROM_BLACK_AT_START);
  });
}

// the game's first frames: the title comes up out of black
function fadeInAtStart(app) {
  app.title.fade.opacity = 1;
  fadeScreen(app, 0, FADE_FROM_BLACK_AT_START);
}

// While the title shows, the builder's windows are hidden (they would sit on the scene).
function showTitleLayout(app) {
  const isShown = isTitleShown(app);
  byId('menu-sheet').classList.toggle('title-screen', isShown);
  if (document.body) document.body.classList.toggle('title-shown', isShown);
}
