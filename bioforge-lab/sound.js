'use strict';
// Sound effects: playing them (a few voices each, so quick repeats overlap), the toolbar button and N key that switch
// them off and on, and the creatures' sounds, heard by watching their world change from frame to frame (browser only).

const SOUND_VOICES = 3;                                   // copies of each sound file that may play at once
const SOUND_VARIATION = 0.06;                             // most a varied sound's pitch (and volume) moves, as a share
const STROKE_REPEAT = 0.7;                                // real s between strokes of a Siphon held on
const OTHER_HEARING_RANGE = 700;                          // px from the player where other creatures fade out
const OTHER_LOUDNESS = 0.63;                              // share of volume for another creature right beside (-4 dB)
const OTHER_DEATH_LOUDNESS = 0.4;                         // share of volume for cells of other creatures dying
const EAT_SUGAR_JUMP = 0.4;                               // share of a speck's sugar a Mouth gains in a frame on eating

// Reads whether sounds are off and wires the button. Any button click makes the soft click sound.
function setUpSounds(app) {
  app.soundsOff = readStorage('sounds-off', false);
  app.soundVoices = {};
  app.soundPlayedAt = {};
  app.soundWatch = null;
  app.cellSounds = new WeakMap();                         // cell -> what its sounds compare with (cellSoundEvents)
  showSoundsButton(app);
  byId('toggle-sounds').onclick = event => {
    toggleSounds(app);
    event?.currentTarget?.blur?.();
  };
  addEventListener('click', event => {
    if (event.target?.closest?.('button')) playSound(app, 'click');
  });
}

// Plays a sound from SOUND_EFFECTS (one of its variants, at random), unless sounds are off, it played less than its
// minGap ago, or there is no such sound (yet). loudness scales its volume; sounds with different gapKeys (the
// player's and other creatures') wait out their gaps apart.
function playSound(app, name, loudness = 1, gapKey = name) {
  const effect = SOUND_EFFECTS[name];
  const now = performance.now() / 1000;
  if (!effect || app.soundsOff || now - (app.soundPlayedAt[gapKey] ?? -Infinity) < effect.minGap) return;
  app.soundPlayedAt[gapKey] = now;
  const variant = effect.variants[Math.floor(Math.random() * effect.variants.length)];
  const voice = nextVoice(app, variant.file);
  const variation = effect.vary ? 1 + (Math.random() * 2 - 1) * SOUND_VARIATION : 1;
  voice.volume = Math.min(1, Math.pow(10, (effect.level - variant.loudness) / 20) * loudness / variation);
  voice.preservesPitch = false;                           // so a faster play sounds higher
  voice.playbackRate = variation;
  voice.currentTime = 0;
  voice.play?.()?.catch?.(() => {});                      // refused before the first click: that one stays silent
}

// the voice of a sound file that was used longest ago, made on first use
function nextVoice(app, file) {
  if (!app.soundVoices[file]) {
    const voices = [];
    for (let i = 0; i < SOUND_VOICES; i++) {
      const voice = document.createElement('audio');
      voice.src = file;
      voice.preload = 'auto';
      voices.push(voice);
    }
    app.soundVoices[file] = { voices, next: 0 };
  }
  const pool = app.soundVoices[file];
  const voice = pool.voices[pool.next];
  pool.next = (pool.next + 1) % SOUND_VOICES;
  return voice;
}

// switches the sound effects off or back on
function toggleSounds(app) {
  app.soundsOff = !app.soundsOff;
  writeStorage('sounds-off', app.soundsOff);
  showSoundsButton(app);
}

// the button shows a crossed-out speaker while sounds are off
function showSoundsButton(app) {
  byId('toggle-sounds').classList.toggle('off', app.soundsOff);
  byId('toggle-sounds').title = app.soundsOff ? 'Sounds are off: switch on (N)' : 'Sounds are on: switch off (N)';
}

// ---------- The creatures' sounds ----------
// Called every frame of a run with the player's creature (and the level run, if any). Compares the world with the
// last frame: each cell's own events (cellSoundEvents), a Mouth of the player's whose sugar jumps has eaten, fewer
// cells means some died, and the goal first counting up in a run (into the ring) plays the calm tune, once. The
// player's cells are heard in full; other creatures' quieter, fading out with distance, and only the nearest of each
// sound per frame. A new world starts the watch over without sounds.
function listenToWorld(app, world, player, run = null) {
  const last = app.soundWatch;
  const now = watchWorld(world, player, run);
  app.soundWatch = now;
  if (!last || last.world !== world || last.player !== player) return;
  const seconds = performance.now() / 1000;
  const othersHeard = {};                                 // sound name -> loudness of the nearest other creature's
  for (const cell of world.cells) {
    if (cell.health <= 0 || cell.creature.debris) continue;
    for (const name of cellSoundEvents(app, cell, seconds)) {
      if (cell.creature === player) {
        playSound(app, name);
        continue;
      }
      const distance = Math.hypot(cell.x - now.hearX, cell.y - now.hearY);
      othersHeard[name] = Math.max(othersHeard[name] ?? 0, 1 - distance / OTHER_HEARING_RANGE);
    }
  }
  for (const [name, nearness] of Object.entries(othersHeard)) {
    if (nearness > 0) playSound(app, name, nearness * OTHER_LOUDNESS, name + ' other');
  }
  if (now.mouthSugar > last.mouthSugar + world.foodSupply.sugar * EAT_SUGAR_JUMP) playSound(app, 'eat');
  // a launched Bud part only moves cells to another creature, so only fewer cells in all is a death
  if (now.allCells < last.allCells) {
    playSound(app, 'death', now.playerCells < last.playerCells ? 1 : OTHER_DEATH_LOUDNESS);
  }
  if (now.goalTime > last.goalTime && !last.hasGoalCounted) playSound(app, 'goal');
  now.hasGoalCounted = last.hasGoalCounted || now.goalTime > last.goalTime;
}

// The sounds one cell makes this frame, from what it was last frame: a Siphon whose signal comes on strokes, and
// again every STROKE_REPEAT while it stays on; a weapon whose cooldown jumps up has fired (TRIGGER_SOUNDS); a Snare
// whose line appears shoots it, and whose line gets a target catches. A cell seen for the first time is silent.
function cellSoundEvents(app, cell, seconds) {
  const was = app.cellSounds.get(cell);
  const isJetting = Boolean(cell.type.jets && cell.signal > SIGNAL_ON);
  const state = { isJetting, strokeAt: was?.strokeAt ?? -Infinity, cooldown: cell.cooldown,
    hasLine: Boolean(cell.snareLine), hasCatch: Boolean(cell.snareLine?.target) };
  app.cellSounds.set(cell, state);
  if (!was) return [];
  const events = [];
  if (isJetting && (!was.isJetting || seconds - was.strokeAt > STROKE_REPEAT)) {
    events.push('stroke');
    state.strokeAt = seconds;
  }
  const weaponSound = TRIGGER_SOUNDS[cell.type.trigger];
  if (weaponSound && cell.cooldown > was.cooldown) events.push(weaponSound);
  if (state.hasLine && !was.hasLine) events.push('snareShot');
  if (state.hasCatch && !was.hasCatch) events.push('snareCatch');
  return events;
}

// What the sounds compare between frames. Other creatures are heard from the player, or from the arena's middle
// when there is no player.
function watchWorld(world, player, run) {
  const playerCells = player ? player.cells.filter(cell => cell.health > 0) : [];
  const mouthSugar = playerCells.filter(cell => cell.type.eatsFood)
    .reduce((sum, cell) => sum + (cell.fluids?.[FLUID_SUGAR] ?? 0), 0);
  return {
    world,
    player,
    hearX: player ? player.centerX : world.width / 2,
    hearY: player ? player.centerY : world.height / 2,
    mouthSugar,
    playerCells: playerCells.length,
    allCells: world.cells.filter(cell => cell.health > 0).length,
    goalTime: run ? run.goalTime : 0,
    time: run ? run.time : 0,
    hasGoalCounted: false,                                // the goal has counted up in this run (kept between frames)
  };
}
