'use strict';
// The sound effects: their files, how loud each is heard and how often it may play (pure data). sound.js plays them.
// Made with ElevenLabs sound generation (2026-10-29); the user picked each from several candidates.
//   variants: one or more files; a sound with several picks one at random each time, so repeats don't sound alike
//   loudness: dB of each file's loudest 300 ms. The files were trimmed (silence before the sound, a tail more
//     than 45 dB down), faded and leveled to -18 dB, peaks at most -1 dB; a few quiet ones hit that peak first
//   level: dB it is heard at: the volume is set to bring the file's loudness there (at most full volume). For
//     comparison, the music at its volume peaks near -26 dB.
//   minGap: real seconds before it may play again
//   vary: each play changes pitch and volume a little, for sounds heard over and over

// one file of a sound and its measured loudness (dB)
function soundFile(file, loudness) {
  return { file: 'audio/sfx/' + file, loudness };
}

// a sound effect from its files and how it is heard
function soundEffect(variants, level, minGap, vary = false) {
  return { variants, level, minGap, vary };
}

const SOUND_EFFECTS = {
  // the builder and the buttons
  click: soundEffect([soundFile('click.wav', -28.6)], -48, 0.05, true),
  place: soundEffect([soundFile('place.wav', -18.0)], -42, 0.05, true),
  remove: soundEffect([soundFile('remove.wav', -28.5)], -42, 0.05),
  wire: soundEffect([soundFile('wire.wav', -29.9)], -42, 0.05),
  vessel: soundEffect([soundFile('vessel.wav', -18.7)], -42, 0.05),
  refuse: soundEffect([soundFile('refuse.wav', -18.0)], -42, 0.3),
  open: soundEffect([soundFile('open.wav', -18.0)], -42, 0.2),
  start: soundEffect([soundFile('start.wav', -18.0)], -42, 0.5),
  enterLab: soundEffect([soundFile('start.wav', -18.0)], -50, 0.5),   // leaving the title: the start sound, softer
  // the creature at work
  stroke: soundEffect([soundFile('stroke.wav', -18.0)], -44, 0.25, true),
  eat: soundEffect([soundFile('eat.wav', -19.9)], -42, 0.1, true),
  death: soundEffect([soundFile('death-1.wav', -18.4), soundFile('death-2.wav', -18.0)], -40, 0.15, true),
  spit: soundEffect([soundFile('spit.wav', -21.2)], -42, 0.1, true),
  sting: soundEffect([soundFile('sting.wav', -22.6)], -42, 0.1, true),
  snareShot: soundEffect([soundFile('snare-shot.wav', -18.0)], -42, 0.1, true),
  snareCatch: soundEffect([soundFile('snare-catch.wav', -18.3)], -40, 0.1, true),
  // a level: the calm tune when the goal first counts up in a run (5 s), then the win or loss
  goal: soundEffect([soundFile('goal.wav', -18.0)], -38, 1),
  win: soundEffect([soundFile('win.wav', -18.0)], -36, 1),
  lose: soundEffect([soundFile('lose.wav', -18.0)], -36, 1),
};

// the sound of a weapon cell firing, by its trigger (data/cells.js); a Snare is heard by its line instead
const TRIGGER_SOUNDS = { spit: 'spit', nettle: 'sting' };
