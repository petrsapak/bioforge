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
done();
