'use strict';
// Background music: one ambient track that loops without a seam, and the toolbar button and M key that switch it on
// and off (browser only).

const MUSIC_VOLUME = 0.2;                                 // share of full volume (0.4 until 2026-10-29: too loud)
// The track fades in over its first 5 s and out over its last 5 s, so a plain loop dips to silence (measured
// 2026-10-29: -54 dB at the start, -85 dB at the end, -20 dB between). After the first play, two copies take turns:
// the one ending fades out while the other fades in from inside the faded-in part.
const MUSIC_LOOP_START = 6;                               // track s the next turn starts at
const MUSIC_LOOP_END = 174;                               // track s a turn has faded out by
const MUSIC_CROSSFADE = 4;                                // s the two copies overlap

// Browsers block sound until the page is clicked or a key is pressed, so the track starts on the first of those. The
// desktop build allows it at once, so it is tried as the page starts too.
// Whether it is off is remembered.
function setUpMusic(app) {
  for (const id of ['music', 'music-b']) {
    byId(id).volume = MUSIC_VOLUME;
    byId(id).addEventListener('ended', () => endTurn(app, byId(id)));
  }
  app.music = { playing: byId('music'), waiting: byId('music-b'), fadeIsOn: false };
  app.musicOff = readStorage('music-off', false);
  showMusicButton(app);
  byId('toggle-music').onclick = event => {
    toggleMusic(app);
    event?.currentTarget?.blur?.();
  };
  addEventListener('pointerdown', () => playMusic(app));
  addEventListener('keydown', () => playMusic(app));
  playMusic(app);
}

// starts the track if it is on and not playing yet; a refused start (no click yet) is tried again on the next one
function playMusic(app) {
  const music = app.music.playing;
  if (app.musicOff || !music.paused || !music.play) return;
  music.play().catch(() => {});
}

// Called every frame: near the end of a turn the other copy starts, and the volumes cross with equal power (the sum
// of their loudness stays even). The fade follows the track's own clock, so it keeps pace with what is heard.
function updateMusic(app) {
  const music = app.music;
  if (app.musicOff || music.playing.paused) return;
  if (!music.fadeIsOn && music.playing.currentTime >= MUSIC_LOOP_END - MUSIC_CROSSFADE) startNextTurn(app, false);
  if (!music.fadeIsOn) return;
  const progress = Math.min(1, Math.max(0, (music.waiting.currentTime - MUSIC_LOOP_START) / MUSIC_CROSSFADE));
  music.waiting.volume = MUSIC_VOLUME * Math.sin(progress * Math.PI / 2);
  music.playing.volume = MUSIC_VOLUME * Math.cos(progress * Math.PI / 2);
  if (progress >= 1) finishFade(app);
}

// Starts the other copy at the loop start: silent for a fade, or at full volume when the playing one has already
// ended (frames stop in a hidden tab, so no fade ran).
function startNextTurn(app, hasEnded) {
  const music = app.music;
  if (app.musicOff || music.fadeIsOn) return;
  music.waiting.currentTime = MUSIC_LOOP_START;
  music.waiting.volume = hasEnded ? MUSIC_VOLUME : 0;
  music.waiting.play?.()?.catch?.(() => {});
  music.fadeIsOn = true;
  if (hasEnded) finishFade(app);
}

// a copy that played to its end (frames stop in a hidden tab): the other one takes over at full volume
function endTurn(app, element) {
  if (element !== app.music.playing) return;
  if (app.music.fadeIsOn) finishFade(app);
  else startNextTurn(app, true);
}

// the faded-in copy becomes the playing one, and the other stops
function finishFade(app) {
  const music = app.music;
  music.playing.pause?.();
  music.waiting.volume = MUSIC_VOLUME;
  [music.playing, music.waiting] = [music.waiting, music.playing];
  music.fadeIsOn = false;
}

// switches the music off or back on, where it left off (a fade under way is finished at once)
function toggleMusic(app) {
  app.musicOff = !app.musicOff;
  writeStorage('music-off', app.musicOff);
  if (app.music.fadeIsOn) finishFade(app);
  if (app.musicOff) app.music.playing.pause?.();
  else playMusic(app);
  showMusicButton(app);
}

// the button shows a crossed-out note while the music is off
function showMusicButton(app) {
  byId('toggle-music').classList.toggle('off', app.musicOff);
  byId('toggle-music').title = app.musicOff ? 'Music is off: switch on (M)' : 'Music is on: switch off (M)';
}
