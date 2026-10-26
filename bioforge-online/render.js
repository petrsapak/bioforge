'use strict';
// Canvas drawing.
// ---------- Rendering ----------
const BODY = { 0: '#1f4a3a', 1: '#4a2430', '-1': '#2a2f33' };

// view 0 = normal, 1..5 = fill level of one fluid
function drawWorld(ctx, w, view) {
  for (const cr of w.creatures) {
    ctx.strokeStyle = BODY[cr.team]; ctx.lineCap = 'round';
    for (const b of w.bonds) {
      if (b.a.owner !== cr) continue;
      ctx.lineWidth = Math.min(b.a.rad, b.b.rad) * 1.6;
      ctx.beginPath(); ctx.moveTo(b.a.x, b.a.y); ctx.lineTo(b.b.x, b.b.y); ctx.stroke();
    }
  }
  for (const c of w.cells) drawCell(ctx, c, view);
  ctx.strokeStyle = '#e8d2a8'; ctx.lineWidth = 1.5;   // Snare lines, with a barb at the tip
  for (const c of w.cells) if (c.line) {
    const t = c.line.tgt, x = t ? t.x : c.line.x, y = t ? t.y : c.line.y;
    ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(x, y); ctx.stroke();
    ctx.fillStyle = c.d.color; ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = CELLS.spitter.color;
  for (const g of w.globs) { ctx.beginPath(); ctx.arc(g.x, g.y, 3.5, 0, TAU); ctx.fill(); }
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

function drawWater(ctx, w, w0, h0) {
  ctx.fillStyle = '#0e1d24'; ctx.fillRect(0, 0, w0, h0);
  ctx.fillStyle = 'rgba(120,200,220,0.05)';
  for (let i = 0; i < 60; i++) {
    const x = (i * 137.5 + w.t * 6 * (1 + i % 3)) % w0, y = (i * 91.3 + Math.sin(w.t * 0.3 + i) * 20 + h0) % h0;
    ctx.beginPath(); ctx.arc(x, y, 1 + i % 3, 0, TAU); ctx.fill();
  }
}
