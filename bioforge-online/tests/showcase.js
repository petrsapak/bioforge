// showcase templates: load over budget or with locked cells, Fight locked, preview sim runs; clearing unlocks Fight
const { app, check, done } = require('./dom');
const names = ['wiggler', 'squirter', 'nettler', 'puffer', 'clear', 'eel', 'jelly', 'manta', 'crab'];
const { els, $, fire, run, tpl } = app(names);
run(10);
for (const n of ['eel', 'jelly', 'manta', 'crab']) {
  tpl[names.indexOf(n)].onclick(); run(60);
  fire('win', 'keydown', { key: ' ', preventDefault() {} }); run(30); fire('win', 'keyup', { key: ' ', preventDefault() {} });
  const cells = +/Cells: (\d+)/.exec(els.stats.innerHTML)[1];
  check(n + ' loaded, fight locked', cells > 30 && els.fight.disabled === true && /Over budget|Locked/.test(els.fight.textContent), `cells ${cells} | ${els.fight.textContent}`);
  els.fight.onclick(); run(5);
  check(n + ' fight click ignored', $('hud').style.display !== 'block');
}
tpl[names.indexOf('wiggler')].onclick(); run(5);
check('affordable template unlocks the world', els.fight.disabled === false && /Enter Tidepool/.test(els.fight.textContent), els.fight.textContent);
els.fight.onclick(); run(60); check('world starts', $('hud').style.display === 'block');
done();
