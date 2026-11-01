'use strict';
// Draws the app icon for icon.html: the Nucleus in its Lab hex, drawn by the game's own cellart.js, on a clear
// background (browser-only, desktop build tool).

const ICON_SIZE = 1024;                                   // px of the master drawing
const EXPORT_SIZES = [256, 128, 64, 48, 32, 24, 16];      // px, the sizes packed into icon.ico
const HEX_SIZE = 440;                                     // px from the hex's centre to its top and bottom corners
const HEX_BORDER = 44;                                    // px, thick so the hex still shows at 16 px
const HEX_FILL = '#0b1418';                               // the Lab's background, behind the cell
const CELL_SCALE = 0.68;                                  // the cell's radius as a share of the hex's size
const GLOW = 40;                                          // px of blur round the hex
const GLOW_COLOR = 'rgba(232,197,71,0.6)';                // the Nucleus's gold, faded

// The Nucleus as cellart.js expects it. On the grid, as in the Lab; heading 0 turns its eye to look up.
function iconNucleus(x, y) {
  return { typeName: 'nucleus', type: CELLS.nucleus, x, y, isOnGrid: true, creature: { heading: 0 } };
}

// a pointy-topped hexagon path round x, y, as the Lab's grid draws them
function hexPath(context, x, y, size) {
  context.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = -Math.PI / 2 + i * Math.PI / 3;
    context.lineTo(x + Math.cos(angle) * size, y + Math.sin(angle) * size);
  }
  context.closePath();
}

// the hex: dark inside with a tint of the cell's colour, and a glowing border in it
function drawHex(context, x, y, color) {
  hexPath(context, x, y, HEX_SIZE);
  context.fillStyle = HEX_FILL;
  context.fill();
  context.fillStyle = translucent(color, 0.16);
  context.fill();
  context.save();
  context.lineJoin = 'round';
  context.shadowColor = GLOW_COLOR;
  context.shadowBlur = GLOW;
  context.strokeStyle = color;
  context.lineWidth = HEX_BORDER;
  context.stroke();
  context.restore();
}

// the whole icon at ICON_SIZE
function drawIcon() {
  const canvas = document.createElement('canvas');
  canvas.width = ICON_SIZE;
  canvas.height = ICON_SIZE;
  const context = canvas.getContext('2d');
  const centre = ICON_SIZE / 2;
  drawHex(context, centre, centre, CELLS.nucleus.color);
  drawCellArt(context, iconNucleus(centre, centre), HEX_SIZE * CELL_SCALE, -Math.PI / 2);
  return canvas;
}

// the master drawing scaled down to size, halving step by step so small sizes stay sharp
function scaledIcon(master, size) {
  let source = master;
  while (source.width / 2 >= size) {
    const half = document.createElement('canvas');
    half.width = source.width / 2;
    half.height = source.height / 2;
    const context = half.getContext('2d');
    context.imageSmoothingQuality = 'high';
    context.drawImage(source, 0, 0, half.width, half.height);
    source = half;
  }
  if (source.width === size) return source;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, 0, 0, size, size);
  return canvas;
}

// draws the icon, shows it at every size, and writes the PNGs as data URLs into #icon-output for make-icon.js
function showIcon() {
  const master = drawIcon();
  const images = { [ICON_SIZE]: master.toDataURL('image/png') };
  const sizes = document.getElementById('sizes');
  const preview = scaledIcon(master, 512);
  sizes.appendChild(preview);
  for (const size of EXPORT_SIZES) {
    const canvas = scaledIcon(master, size);
    images[size] = canvas.toDataURL('image/png');
    sizes.appendChild(canvas);
  }
  document.getElementById('icon-output').textContent = JSON.stringify(images);
}

showIcon();
