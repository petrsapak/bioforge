'use strict';
// Sound effects (full app, fake DOM): every effect has its files, a run's start and a creature's Siphon strokes are
// heard (the strokes waiting out their gap), and the toolbar button and N switch them off, remembered on the next
// visit.
const fs = require('fs');
const path = require('path');
const { startApp, SCREEN_WIDTH, SCREEN_HEIGHT } = require('./dom');
const { check, done } = require('./check');

// replaces playSound with a copy that also writes down every sound that really plays (not off, not too soon), by its
// gap key: its name, plus ' other' for other creatures'
function recordSounds(app) {
  app.readGlobal(`playSound = (original => (app, name, loudness, gapKey = name) => {
    const before = app.soundPlayedAt[gapKey];
    original(app, name, loudness, gapKey);
    if (app.soundPlayedAt[gapKey] !== before) (globalThis.heard ??= []).push(gapKey);
  })(playSound)`);
  return () => app.readGlobal('globalThis.heard ?? []');
}

const first = startApp();
const effects = first.readGlobal('SOUND_EFFECTS');
const variants = Object.values(effects).flatMap(effect => effect.variants);
const missing = variants.filter(variant => !fs.existsSync(path.join(__dirname, '..', variant.file)));
check('every sound effect has its files', missing.length === 0, missing.map(variant => variant.file).join(', '));

const heard = recordSounds(first);
first.runFrames(5);
first.templateButton('jet').onclick();
first.runFrames(5);
first.byId('start-sandbox').onclick();
check('starting the Sandbox is heard', heard().includes('start'), heard().join(' '));
first.runFrames(240);
const strokes = heard().filter(name => name === 'stroke').length;
check('the Jet\'s Siphons are heard stroking, but not every frame', strokes >= 3 && strokes < 60, `${strokes} strokes`);

first.byId('sandbox-enemy').value = 'squirter';
first.fire('game', 'mousedown', { clientX: SCREEN_WIDTH / 2 + 150, clientY: SCREEN_HEIGHT / 2, button: 0 });
first.runFrames(300);
const otherStrokes = heard().filter(name => name === 'stroke other').length;
check('another creature\'s Siphons are heard too', otherStrokes >= 2, `${otherStrokes} strokes`);


// a Spitter and a Snarer hunting the player: their spits, shots and catches are heard (the Sandbox's enemy list
// doesn't offer them, but the fake select takes any design name; players meet them as their own builds)
const hunted = startApp();
const huntedHeard = recordSounds(hunted);
hunted.runFrames(5);
hunted.templateButton('jet').onclick();
hunted.runFrames(5);
hunted.byId('start-sandbox').onclick();
for (const [design, offsetX] of [['spitter', -200], ['snarer', 200]]) {
  hunted.byId('sandbox-enemy').value = design;
  hunted.fire('game', 'mousedown', { clientX: SCREEN_WIDTH / 2 + offsetX, clientY: SCREEN_HEIGHT / 2, button: 0 });
}
hunted.runFrames(900);
const weaponSounds = ['spit other', 'snareShot other', 'snareCatch other'].map(name =>
  `${name} ${huntedHeard().filter(heardName => heardName === name).length}`);
check('other creatures\' weapons are heard: spits, snare shots and catches',
  weaponSounds.every(entry => !entry.endsWith(' 0')), weaponSounds.join(', '));

// a level run whose goal counts up, stops (out of the ring) and counts up again: the tune plays only the first time
first.readGlobal(`globalThis.goalTest = {
  app: { soundsOff: false, soundVoices: {}, soundPlayedAt: {}, soundWatch: null },
  world: { cells: [], foodSupply: createFoodSupply() }, run: { goalTime: 0, time: 0 } }`);
const goalFrame = (time, goalTime) => {
  first.runFrames(90);                                    // 1.5 real s, longer than the tune's shortest gap
  first.readGlobal(`goalTest.run.time = ${time}; goalTest.run.goalTime = ${goalTime};
    listenToWorld(goalTest.app, goalTest.world, null, goalTest.run)`);
};
const goalTunes = () => heard().filter(name => name === 'goal').length;
goalFrame(0, 0);
goalFrame(1, 0.1);
const tunesAfterFirst = goalTunes();
goalFrame(3, 0.1);
goalFrame(5, 0.2);
check('the goal tune plays when the goal first counts up, not on coming back', tunesAfterFirst === 1 &&
  goalTunes() === 1, `${tunesAfterFirst}, then ${goalTunes()}`);

first.fire('window', 'keydown', { key: 'n' });
const heardBefore = heard().length;
first.runFrames(240);
check('N switches the sounds off', heard().length === heardBefore);

const second = startApp(first.storage.items);
check('switched off stays off on the next visit, and Settings says so',
  second.byId('setting-sounds').textContent === 'Off');
second.byId('setting-sounds').onclick({});
check('Settings switches them back on', second.byId('setting-sounds').textContent === 'On');

// a button clicks on the press (the release came about 0.1 s late); not a disabled one, nor a right press
const pressed = startApp();
const pressedHeard = recordSounds(pressed);
const clicks = () => pressedHeard().filter(name => name === 'click').length;
const pressOn = (button, mouseButton = 0) => {
  pressed.runFrames(10);                                  // longer than the click's shortest gap
  pressed.fire('window', 'pointerdown', { button: mouseButton, target: { closest: () => button } });
};
pressOn({ disabled: false });
const clicksOnPress = clicks();
pressOn({ disabled: true });
pressOn({ disabled: false }, 2);
pressOn(null);
check('pressing a button clicks at once, but not a disabled button, a right press or the water',
  clicksOnPress === 1 && clicks() === 1, `${clicksOnPress}, then ${clicks()}`);
const clickOn = detail => {
  pressed.runFrames(10);
  pressed.fire('window', 'click', { detail, target: { closest: () => ({ disabled: false }) } });
};
clickOn(1);
const clicksAfterRelease = clicks();
clickOn(0);
check('the mouse\'s release doesn\'t click again, but Enter or Space on a button does',
  clicksAfterRelease === 1 && clicks() === 2, `${clicksAfterRelease}, then ${clicks()}`);
done();
