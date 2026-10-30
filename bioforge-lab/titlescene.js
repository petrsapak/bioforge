'use strict';
// The title screen's living scene (data/title.js): building its world, keeping every group alive by sending in
// newcomers, clearing old debris, moving the light, and the creatures the camera may follow (pure).

// The one place a title scene is built: its world, with every group spawned and the food stocked.
function createTitleScene(scene = TITLE_SCENE) {
  const world = newWorld(scene.width, scene.height, { seed: scene.seed, systems: scene.systems,
    foodSupply: createFoodSupply(scene.food) });
  const title = { scene, world, time: 0, groups: scene.groups.map(entry => ({ entry, creatures: [], waiting: 0 })) };
  placeTitleLight(title);
  for (const group of title.groups) {
    for (let i = 0; i < group.entry.count; i++) spawnTitleCreature(title, group);
  }
  stockFood(world);
  return title;
}

// one step: the light moves, Space is held during a burst, the world steps, then lost creatures and old debris are
// dealt with
function stepTitleScene(title, dt) {
  const burst = title.scene.commandBurst;
  title.time += dt;
  placeTitleLight(title);
  const ability = title.time % burst.period < burst.length;
  step(title.world, dt, { swimX: 0, swimY: 0, ability, heldKeys: new Set() });
  for (const group of title.groups) replaceLostCreatures(title, group, dt);
  clearOldDebris(title);
}

function placeTitleLight(title) {
  const light = title.scene.light;
  const [x, y] = pointAlongLoop(light.path, title.time * light.speed);
  title.world.light = createLight(x, y, light.range);
}

// A group short of its count gets one newcomer once respawnDelay has passed since it noticed.
function replaceLostCreatures(title, group, dt) {
  group.creatures = group.creatures.filter(creature => creature.alive && title.world.creatures.includes(creature));
  if (group.creatures.length >= group.entry.count) {
    group.waiting = 0;
    return;
  }
  group.waiting += dt;
  if (group.waiting < title.scene.respawnDelay) return;
  group.waiting = 0;
  spawnTitleCreature(title, group);
}

// A creature of the group at a random spot: near the light for the Seekers, else anywhere clear of the walls,
// turned a random way.
function spawnTitleCreature(title, group) {
  const { scene, world } = title;
  const entry = group.entry;
  let x = scene.spawnMargin + randomFraction(world) * (scene.width - 2 * scene.spawnMargin);
  let y = scene.spawnMargin + randomFraction(world) * (scene.height - 2 * scene.spawnMargin);
  if (entry.nearLight) {
    const angle = randomFraction(world) * TAU;
    x = world.light.x + cosine(angle) * scene.lightSpawnRadius;
    y = world.light.y + sine(angle) * scene.lightSpawnRadius;
  }
  const creature = spawn(world, TEMPLATES[entry.design], x, y, randomFraction(world) * TAU, entry.team);
  creature.aiControlled = entry.behaviour === 'hunt';
  creature.autonomous = entry.behaviour === 'wired';
  group.creatures.push(creature);
}

// Pieces broken off in fights pile up; past maxDebrisCells the oldest pieces are taken out of the water.
function clearOldDebris(title) {
  const world = title.world;
  let debrisCells = 0;
  for (const creature of world.creatures) {
    if (creature.debris) debrisCells += creature.cells.length;
  }
  for (const creature of world.creatures.filter(other => other.debris)) {
    if (debrisCells <= title.scene.maxDebrisCells) return;
    debrisCells -= creature.cells.length;
    removeCreature(world, creature);
  }
}

// What the camera may look at, in a fixed order: the light with its Seekers, then each living creature of the
// other groups. Each is { x, y } in the water.
function titleSubjects(title) {
  const subjects = [{ x: title.world.light.x, y: title.world.light.y }];
  for (const group of title.groups) {
    if (group.entry.nearLight) continue;
    for (const creature of group.creatures) subjects.push({ x: creature.centerX, y: creature.centerY });
  }
  return subjects;
}
