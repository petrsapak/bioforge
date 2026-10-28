'use strict';
// Builder, match and sandbox app (browser only).
// ---------- App (browser only) ----------
function boot() {
  const cv = document.getElementById('game'), ctx = cv.getContext('2d');
  const $ = id => document.getElementById(id);
  // PANEL_W: menu width kept clear when centring the grid; the grid itself runs under the menu
  const PANEL_W = 320, ZOOM_MIN = 0.2, ZOOM_MAX = 5;
  const GAME_SPEED = 2.5;                             // match and sandbox: game seconds per real second
  let zoom = 1.9, panX = 0, panY = 0, pan = null;      // editor view: wheel zooms, middle-drag pans
  let mode = 'build', view = 0, selected = 'muscle', hover = null;
  const budget = MATCH_BIOMASS;                       // every hero gets the same biomass
  let match = null, me = null;                         // the running match; your hero slot in it
  let cam = { x: 0, y: 0 };                           // match: the view's middle (world px), follows you
  let bigMap = false;                                  // M: the whole map
  let design = new Map(TEMPLATES.starter.cells.map(b => [key(b.q, b.r), b.t]));
  let world = null, player = null, tank = null;
  let warns = [], warnHover = -1;                      // design warnings ({ text, keys }); the one under the mouse
  let sel = new Set(), stamp = null;                  // Ctrl+clicked hexes; the saved part being placed ({ t, rot })
  let pdrag = null, adrag = null, libDrag = null, hoverPx = null;   // Bud part / aim being dragged, library part being dragged; cursor in grid px
  let meta = new Map(), focus = null;            // per-cell extras by hex key ({ tpl } for Buds, { bind } for Commands); clicked cell
  const keys = new Set(), digits = new Set();          // digits: number keys held, for bound Commands
  const metaOf = k => { if (!meta.has(k)) meta.set(k, {}); return meta.get(k); };

  // cells not connected to the Nucleus are only planned: drawn faded, free, left out of the creature until joined
  const joined = () => reach(k => design.has(k));
  const list = () => { const j = joined(); return [...design].filter(([k]) => j.has(k)).map(([k, t]) => { const [q, r] = k.split(',').map(Number); return { q, r, t, ...meta.get(k) }; }); };
  const blueprint = () => ({ cells: list() });
  // cost if the change f() were made (f changes the design; undo() puts it back)
  const costWith = (f, undo) => { f(); const c = cost(); undo(); return c; };
  // Unlimited biomass: build as big as you like; entering the world stays locked while over budget (the Sandbox takes any size)
  let freeBuild = false;
  try { freeBuild = localStorage.getItem('bioforge-free') === '1'; } catch (e) {}
  const cap = () => freeBuild ? Infinity : budget;
  const cost = () => bpCost(blueprint());
  const fmt = v => String(Math.round(v * 2) / 2);
  const extent = () => 2 * Math.max(0, ...list().map(b => Math.hypot(...hexPx(b.q, b.r)))) + 2 * CR;   // design diameter in px
  const layout = () => {
    return { gx: PANEL_W + (cv.width - PANEL_W) / 2 + panX, gy: cv.height / 2 + panY };
  };
  // zoom so the whole hex grid fits right of the panel
  function fitView() {
    const w = cv.width - PANEL_W - 30, h = cv.height - 60;
    zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, w / ((2 * GR + 1) * HX), h / ((2 * GR + 1) * HY + 30)));
    panX = panY = 0;
  }

  function resize() { cv.width = innerWidth; cv.height = innerHeight; }
  addEventListener('resize', () => { resize(); if (mode === 'build') rebuildTank(); }); resize();

  function rebuildTank() {
    const S = extent() + 160;                       // hidden sim: drives the live signals and fluids drawn on the grid
    tank = newWorld(S, S); tank.test = true;
    tank.t = performance.now() / 1000;
    spawn(tank, blueprint(), S / 2, S / 2, 0, 0);
    for (const k of sel) if (!design.has(k)) sel.delete(k);
    for (const k of meta.keys()) if (!design.has(k)) meta.delete(k);
    if (focus && !design.has(focus)) focus = null;
    refreshPanel();
  }

  function canPlace(q, r) {
    const k = key(q, r);
    if (!inGrid(q, r) || design.has(k)) return false;
    if (reserved().has(k)) return false;               // kept free for a Bud's part
    // anywhere: a cell off the body is planned and free; joining the body (maybe with planned cells) must fit the budget
    return costWith(() => design.set(k, selected), () => design.delete(k)) <= cap();
  }

  // cells cut off from the nucleus stay, as planned cells
  function removeAt(q, r) {
    if (design.get(key(q, r)) === undefined || design.get(key(q, r)) === 'nucleus') return;
    design.delete(key(q, r));
  }

  // cell dock: one collapsible section per category; each cell type is a hexagon showing the cell, its name and cost
  const HEX_W = 54, HEX_H = Math.round(HEX_W * 2 / Math.sqrt(3)), HEX_GAP = 3;
  const dockSecs = [];
  for (const [t, d] of Object.entries(CELLS)) {
    if (t === 'nucleus') continue;
    if (!dockSecs.length || dockSecs[dockSecs.length - 1].cat !== d.cat) {
      const br = document.createElement('details'), sm = document.createElement('summary'), box = document.createElement('div');
      br.open = true; br.dataset.node = 'cat:' + d.cat; sm.textContent = d.cat; box.className = 'hexes';
      br.appendChild(sm); br.appendChild(box); $('palette').appendChild(br);
      br.addEventListener('toggle', () => layoutDock());
      dockSecs.push({ cat: d.cat, br, box, items: [] });
    }
    const el = document.createElement('button'), cw = HEX_W - 4, ch = HEX_H - 4;
    el.className = 'pal'; el.dataset.t = t;
    el.style.width = HEX_W + 'px'; el.style.height = HEX_H + 'px';
    el.innerHTML = `<canvas width="${cw * 2}" height="${ch * 2}"></canvas>`;
    const ic = el.querySelector && el.querySelector('canvas');
    if (ic) {                                          // drawn at 2x for sharp text
      const g = ic.getContext('2d');
      g.scale(2, 2);
      g.save(); g.translate(cw / 2, ch * 0.4); g.scale(1.2, 1.2);
      drawCell(g, { t, d, hp: 1, max: 1, V: 0, flash: 0, e: 1, f: [0, 0, 0, 0, 0], cap: [1, 1, 1, 1, 1], x: 0, y: 0, rad: CR, owner: { cx: 0, cy: 10, theta: 0 } }, 0);
      g.restore();
      g.globalAlpha = 1; g.textAlign = 'center';
      g.fillStyle = '#dfe4ea'; g.font = '8px system-ui'; g.fillText(d.name, cw / 2, ch * 0.78);
      g.fillStyle = '#e8c547'; g.font = 'bold 8px system-ui'; g.fillText(d.cost, cw / 2, 9);
    }
    el.onclick = () => { selected = t; stamp = null; refreshPanel(); };
    dockSecs[dockSecs.length - 1].box.appendChild(el);
    dockSecs[dockSecs.length - 1].items.push(el);
  }
  // honeycomb: every section uses the same number of rows, the fewest that fit the window width;
  // odd rows are shifted half a hexagon so the rows interlock. Sections wrap if even that is too wide.
  function layoutDock() {
    const step = HEX_W + HEX_GAP, rowH = HEX_H * 0.75 + HEX_GAP, avail = innerWidth - 50;
    const dims = (s, rows) => {
      const cols = Math.ceil(s.items.length / rows), nr = Math.ceil(s.items.length / cols);
      return { cols, nr, w: cols * step - HEX_GAP + (nr > 1 ? step / 2 : 0) };
    };
    const total = rows => dockSecs.reduce((a, s) => a + (s.br.open ? dims(s, rows).w : 70) + 18, 0);
    let rows = 1;
    while (rows < 6 && total(rows) > avail) rows++;
    for (const s of dockSecs) {
      const { cols, nr, w } = dims(s, rows);
      s.items.forEach((el, i) => {
        const r = Math.floor(i / cols), c = i % cols;
        el.style.left = c * step + (r % 2 ? step / 2 : 0) + 'px';
        el.style.top = r * rowH + 'px';
      });
      s.box.style.width = w + 'px'; s.box.style.height = HEX_H + (nr - 1) * rowH + 'px';
    }
  }
  layoutDock();
  addEventListener('resize', layoutDock);

  // floating windows (windows.js)
  floating($('panel'), $('grip'), 'bioforge-panel');
  const pvCollapsed = collapsible($('preview'), $('pvbar'), $('pvtoggle'), 'bioforge-preview');
  collapsible($('lib'), $('libbar'), $('libtoggle'), 'bioforge-lib');

  try { $('dock').classList.toggle('collapsed', localStorage.getItem('bioforge-dock') === '1'); } catch (e) {}
  $('dockbar').onclick = () => {
    $('dock').classList.toggle('collapsed');
    try { localStorage.setItem('bioforge-dock', $('dock').classList.contains('collapsed') ? '1' : '0'); } catch (e) {}
  };

  rememberTree();
  ['Normal', ...FLUIDS.map(f => f.short)].forEach((name, i) => {
    const el = document.createElement('button');
    el.className = 'small'; el.dataset.view = i; el.textContent = name;
    el.onclick = () => { view = i; refreshPanel(); };
    $('views').appendChild(el);
  });
  // replace the whole design (built-in templates and saved creatures); over-budget designs load but cannot fight
  let lastName = '';                                   // name of the saved creature last loaded (offered when saving again)
  function loadDesign(o, label) {
    lastName = o.full ? o.name : '';
    design = new Map(o.cells.map(b => [key(b.q, b.r), b.t]));
    meta = new Map(o.cells.filter(b => b.tpl || b.bind).map(b => [key(b.q, b.r), { tpl: b.tpl, bind: b.bind, rot: b.rot, off: b.off, aim: b.aim }]));
    stamp = null; sel.clear(); focus = null;
    rebuildTank();
    const why = buildCheck(blueprint());
    if (why) $('info').textContent = `${label}: ${why}. Watch it here; to take it into a match, change it.`;
  }
  document.querySelectorAll('[data-tpl]').forEach(btn => btn.onclick = () => {
    const t = btn.dataset.tpl;
    loadDesign(t === 'clear' ? { cells: [{ q: 0, r: 0, t: 'nucleus' }] } : TEMPLATES[t], btn.textContent);
  });

  // ---------- template library: saved selections, stamped back onto the design as parts ----------
  // saved part: cells relative to an anchor cell; a saved creature (has the Nucleus) is stored as-is
  const LIB_KEY = 'bioforge-templates';
  let lib = [], libRows = [];
  try { lib = JSON.parse(localStorage.getItem(LIB_KEY)) || []; } catch (e) {}
  const saveLib = () => { try { localStorage.setItem(LIB_KEY, JSON.stringify(lib)); } catch (e) {} };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  function saveSelection(name) {
    const cells = [...sel].filter(k => design.has(k)).map(k => { const [q, r] = k.split(',').map(Number); return { q, r, t: design.get(k), ...meta.get(k) }; });
    if (!cells.length) return;
    const full = cells.some(b => b.t === 'nucleus');
    let a = { q: 0, r: 0 };
    if (!full) {                                       // anchor: the cell nearest the middle, so the stamp hangs under the cursor
      const px = cells.map(b => hexPx(b.q, b.r)), mx = px.reduce((s, p) => s + p[0], 0) / px.length, my = px.reduce((s, p) => s + p[1], 0) / px.length;
      const d = px.map(p => (p[0] - mx) ** 2 + (p[1] - my) ** 2);
      a = cells[d.indexOf(Math.min(...d))];
    }
    const t = { name, full, cells: cells.map(b => ({ q: b.q - a.q, r: b.r - a.r, t: b.t, tpl: b.tpl, bind: b.bind, rot: b.rot, off: b.off, aim: b.aim })) };
    const old = lib.findIndex(x => x.name === name && !!x.full === full);   // same name: overwrite it
    if (old >= 0) { if (stamp && stamp.t === lib[old]) stamp = null; lib[old] = t; } else lib.push(t);
    sel.clear(); saveLib(); renderLib(); refreshPanel();
    $('info').textContent = `${old >= 0 ? 'Overwrote' : 'Saved'} "${name}" in ${full ? 'My creatures' : 'My templates'}.`;
  }

  // the stamp's cells turned and moved to (q, r); hexes already taken are skipped
  function stampAt(q, r) {
    const at = (a, b) => { const [x, y] = rotHex(a, b, stamp.rot); return [q + x, r + y]; };
    const cells = stamp.t.cells.map(b => { const [x, y] = at(b.q, b.r); return { q: x, r: y, t: b.t, tpl: b.tpl, bind: b.bind,
      rot: b.rot === undefined ? undefined : b.rot + stamp.rot, off: b.off && rotHex(b.off[0], b.off[1], stamp.rot),
      aim: b.aim === undefined ? undefined : b.aim + stamp.rot * Math.PI / 3 }; }).filter(b => !design.has(key(b.q, b.r)));
    let why = '';
    if (!cells.length) why = 'Every hex there is already taken.';
    else if (cells.some(b => !inGrid(b.q, b.r))) why = 'Part of it is off the grid.';
    else if (cells.some(b => reserved().has(key(b.q, b.r)))) why = "It covers hexes kept free for a Bud's part.";
    else {                                             // off the body it is only planned; joining the body must fit the budget
      const after = costWith(() => { for (const b of cells) design.set(key(b.q, b.r), b.t); },
        () => { for (const b of cells) design.delete(key(b.q, b.r)); });
      if (after > cap()) why = `Not enough biomass: it costs ${fmt(after - cost())}, you have ${fmt(budget - cost())} left.`;
    }
    return { cells, why };
  }
  function placeStamp(q, r) {
    const s = stampAt(q, r);
    if (s.why) { $('info').textContent = s.why; return; }
    for (const b of s.cells) { design.set(key(b.q, b.r), b.t); if (b.tpl || b.bind) meta.set(key(b.q, b.r), { tpl: b.tpl, bind: b.bind, rot: b.rot, off: b.off, aim: b.aim }); }
    rebuildTank();
  }
  function useTemplate(t) {
    if (t.full) { loadDesign(t, t.name); return; }
    if (focus && design.get(focus) === 'bud') { assignPart(focus, t); return; }   // a clicked Bud takes the part as what it grows
    stamp = stamp && stamp.t === t ? null : { t, rot: 0 };   // clicking the active part again puts it down
    refreshPanel();
  }

  // small picture of a template: one dot per cell in its colour
  function thumb(cvs, t) {
    const g = cvs.getContext('2d'), pts = t.cells.map(b => hexPx(b.q, b.r));
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const k = Math.min(3, (cvs.width - 8) / (x1 - x0 + 2 * CR), (cvs.height - 8) / (y1 - y0 + 2 * CR));
    g.clearRect(0, 0, cvs.width, cvs.height);
    g.save(); g.translate(cvs.width / 2, cvs.height / 2); g.scale(k, k); g.translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
    t.cells.forEach((b, i) => { g.fillStyle = CELLS[b.t].color; g.beginPath(); g.arc(pts[i][0], pts[i][1], CR * 0.9, 0, TAU); g.fill(); });
    g.restore();
  }
  function renderLib() {
    $('mycr').innerHTML = lib.some(t => t.full) ? '' : '<div class="help">No creatures saved yet: Edit → Save creature.</div>';
    $('mylib').innerHTML = lib.some(t => !t.full) ? '' : '<div class="help">Nothing saved yet.</div>';
    libRows = lib.map(t => {
      const box = $(t.full ? 'mycr' : 'mylib');
      const row = document.createElement('div'), cvs = document.createElement('canvas'), nm = document.createElement('span');
      const ren = document.createElement('button'), del = document.createElement('button');
      row.className = 'li'; row._t = t;
      row.title = t.full ? 'Click to load this creature' : 'Click to stamp this part onto your creature, or drag it onto a Bud to make the Bud grow it';
      cvs.width = cvs.height = 80; thumb(cvs, t);
      nm.textContent = `${t.name} (${t.cells.length}${t.full ? ', creature' : ''})`;
      ren.className = del.className = 'small'; ren.textContent = '✎'; del.textContent = '✕'; ren.title = 'Rename'; del.title = 'Delete';
      ren.onclick = e => {
        e.stopPropagation();
        const n = prompt(t.full ? 'Creature name' : 'Template name', t.name);
        if (n && n.trim()) { t.name = n.trim().slice(0, 40); saveLib(); renderLib(); refreshPanel(); }
      };
      del.onclick = e => {
        e.stopPropagation();
        if (!confirm(`Delete ${t.full ? 'creature' : 'template'} "${t.name}"?`)) return;
        lib = lib.filter(x => x !== t);
        if (stamp && stamp.t === t) stamp = null;
        saveLib(); renderLib(); refreshPanel();
      };
      row.onclick = () => useTemplate(t);
      row.onmousedown = e => { if (e.button === 0 && !(e.target.closest && e.target.closest('button'))) { libDrag = t; e.preventDefault(); } };   // drag onto a Bud
      for (const x of [cvs, nm, ren, del]) row.appendChild(x);
      box.appendChild(row);
      return row;
    });
  }
  renderLib();

  // right-click on a selected cell: name it and save
  function openSave(x, y) {
    $('ctxn').textContent = `${sel.size} selected cell${sel.size === 1 ? '' : 's'}${[...sel].some(k => design.get(k) === 'nucleus') ? ' (with the Nucleus: saves a whole creature)' : ''}`;
    const whole = [...sel].some(k => design.get(k) === 'nucleus');
    $('ctxname').value = whole ? lastName || `Creature ${lib.filter(t => t.full).length + 1}` : `Part ${lib.length + 1}`;
    $('ctxsave').textContent = whole ? 'Save creature' : 'Save template';
    Object.assign($('ctx').style, { display: 'block', left: Math.min(x, innerWidth - 230) + 'px', top: Math.min(y, innerHeight - 120) + 'px' });
    $('ctxname').focus?.(); $('ctxname').select?.();
  }
  const closeCtx = () => { $('ctx').style.display = 'none'; };
  $('ctxsave').onclick = () => { saveSelection($('ctxname').value.trim().slice(0, 40) || `Part ${lib.length + 1}`); closeCtx(); };
  $('ctxclear').onclick = () => { sel.clear(); closeCtx(); };
  // Save creature: select every cell and ask for a name (the name of the last loaded saved creature, to overwrite it)
  $('savecr').onclick = e => { sel = new Set(design.keys()); openSave(e.clientX, e.clientY); };
  $('freebuild').onclick = () => {
    freeBuild = !freeBuild;
    try { localStorage.setItem('bioforge-free', freeBuild ? '1' : '0'); } catch (e) {}
    refreshPanel();
  };
  $('ctxname').addEventListener('keydown', e => { if (e.key === 'Enter') $('ctxsave').onclick(); if (e.key === 'Escape') closeCtx(); });
  addEventListener('mousedown', e => { if (!(e.target && e.target.closest && e.target.closest('#ctx'))) closeCtx(); });
  $('fight').onclick = startBattle;

  // design checks (design.js) on the joined body l; cells off the body are reported as planned
  const warnings = l => designWarnings(l, [...design.keys()].filter(k => !l.some(b => key(b.q, b.r) === k)));

  // Bud parts are edited directly on the grid: drag a part's dots to move it (pdrag), drag the arrow tip to aim (adrag),
  // Q/E turn the part around its Bud (or in hand while dragging). A part from the library is dropped on a Bud (libDrag).
  // hexes other Buds' parts will grow on (skip = one Bud to leave out)
  function reserved(skip) {
    const all = list(), s = new Set();
    for (const b of all) if (b.t === 'bud' && b.tpl && key(b.q, b.r) !== skip) for (const c of budPlan(all, b).cells) s.add(key(c.q, c.r));
    return s;
  }
  // the Bud k's part turned by rot with its middle cell at (q, r); why = reason it cannot go there
  function partAt(k, rot, q, r) {
    const [bq, br] = k.split(',').map(Number), m = meta.get(k);
    const cells = m.tpl.cells.map(c => { const [x, y] = rotHex(c.q, c.r, rot); return { q: q + x, r: r + y, t: c.t }; });
    const ks = new Set(cells.map(c => key(c.q, c.r))), others = reserved(k);
    let why = '';
    if (cells.some(c => !inGrid(c.q, c.r))) why = 'Part of it is off the grid.';
    else if (cells.some(c => design.has(key(c.q, c.r)))) why = 'It covers cells of the body.';
    else if (cells.some(c => others.has(key(c.q, c.r)))) why = "It covers another Bud's part.";
    else {                                             // every cell must hang on the Bud through the part itself
      const seen = new Set(), queue = [[bq, br]];
      while (queue.length) {
        const [cq, cr] = queue.pop();
        for (const [dq, dr] of NB) { const k = key(cq + dq, cr + dr); if (ks.has(k) && !seen.has(k)) { seen.add(k); queue.push([cq + dq, cr + dr]); } }
      }
      if (seen.size < ks.size) why = 'It must touch the Bud, with every cell connected to it.';
    }
    return { cells, why, off: [q - bq, r - br] };
  }
  // put the Bud k's part at (q, r) turned by rot, if it fits; otherwise say why and keep it where it was
  function setPart(k, rot, q, r) {
    const p = partAt(k, rot, q, r);
    if (p.why) { rebuildTank(); $('info').textContent = p.why; return false; }
    Object.assign(metaOf(k), { rot: (rot % 6 + 6) % 6, off: p.off });
    rebuildTank(); return true;
  }
  // the Bud's current part placement (also for Buds still on the automatic spot)
  function partOf(k) {
    const [q, r] = k.split(',').map(Number), m = meta.get(k), p = budPlan(list(), { q, r, ...m });
    return { q, r, rot: p.rot, off: m.off || p.off };
  }
  // give Bud k a part from the library; it starts on the automatic spot next to the Bud, ready to drag
  function assignPart(k, t) {
    focus = k;
    if (t.full || t.cells.some(b => b.t === 'bud')) { refreshPanel(); $('info').textContent = 'A Bud can only grow a part without a Nucleus or another Bud.'; return; }
    const m = metaOf(k), [q, r] = k.split(',').map(Number);
    m.tpl = { name: t.name, cells: t.cells.map(({ q, r, t }) => ({ q, r, t })) };
    delete m.off; delete m.rot;
    const p = budPlan(list(), { q, r, tpl: m.tpl });
    if (p.off) { m.off = p.off; m.rot = (p.rot % 6 + 6) % 6; }
    rebuildTank();
  }
  // turn the Bud k's part one 60° step around the Bud
  function turnPart(k, d) {
    const o = partOf(k);
    if (!o.off) return;
    const [x, y] = rotHex(o.off[0], o.off[1], d);
    setPart(k, o.rot + d, o.q + x, o.r + y);
  }
  // aim arrow of a Bud: from just past the far end of its part, along its firing direction (grid pixels)
  function aimArrow(all, b) {
    const p = budPlan(all, b);
    if (!p.cells.length) return null;
    const [dx, dy] = p.dir, tip = Math.max(...p.cells.map(c => { const [x, y] = hexPx(c.q, c.r); return x * dx + y * dy; }));
    const [bx, by] = hexPx(b.q, b.r), o = Math.max(CR, tip - (bx * dx + by * dy) + CR);
    return { dx, dy, x0: bx + dx * o, y0: by + dy * o, x1: bx + dx * (o + 18), y1: by + dy * (o + 18) };
  }
  // what is under the cursor: the clicked Bud's arrow tip, or a cell of some Bud's part
  function budHandle(q, r) {
    const all = list();
    if (focus && design.get(focus) === 'bud' && hoverPx) {
      const a = aimArrow(all, all.find(c => key(c.q, c.r) === focus));
      if (a && (hoverPx[0] - a.x1) ** 2 + (hoverPx[1] - a.y1) ** 2 < 12 * 12) return { k: focus, aim: true };
    }
    for (const b of all) if (b.t === 'bud' && b.tpl) {
      const p = budPlan(all, b);
      if (p.off && p.cells.some(c => c.q === q && c.r === r)) return { k: key(b.q, b.r), grab: [q - b.q - p.off[0], r - b.r - p.off[1]], rot: p.rot };
    }
    return null;
  }

  // info for the clicked cell: Buds show and take their part, Commands show and take their key
  function focusInfo() {
    const t = design.get(focus), d = CELLS[t], m = meta.get(focus) || {};
    let s = `<b>${d.name}</b> (clicked cell; Esc to let go)<br>`;
    if (t === 'bud') {
      const p = m.tpl, secs = p ? bpCost(p) * GROW_FUEL / (d.fuel * FUEL_K) : 0;
      s += p ? `Grows <b>${esc(p.name)}</b> (${p.cells.length} cells, about ${Math.round(secs)} s when well fed). ` : 'Grows nothing yet. ';
      s += p ? 'Drag its dots to move it, Q/E turn it around the Bud, drag the arrow tip to aim. ' : '';
      s += 'Drag a part from the Templates library onto a Bud (or click it while this Bud is clicked) to make it grow that. Fire it with a nerve signal once the ring is full.';
      if (p) s += `<br><span class="help">${m.aim !== undefined ? `Fires at ${Math.round(((m.aim * 180 / Math.PI) % 360 + 360) % 360)}° (0° = straight ahead, clockwise).`
          : "Fires the way the part's front (top in the library picture) points."}</span>`
        + (m.aim !== undefined ? '<div class="row"><button class="small" id="budaimreset">Reset aim</button></div>' : '');
    } else if (t === 'command') {
      s += `Fires on <b>${m.bind ? 'key ' + m.bind : 'Space'}</b>. Press 1–9 to bind it to a number key, the same key again to go back to Space. The AI still fires it when close.`;
    } else s += d.desc;
    return s;
  }

  function refreshPanel() {
    document.querySelectorAll('.pal').forEach(el => el.classList.toggle('sel', el.dataset.t === selected));
    document.querySelectorAll('[data-view]').forEach(el => el.classList.toggle('sel', +el.dataset.view === view));
    $('budget').innerHTML = `Biomass: <b>${fmt(budget - cost())}</b> / ${budget} · Cells ${list().length} / ${MATCH_CELLS}` + (freeBuild ? ' <span class="help">(unlimited: a match needs it under budget, Sandbox takes any size)</span>' : '');
    $('freebuild').classList.toggle('sel', freeBuild);
    const d = CELLS[selected];
    for (const row of libRows) row.classList.toggle('sel', !!stamp && stamp.t === row._t);
    $('info').innerHTML = stamp
      ? `<b>Placing "${esc(stamp.t.name)}"</b> (${stamp.t.cells.length} cells, ${fmt(bpCost(stamp.t))} biomass)<br>Click to place it; off the body it stays planned until joined. Hexes already taken are skipped. Q/E rotate, right-click or Esc to stop.`
      : focus ? focusInfo()
      : `<b>${d.name}</b> (${d.hp} HP${d.cond ? ', carries nerve signals' : ''}${d.fuel ? `, burns ${+(d.fuel * FUEL_K).toFixed(3)}/s` : ''})<br>${d.desc}`;
    const bz = document.getElementById('budaimreset');
    if (bz) bz.onclick = () => { delete metaOf(focus).aim; rebuildTank(); };
    const l = list();
    const hp = l.reduce((s, b) => s + CELLS[b.t].hp, 0), mass = l.reduce((s, b) => s + CELLS[b.t].mass, 0);
    const burnMax = l.reduce((s, b) => s + CELLS[b.t].fuel * FUEL_K, 0), gillO2 = l.filter(b => b.t === 'gill').length * GILL_O2;
    const energy = l.reduce((s, b) => s + CELLS[b.t].capS * START_FILL, 0);
    $('stats').innerHTML = `Cells: ${l.length}   Mass: ${mass.toFixed(1)}   HP: ${hp}`
      + `\nMax burn: ${burnMax.toFixed(2)}/s   Gills: +${gillO2.toFixed(2)} O₂/s\nEnergy stock: ${energy.toFixed(1)}${l.some(b => b.t === 'mouth') ? ' + whatever the Mouth eats' : ' (no Mouth)'}`
      + (warns = warnings(l)).map((w, i) => `\n<span class="warn" data-w="${i}">⚠ ${w.text}</span>`).join('');
    // hovering a warning outlines the cells it is about on the grid
    $('stats').onmouseover = e => { warnHover = e.target.dataset && e.target.dataset.w !== undefined ? +e.target.dataset.w : -1; };
    $('stats').onmouseleave = () => { warnHover = -1; };
    const why = buildCheck(blueprint());
    $('fight').disabled = !!why;
    $('fight').textContent = why || 'Start 5v5 match ▶';
  }

  // sandbox: play any creature with no budget, click the water to spawn enemies, nobody wins or loses
  let sandbox = false;
  const SB_TPL = ['wiggler', 'squirter', 'nettler', 'puffer', 'starter', 'eel', 'jelly', 'manta', 'crab'];
  for (const id of ['sbme', 'sbfoe']) for (const v of ['mine', ...SB_TPL]) {
    const o = document.createElement('option');
    o.value = v; o.textContent = v === 'mine' ? 'Your design' : v[0].toUpperCase() + v.slice(1);
    $(id).appendChild(o);
  }
  $('sbme').value = 'mine'; $('sbfoe').value = 'wiggler';
  const sbBlueprint = v => v === 'mine' ? blueprint() : TEMPLATES[v];

  // sandbox only (in a match the match respawns you)
  function spawnPlayer() {
    if (player) removeCreature(world, player);
    const bpo = sbBlueprint($('sbme').value);
    const ext = Math.max(...bpo.cells.map(b => Math.hypot(...hexPx(b.q, b.r))));
    player = spawn(world, bpo, cv.width / 2, cv.height - Math.max(150, ext + 50), 0, 0);
    player.hp0 = player.cells.reduce((s, c) => s + c.max, 0);   // for the HUD's Body bar
  }

  function startBattle(sb) {
    sandbox = sb === true;
    if (!sandbox && buildCheck(blueprint())) return;
    player = null; bigMap = false;
    if (sandbox) { match = me = null; world = newWorld(cv.width, cv.height); spawnPlayer(); }
    else { match = makeMatch(blueprint(), Date.now() % 1e6); world = match.w; me = match.heroes[0]; player = me.cr; cam = { x: player.cx, y: player.cy }; }
    if (sandbox) world.idle = $('sbai').textContent.endsWith('idle');
    mode = 'battle'; hideTip(); closeCtx(); stamp = pdrag = adrag = null;
    $('panel').style.display = $('preview').style.display = $('lib').style.display = $('dock').style.display = 'none'; $('hud').style.display = 'block'; $('msg').style.display = 'none';
    $('sbar').style.display = sandbox ? 'flex' : 'none';
  }

  const sbBtn = (id, f) => $(id).onclick = e => { f(); e?.currentTarget?.blur?.(); };   // blur so Space doesn't re-press it
  sbBtn('sandbox', () => startBattle(true));
  sbBtn('sbai', () => { world.idle = !world.idle; $('sbai').textContent = `Enemies: ${world.idle ? 'idle' : 'hunt'}`; });
  sbBtn('sbclear', () => world.creatures.filter(c => c.team !== 0).forEach(c => removeCreature(world, c)));
  sbBtn('sbrespawn', spawnPlayer);
  sbBtn('sbexit', () => toBuild());
  $('sbme').onchange = e => { spawnPlayer(); e?.target?.blur?.(); };
  $('sbfoe').onchange = e => e?.target?.blur?.();

  function toBuild() {
    mode = 'build'; world = match = me = null; sandbox = false; $('sbar').style.display = 'none';
    $('panel').style.display = $('preview').style.display = $('lib').style.display = 'flex'; $('dock').style.display = 'block'; $('hud').style.display = 'none'; $('msg').style.display = 'none';
    rebuildTank();
  }

  addEventListener('keydown', e => {
    if (e.target && e.target.tagName === 'INPUT') return;   // typing a template name
    keys.add(e.key.toLowerCase());
    if (e.key === ' ') e.preventDefault();
    // Shift+1..6 = fluid view; 1..9 = bound Command triggers (with a Command clicked in the builder: bind it)
    const dig = /^Digit[0-9]$/.test(e.code || '') ? e.code[5] : /^[0-9]$/.test(e.key) ? e.key : null;
    if (dig && e.shiftKey) { if (dig >= '1' && dig <= '6') { view = +dig - 1; if (mode === 'build') refreshPanel(); } }
    else if (dig && dig !== '0') {
      digits.add(dig);
      if (mode === 'build' && focus && design.get(focus) === 'command' && !e.repeat) {
        const m = metaOf(focus); m.bind = m.bind === dig ? undefined : dig;
        rebuildTank();
      }
    }
    if (mode === 'build' && e.key.toLowerCase() === 'f') fitView();
    if (mode === 'build' && e.key === 'Escape') { if (pdrag || adrag) pdrag = adrag = null; else { stamp = null; sel.clear(); focus = null; } closeCtx(); refreshPanel(); }
    if (mode === 'build' && 'qe'.includes(e.key.toLowerCase()) && e.key.length === 1) {
      const d = e.key.toLowerCase() === 'e' ? 1 : -1;
      if (stamp) stamp.rot += d;
      else if (pdrag) { pdrag.rot += d; pdrag.grab = rotHex(pdrag.grab[0], pdrag.grab[1], d); }   // turn it in hand
      else if (focus && design.get(focus) === 'bud' && meta.get(focus)?.tpl) turnPart(focus, d);
    }
    if (mode !== 'battle') return;
    if (e.key === 'Escape') toBuild();
    if (e.key.toLowerCase() === 't') { if (me) me.auto = !me.auto; else player.auto = !player.auto; }   // in a match: a bot plays you
    if (e.key.toLowerCase() === 'm' && match) bigMap = !bigMap;
    if (e.key.toLowerCase() === 'r' && sandbox) spawnPlayer();
  });
  addEventListener('keyup', e => {
    keys.delete(e.key.toLowerCase());
    const dig = /^Digit[0-9]$/.test(e.code || '') ? e.code[5] : /^[0-9]$/.test(e.key) ? e.key : null;
    if (dig) digits.delete(dig);
  });
  const hexAt = e => { const L = layout(); return pxToHex((e.clientX - L.gx) / zoom, (e.clientY - L.gy) / zoom); };
  cv.addEventListener('mousemove', e => {
    if (pan) { panX = pan.x + e.clientX - pan.mx; panY = pan.y + e.clientY - pan.my; }
    hover = mode === 'build' ? hexAt(e) : null;
    if (mode === 'build') { const L = layout(); hoverPx = [(e.clientX - L.gx) / zoom, (e.clientY - L.gy) / zoom]; }
  });
  addEventListener('mouseup', e => {
    if (mode === 'build' && hover) {
      if (pdrag) setPart(pdrag.k, pdrag.rot, hover[0] - pdrag.grab[0], hover[1] - pdrag.grab[1]);   // drop the dragged part
      if (adrag && hoverPx) {                          // aim from the Bud toward where the arrow tip was let go
        const [bx, by] = hexPx(...adrag.split(',').map(Number)), dx = hoverPx[0] - bx, dy = hoverPx[1] - by;
        if (dx * dx + dy * dy > 4) metaOf(adrag).aim = Math.atan2(dx, -dy);
        rebuildTank();
      }
      if (libDrag && e.target === cv && design.get(key(...hover)) === 'bud') assignPart(key(...hover), libDrag);
    }
    pan = pdrag = adrag = libDrag = null;
  });
  cv.addEventListener('wheel', e => {                  // zoom toward the cursor
    if (mode !== 'build') return;
    e.preventDefault();
    const L = layout(), z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom * Math.exp(-e.deltaY * 0.0015)));
    panX += (e.clientX - L.gx) * (1 - z / zoom); panY += (e.clientY - L.gy) * (1 - z / zoom);
    zoom = z;
  }, { passive: false });
  cv.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (mode === 'build' && !stamp && sel.has(key(...hexAt(e)))) openSave(e.clientX, e.clientY);
  });
  // tooltip after the cursor rests 1 s on a placed cell or a palette button
  let tipKey = null, tipSince = 0, mouseX = 0, mouseY = 0;
  const hideTip = () => { tipSince = performance.now(); $('tip').style.display = 'none'; stopDemo(); };
  addEventListener('mousemove', e => {
    mouseX = e.clientX; mouseY = e.clientY;
    let k = null;
    const pal = e.target && e.target.closest && e.target.closest('.pal');
    if (pal) k = 'p:' + pal.dataset.t;
    else if (e.target === cv && mode === 'build') { const [q, r] = hexAt(e); if (design.has(key(q, r))) k = 'g:' + key(q, r); }
    if (k !== tipKey) { tipKey = k; hideTip(); }
  });
  addEventListener('mousedown', hideTip);
  function updateTip(now) {
    const el = $('tip');
    if (!tipKey || mode !== 'build' || now - tipSince < 1000 || el.style.display === 'block') return;
    const t = tipKey[0] === 'p' ? tipKey.slice(2) : design.get(tipKey.slice(2)), d = CELLS[t];
    if (!d) return;
    const facts = [`cost ${d.cost}`, `${d.hp} HP`, d.cond && 'carries nerve signals', d.fuel && `burns ${+(d.fuel * FUEL_K).toFixed(3)}/s`].filter(Boolean).join(' · ');
    el.innerHTML = `<b>${d.name}</b> <span class="dim">${facts}</span><br>${d.desc}<div class="h">How to use</div>${TIPS[t].use}`
      + `<div class="h">Example</div><canvas id="democv" width="${DEMO_W}" height="${DEMO_H}"></canvas>`;
    el.style.display = 'block';
    el.style.left = Math.max(8, Math.min(mouseX + 16, innerWidth - el.offsetWidth - 8)) + 'px';
    el.style.top = Math.max(8, Math.min(mouseY + 16, innerHeight - el.offsetHeight - 8)) + 'px';
    startDemo(t, $('democv'));                         // live example in the tooltip (tipdemo.js)
  }

  cv.addEventListener('mousedown', e => {
    if (mode === 'battle' && sandbox) {
      const x = e.clientX, y = e.clientY;
      if (e.button === 0) {                             // spawn the chosen enemy here, facing the player
        spawn(world, sbBlueprint($('sbfoe').value), x, y, Math.atan2(player.cx - x, y - player.cy), 1);
      } else if (e.button === 2) {                      // remove the enemy (or debris) under the cursor
        const hit = world.cells.find(c => c.owner !== player && (c.x - x) ** 2 + (c.y - y) ** 2 < (c.rad + 4) ** 2);
        if (hit) removeCreature(world, hit.owner);
      }
      return;
    }
    if (mode !== 'build') return;
    if (e.button === 1) { e.preventDefault(); pan = { x: panX, y: panY, mx: e.clientX, my: e.clientY }; return; }
    const [q, r] = hexAt(e), k = key(q, r);
    if (e.button === 0 && !stamp && !(e.ctrlKey || e.metaKey)) {   // grab a Bud's arrow tip or part
      const h = budHandle(q, r);
      if (h) { focus = h.k; if (h.aim) adrag = h.k; else pdrag = h; refreshPanel(); return; }
    }
    if (stamp) { if (e.button === 2) { stamp = null; refreshPanel(); } else placeStamp(q, r); return; }
    if (e.button === 0 && (e.ctrlKey || e.metaKey)) { if (design.has(k) && !sel.delete(k)) sel.add(k); return; }
    if (e.button === 2 && sel.has(k)) return;          // the context menu opens on this cell instead (see contextmenu)
    if (e.button === 0 && design.has(k)) { focus = k; refreshPanel(); return; }   // inspect / set up a placed cell
    if (e.button === 2) removeAt(q, r);
    else if (canPlace(q, r)) { design.set(key(q, r), selected); focus = selected === 'bud' || selected === 'command' ? k : null; }   // ready to set up
    else return;
    rebuildTank();
  });

  function hexPath(x, y, s) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; ctx.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s); }
    ctx.closePath();
  }

  function drawBuild() {
    ctx.fillStyle = '#0b1418'; ctx.fillRect(0, 0, cv.width, cv.height);
    const L = layout();
    // hex grid with the design (static), cells showing the tank's live nerve signals and fluids
    ctx.save(); ctx.translate(L.gx, L.gy); ctx.scale(zoom, zoom);
    const pad = HX * zoom;                             // skip hexes outside the screen
    for (let q = -GR; q <= GR; q++) for (let r = -GR; r <= GR; r++) {
      if (!inGrid(q, r)) continue;
      const [x, y] = hexPx(q, r), sx = L.gx + x * zoom, sy = L.gy + y * zoom;
      if (sx < -pad || sx > cv.width + pad || sy < -pad || sy > cv.height + pad) continue;
      hexPath(x, y, HX / Math.sqrt(3) - 0.6);
      const hov = !stamp && !pdrag && !adrag && !libDrag && hover && hover[0] === q && hover[1] === r;
      ctx.fillStyle = !hov ? '#132228' : canPlace(q, r) ? 'rgba(120,220,120,0.3)' : 'rgba(230,90,90,0.25)';
      ctx.fill();
    }
    const live = new Map(tank.cells.map(c => [key(c.q, c.r), c])), joinedK = joined();
    for (const [k, t] of design) {
      const [q, r] = k.split(',').map(Number), [x, y] = hexPx(q, r), tc = live.get(k), plan = !joinedK.has(k);
      // static copy of the live tank cell drawn at its grid slot; thorns and mouths face away from the nucleus
      const fallback = { t, d: CELLS[t], hp: 1, max: 1, V: 0, flash: 0, e: 1, f: [0, 0, 0, 0, 0], cap: [1, 1, 1, 1, 1] };
      drawCell(ctx, { ...(tc || fallback), x, y, rad: CR, owner: { cx: 0, cy: 0, theta: 0 } }, view);
      if (plan) {                                      // planned (not joined to the body): washed out, dashed outline
        hexPath(x, y, HX / Math.sqrt(3) - 0.6); ctx.fillStyle = 'rgba(19,34,40,0.6)'; ctx.fill();
        hexPath(x, y, HX / Math.sqrt(3) - 1.2); ctx.strokeStyle = '#8a96a3'; ctx.lineWidth = 1; ctx.setLineDash([2, 2]); ctx.stroke(); ctx.setLineDash([]);
      }
    }
    ctx.lineCap = 'round';
    // where each Bud's part will grow (dots; brighter for the clicked Bud) and its firing arrow (tip = drag handle)
    const all = list();
    for (const b of all) if (b.t === 'bud' && b.tpl) {
      const k = key(b.q, b.r), mine = k === focus;
      if (pdrag && pdrag.k === k) continue;            // drawn under the cursor instead
      const p = budPlan(all, b);
      for (const c of p.cells) {
        const [x, y] = hexPx(c.q, c.r);
        ctx.globalAlpha = mine ? 0.55 : 0.25; ctx.fillStyle = CELLS[c.t].color; ctx.beginPath(); ctx.arc(x, y, CR * 0.7, 0, TAU); ctx.fill();
        if (mine) { ctx.globalAlpha = 0.8; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.setLineDash([2, 2]); hexPath(x, y, HX / Math.sqrt(3) - 1.2); ctx.stroke(); ctx.setLineDash([]); }
      }
      const a = aimArrow(all, b);
      if (!a) continue;
      let { dx, dy, x0, y0, x1, y1 } = a;
      if (adrag === k && hoverPx) {                    // being aimed: point at the cursor
        const [bx, by] = hexPx(b.q, b.r), l = Math.hypot(hoverPx[0] - bx, hoverPx[1] - by) || 1;
        dx = (hoverPx[0] - bx) / l; dy = (hoverPx[1] - by) / l;
        x0 = bx + dx * CR; y0 = by + dy * CR; x1 = hoverPx[0]; y1 = hoverPx[1];
      }
      ctx.globalAlpha = mine ? 0.95 : 0.5; ctx.strokeStyle = '#c8e07a'; ctx.lineWidth = mine ? 2 : 1.5;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
      ctx.moveTo(x1 - dx * 6 - dy * 4, y1 - dy * 6 + dx * 4); ctx.lineTo(x1, y1); ctx.lineTo(x1 - dx * 6 + dy * 4, y1 - dy * 6 - dx * 4); ctx.stroke();
      if (mine) { ctx.fillStyle = '#c8e07a'; ctx.beginPath(); ctx.arc(x1, y1, 3.5, 0, TAU); ctx.fill(); }   // grab here to aim
    }
    ctx.globalAlpha = 1;
    if (focus) { const [x, y] = hexPx(...focus.split(',').map(Number)); hexPath(x, y, HX / Math.sqrt(3) - 0.6); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
    // Ctrl+click selection: dashed gold outlines
    ctx.strokeStyle = '#e8c547'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 2]);
    for (const k of sel) { const [x, y] = hexPx(...k.split(',').map(Number)); hexPath(x, y, HX / Math.sqrt(3) - 1.2); ctx.stroke(); }
    ctx.setLineDash([]);
    // cells some warning is about: small orange "!"; the warning under the mouse outlines its cells
    const hot = new Set(warns[warnHover] ? warns[warnHover].keys : []);
    ctx.font = 'bold 6px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const k of new Set(warns.flatMap(w => w.keys))) {
      const [x, y] = hexPx(...k.split(',').map(Number)), bx = x + CR * 0.6, by = y - CR * 0.6;
      ctx.globalAlpha = warnHover < 0 || hot.has(k) ? 1 : 0.35;
      ctx.fillStyle = '#e8875a'; ctx.beginPath(); ctx.arc(bx, by, 3.2, 0, TAU); ctx.fill();
      ctx.fillStyle = '#0b1418'; ctx.fillText('!', bx, by + 0.3);
    }
    ctx.globalAlpha = 1; ctx.textBaseline = 'alphabetic';
    ctx.strokeStyle = '#ffb48f'; ctx.lineWidth = 2.5;
    for (const k of hot) { const [x, y] = hexPx(...k.split(',').map(Number)); hexPath(x, y, HX / Math.sqrt(3) - 0.6); ctx.stroke(); }
    // library part dragged over the grid: say where to drop it
    if (libDrag && hoverPx) {
      const onBud = hover && design.get(key(...hover)) === 'bud';
      ctx.fillStyle = onBud ? '#c8e07a' : '#8a96a3'; ctx.font = '6px system-ui'; ctx.textAlign = 'left';
      ctx.fillText(onBud ? `Drop: this Bud grows "${libDrag.name}"` : 'Drop it on a Bud', hoverPx[0] + 8, hoverPx[1] - 6);
    }
    // Bud part being dragged / part being stamped: ghost under the cursor, green if it fits, red if not
    if ((pdrag || stamp) && hover) {
      const s = pdrag ? partAt(pdrag.k, pdrag.rot, hover[0] - pdrag.grab[0], hover[1] - pdrag.grab[1]) : stampAt(hover[0], hover[1]), ok = !s.why;
      for (const b of s.cells) {
        const [x, y] = hexPx(b.q, b.r);
        hexPath(x, y, HX / Math.sqrt(3) - 0.6); ctx.fillStyle = ok ? 'rgba(120,220,120,0.3)' : 'rgba(230,90,90,0.3)'; ctx.fill();
        ctx.globalAlpha = 0.6; ctx.fillStyle = CELLS[b.t].color; ctx.beginPath(); ctx.arc(x, y, CR * 0.8, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
      }
    }
    ctx.fillStyle = '#6f7b88'; ctx.font = '7px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('▲ FRONT', 0, -GR * HY - 14);
    if (view) { ctx.fillStyle = FLUIDS[view - 1].color; ctx.fillText(`showing ${FLUIDS[view - 1].name} level`, 0, GR * HY + 20); }
    ctx.restore();
    ctx.fillStyle = '#6f7b88'; ctx.font = '12px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('Wheel: zoom · Middle-drag: pan · F: whole grid', cv.width / 2, 20);
    drawPreview();
  }

  // the hidden sim drawn into the floating preview window, scaled to fit
  function drawPreview() {
    const pv = $('pv'), w = pv.clientWidth, h = pv.clientHeight;
    if (pvCollapsed() || !w || !h) return;
    if (pv.width !== w || pv.height !== h) { pv.width = w; pv.height = h; }
    const pc = pv.getContext('2d'), k = Math.min(w / tank.w, h / tank.h);
    pc.fillStyle = '#0b1418'; pc.fillRect(0, 0, w, h);
    pc.save(); pc.translate((w - tank.w * k) / 2, (h - tank.h * k) / 2); pc.scale(k, k);
    drawWater(pc, tank, tank.w, tank.h);
    drawWorld(pc, tank, view);
    pc.restore();
  }

  const HUD_BARS = makeHudBars($('hudbars'));          // hud.js
  let hudKeys = '';
  function drawHud(left) {
    const v = vitals(player), dead = !player.alive;
    const clock = t => `${t / 60 | 0}:${String(t % 60 | 0).padStart(2, '0')}`;
    $('hudlvl').style.display = sandbox ? 'none' : '';
    if (match) $('hudlvl').textContent = `${clock(match.t)} · next wave ${Math.ceil(match.waveT)} s`;
    $('hudwave').textContent = sandbox ? 'Sandbox' : `${ARENA.teams[0].name} ${match.kills[0]} – ${match.kills[1]} ${ARENA.teams[1].name}`;
    $('hudfoes').textContent = sandbox ? `Enemies ${left}` : `${Math.round(fps)} fps`;
    HUD_BARS.forEach((b, i) => {
      const x = clamp01(v.bars[i]);
      b.fill.style.width = (x * 100).toFixed(1) + '%'; b.val.textContent = Math.round(x * 100) + '%';
      b.row.classList.toggle('low', !dead && b.low(x));
    });
    $('huddead').style.display = dead ? 'block' : 'none';
    $('huddead').textContent = match ? `You died · back in ${Math.ceil(me.respawn / GAME_SPEED)} s` : 'You died · R respawns';
    $('hudchips').innerHTML = (v.starving ? `<span class="c-starve">${v.starving} starving</span>` : '')
      + (v.poisoned ? `<span class="c-poison">${v.poisoned} poisoned</span>` : '') + ((me ? me.auto : player.auto) ? '<span class="c-auto">Autopilot</span>' : '');
    const k = (sandbox ? '<b>Click</b> spawn &nbsp;<b>Right-click</b> remove &nbsp;<b>R</b> respawn<br>' : '')
      + '<b>W</b><b>S</b> swim &nbsp;<b>A</b><b>D</b> turn &nbsp;<b>Space</b> fire &nbsp;<b>1–9</b> triggers<br><b>T</b> autopilot &nbsp;' + (match ? '<b>M</b> map &nbsp;' : '') + '<b>Shift+1–6</b> view &nbsp;<b>Esc</b> builder';
    if (k !== hudKeys) $('hudkeys').innerHTML = hudKeys = k;
  }

  let last = performance.now(), fps = 60;
  function frame(now) {
    const raw = (now - last) / 1000, dt = Math.min(0.05, raw); last = now;   // a slow frame past 20 fps slows the game down
    fps += (1 / Math.max(raw, 1e-3) - fps) * 0.05;
    if (mode === 'build') {
      const L = layout();
      for (const cr of tank.creatures) if (!cr.debris) { cr.want = 0; }
      step(tank, dt, { sx: 0, sy: 0, ability: keys.has(' '), held: digits });
      // keep the hidden creature in the middle of its world
      const pc = tank.creatures.find(c => !c.debris);
      if (pc) for (const c of tank.cells) { c.x += (tank.w / 2 - pc.cx) * 0.05; c.y += (tank.h / 2 - pc.cy) * 0.05; }
      drawBuild();
      updateTip(now);
      runDemo(dt);
    } else {
      const k = n => keys.has(n);
      const turn = (k('d') || k('arrowright') ? 1 : 0) - (k('a') || k('arrowleft') ? 1 : 0);
      const fwd = (k('w') || k('arrowup') ? 1 : 0) - (k('s') || k('arrowdown') ? 1 : 0);
      // game time runs GAME_SPEED x real time, in steps of at most 1/40 s so the springs stay stable
      const n = Math.ceil(dt * GAME_SPEED * 40 - 1e-6), h = dt * GAME_SPEED / n;
      for (let i = 0; i < n; i++) {
        if (match) tickMatch(match, h);
        step(world, h, { fwd, turn, ability: k(' '), held: digits });
      }
      if (match) {                                     // the camera eases after you; while dead it stays put
        player = me.cr;
        if (player.alive) { const e = Math.min(1, dt * 6); cam.x += (player.cx - cam.x) * e; cam.y += (player.cy - cam.y) * e; }
        const x0 = cam.x - cv.width / 2, y0 = cam.y - cv.height / 2;
        drawWater(ctx, world, cv.width, cv.height, cam.x, cam.y);
        ctx.save(); ctx.translate(-x0, -y0);
        drawArena(ctx, match, x0, y0, x0 + cv.width, y0 + cv.height);
        drawMap(ctx, world, x0, y0, x0 + cv.width, y0 + cv.height);
        drawWorld(ctx, world, view, [x0, y0, x0 + cv.width, y0 + cv.height]);
        drawUnits(ctx, match, player);
        ctx.restore();
        drawArenaMap(ctx, match, player, cam, cv.width - 316, 16, 300, cv.width, cv.height);
        drawEvents(ctx, match, cv.width);
        if (bigMap) { const sz = Math.min(cv.width - 80, (cv.height - 120) * 2); drawArenaMap(ctx, match, player, cam, (cv.width - sz) / 2, 60, sz, cv.width, cv.height); }
        if (match.winner >= 0) {
          $('msg').style.display = 'block';
          $('msg').innerHTML = `<h2>${match.winner === 0 ? 'Victory' : 'Defeat'}</h2>${ARENA.teams[match.winner].name} destroyed the enemy core · Esc back to the builder`;
        }
      } else {
        drawWater(ctx, world, cv.width, cv.height);
        drawWorld(ctx, world, view);
      }
      drawHud(world.creatures.filter(c => c.team === 1 && !c.debris).length);
    }
    requestAnimationFrame(frame);
  }
  rebuildTank();
  requestAnimationFrame(frame);
}
