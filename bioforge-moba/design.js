'use strict';
// Builder design logic: hex grid helpers and design checks. No DOM: runs in the browser and in Node.

// grid pixel -> nearest hex [q, r]
function pxToHex(x, y) {
  const r = y / HY, q = x / HX - r / 2, s = -q - r;
  let rq = Math.round(q), rr = Math.round(r), rs = Math.round(s);
  const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs; else if (dr > ds) rr = -rq - rs;
  return [rq, rr];
}
const inGrid = (q, r) => Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= GR;

// hexes reachable from the nucleus through hexes where has(key) is true
function reach(has) {
  const seen = new Set([key(0, 0)]), queue = [[0, 0]];
  while (queue.length) {
    const [cq, cr] = queue.pop();
    for (const [dq, dr] of NB) { const k = key(cq + dq, cr + dr); if (has(k) && !seen.has(k)) { seen.add(k); queue.push([cq + dq, cr + dr]); } }
  }
  return seen;
}

// design checks: signals, Bud parts, and whether the body has O2, energy and a waste exit for its working cells
// l: the joined body's cells; planned: keys of cells not joined to it. Each warning: { text, keys } where keys are
// the hexes it is about (marked on the grid)
function designWarnings(l, planned) {
  const n = t => l.filter(b => b.t === t).length, warn = [], push = (text, keys = []) => warn.push({ text, keys });
  const ks = bl => bl.map(b => key(b.q, b.r));
  if (planned.length) push(`${planned.length} planned cell(s) are not connected to the body: they are not part of the creature and cost nothing until you join them.`, planned);
  // the checks below look at the joined body only
  const design = new Map(l.map(b => [key(b.q, b.r), b.t]));
  const gens = n('pacemaker') + n('command') + n('eyespot');
  const nerveActs = ['muscle', 'bloater', 'siphon', 'nettle', 'snare', 'spitter', 'adrenal', 'valve', 'bud'];
  if (l.some(b => nerveActs.includes(b.t)) && !gens) push('Muscles, Bloaters, Siphons, Nettles, Snares, Spitters, Adrenals, Valves and Buds need a nerve signal source (Pacemaker, Command or Eyespot).', ks(l.filter(b => nerveActs.includes(b.t))));
  const bs = l.filter(b => b.t === 'bud'), withPart = bs.filter(b => b.tpl), plans = withPart.map(b => budPlan(l, b));
  if (bs.some(b => !b.tpl)) push(`${bs.filter(b => !b.tpl).length} Bud(s) have no part to grow: click the Bud, then a part in the Templates library.`, ks(bs.filter(b => !b.tpl)));
  if (plans.some(p => !p.cells.length)) push(`${plans.filter(p => !p.cells.length).length} Bud(s) have no free side to grow on: put Buds on the surface.`, ks(withPart.filter((b, i) => !plans[i].cells.length)));
  else if (plans.some(p => p.blocked)) push(`${plans.reduce((s, p) => s + p.blocked, 0)} cell(s) of Bud parts are blocked by the body and will not grow.`, ks(withPart.filter((b, i) => plans[i].blocked)));
  // a part has its own nerves: what needs a signal in it needs a Pacemaker or Eyespot in the part too
  const deaf = withPart.filter(b => b.tpl.cells.some(c => nerveActs.includes(c.t)) && !b.tpl.cells.some(c => c.t === 'pacemaker' || c.t === 'eyespot'));
  if (deaf.length) push(`${deaf.length} Bud part(s) have Muscles, Nettles or the like but no Pacemaker or Eyespot of their own: a part's nerves are apart from the body's, so those cells do nothing.`, ks(deaf));
  const claimed = plans.flatMap(p => p.cells.map(c => key(c.q, c.r)));
  if (new Set(claimed).size < claimed.length) push('Two Buds grow parts onto the same hexes. Click a Bud and turn its part (Q/E) so they do not overlap.', [...new Set(claimed.filter((k, i) => claimed.indexOf(k) !== i))]);
  if (!n('thorn') && !n('nettle') && !n('bloater') && !n('mouth') && !n('spitter') && !n('snare')) push('No weapons: it cannot hurt anything.');
  const isCond = k => design.has(k) && CELLS[design.get(k)].cond;
  const live = new Set(), q = [];
  for (const [k, t] of design) if (CELLS[t].gen) { live.add(k); q.push(k); }
  while (q.length) {
    const [cq, cr] = q.pop().split(',').map(Number);
    for (const [dq, dr] of NB) { const k = key(cq + dq, cr + dr); if (isCond(k) && !live.has(k)) { live.add(k); q.push(k); } }
  }
  const unwired = [...design].filter(([k, t]) => nerveActs.includes(t) && !live.has(k)).map(([k]) => k);
  if (gens && unwired.length) push(`${unwired.length} cell(s) that need a nerve signal are not connected to a signal source.`, unwired);
  // fluids spread through the whole joined body (Valves counted as open)
  const fueled = [...design].filter(([, t]) => CELLS[t].fuel).map(([k]) => k), fc = fueled.length;
  if (fc && !n('gill')) push(`No Gill: the ${fc} fuel-burning cell(s) run out of O₂.`, fueled);
  if (fc && !n('mouth') && !n('fat')) push(`No Mouth or Fat: the ${fc} fuel-burning cell(s) run out of energy.`, fueled);
  if (fc && !n('pore')) push(`No Pore: waste builds up in the ${fc} fuel-burning cell(s) and poisons them.`, fueled);
  const at = k => { const [q, r] = k.split(',').map(Number); return { q, r }; };
  const enclosed = k => { const { q, r } = at(k); return NB.every(([dq, dr]) => design.has(key(q + dq, r + dr))); };
  const buried = [...design].filter(([k, t]) => t === 'pore' && enclosed(k)).map(([k]) => k);
  if (buried.length) push(`${buried.length} Pore cell(s) are buried inside the body and do nothing: Pores must touch the water.`, buried);
  const hearts = [...design].filter(([, t]) => t === 'heart').map(([k]) => at(k));
  const far = fueled.filter(k => !hearts.some(h => hexDist(at(k), h) <= HEART_R));
  if (far.length) push(`${far.length} fuel-burning cell(s) are more than ${HEART_R} cells from a Heart: fluids reach them slowly.`, far);
  return warn;
}
