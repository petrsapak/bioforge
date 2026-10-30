'use strict';
// Sandbox (full app, fake DOM): enter with a showcase build, swap the player, spawn and remove enemies by clicking,
// idle and hunting enemies, no win or lose, Esc back to the builder, and a second run with another design.
const { startApp, SCREEN_HEIGHT } = require('./dom');
const { check, done } = require('./check');

const ENEMY_DESIGNS = ['wiggler', 'squirter', 'nettler', 'puffer', 'starter', 'eel', 'jelly', 'manta', 'crab'];
const { byId, fire, runFrames, templateButton } = startApp();

const enemyCount = () => +/Enemies (\d+)/.exec(byId('hud-enemies').textContent)[1];
const playerAlive = () => byId('hud-dead').style.display === 'none';
const clickWater = (x, y, button = 0) => fire('game', 'mousedown', { clientX: x, clientY: y, button });
const pressKey = key => fire('window', 'keydown', { key });
const chooseEnemy = name => {
  byId('sandbox-enemy').value = name;
};

runFrames(5);
templateButton('eel').onclick();
runFrames(5);
byId('start-sandbox').onclick();
runFrames(10);
check('sandbox starts with an empty arena',
  byId('hud').style.display === 'block' && byId('sandbox-bar').style.display === 'flex' && enemyCount() === 0,
  byId('hud-mode').textContent);

const chips = () => byId('hud-chips').innerHTML;
pressKey('p');
runFrames(2);
check('P pauses: the chip says so and the button offers to run', chips().includes('Paused') &&
  byId('sandbox-pause').textContent === '▶', chips());
pressKey('.');
runFrames(2);
check('. moves one step and stays paused', chips().includes('Paused'));
byId('sandbox-pause').onclick();
pressKey(',');
runFrames(2);
check(', speeds it up to double', byId('sandbox-speed').textContent === '2×' && chips().includes('Fast 2×'), chips());
byId('sandbox-speed').onclick();
byId('sandbox-speed').onclick();
runFrames(2);
check('then on to half speed', byId('sandbox-speed').textContent === '½×' && chips().includes('Slow motion ½×'),
  chips());
byId('sandbox-speed').onclick();
byId('sandbox-speed').onclick();
runFrames(2);
check('the speed button cycles back to normal', byId('sandbox-speed').textContent === '1×' && chips() === '');

byId('sandbox-player').value = 'manta';
byId('sandbox-player').onchange();
runFrames(30);
check('the player swaps to a Manta and lives', playerAlive());

chooseEnemy('crab');
clickWater(500, 200);
chooseEnemy('jelly');
clickWater(1100, 200);
runFrames(5);
check('clicks spawn enemies', enemyCount() === 2);

byId('sandbox-enemy-mode').onclick();
runFrames(180);
check('the enemy button switches to idle', byId('sandbox-enemy-mode').textContent === 'Enemies: idle');
clickWater(500, 200, 2);
runFrames(2);
check('an idle Crab stays where it was spawned, and right-click removes it', enemyCount() === 1);

byId('sandbox-enemy-mode').onclick();
runFrames(240);
clickWater(1100, 200, 2);
runFrames(2);
check('a hunting Jelly has moved away from its spawn point, so right-click misses it', enemyCount() === 1);
clickWater(800, SCREEN_HEIGHT - 160, 2);
runFrames(2);
check('right-click on the player does not remove it', playerAlive());

byId('sandbox-clear').onclick();
runFrames(30);
check('Clear enemies leaves an empty arena', enemyCount() === 0);
pressKey('r');
runFrames(10);
check('R respawns the player', playerAlive());

ENEMY_DESIGNS.forEach((name, i) => {
  chooseEnemy(name);
  clickWater(200 + i * 140, 120 + (i % 3) * 80);
});
runFrames(600);
check('9 enemy types brawl for 10 s without an error', true, byId('hud-enemies').textContent);

// Esc opens the menu (since 2026-10-30; before, it went straight back to the builder), and the menu leaves
pressKey('Escape');
runFrames(5);
check('Esc opens the menu over the Sandbox, with Back to the builder',
  byId('menu-sheet').style.display === 'flex' && byId('menu-builder').style.display === '' &&
  byId('sandbox-bar').style.display === 'flex');
byId('menu-builder').onclick({});
runFrames(5);
check('Back to the builder goes back to the builder', byId('menu-sheet').style.display === 'none' &&
  byId('sandbox-bar').style.display === 'none' && byId('hud').style.display === 'none');
// '' hands the display back to style.css; 'block' broke the dock's centring (user, 2026-10-28)
check('back in the builder, the dock and the tabs keep their own layout', byId('dock').style.display === '' &&
  byId('layer-tabs').style.display === '' && byId('builder-left').style.display === '');
templateButton('lancer').onclick();
runFrames(5);
byId('start-sandbox').onclick();
runFrames(30);
check('the sandbox starts again with a new design', byId('sandbox-bar').style.display === 'flex' && playerAlive());

// ---------- The chemical lens ----------
pressKey('c');
runFrames(20);
check('C turns the chemical lens on: its legend shows, and the run goes on drawing it',
  byId('lens-legend').style.display === 'flex' && byId('chemical-lens').classList.contains('selected') &&
  playerAlive());
pressKey('c');
check('C again turns it off', byId('lens-legend').style.display === 'none' &&
  !byId('chemical-lens').classList.contains('selected'));
done();
