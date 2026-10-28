// The builder (full app, fake DOM), driven by the mouse and keys: placing and removing cells, the tooltip, binding a
// Command, saving a selection and stamping it, giving a Bud a part by dragging, and carrying old saves over.
const { startApp } = require('./dom');
const { check, done } = require('./check');

// Bioforge Moba's library, in the old format, as it may sit in the browser's storage
const OLD_LIBRARY = JSON.stringify([{ name: 'Old timer', full: true, cells: [{ q: 0, r: 0, t: 'nucleus' }] }]);
const { byId, fire, runFrames, readGlobal, storage } = startApp(['clear'], { 'bioforge-templates': OLD_LIBRARY });

// where hex (q, r) is on screen: the grid's middle is right of the panel, at the start zoom (see builderview.js)
const GRID_MIDDLE_X = 320 + (1600 - 320) / 2;
const GRID_MIDDLE_Y = 900 / 2;
const START_ZOOM = 1.9;
function screenPointOf(q, r) {
  const [x, y] = readGlobal('hexToPixel')(q, r);
  return { clientX: GRID_MIDDLE_X + x * START_ZOOM, clientY: GRID_MIDDLE_Y + y * START_ZOOM };
}
const canvas = byId('game');
const moveMouseTo = (q, r) => {
  fire('game', 'mousemove', { ...screenPointOf(q, r), target: canvas });
  fire('window', 'mousemove', { ...screenPointOf(q, r), target: canvas });
};
const clickHex = (q, r, fields = {}) => {
  moveMouseTo(q, r);
  fire('game', 'mousedown', { ...screenPointOf(q, r), button: 0, target: canvas, ...fields });
  fire('window', 'mouseup', { ...screenPointOf(q, r), target: canvas });
  runFrames(1);
};
const cellCount = () => +/Cells: (\d+)/.exec(byId('stats').innerHTML)[1];
const info = () => byId('info').innerHTML;
const pressKey = key => {
  fire('window', 'keydown', { key });
  fire('window', 'keyup', { key });
};
// the dock's button for a cell type: palette > category section > hexagons > buttons
const dockButton = typeName => byId('palette').children
  .flatMap(section => section.children[1].children)
  .find(button => button.dataset.type === typeName);

runFrames(5);
const startCount = cellCount();
dockButton('tissue').onclick();
clickHex(2, 0);
check('a click on a free hex next to the body places the chosen cell', cellCount() === startCount + 1);
clickHex(2, 0, { button: 2 });
check('a right click removes it', cellCount() === startCount);

moveMouseTo(0, 0);
runFrames(70);
check('resting on a cell shows its tooltip with a live example',
  byId('tooltip').style.display === 'block' && /How to use/.test(byId('tooltip').innerHTML));

dockButton('command').onclick();
clickHex(-2, 1);
pressKey('3');
check('a new Command is clicked at once, and a number key binds it', /Fires on <b>key 3<\/b>/.test(info()), info());
pressKey('Escape');

clickHex(0, -1, { ctrlKey: true });
clickHex(1, -1, { ctrlKey: true });
fire('game', 'contextmenu', { ...screenPointOf(1, -1), target: canvas });
check('right-clicking the selection opens the save menu', byId('save-menu').style.display === 'block');
byId('save-menu-name').value = 'Front';
byId('save-menu-save').onclick();
const partRow = byId('my-parts').children[0];
check('the selection is saved as a part', !!partRow && /Saved "Front"/.test(info()), info());
check('the library is kept in storage', JSON.parse(storage.items['bioforge-lab-library']).length === 2);

partRow.onclick();
check('clicking the part picks it up as a stamp', /Placing "Front"/.test(info()), info());
const beforeStamp = cellCount();
clickHex(3, -3);
check('a click puts the stamp down (off the body, as planned cells)',
  byId('stats').innerHTML.includes('planned cell'), `cells ${beforeStamp} -> ${cellCount()}`);
pressKey('Escape');

dockButton('bud').onclick();
clickHex(-1, -1);
partRow.onmousedown({ button: 0, target: {}, preventDefault() {} });
moveMouseTo(-1, -1);
fire('window', 'mouseup', { ...screenPointOf(-1, -1), target: canvas });
runFrames(1);
check('dragging the part onto a Bud makes the Bud grow it', /Grows <b>Front<\/b>/.test(info()), info());

check("Bioforge Moba's old library carries over", byId('my-creatures').children.length === 1);
check('the old library is left as it was', storage.items['bioforge-templates'] === OLD_LIBRARY);
done();
