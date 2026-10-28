'use strict';
// Floating windows and the menu tree's open branches, both remembered per browser (browser only).

// a window dragged by a handle, resized from the corner; position, size and collapsed state are remembered under store.
// Returns save(), to call after changing the window from code.
function floating(el, handle, store) {
  let g = null;
  try {
    const b = JSON.parse(localStorage.getItem(store));
    if (b) {
      Object.assign(el.style, { left: b.x + 'px', top: b.y + 'px', right: 'auto', width: b.w + 'px', height: b.h ? b.h + 'px' : '' });
      el.classList.toggle('collapsed', !!b.c);
    }
  } catch (e) {}
  handle.addEventListener('mousedown', e => {
    if (e.target.closest && e.target.closest('button')) return;
    g = { mx: e.clientX, my: e.clientY, x: el.offsetLeft, y: el.offsetTop }; e.preventDefault();
  });
  addEventListener('mousemove', e => {
    if (!g) return;
    el.style.left = Math.max(0, Math.min(innerWidth - 60, g.x + e.clientX - g.mx)) + 'px';
    el.style.top = Math.max(0, Math.min(innerHeight - 30, g.y + e.clientY - g.my)) + 'px';
    el.style.right = 'auto';
  });
  const save = () => {
    if (!el.offsetWidth) return;
    const b = { x: el.offsetLeft, y: el.offsetTop, w: parseFloat(el.style.width) || el.offsetWidth, h: parseFloat(el.style.height) || 0, c: el.classList.contains('collapsed') };
    try { localStorage.setItem(store, JSON.stringify(b)); } catch (e) {}
  };
  addEventListener('mouseup', () => { g = null; save(); });
  return save;
}

// a floating window with a –/+ button that hides its body; returns whether it is collapsed now
function collapsible(el, handle, btn, store) {
  const save = floating(el, handle, store), collapsed = () => el.classList.contains('collapsed');
  btn.textContent = collapsed() ? '+' : '–';
  btn.onclick = () => {
    el.classList.toggle('collapsed');
    btn.textContent = collapsed() ? '+' : '–';
    save();
  };
  return collapsed;
}

// remember which tree branches are open (per browser; optional)
function rememberTree() {
  let openState = {};
  try { openState = JSON.parse(localStorage.getItem('bioforge-tree')) || {}; } catch (e) {}
  document.querySelectorAll('details[data-node]').forEach(el => {
    if (el.dataset.node in openState) el.open = openState[el.dataset.node];
    el.addEventListener('toggle', () => {
      openState[el.dataset.node] = el.open;
      try { localStorage.setItem('bioforge-tree', JSON.stringify(openState)); } catch (e) {}
    });
  });
}
