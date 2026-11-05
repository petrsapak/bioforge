'use strict';
// Makes the tutorial's voice lines with ElevenLabs: one MP3 per step of data/tutorial.js, saved as
// audio/voice/<step id>.mp3, which tutorialview.js plays (Node only, not part of the game; no npm packages).
//
//   set ELEVENLABS_API_KEY=...        your key (never put it in the repository)
//   set ELEVENLABS_VOICE_ID=...       the voice to use (Voices > the voice's menu > Copy voice ID)
//   node tools/make-voice.js          makes the lines that are new or whose words changed
//   node tools/make-voice.js --dry-run   lists them without calling ElevenLabs
//   node tools/make-voice.js --force     makes every line again
// Optional: ELEVENLABS_MODEL (default eleven_multilingual_v2). audio/voice/lines.json remembers the words, voice and
// model each file was made from, so changing any of them makes that line again.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const VOICE_FOLDER = path.join(ROOT, 'audio', 'voice');
const MADE_LIST = path.join(VOICE_FOLDER, 'lines.json');
const API_URL = 'https://api.elevenlabs.io/v1/text-to-speech/';
const OUTPUT_FORMAT = 'mp3_44100_128';
const DEFAULT_MODEL = 'eleven_multilingual_v2';

// every step of every lesson, in order, as { id, text }
function readLines() {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'data', 'tutorial.js'), 'utf8') + '\nthis.lessons = TUTORIAL_LESSONS;',
    context);
  return context.lessons.flatMap(lesson => lesson.steps.map(step => ({ id: step.id, text: step.text })));
}

// what each file was made from, by step id
function readMadeList() {
  return fs.existsSync(MADE_LIST) ? JSON.parse(fs.readFileSync(MADE_LIST, 'utf8')) : {};
}

// asks ElevenLabs for one line, with the lines around it so the voice carries on naturally; returns the MP3 bytes
async function speak(line, before, after, settings) {
  const response = await fetch(`${API_URL}${settings.voiceId}?output_format=${OUTPUT_FORMAT}`, {
    method: 'POST',
    headers: { 'xi-api-key': settings.apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text: line.text, model_id: settings.model, previous_text: before, next_text: after }),
  });
  if (!response.ok) throw new Error(`${line.id}: ElevenLabs answered ${response.status}: ${await response.text()}`);
  return Buffer.from(await response.arrayBuffer());
}

// makes the lines that need it, and reports files no step uses any more (left in place)
async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const isForced = process.argv.includes('--force');
  const settings = {
    apiKey: process.env.ELEVENLABS_API_KEY,
    voiceId: process.env.ELEVENLABS_VOICE_ID,
    model: process.env.ELEVENLABS_MODEL || DEFAULT_MODEL,
  };
  const lines = readLines();
  const made = readMadeList();
  const isCurrent = line => {
    const entry = made[line.id];
    return !isForced && entry && entry.text === line.text && entry.voiceId === settings.voiceId &&
      entry.model === settings.model && fs.existsSync(path.join(VOICE_FOLDER, line.id + '.mp3'));
  };
  const toMake = lines.filter(line => !isCurrent(line));
  console.log(`${lines.length} lines, ${toMake.length} to make.`);
  if (isDryRun) {
    toMake.forEach(line => console.log(`  ${line.id}: ${line.text}`));
    return;
  }
  if (toMake.length && (!settings.apiKey || !settings.voiceId)) {
    throw new Error('Set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID first (see the top of this file).');
  }
  fs.mkdirSync(VOICE_FOLDER, { recursive: true });
  for (const line of toMake) {
    const i = lines.indexOf(line);
    const before = i > 0 ? lines[i - 1].text : '';
    const after = i < lines.length - 1 ? lines[i + 1].text : '';
    fs.writeFileSync(path.join(VOICE_FOLDER, line.id + '.mp3'), await speak(line, before, after, settings));
    made[line.id] = { text: line.text, voiceId: settings.voiceId, model: settings.model };
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
