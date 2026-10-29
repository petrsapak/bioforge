'use strict';
// Music (full app, fake DOM): the track waits for the first click or key, the toolbar button and M switch it off and
// on, and a switched-off track stays off on the next visit.
const { startApp } = require('./dom');
const { check, done } = require('./check');

// a fake <audio> that counts how often it is started and paused
function fakeAudio(element) {
  element.paused = true;
  element.playCount = 0;
  element.play = () => {
    element.paused = false;
    element.playCount++;
    return Promise.resolve();
  };
  element.pause = () => {
    element.paused = true;
  };
  return element;
}

const first = startApp([]);
const music = fakeAudio(first.byId('music'));
first.runFrames(2);
check('the music waits for the first click or key', music.playCount === 0);
first.fire('window', 'pointerdown', {});
check('the first click starts it', music.playCount === 1 && !music.paused);
first.fire('window', 'pointerdown', {});
check('a second click doesn\'t start it again', music.playCount === 1);
first.byId('toggle-music').onclick({});
check('the toolbar button switches it off', music.paused && first.byId('toggle-music').classList.contains('off'));
first.fire('window', 'keydown', { key: 'm' });
check('M switches it back on', !music.paused && !first.byId('toggle-music').classList.contains('off'),
  music.playCount + ' starts');
first.fire('window', 'keydown', { key: 'M' });
check('M switches it off again, and a click doesn\'t restart it', music.paused);
first.fire('window', 'pointerdown', {});
check('a click while it is off leaves it off', music.paused);

const second = startApp([], first.storage.items);
const nextMusic = fakeAudio(second.byId('music'));
second.fire('window', 'pointerdown', {});
check('switched off stays off on the next visit', nextMusic.playCount === 0 &&
  second.byId('toggle-music').classList.contains('off'));

// ---------- The seamless loop ----------
// Two copies take turns: near the end of one, the other starts inside the track and the volumes cross.
const third = startApp([]);
const copyA = fakeAudio(third.byId('music'));
const copyB = fakeAudio(third.byId('music-b'));
copyA.currentTime = 0;
third.fire('window', 'pointerdown', {});
third.runFrames(1);
check('the first turn plays the track from its start', !copyA.paused && copyB.paused);
copyA.currentTime = 171;
third.runFrames(1);
check('near the end the other copy starts silent, after the track\'s fade-in',
  !copyB.paused && copyB.currentTime === 6 && copyB.volume === 0, `at ${copyB.currentTime}, volume ${copyB.volume}`);
copyB.currentTime = 8;
third.runFrames(1);
const full = third.readGlobal('MUSIC_VOLUME');
const half = full * Math.SQRT1_2;
check('halfway both play at equal power', Math.abs(copyA.volume - half) < 1e-9 && Math.abs(copyB.volume - half) < 1e-9,
  `${copyA.volume} ${copyB.volume}`);
copyB.currentTime = 10;
third.runFrames(1);
check('after the fade the old copy stops and the new one plays at full volume',
  copyA.paused && !copyB.paused && copyB.volume === full);
third.fire('music-b', 'ended', {});
check('a copy that played to its end (hidden tab) hands over at full volume',
  !copyA.paused && copyA.currentTime === 6 && copyA.volume === full);
done();
