'use strict';
// Background music: one ambient track that loops, and the toolbar button and M key that switch it on and off
// (browser only).

const MUSIC_VOLUME = 0.4;                                 // share of full volume

// Browsers block sound until the page is clicked or a key is pressed, so the track starts on the first of those.
// Whether it is off is remembered.
function setUpMusic(app) {
  byId('music').volume = MUSIC_VOLUME;
  app.musicOff = readStorage('music-off', false);
  showMusicButton(app);
  byId('toggle-music').onclick = event => {
    toggleMusic(app);
    event?.currentTarget?.blur?.();
  };
  addEventListener('pointerdown', () => playMusic(app));
  addEventListener('keydown', () => playMusic(app));
}

// starts the track if it is on and not playing yet; a refused start (no click yet) is tried again on the next one
function playMusic(app) {
  const music = byId('music');
  if (app.musicOff || !music.paused || !music.play) return;
  music.play().catch(() => {});
}

// switches the music off or back on, where it left off
function toggleMusic(app) {
  app.musicOff = !app.musicOff;
  writeStorage('music-off', app.musicOff);
  if (app.musicOff) byId('music').pause?.();
  else playMusic(app);
  showMusicButton(app);
}

// the button shows a crossed-out note while the music is off
function showMusicButton(app) {
  byId('toggle-music').classList.toggle('off', app.musicOff);
  byId('toggle-music').title = app.musicOff ? 'Music is off: switch on (M)' : 'Music is on: switch off (M)';
}
