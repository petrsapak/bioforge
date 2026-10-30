'use strict';
// The title screen: its living scene keeps every group alive, keeps debris in check and runs the same every time;
// in the app (fake DOM) the title shows behind the main menu, and leaving it dims the screen before the lab appears.
const { load } = require('./load');
const { startApp, LEAVE_TITLE_FRAMES } = require('./dom');
const { check, done } = require('./check');
const { X: sim } = load({}, ['TITLE_SCENE', 'createTitleScene', 'stepTitleScene', 'titleSubjects', 'takeSnapshot',
  'runDataIndex']);

const STEP_SECONDS = 1 / 40;
const SCENE_SECONDS = 90;

// ---------- The scene ----------
const title = sim.createTitleScene();
const fullCounts = () => title.groups.every(group => group.creatures.length === group.entry.count);
check('every group starts at full strength', fullCounts());
let lostAny = false;
let mostDebrisCells = 0;
for (let i = 0; i < SCENE_SECONDS / STEP_SECONDS; i++) {
  sim.stepTitleScene(title, STEP_SECONDS);
  if (!fullCounts()) lostAny = true;
  const debrisCells = title.world.creatures.filter(creature => creature.debris)
    .reduce((sum, creature) => sum + creature.cells.length, 0);
  mostDebrisCells = Math.max(mostDebrisCells, debrisCells);
}
check(`in ${SCENE_SECONDS} s the hunters kill something`, lostAny);
check('and every group is still there, refilled by newcomers', title.groups.every(group => group.creatures.length > 0),
  title.groups.map(group => `${group.entry.design} ${group.creatures.length}`).join(', '));
check('broken-off pieces never pile up past the limit (a piece adds at most its own cells)',
  mostDebrisCells <= sim.TITLE_SCENE.maxDebrisCells + 40, `${mostDebrisCells} cells`);
check('the camera has the light and the other creatures to look at', sim.titleSubjects(title).length > 3);

const once = sim.createTitleScene();
const twice = sim.createTitleScene();
for (let i = 0; i < 20 / STEP_SECONDS; i++) {
  sim.stepTitleScene(once, STEP_SECONDS);
  sim.stepTitleScene(twice, STEP_SECONDS);
}
const stateText = scene => JSON.stringify(sim.takeSnapshot(scene.world, sim.runDataIndex()));
check('the scene runs the same every time', stateText(once) === stateText(twice));

// ---------- In the app ----------
const { byId, runFrames } = startApp(['clear'], {}, { atMainMenu: true });
runFrames(5);
check('the main menu sits on the title scene', byId('menu-sheet').classList.contains('title-screen'));
check('the game comes up out of black', +byId('screen-fade').style.opacity > 0.5);
runFrames(120);
check('then the title is clear', byId('screen-fade').style.display === 'none');
byId('menu-free-build').onclick({});
runFrames(15);
check('leaving dims the screen while the menu slides away', +byId('screen-fade').style.opacity > 0.2 &&
  byId('menu-sheet').classList.contains('leaving') && byId('menu-sheet').style.display === 'flex');
runFrames(LEAVE_TITLE_FRAMES - 15);
check('at black the lab is set up behind it', byId('menu-sheet').style.display === 'none' &&
  !byId('menu-sheet').classList.contains('title-screen') && +byId('screen-fade').style.opacity > 0.8);
runFrames(70);
check('and the lab fades in', byId('screen-fade').style.display === 'none');

done();
