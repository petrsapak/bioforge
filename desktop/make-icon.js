'use strict';
// node make-icon.js: draws icon.html in headless Edge and saves the app icon as icon.ico (the desktop build's), and
// bioforge-lab/icon.png (the page's and the window's), and icon-1024.png (the master) (Node only, desktop build tool).

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PAGE = path.join(__dirname, 'icon.html');
const ICO_FILE = path.join(__dirname, 'icon.ico');
const MASTER_FILE = path.join(__dirname, 'icon-1024.png');
const GAME_ICON_FILE = path.join(__dirname, '..', 'bioforge-lab', 'icon.png');
const GAME_ICON_SIZE = 256;                               // px
const ICO_SIZES = [256, 128, 64, 48, 32, 24, 16];         // px, largest first
const ICO_HEADER_BYTES = 6;
const ICO_ENTRY_BYTES = 16;

// the PNGs icon.html drew, as Buffers by size, read from the page Edge dumps
function drawIcons() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'bioforge-icon-'));
  const page = execFileSync(EDGE, ['--headless=new', '--disable-gpu', '--allow-file-access-from-files',
    `--user-data-dir=${profile}`, '--virtual-time-budget=5000', '--dump-dom', 'file:///' + PAGE.replace(/\\/g, '/')],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  fs.rmSync(profile, { recursive: true, force: true });
  const match = page.match(/<pre id="icon-output">([^<]+)<\/pre>/);
  if (!match) throw new Error('icon.html drew nothing; open it in a browser to see why');
  const dataUrls = JSON.parse(match[1].replace(/&quot;/g, '"'));
  const images = {};
  for (const [size, dataUrl] of Object.entries(dataUrls)) {
    images[size] = Buffer.from(dataUrl.split(',')[1], 'base64');
  }
  return images;
}

// an .ico file holding the PNGs as they are (Windows reads PNG entries since Vista)
function packIco(images) {
  const header = Buffer.alloc(ICO_HEADER_BYTES);
  header.writeUInt16LE(1, 2);                             // type 1: icon
  header.writeUInt16LE(ICO_SIZES.length, 4);
  const entries = Buffer.alloc(ICO_ENTRY_BYTES * ICO_SIZES.length);
  let offset = ICO_HEADER_BYTES + entries.length;
  ICO_SIZES.forEach((size, i) => {
    const entry = i * ICO_ENTRY_BYTES;
    entries.writeUInt8(size % 256, entry);                // 0 means 256
    entries.writeUInt8(size % 256, entry + 1);
    entries.writeUInt16LE(1, entry + 4);                  // colour planes
    entries.writeUInt16LE(32, entry + 6);                 // bits per pixel
    entries.writeUInt32LE(images[size].length, entry + 8);
    entries.writeUInt32LE(offset, entry + 12);
    offset += images[size].length;
  });
  return Buffer.concat([header, entries, ...ICO_SIZES.map(size => images[size])]);
}

const images = drawIcons();
fs.writeFileSync(ICO_FILE, packIco(images));
fs.writeFileSync(MASTER_FILE, images[1024]);
fs.writeFileSync(GAME_ICON_FILE, images[GAME_ICON_SIZE]);
console.log('wrote icon.ico, icon-1024.png and bioforge-lab/icon.png');
