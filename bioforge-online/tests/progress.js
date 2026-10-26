// progression (milestone 3): level curve, XP per kill scaled by the level gap, what each level lets you build, and the
// app: kills in the world give XP, a level-up raises the budget and unlocks cells
const { load } = require('./load');
const { app, check, done } = require('./dom');
const { X } = load({}, ['newProgress', 'gainXP', 'xpNeed', 'killXP', 'levelBiomass', 'levelCells', 'buildCheck', 'CELL_LVL', 'CELLS', 'TEMPLATES', 'BIOMES', 'bp']);
const { newProgress, gainXP, xpNeed, killXP, levelBiomass, levelCells, buildCheck, CELL_LVL, CELLS, TEMPLATES, BIOMES, bp } = X;

{ // level 1 -> 5 on the curve
  const p = newProgress(), total = [1, 2, 3, 4].reduce((s, L) => s + xpNeed(L), 0);
  const ups = gainXP(p, total - 1);
  check('one XP short of level 5 stays level 4', p.lvl === 4 && ups.length === 3, `lvl ${p.lvl}, xp ${p.xp}`);
  gainXP(p, 1);
  check('level 1 -> 5 takes the expected XP', p.lvl === 5 && p.xp === 0, `${total} XP: lvl ${p.lvl}, xp ${p.xp}`);
  check('each level needs more XP than the last', [1, 2, 3, 4, 5, 10].every(L => xpNeed(L + 1) > xpNeed(L)));
  const q = newProgress(), many = gainXP(q, 1e9);
  check('capped at level 20', q.lvl === 20 && many.length === 19 && q.xp === 0);
  const r = newProgress(), u = gainXP(r, xpNeed(1) + xpNeed(2) + xpNeed(3));
  check('level-ups list what they unlock', u.map(x => x.lvl).join() === '2,3,4' && u[2].cells.includes('eyespot'), JSON.stringify(u));
}
{ // XP per kill and the level gap
  { const p = newProgress(); gainXP(p, killXP(1, 1)); gainXP(p, killXP(1, 1)); check('two level 1 kills: level 2', p.lvl === 2, `${killXP(1, 1)} XP each`); }
  check('tougher enemies give more XP', killXP(3, 3) > killXP(2, 3) && killXP(5, 3) > killXP(3, 3));
  check('enemies far below give a trickle', killXP(1, 10) <= Math.ceil(killXP(1, 1) * 0.1) && killXP(1, 10) >= 1, `${killXP(1, 10)} vs ${killXP(1, 1)}`);
  check('extra for higher levels is capped', killXP(15, 1) <= Math.round(15 * 15 ** 1.3 * 1.5));
  // a sane pace: a few motes for level 2, a handful of level-matched kills per level after
  const kills = L => Math.ceil(xpNeed(L) / killXP(L, L));
  check('pace: 2-10 even-level kills per level up to 5', [1, 2, 3, 4].every(L => kills(L) >= 2 && kills(L) <= 10), [1, 2, 3, 4].map(kills).join());
}
{ // what a level lets you build
  check('budget and cell cap grow every level', [1, 5, 10].every(L => levelBiomass(L + 1) > levelBiomass(L) && levelCells(L + 1) > levelCells(L)));
  check('starter and wiggler fit level 1', buildCheck(TEMPLATES.starter, 1) === '' && buildCheck(TEMPLATES.wiggler, 1) === '');
  check('every cell type has an unlock level', Object.keys(CELLS).every(t => CELL_LVL[t] >= 1));
  check('a locked cell is rejected', /Locked: .*Nettle/.test(buildCheck(TEMPLATES.nettler, 1)) && buildCheck(TEMPLATES.nettler, 5) === '', buildCheck(TEMPLATES.nettler, 1));
  const big = { cells: bp([[0, 0, 'nucleus'], ...Array.from({ length: 20 }, (_, i) => [i + 1, 0, 'tissue'])]) };
  check('too many cells is rejected', /Too many cells/.test(buildCheck(big, 1)) && buildCheck(big, 3) === '', buildCheck(big, 1));
  const pricey = { cells: bp([[0, 0, 'nucleus'], ...Array.from({ length: 15 }, (_, i) => [i + 1, 0, 'muscle'])]) };
  check('over budget is rejected', /Over budget/.test(buildCheck(pricey, 1)), buildCheck(pricey, 1));
  check('showcase builds open up around level 10-12', ['eel', 'jelly', 'manta', 'crab'].every(t => buildCheck(TEMPLATES[t], 12) === ''),
    ['eel', 'jelly', 'manta', 'crab'].map(t => t + ' ' + (buildCheck(TEMPLATES[t], 12) || 'ok')).join(', '));
  check('every zone has a level', BIOMES.tidepool.zones.every(z => z.lvl >= 1));
}
{ // the app: kill enemies in the world, gain XP and levels; the builder budget follows
  const { $, run, tpl, els, fire, ctx } = app(['wiggler']);
  let W = null;
  const make = ctx.makeWorld; ctx.makeWorld = d => (W = make(d));   // catch the world the app builds
  run(5); tpl[0].onclick(); run(5);
  check('builder shows level 1', els.budget.innerHTML.includes('Level <b>1</b>'), els.budget.innerHTML);
  $('fight').onclick(); run(30);
  check('HUD shows level and XP', /^Lv 1 · 0 \/ \d+ XP$/.test($('hudlvl').textContent), $('hudlvl').textContent);
  const mob = W.mobs.find(m => !m.frozen && m.mob.sp.lvl === 1);
  mob.core.hp = -1; run(30);
  check('a kill gives XP', $('hudlvl').textContent === `Lv 1 · ${killXP(1, 1)} / ${xpNeed(1)} XP`, $('hudlvl').textContent);
  for (let i = 0; i < 30; i++) W.kills.push({ lvl: 3, tpl: 'wiggler', x: 6000, y: 6000 });   // as tickWorld logs deaths
  run(5);
  const L = +/Lv (\d+)/.exec($('hudlvl').textContent)[1];
  check('enough kills: level up', L >= 4, $('hudlvl').textContent);
  fire('win', 'keydown', { key: 'Escape', preventDefault() {} }); run(5);
  check('builder budget and cell cap follow the level', els.budget.innerHTML.includes(`Level <b>${L}</b>`)
    && els.budget.innerHTML.includes(`/ ${levelBiomass(L)} · Cells`) && els.budget.innerHTML.endsWith(`/ ${levelCells(L)}`), els.budget.innerHTML);
}
done();
