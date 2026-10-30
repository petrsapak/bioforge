'use strict';
// The title screen's living scene behind the main menu: its water, who lives there, the drifting light, and how the
// camera wanders between them (pure data). titlescene.js runs it, titleview.js draws it.

// One group of creatures in the scene. design: a template name; team: 0 for the wired drifters, 1 and 2 for two
// rival packs of hunters, which chase anything not of their team; count: how many live at once; behaviour: 'wired'
// (moves only by its own wiring) or 'hunt' (the AI steers it); nearLight: spawned around the light.
function titleGroup(design, team, count, behaviour, nearLight = false) {
  return { design, team, count, behaviour, nearLight };
}

const TITLE_SCENE = {
  width: 2000,                                            // px of water
  height: 1150,                                           // px
  seed: 11,
  // No fluid upkeep: the showcase creatures weren't built to feed themselves, and starved within 30 s with it.
  systems: ['nerve', 'food', 'regrow', 'secretions'],
  food: { maxCount: 30, interval: 0.4 },                  // specks drifting like plankton
  light: {                                                // a lamp drifting round a loop that the Seekers follow
    path: [[500, 380], [1000, 260], [1500, 420], [1450, 800], [950, 900], [520, 760]],
    speed: 14,                                            // px per game s: a Seeker swims about 20
    range: 520,                                           // px
  },
  groups: [
    titleGroup('seeker', 0, 7, 'wired', true),
    titleGroup('jelly', 0, 2, 'wired'),
    titleGroup('eel', 1, 1, 'hunt'),
    titleGroup('manta', 1, 1, 'hunt'),
    titleGroup('crab', 2, 1, 'hunt'),
    titleGroup('snarer', 2, 1, 'hunt'),
    titleGroup('spitter', 2, 1, 'hunt'),
  ],
  respawnDelay: 5,                                        // game s before a lost creature is replaced
  spawnMargin: 140,                                       // px from the walls where newcomers appear
  lightSpawnRadius: 160,                                  // px around the light where Seekers appear
  maxDebrisCells: 60,                                     // cells of broken-off pieces kept; the oldest go first
  commandBurst: { period: 7, length: 1.5 },               // game s: Space is held for 1.5 s every 7 s
};
