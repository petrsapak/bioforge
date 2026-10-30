'use strict';
// The chemical lens (C, or the button by the layer tabs): a view the player turns on and off that shows the hormones.
// The bodies dim, each cell gets a soft cloud in the colour of every hormone it holds, as big as it is full, and the
// water shows the clouds the scent system keeps there. Works in the builder's grid, levels and the Sandbox (browser
// only).

const LENS_SHADE = 'rgba(4,9,13,0.62)';                   // laid over the world while the lens is on
const LENS_MIN_FILL = 0.03;                               // a cell's hormone below this share of its room isn't shown
const LENS_CLOUD_REACH = 2.4;                             // a full cell's cloud reaches this many cell radii
const LENS_CLOUD_ALPHA = 0.85;                            // how strong a full cell's cloud is drawn
const LENS_WATER_GAIN = 1.6;                              // the water's clouds are drawn this much stronger
const LENS_SPRITE_SIZE = 64;                              // px of the soft sprite a hormone's clouds are drawn from

// the hormones the lens shows: { fluid (index into FLUIDS), rgb: [r, g, b], sprite } for each chemical fluid
const LENS_HORMONES = FLUIDS
  .map((fluid, index) => ({ fluid: index, layer: fluid.layer, color: fluid.color }))
  .filter(entry => entry.layer === 'chemical')
  .map(({ fluid, color }) => ({ fluid, rgb: rgbOf(color), sprite: null }));

// the small canvas each water field is drawn into, kept here so that no DOM object gets into the sim's state (saves)
const waterScentCanvases = new WeakMap();

// [r, g, b] of a '#rrggbb' colour
function rgbOf(hex) {
  return [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16));
}

// the button and the legend; the lens starts off every visit, since it is a view to look through now and then
function setUpChemicalLens(app) {
  byId('chemical-lens').onclick = () => toggleChemicalLens(app);
  const legend = LENS_HORMONES.map(({ fluid }) =>
    `<span><i style="background:${FLUIDS[fluid].color}"></i>${FLUIDS[fluid].name}</span>`).join('');
  byId('lens-legend').innerHTML = `<b>Hormones</b>${legend}<em>C: off</em>`;
}

// C: turns the lens on or off
function toggleChemicalLens(app) {
  app.isLensOn = !app.isLensOn;
  byId('chemical-lens').classList.toggle('selected', app.isLensOn);
  byId('lens-legend').style.display = app.isLensOn ? 'flex' : 'none';
}

// A soft round sprite in one colour, opaque in the middle and fading to nothing at the edge. Made once per hormone
// and drawn scaled, which is much cheaper than a new gradient for every cell every frame.
function lensSprite(hormone) {
  if (hormone.sprite) return hormone.sprite;
  const sprite = document.createElement('canvas');
  sprite.width = LENS_SPRITE_SIZE;
  sprite.height = LENS_SPRITE_SIZE;
  const context = sprite.getContext('2d');
  const middle = LENS_SPRITE_SIZE / 2;
  const glow = context.createRadialGradient(middle, middle, 0, middle, middle, middle);
  const [red, green, blue] = hormone.rgb;
  glow.addColorStop(0, `rgba(${red},${green},${blue},1)`);
  glow.addColorStop(0.45, `rgba(${red},${green},${blue},0.45)`);
  glow.addColorStop(1, `rgba(${red},${green},${blue},0)`);
  context.fillStyle = glow;
  context.fillRect(0, 0, LENS_SPRITE_SIZE, LENS_SPRITE_SIZE);
  hormone.sprite = sprite;
  return sprite;
}

// The lens over a world drawn in world px (levels, the Sandbox): shade, the water's clouds, then each cell's clouds.
function drawChemicalLens(context, world) {
  context.fillStyle = LENS_SHADE;
  context.fillRect(0, 0, world.width, world.height);
  drawWaterScent(context, world);
  drawCellClouds(context, world.cells.map(cell => ({ cell, x: cell.x, y: cell.y, radius: cell.radius })));
}

// The builder's grid under the lens: the design's cells, at their grid places, show the test tank's hormones.
function drawBuilderLens(app) {
  const context = app.context;
  const liveCells = new Map(app.tank.cells.map(cell => [keyOfCell(cell), cell]));
  const shown = [];
  for (const [key, designCell] of app.edited.cells) {
    const cell = liveCells.get(key);
    if (!cell) continue;
    const [x, y] = hexToPixel(designCell.q, designCell.r);
    shown.push({ cell, x, y, radius: CELL_RADIUS });
  }
  context.save();
  context.fillStyle = LENS_SHADE;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.fillRect(0, 0, app.canvas.width, app.canvas.height);
  context.restore();
  drawCellClouds(context, shown);
}

// Each shown cell ({ cell, x, y, radius }) gets a cloud per hormone it holds, mixed by adding light, so a cell with
// two hormones shows both colours blended.
function drawCellClouds(context, shown) {
  context.save();
  context.globalCompositeOperation = 'lighter';
  for (const { cell, x, y, radius } of shown) {
    if (cell.dead) continue;
    for (const hormone of LENS_HORMONES) {
      const capacity = cell.fluidCapacity[hormone.fluid];
      const fill = capacity ? Math.min(1, cell.fluids[hormone.fluid] / capacity) : 0;
      if (fill < LENS_MIN_FILL) continue;
      const reach = radius * (1 + (LENS_CLOUD_REACH - 1) * fill);
      context.globalAlpha = LENS_CLOUD_ALPHA * (0.35 + 0.65 * fill);
      context.drawImage(lensSprite(hormone), x - reach, y - reach, reach * 2, reach * 2);
    }
  }
  context.restore();
}

// The scent system's water patches as one small picture, a pixel per patch, drawn stretched over the arena with
// smoothing, so the patches blur into clouds. Nothing is drawn where the scent system has not run.
function drawWaterScent(context, world) {
  const field = world.scent;
  if (!field) return;
  const picture = waterScentPicture(field);
  if (!picture) return;
  context.save();
  context.imageSmoothingEnabled = true;
  context.drawImage(picture, 0, 0, field.columns * SCENT_PATCH_SIZE, field.rows * SCENT_PATCH_SIZE);
  context.restore();
}

// the water's hormones as a canvas of field.columns × field.rows pixels (reused between frames), or null if the
// water is clean
function waterScentPicture(field) {
  if (!waterScentCanvases.has(field)) {
    const canvas = document.createElement('canvas');
    canvas.width = field.columns;
    canvas.height = field.rows;
    waterScentCanvases.set(field, canvas);
  }
  const canvas = waterScentCanvases.get(field);
  const context = canvas.getContext('2d');
  const image = context.createImageData(field.columns, field.rows);
  let isAnyScent = false;
  for (let patch = 0; patch < field.columns * field.rows; patch++) {
    let red = 0;
    let green = 0;
    let blue = 0;
    let strongest = 0;
    for (const hormone of LENS_HORMONES) {
      const level = Math.min(1, field.levels[hormone.fluid][patch] * LENS_WATER_GAIN);
      red += hormone.rgb[0] * level;
      green += hormone.rgb[1] * level;
      blue += hormone.rgb[2] * level;
      strongest = Math.max(strongest, level);
    }
    if (strongest < LENS_MIN_FILL) continue;
    isAnyScent = true;
    const scale = 255 / Math.max(255, red, green, blue);  // keep the mix's hue when it adds up past white
    image.data.set([red * scale, green * scale, blue * scale, 200 * strongest], patch * 4);
  }
  if (!isAnyScent) return null;
  context.putImageData(image, 0, 0);
  return canvas;
}
