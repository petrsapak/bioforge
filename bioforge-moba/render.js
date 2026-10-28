'use strict';
// Canvas drawing.
// ---------- Rendering ----------
const BODY = { 0: '#1f4a3a', 1: '#4a2430', '-1': '#2a2f33' };

// view 0 = normal, 1..5 = fill level of one fluid; box = [x0, y0, x1, y1]: draw only cells inside it (the camera's view)
function drawWorld(ctx, w, view, box) {
  const seen = box ? c => c.x > box[0] - 30 && c.x < box[2] + 30 && c.y > box[1] - 30 && c.y < box[3] + 30 : () => true;
  ctx.lineCap = 'round';
  for (const b of w.bonds) {
    if (!seen(b.a)) continue;
    ctx.strokeStyle = BODY[b.a.owner.team] || BODY[-1];
    ctx.lineWidth = Math.min(b.a.rad, b.b.rad) * 1.6;
    ctx.beginPath(); ctx.moveTo(b.a.x, b.a.y); ctx.lineTo(b.b.x, b.b.y); ctx.stroke();
  }
  for (const c of w.cells) if (seen(c)) drawCell(ctx, c, view);
  ctx.strokeStyle = '#e8d2a8'; ctx.lineWidth = 1.5;   // Snare lines, with a barb at the tip
  for (const c of w.cells) if (c.line) {
    const t = c.line.tgt, x = t ? t.x : c.line.x, y = t ? t.y : c.line.y;
    ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(x, y); ctx.stroke();
    ctx.fillStyle = c.d.color; ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = CELLS.spitter.color;
  for (const g of w.globs) { ctx.beginPath(); ctx.arc(g.x, g.y, g.big ? 6 : 3.5, 0, TAU); ctx.fill(); }   // big: a tower's
  ctx.strokeStyle = '#cfe9ff'; ctx.lineWidth = 2;
  for (const z of w.zaps) {
    ctx.beginPath(); ctx.moveTo(z.x0, z.y0);
    const mx = (z.x0 + z.x1) / 2 + (Math.random() - 0.5) * 14, my = (z.y0 + z.y1) / 2 + (Math.random() - 0.5) * 14;
    ctx.lineTo(mx, my); ctx.lineTo(z.x1, z.y1); ctx.stroke();
  }
  ctx.fillStyle = '#d8e070';
  for (const p of w.food) { ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, TAU); ctx.fill(); }
  for (const p of w.sparks) { ctx.globalAlpha = Math.min(1, p.life * 3); ctx.fillStyle = p.color; ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3); }
  ctx.globalAlpha = 1;
}

function drawCell(ctx, c, view) {
  const r = c.rad * 0.9, cr = c.owner;
  if (view) {                                         // fluid map: fill = level of the chosen fluid
    const i = view - 1;
    ctx.globalAlpha = 1; ctx.fillStyle = '#1a2328';
    ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.1 + 0.9 * clamp01(c.f[i] / c.cap[i]); ctx.fillStyle = FLUIDS[i].color; ctx.fill();
    ctx.globalAlpha = 1; ctx.strokeStyle = c.d.color; ctx.lineWidth = 1.5; ctx.stroke();
    return;
  }
  ctx.globalAlpha = 0.4 + 0.6 * clamp01(c.hp / c.max);
  const out = Math.atan2(c.y - cr.cy, c.x - cr.cx);  // direction away from the body centre
  if (c.t === 'thorn') {
    ctx.fillStyle = c.d.color;
    ctx.beginPath();
    ctx.moveTo(c.x + Math.cos(out) * r * 1.9, c.y + Math.sin(out) * r * 1.9);
    ctx.lineTo(c.x + Math.cos(out + 1.9) * r, c.y + Math.sin(out + 1.9) * r);
    ctx.lineTo(c.x + Math.cos(out - 1.9) * r, c.y + Math.sin(out - 1.9) * r);
    ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = c.d.color;
  ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.2; ctx.stroke();
  // per-type detail
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  const reservoir = i => { ctx.fillStyle = FLUIDS[i].color; ctx.beginPath(); ctx.arc(c.x, c.y, r * 0.75 * Math.sqrt(clamp01(c.f[i] / c.cap[i])), 0, TAU); ctx.fill(); };
  if (c.t === 'nucleus') {
    const fx = Math.sin(cr.theta), fy = -Math.cos(cr.theta);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(c.x + fx * r * 0.3, c.y + fy * r * 0.3, r * 0.45, 0, TAU); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(c.x + fx * r * 0.5, c.y + fy * r * 0.5, r * 0.22, 0, TAU); ctx.fill();
  } else if (c.t === 'muscle') {
    for (const k of [-0.4, 0, 0.4]) { ctx.beginPath(); ctx.moveTo(c.x - r * 0.6, c.y + k * r); ctx.lineTo(c.x + r * 0.6, c.y + k * r); ctx.stroke(); }
  } else if (c.t === 'shell') {
    ctx.beginPath(); ctx.arc(c.x, c.y, r * 0.55, 0, TAU); ctx.stroke();
  } else if (c.t === 'cilia') {
    ctx.strokeStyle = c.d.color; ctx.lineWidth = 1;
    for (const k of [-0.9, -0.3, 0.3, 0.9]) { const a = out + k; ctx.beginPath(); ctx.moveTo(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r); ctx.lineTo(c.x + Math.cos(a) * r * 1.5, c.y + Math.sin(a) * r * 1.5); ctx.stroke(); }
  } else if (c.t === 'nerve') {
    ctx.beginPath(); ctx.arc(c.x, c.y, r * 0.3, 0, TAU); ctx.fill();
  } else if (c.t === 'ganglion') {
    ctx.fillRect(c.x - r * 0.5, c.y - r * 0.45, r * 0.25, r * 0.9); ctx.fillRect(c.x + r * 0.25, c.y - r * 0.45, r * 0.25, r * 0.9);
  } else if (c.d.gen) {
    ctx.fillStyle = c.V > 0.5 ? '#fff' : 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.arc(c.x, c.y, r * (c.t === 'eyespot' ? 0.45 : 0.3), 0, TAU); ctx.fill();
    if (c.t === 'eyespot' && cr.cx !== undefined) { ctx.strokeStyle = 'rgba(79,209,197,0.12)'; ctx.beginPath(); ctx.arc(c.x, c.y, SENSE_R, 0, TAU); ctx.stroke(); }
  } else if (c.t === 'siphon') {
    const bx = -Math.sin(cr.theta), by = Math.cos(cr.theta);
    ctx.fillStyle = '#2f6d91'; ctx.beginPath(); ctx.arc(c.x + bx * r * 0.4, c.y + by * r * 0.4, r * 0.35, 0, TAU); ctx.fill();
    if (c.V > 0.2 && c.e > 0.2) {
      ctx.fillStyle = `rgba(160,220,255,${clamp01(c.V * c.e) * 0.7})`;
      ctx.beginPath(); ctx.arc(c.x + bx * r * 1.6, c.y + by * r * 1.6, r * 0.5 * (0.7 + Math.random() * 0.5), 0, TAU); ctx.fill();
    }
  } else if (c.t === 'nettle') {
    ctx.strokeStyle = '#3f5aa0'; ctx.lineWidth = 2;
    for (const k of [0, 2.1, 4.2]) { const a = out + k; ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + Math.cos(a) * r * 0.7, c.y + Math.sin(a) * r * 0.7); ctx.stroke(); }
  } else if (c.t === 'snare') {                         // a hook pointing out
    ctx.strokeStyle = '#3a2410'; ctx.lineWidth = 2;
    const hx = c.x + Math.cos(out) * r * 0.15, hy = c.y + Math.sin(out) * r * 0.15;
    ctx.beginPath(); ctx.arc(hx, hy, r * 0.45, out + 0.6, out + 0.6 + 4.2); ctx.stroke();
  } else if (c.t === 'spitter') {                       // a muzzle on the outer side, lit while ready to fire
    ctx.fillStyle = c.cd <= 0 ? '#2e4a10' : '#1a2208';
    ctx.beginPath(); ctx.arc(c.x + Math.cos(out) * r * 0.35, c.y + Math.sin(out) * r * 0.35, r * 0.38, 0, TAU); ctx.fill();
  } else if (c.t === 'gill') {
    ctx.strokeStyle = '#7a2a3a'; ctx.lineWidth = 1.5;
    for (const k of [-0.4, 0, 0.4]) { ctx.beginPath(); ctx.moveTo(c.x + k * r, c.y - r * 0.5); ctx.lineTo(c.x + k * r, c.y + r * 0.5); ctx.stroke(); }
  } else if (c.t === 'mouth') {
    ctx.fillStyle = '#3a1a14';
    ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.arc(c.x, c.y, r * 0.85, out - 0.6, out + 0.6); ctx.closePath(); ctx.fill();
  } else if (c.t === 'heart') {
    ctx.fillStyle = '#ff7a8a';
    ctx.beginPath(); ctx.arc(c.x, c.y, r * (0.3 + 0.15 * c.e * Math.max(0, Math.sin(performanceNow() * 8))), 0, TAU); ctx.fill();
  } else if (c.t === 'valve') {
    ctx.fillStyle = c.V > 0.5 ? '#e8f4ff' : '#26323a';
    ctx.beginPath(); ctx.moveTo(c.x - r * 0.6, c.y - r * 0.45); ctx.lineTo(c.x, c.y); ctx.lineTo(c.x - r * 0.6, c.y + r * 0.45); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(c.x + r * 0.6, c.y - r * 0.45); ctx.lineTo(c.x, c.y); ctx.lineTo(c.x + r * 0.6, c.y + r * 0.45); ctx.closePath(); ctx.fill();
  } else if (c.t === 'airsac') {
    reservoir(O);
  } else if (c.t === 'fat') {
    reservoir(S);
  } else if (c.t === 'pore') {
    ctx.strokeStyle = '#2a2014'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(c.x, c.y, r * 0.35, 0, TAU); ctx.stroke();
  } else if (c.t === 'mender') {
    ctx.fillStyle = '#fff'; ctx.fillRect(c.x - r * 0.15, c.y - r * 0.5, r * 0.3, r); ctx.fillRect(c.x - r * 0.5, c.y - r * 0.15, r, r * 0.3);
  } else if (c.t === 'adrenal') {
    ctx.fillStyle = '#5a0a30';
    ctx.beginPath(); ctx.moveTo(c.x, c.y - r * 0.55); ctx.lineTo(c.x + r * 0.4, c.y); ctx.lineTo(c.x, c.y + r * 0.55); ctx.lineTo(c.x - r * 0.4, c.y); ctx.closePath(); ctx.fill();
  } else if (c.t === 'bud') {                         // seed, with a ring that fills as the part grows (solid when ready)
    const g = c.grow, n = g ? g.plan.cells.length : 0;
    ctx.fillStyle = g && g.done && n ? '#fff' : '#4a5a20';
    ctx.beginPath(); ctx.arc(c.x, c.y, r * 0.3, 0, TAU); ctx.fill();
    if (n) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(c.x, c.y, r * 0.6, -Math.PI / 2, -Math.PI / 2 + TAU * g.have / n); ctx.stroke(); }
  }
  if (c.bind) {                                       // Command bound to a number key
    ctx.globalAlpha = 1; ctx.fillStyle = '#111'; ctx.font = `bold ${r * 1.1 | 0}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(c.bind, c.x, c.y + 0.5); ctx.textBaseline = 'alphabetic';
  }
  if (c.d.cond && c.V > 0.03) {                     // nerve signal glow
    ctx.globalAlpha = clamp01(c.V) * 0.55; ctx.fillStyle = '#fff6a0';
    ctx.beginPath(); ctx.arc(c.x, c.y, r * 0.75, 0, TAU); ctx.fill();
  }
  if (c.f[A] > 0.05) {                              // adrenaline rim
    ctx.globalAlpha = clamp01(c.f[A]); ctx.strokeStyle = FLUIDS[A].color; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(c.x, c.y, r + 1, 0, TAU); ctx.stroke();
  }
  if (c.starve) { ctx.globalAlpha = 0.5; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, TAU); ctx.fill(); }
  if (c.poison) { ctx.globalAlpha = 0.9; ctx.strokeStyle = FLUIDS[W].color; ctx.lineWidth = 2; ctx.setLineDash([3, 2]); ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
  if (c.flash > 0) { ctx.globalAlpha = Math.min(1, c.flash * 8); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1;
}
const performanceNow = () => (typeof performance !== 'undefined' ? performance.now() / 1000 : 0);

// ox, oy: camera position in the open world; the motes drift past at half speed (depth). bg: the water colour
function drawWater(ctx, w, w0, h0, ox = 0, oy = 0, bg = '#0e1d24') {
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w0, h0);
  ctx.fillStyle = 'rgba(120,200,220,0.05)';
  const mod = (v, m) => (v % m + m) % m;
  for (let i = 0; i < 60; i++) {
    const x = mod(i * 137.5 + w.t * 6 * (1 + i % 3) - ox * 0.5, w0), y = mod(i * 91.3 + Math.sin(w.t * 0.3 + i) * 20 + h0 - oy * 0.5, h0);
    ctx.beginPath(); ctx.arc(x, y, 1 + i % 3, 0, TAU); ctx.fill();
  }
}

// ---------- Arena ----------
// rocks, currents and the map edge inside the view box [x0, y0, x1, y1] (world px)
function drawMap(ctx, w, x0, y0, x1, y1) {
  const map = w.map;
  ctx.strokeStyle = '#2c4a52'; ctx.lineWidth = 6; ctx.strokeRect(0, 0, map.w, map.h);
  ctx.strokeStyle = 'rgba(150,220,235,0.18)'; ctx.lineWidth = 1.5;   // currents: streaks drifting the way the water flows
  for (const u of map.currents) {
    if (u.x + u.r < x0 || u.x - u.r > x1 || u.y + u.r < y0 || u.y - u.r > y1) continue;
    const v = Math.hypot(u.vx, u.vy), dx = u.vx / v, dy = u.vy / v;
    for (let i = 0; i < u.r / 12; i++) {
      const a = i * 2.39996, rr = u.r * Math.sqrt((i * 0.618) % 1), along = ((w.t * v + i * 97) % (2 * u.r)) - u.r;
      const px = u.x + Math.cos(a) * rr + dx * along * 0.3, py = u.y + Math.sin(a) * rr + dy * along * 0.3;
      if ((px - u.x) ** 2 + (py - u.y) ** 2 > u.r * u.r) continue;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + dx * 14, py + dy * 14); ctx.stroke();
    }
  }
  const seen = (x, y, r) => x + r > x0 && x - r < x1 && y + r > y0 && y - r < y1;
  ctx.textAlign = 'center';
  for (const r of map.regions) if (seen(r.at[0], r.at[1], 900) && !map.landmarks.some(l => Math.hypot(l.x - r.at[0], l.y - r.at[1]) < 300)) {     // the region's name written large on the sea floor
    ctx.fillStyle = 'rgba(200,235,240,0.06)'; ctx.font = 'bold 110px system-ui'; ctx.fillText(r.name, r.at[0], r.at[1]);
  }
  for (const l of map.landmarks) if (seen(l.x, l.y, l.r + 150)) {    // dark floor inside the ring, name over it
    ctx.fillStyle = l.kind === 'cave' ? 'rgba(0,0,0,0.35)' : l.kind === 'lair' ? 'rgba(40,0,10,0.45)' : 'rgba(20,40,80,0.25)';
    ctx.beginPath(); ctx.arc(l.x, l.y, l.r, 0, TAU); ctx.fill();
    ctx.fillStyle = l.kind === 'lair' ? 'rgba(255,110,110,0.5)' : l.kind === 'arena' ? 'rgba(150,190,255,0.45)' : 'rgba(230,220,180,0.35)';
    ctx.font = 'bold 44px system-ui'; ctx.fillText((LANDMARK_ICON[l.kind] || '') + ' ' + l.name, l.x, l.y);
    if (l.desc) { ctx.font = '22px system-ui'; ctx.fillText(l.desc, l.x, l.y + 36); }
  }
  const pulse = 0.5 + 0.5 * Math.sin(w.t * 3);
  for (const o of map.rocks) {
    if (!seen(o.x, o.y, o.r)) continue;
    if (o.gate) {                                     // the sealed boss door: glowing membrane
      ctx.fillStyle = `rgba(180,30,60,${0.45 + 0.3 * pulse})`; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#ff7a8a'; ctx.lineWidth = 2; ctx.stroke(); continue;
    }
    const base = map.regions[o.k] ? map.regions[o.k].rock : '#3b5058';
    ctx.fillStyle = o.ring ? shade(base, 0.45) : shade(base, 0.65); ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = base; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = shade(base, o.ring ? 0.55 : 0.78); ctx.beginPath(); ctx.arc(o.x - o.r * 0.25, o.y - o.r * 0.25, o.r * 0.5, 0, TAU); ctx.fill();
  }
}
const LANDMARK_ICON = { cave: '◖', lair: '☠', arena: '★' };
// '#rrggbb' scaled toward black by k (cached: called for every rock each frame)
const SHADE = new Map();
function shade(hex, k) {
  const id = hex + k;
  if (!SHADE.has(id)) { const n = parseInt(hex.slice(1), 16); SHADE.set(id, `rgb(${(n >> 16) * k | 0},${(n >> 8 & 255) * k | 0},${(n & 255) * k | 0})`); }
  return SHADE.get(id);
}

// lane floors, base floors and the fountains, under everything else
function drawArena(ctx, m, x0, y0, x1, y1) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(150,200,190,0.07)'; ctx.lineWidth = ARENA.laneW * 1.4;
  for (const pts of Object.values(ARENA.lanes)) { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); }
  ARENA.teams.forEach((t, i) => {
    ctx.fillStyle = shade(t.color, 0.18); ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.arc(t.core[0], t.core[1], 520, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.25 + 0.1 * Math.sin(m.w.t * 2); ctx.fillStyle = t.color;
    ctx.beginPath(); ctx.arc(t.spawn[0], t.spawn[1], FOUNTAIN_R, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  });
  for (const s of m.structs) {                        // tower range rings
    ctx.strokeStyle = s.inv ? 'rgba(255,255,255,0.06)' : shade(ARENA.teams[s.team].color, 0.5); ctx.lineWidth = 2; ctx.setLineDash([8, 10]);
    ctx.beginPath(); ctx.arc(s.core.x, s.core.y, s.mob.def.range, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  }
}

// a health bar over every hero, minion and structure; heroes' names; a shield over structures that cannot be hit yet
function drawUnits(ctx, m, me) {
  const bar = (cr, wd, y, col) => {
    const f = Math.max(0, Math.min(1, cr.core.hp / cr.core.max)), b = Math.max(0, Math.min(1, cr.cells.reduce((s, c) => s + Math.max(0, c.hp), 0) / (cr.hp0 || 1)));
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(cr.cx - wd / 2 - 1, y - 1, wd + 2, 8);
    ctx.fillStyle = '#7fd18a55'; ctx.fillRect(cr.cx - wd / 2, y, wd * b, 3);   // body
    ctx.fillStyle = col; ctx.fillRect(cr.cx - wd / 2, y + 3, wd * f, 3);       // nucleus: dies with it
  };
  ctx.textAlign = 'center';
  for (const cr of m.w.creatures) {
    if (cr.debris || cr.team < 0 || !cr.box || !cr.core) continue;
    const col = ARENA.teams[cr.team].color, top = cr.box[1] - 12;
    if (cr.mob && cr.mob.def) {
      bar(cr, 90, top - 4, col);
      if (cr.inv) { ctx.strokeStyle = 'rgba(200,230,255,0.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cr.core.x, cr.core.y, 55, 0, TAU); ctx.stroke(); }
    } else if (cr.slot) {
      bar(cr, 70, top, col);
      ctx.font = 'bold 13px system-ui'; ctx.fillStyle = cr === me ? '#fff' : col; ctx.fillText(cr.slot.name, cr.cx, top - 5);
    } else bar(cr, 30, top + 4, col);
  }
}

// recent match events (towers falling, heroes killed), top middle
function drawEvents(ctx, m, cw) {
  ctx.textAlign = 'center'; ctx.font = 'bold 16px system-ui';
  m.events.slice(-4).forEach((e, i) => { ctx.globalAlpha = Math.min(1, e.t); ctx.fillStyle = '#f2ead0'; ctx.fillText(e.text, cw / 2, 90 + i * 22); });
  ctx.globalAlpha = 1;
}

// the arena scaled to width size at (x, y): lanes, rocks, structures, minions, heroes, the view box
function drawArenaMap(ctx, m, me, cam, x, y, size, vw, vh) {
  const map = m.w.map, k = size / map.w;
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(8,16,20,0.9)'; ctx.fillRect(0, 0, map.w * k, map.h * k);
  ctx.strokeStyle = '#2c4a52'; ctx.lineWidth = 1; ctx.strokeRect(0, 0, map.w * k, map.h * k);
  ctx.strokeStyle = 'rgba(150,200,190,0.18)'; ctx.lineWidth = Math.max(2, ARENA.laneW * k); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const pts of Object.values(ARENA.lanes)) { ctx.beginPath(); pts.forEach(([px, py], i) => i ? ctx.lineTo(px * k, py * k) : ctx.moveTo(px * k, py * k)); ctx.stroke(); }
  ctx.fillStyle = '#3b5058';
  for (const o of map.rocks) { ctx.beginPath(); ctx.arc(o.x * k, o.y * k, Math.max(1, o.r * k), 0, TAU); ctx.fill(); }
  for (const s of m.structs) {
    const r = s.mob.kind === 'core' ? 7 : 5;
    ctx.fillStyle = ARENA.teams[s.team].color; ctx.fillRect(s.cx * k - r, s.cy * k - r, 2 * r, 2 * r);
    if (s.inv) { ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.strokeRect(s.cx * k - r, s.cy * k - r, 2 * r, 2 * r); }
  }
  for (const cr of m.minions) { ctx.fillStyle = ARENA.teams[cr.team].color; ctx.fillRect(cr.cx * k - 1, cr.cy * k - 1, 2, 2); }
  for (const s of m.heroes) {
    if (!s.cr.alive) continue;
    ctx.fillStyle = ARENA.teams[s.team].color; ctx.beginPath(); ctx.arc(s.cr.cx * k, s.cr.cy * k, 4, 0, TAU); ctx.fill();
    if (s.cr === me) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1; ctx.strokeRect((cam.x - vw / 2) * k, (cam.y - vh / 2) * k, vw * k, vh * k);
  ctx.restore();
}
