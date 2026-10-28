'use strict';
// The builder's hover tooltip: after the mouse rests on a dock button or a placed cell, it shows what the cell does,
// how to use it, and a live example (tipdemo.js) (browser only).

const TOOLTIP_DELAY = 1000;                               // ms the mouse must rest before the tooltip shows
const TOOLTIP_MOUSE_OFFSET = 16;                          // px from the mouse
const TOOLTIP_EDGE_MARGIN = 8;                            // px kept free at the window's edges

function createTooltipState() {
  return { target: null, typeName: null, since: 0, mouseX: 0, mouseY: 0 };
}

// Notes what the mouse is over (a dock button or a placed cell); a new target hides the tooltip and restarts the wait.
function trackTooltipTarget(app, event) {
  const tooltip = app.tooltip;
  tooltip.mouseX = event.clientX;
  tooltip.mouseY = event.clientY;
  let target = null;
  let typeName = null;
  const dockButton = event.target && event.target.closest && event.target.closest('.palette-cell');
  if (dockButton) {
    typeName = dockButton.dataset.type;
    target = 'dock:' + typeName;
  } else if (event.target === app.canvas && app.mode === 'build') {
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
  if (!cellType) return;
  box.innerHTML = tooltipHtml(tooltip.typeName, cellType);
  box.style.display = 'block';
  const left = tooltip.mouseX + TOOLTIP_MOUSE_OFFSET;
  const top = tooltip.mouseY + TOOLTIP_MOUSE_OFFSET;
  const maxLeft = innerWidth - box.offsetWidth - TOOLTIP_EDGE_MARGIN;
  const maxTop = innerHeight - box.offsetHeight - TOOLTIP_EDGE_MARGIN;
  box.style.left = Math.max(TOOLTIP_EDGE_MARGIN, Math.min(left, maxLeft)) + 'px';
  box.style.top = Math.max(TOOLTIP_EDGE_MARGIN, Math.min(top, maxTop)) + 'px';
  startDemo(tooltip.typeName, byId('tooltip-demo'));
}

function tooltipHtml(typeName, cellType) {
  const facts = [`cost ${cellType.cost}`, `${cellType.health} HP`];
  if (cellType.conductsSignal) facts.push('carries nerve signals');
  if (cellType.fuelBurn) facts.push(`burns ${+(cellType.fuelBurn * FUEL_BURN_SCALE).toFixed(3)}/s`);
  return `<b>${cellType.name}</b> <span class="dim">${facts.join(' · ')}</span><br>${cellType.description}` +
    `<div class="tooltip-heading">How to use</div>${TIPS[typeName].howToUse}` +
    `<div class="tooltip-heading">Example</div>` +
    `<canvas id="tooltip-demo" width="${DEMO_WIDTH}" height="${DEMO_HEIGHT}"></canvas>`;
}
