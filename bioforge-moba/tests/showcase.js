// library: the heroes fit the match budget and start a match; the showcase builds load but are too big for a match
const { app, check, done } = require('./dom');
const names = ['lancer', 'stinger', 'spitter', 'snarer', 'clear', 'eel', 'jelly', 'manta', 'crab'];
const { els, $, fire, run, tpl } = app(names);
const cells = () => +/Cells: (\d+)/.exec(els.stats.innerHTML)[1];
run(10);
for (const n of ['eel', 'jelly', 'manta', 'crab']) {
  tpl[names.indexOf(n)].onclick(); run(60);
  fire('win', 'keydown', { key: ' ', preventDefault() {} }); run(30); fire('win', 'keyup', { key: ' ', preventDefault() {} });
  check(n + ' loaded, match locked', cells() > 30 && els.fight.disabled === true && /Over budget|Too many/.test(els.fight.textContent), `cells ${cells()} | ${els.fight.textContent}`);
  els.fight.onclick(); run(5);
  check(n + ' match click ignored', $('hud').style.display !== 'block');
}
for (const n of ['lancer', 'stinger', 'spitter', 'snarer']) {
  tpl[names.indexOf(n)].onclick(); run(30);
  check(n + ' loaded, match open', cells() >= 15 && els.fight.disabled === false && /Start 5v5 match/.test(els.fight.textContent), `cells ${cells()} | ${els.fight.textContent}`);
}
els.fight.onclick(); run(60); check('match starts', $('hud').style.display === 'block' && /Reef 0 – 0 Brine/.test($('hudwave').textContent), $('hudwave').textContent);
done();
