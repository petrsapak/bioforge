'use strict';
// Makes the tutorial's voice lines with ElevenLabs: one MP3 per step of data/tutorial.js, saved as
// audio/voice/<step id>.mp3, which tutorialview.js plays (Node only, not part of the game; no npm packages).
//
//   set ELEVENLABS_API_KEY=...        your key (ELEVEN_LABS_API_KEY works too; never put it in the repository)
//   node tools/make-voice.js          makes the lines that are new or whose words changed
//   node tools/make-voice.js --dry-run   lists them without calling ElevenLabs
//   node tools/make-voice.js --force     makes every line again
//   node tools/make-voice.js --first     makes only the first line still to make, to hear the voice first
// The voice is Will, one of ElevenLabs' own voices: young, male, calm and sure of himself (user, 2026-11-05: "a young
// male confident calm voice"). ELEVENLABS_VOICE_ID picks another (Voices > the voice's menu > Copy voice ID), and
// ELEVENLABS_MODEL another model. Before making anything the script looks the voice up and prints its name, so a
// wrong ID costs no credits. audio/voice/lines.json remembers the words, voice, model and voice settings each file
// was made from, so changing any of them makes that line again.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const VOICE_FOLDER = path.join(ROOT, 'audio', 'voice');
const MADE_LIST = path.join(VOICE_FOLDER, 'lines.json');
const API_URL = 'https://api.elevenlabs.io/v1/';
const OUTPUT_FORMAT = 'mp3_44100_128';
const DEFAULT_MODEL = 'eleven_multilingual_v2';
const DEFAULT_VOICE_ID = 'bIHbv24MWmeRgasZH58o';          // Will: young American male, relaxed and steady
// a calm, even delivery: steady from line to line (stability), close to the voice, little acting (style)
const VOICE_SETTINGS = { stability: 0.6, similarity_boost: 0.8, style: 0.1, use_speaker_boost: true };

// every step of every lesson, in order, as { id, text }
function readLines() {
  const context = vm.createContext({});
  const source = fs.readFileSync(path.join(ROOT, 'data', 'tutorial.js'), 'utf8');
  vm.runInContext(source + '\nthis.lessons = TUTORIAL_LESSONS;', context);
  return context.lessons.flatMap(lesson => lesson.steps.map(step => ({ id: step.id, text: step.text })));
}

// what each file was made from, by step id
function readMadeList() {
  return fs.existsSync(MADE_LIST) ? JSON.parse(fs.readFileSync(MADE_LIST, 'utf8')) : {};
}

// asks ElevenLabs for one line, with the lines around it so the voice carries on naturally; returns the MP3 bytes
async function speak(line, before, after, settings) {
  const response = await fetch(`${API_URL}text-to-speech/${settings.voiceId}?output_format=${OUTPUT_FORMAT}`, {
    method: 'POST',
    headers: { 'xi-api-key': settings.apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text: line.text, model_id: settings.model, previous_text: before, next_text: after,
      voice_settings: VOICE_SETTINGS }),
  });
  if (!response.ok) throw new Error(`${line.id}: ElevenLabs answered ${response.status}: ${await response.text()}`);
  return Buffer.from(await response.arrayBuffer());
}

// Looks the voice up (free) and prints its name and description; throws when the account can't use it. A key
// limited to speech (no voices_read permission) can't look voices up, so then the first line is the check.
async function checkVoice(settings) {
  const response = await fetch(`${API_URL}voices/${settings.voiceId}`, { headers: { 'xi-api-key': settings.apiKey } });
  const answer = response.ok ? '' : await response.text();
  if (answer.includes('missing_permissions')) {
    console.log(`Voice ${settings.voiceId}: this key can't look voices up, so it is not checked first.`);
    return;
  }
  if (!response.ok) throw new Error(`Voice ${settings.voiceId}: ElevenLabs answered ${response.status}: ${answer}`);
  const voice = await response.json();
  const labels = Object.values(voice.labels || {}).join(', ');
  console.log(`Voice: ${voice.name}${labels ? ` (${labels})` : ''}`);
}

// makes the lines that need it, and reports files no step uses any more (left in place)
async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const isForced = process.argv.includes('--force');
  const isFirstOnly = process.argv.includes('--first');
  const settings = {
    apiKey: process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_LABS_API_KEY,
    voiceId: process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID,
    model: process.env.ELEVENLABS_MODEL || DEFAULT_MODEL,
  };
  const settingsText = JSON.stringify(VOICE_SETTINGS);
  const lines = readLines();
  const made = readMadeList();
  const isCurrent = line => {
    const entry = made[line.id];
    return !isForced && entry && entry.text === line.text && entry.voiceId === settings.voiceId &&
      entry.model === settings.model && entry.voiceSettings === settingsText &&
      fs.existsSync(path.join(VOICE_FOLDER, line.id + '.mp3'));
  };
  const toMake = lines.filter(line => !isCurrent(line)).slice(0, isFirstOnly ? 1 : lines.length);
  console.log(`${lines.length} lines, ${toMake.length} to make.`);
  if (isDryRun) {
    toMake.forEach(line => console.log(`  ${line.id}: ${line.text}`));
    return;
  }
  if (!toMake.length) return;
  if (!settings.apiKey) throw new Error('Set ELEVENLABS_API_KEY first (see the top of this file).');
  await checkVoice(settings);
  fs.mkdirSync(VOICE_FOLDER, { recursive: true });
  for (const line of toMake) {
    const i = lines.indexOf(line);
    const before = i > 0 ? lines[i - 1].text : '';
    const after = i < lines.length - 1 ? lines[i + 1].text : '';
    fs.writeFileSync(path.join(VOICE_FOLDER, line.id + '.mp3'), await speak(line, before, after, settings));
    made[line.id] = { text: line.text, voiceId: settings.voiceId, model: settings.model, voiceSettings: settingsText };
    fs.writeFileSync(MADE_LIST, JSON.stringify(made, null, 2) + '\n');   // after each line, so a failure keeps the rest
    console.log(`  made ${line.id}.mp3`);
  }
  const ids = new Set(lines.map(line => line.id));
  const unused = fs.readdirSync(VOICE_FOLDER).filter(name => name.endsWith('.mp3') && !ids.has(name.slice(0, -4)));
  if (unused.length) console.log(`No step uses these any more (delete them by hand): ${unused.join(', ')}`);
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
