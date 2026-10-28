'use strict';
// The builder's hover tooltip: after the mouse rests on a dock button or a placed cell, it shows the cell's name and
// cost, what it does, how to use it, and a live example (tipdemo.js); on a neuron button, the neuron (browser only).

const TOOLTIP_DELAY = 200;                                // ms the mouse must rest before the tooltip shows
const TOOLTIP_MOUSE_OFFSET = 24;                          // px from the mouse, or from the dock button
const TOOLTIP_EDGE_MARGIN = 8;                            // px kept free at the window's edges

function createTooltipState() {
  return { target: null, typeName: null, neuronKind: null, anchor: null, since: 0, mouseX: 0, mouseY: 0 };
}

// Notes what the mouse is over (a dock button, or a placed cell in the Body view only: in the Nerve and Vessels
// views the mouse crosses cells all the time while laying fibres and vessels); a new target hides the tooltip and
// restarts the wait.
function trackTooltipTarget(app, event) {
  const tooltip = app.tooltip;
  tooltip.mouseX = event.clientX;
  tooltip.mouseY = event.clientY;
  let target = null;
  let typeName = null;
  let neuronKind = null;
  const dockButton = event.target && event.target.closest && event.target.closest('.palette-cell');
  if (dockButton) {
    typeName = dockButton.dataset.type || null;
    neuronKind = dockButton.dataset.neuron || null;
    target = 'dock:' + (typeName || neuronKind);
  } else if (event.target === app.canvas && app.mode === 'build' && app.layer === 'body') {
    const [q, r] = hexUnderMouse(app, event);
    const cell = app.edited.cells.get(hexKey(q, r));
    if (cell) {
      typeName = cell.typeName;
      target = 'grid:' + hexKey(q, r);
    }
  }
  if (target === tooltip.target) return;
  tooltip.target = target;
  tooltip.typeName = typeName;
  tooltip.neuronKind = neuronKind;
  tooltip.anchor = dockButton || null;
  hideTooltip(app);
}

function hideTooltip(app) {
  app.tooltip.since = performance.now();
  byId('tooltip').style.display = 'none';
  stopDemo();
}

// shows the tooltip once the mouse has rested long enough on the same target
function updateTooltip(app, now) {
  const tooltip = app.tooltip;
  const box = byId('tooltip');
  if (!tooltip.target || app.mode !== 'build' || now - tooltip.since < TOOLTIP_DELAY) return;
  if (box.style.display === 'block') return;
  const cellType = CELLS[tooltip.typeName];
  const neuronType = NEURONS[tooltip.neuronKind];
  if (!cellType && !neuronType) return;
  box.innerHTML = cellType
    ? tooltipHtml(tooltip.typeName, cellType)
    : neuronTooltipHtml(tooltip.neuronKind, neuronType);
  box.style.display = 'block';
  const { left, top } = tooltipPlace(tooltip, box.offsetWidth, box.offsetHeight);
  const maxLeft = innerWidth - box.offsetWidth - TOOLTIP_EDGE_MARGIN;
  const maxTop = innerHeight - box.offsetHeight - TOOLTIP_EDGE_MARGIN;
  box.style.left = Math.max(TOOLTIP_EDGE_MARGIN, Math.min(left, maxLeft)) + 'px';
  box.style.top = Math.max(TOOLTIP_EDGE_MARGIN, Math.min(top, maxTop)) + 'px';
  if (cellType) startDemo(tooltip.typeName, byId('tooltip-demo'));
  else startNeuronDemo(tooltip.neuronKind, byId('tooltip-demo'), byId('tooltip-traces'));
}

// Where the tooltip goes before it is kept on screen: above a dock button, centred on it; next to a cell on the
// grid, on the side towards the middle of the screen and level with the mouse, so it doesn't cover the body.
function tooltipPlace(tooltip, width, height) {
  if (tooltip.anchor && tooltip.anchor.getBoundingClientRect) {
    const rect = tooltip.anchor.getBoundingClientRect();
    return { left: rect.left + rect.width / 2 - width / 2, top: rect.top - height - TOOLTIP_MOUSE_OFFSET / 2 };
  }
  const isRightHalf = tooltip.mouseX > innerWidth / 2;
  const left = isRightHalf ? tooltip.mouseX - width - TOOLTIP_MOUSE_OFFSET : tooltip.mouseX + TOOLTIP_MOUSE_OFFSET;
  return { left, top: tooltip.mouseY - height / 2 };
}

function tooltipHtml(typeName, cellType) {
  const facts = [`${cellType.health} HP`];
  if (cellType.needsSignal) facts.push('needs a nerve signal');
  if (cellType.fuelBurn) facts.push(`burns ${+(cellType.fuelBurn * FUEL_BURN_SCALE).toFixed(3)}/s`);
  return `<div class="tooltip-title"><b>${cellType.name}</b>` +
    `<span class="tooltip-cost" title="Biomass cost">◆ ${cellType.cost}</span></div>` +
    `<span class="dim">${facts.join(' · ')}</span><br>${cellType.description}` +
    `<div class="tooltip-heading">How to use</div>${TIPS[typeName].howToUse}` +
    `<div class="tooltip-heading">Example</div>` +
    `<canvas id="tooltip-demo" width="${DEMO_WIDTH}" height="${DEMO_HEIGHT}"></canvas>`;
}

// A neuron button's tooltip, in the cell tooltip's format: name and cost (neurons cost no biomass), its facts, what
// it does, how to use it, and a live example with the signals of its cells as lanes.
function neuronTooltipHtml(kind, neuronType) {
  const facts = [neuronType.ignoresInputs ? 'makes its own signal' : 'reads the fibres coming in'];
  const setting = neuronType.setting;
  if (setting) facts.push(`${setting.name} ${setting.min}–${setting.max}${setting.unit ? ' ' + setting.unit : ''}`);
  return `<div class="tooltip-title"><b>${neuronType.symbol} ${neuronType.name}</b>` +
    `<span class="tooltip-cost" title="Biomass cost">◆ 0</span></div>` +
    `<span class="dim">${facts.join(' · ')}</span><br>${neuronType.description}` +
    `<div class="tooltip-heading">How to use</div>${NEURON_TIPS[kind].howToUse}` +
    `<div class="tooltip-heading">Example</div>` +
    `<canvas id="tooltip-demo" width="${DEMO_WIDTH}" height="${DEMO_HEIGHT}"></canvas>` +
    `<canvas id="tooltip-traces" width="${DEMO_WIDTH}" height="0"></canvas>`;
}
