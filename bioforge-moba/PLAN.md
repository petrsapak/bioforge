# Bioforge Arena: plan

A 5v5 MOBA with Bioforge's soft-body cell creatures. Every player designs a creature in the builder before the match, within the same biomass budget, then plays it in a small two-lane arena with towers, minion waves and a core per team. You win by destroying the enemy core.

This replaces the Bioforge Online MMORPG idea (2026-10-27). The MMO folder `prototypes/bioforge-online` stays as it was.

## Decisions (2026-10-27)
- **Players:** bots first. The first versions are offline: you plus 4 bots against 5 bots. Networking comes later. The sim has no DOM, so a Node server can run it unchanged.
- **Creatures:** built before the match in the builder, within a fixed budget: 50 biomass and 24 cells. The budget was 120 / 50 until the fps fix, so ten heroes stay cheap to simulate. Every cell type is available and nothing unlocks over time.
- **Map:** small, with two lanes (top and bottom), about 6000×3000 px, so matches stay short.
- **Code:** a new folder that reuses the sim, renderer, builder and cell data from bioforge-online. The open world and progression code is dropped.

## Architecture
These are plain `<script src>` files in one global namespace, the same as before: `index.html` opens straight from disk, and the tests load the same files with `vm`.

```
sim.js          physics, cells, fluids, combat (pure); structures are pinned cells (c.pin) that can be shielded (c.inv)
map.js          arena map from data: rocks, currents, lanes, rock/current hooks, steering (pure)
moba.js         match rules: heroes, waves, towers, fountain, respawns, bot heroes, winning, buildCheck (pure)
data/arena.js   arena layout, structures, minion designs, waves, budget, bot designs and names
data/*.js       cells, templates, tips
render.js       canvas: creatures, rocks, lanes, health bars, minimap, events
ui.js           builder, match HUD, sandbox
tests/*.js      headless checks: node tests/all.js
```

## Milestones
1. **Playable bot match.** ✅ Done 2026-10-27.
   - Arena: two lanes, rocks in the middle kept off the lanes, and a base at each end with a core and a fountain.
   - Towers: per team, an outer and an inner tower on each lane. Towers shoot minions first, then heroes. A tower can only be hit once the tower before it is down, and the core once any inner tower is down.
   - Minions: a wave of 2 grunts (thorn) and 1 spitling (spitter) per lane every 30 s. They swim the lane and fight whatever they meet.
   - Heroes: you plus 9 bots. The bots play a compact roster in `data/arena.js`: Lancer (siphon dash into thorns), Stinger (eyespot nettles), Spitter (four acid spitters) and Snarer (snares that pull foes onto thorns). Bots push their lane behind the minions, fight what comes near, stay out of an enemy tower's range unless their minions are in it, and retreat to the fountain when hurt.
   - Death and fountain: when your nucleus dies you respawn at the fountain after 15 game s. The fountain heals, refuels, regrows lost cells and burns enemies.
   - Win: destroy the enemy core.
   - T lets a bot play you; M shows the whole map.
   - Test: `tests/match.js`.
2. **Playtest and tune.** Check match length, tower and core health, wave size, bot behaviour, and whether 120 biomass is the right budget.
3. **In-match growth (to decide).** A MOBA usually has in-match progression, such as levels and items. Options:
   - (a) Biomass from kills and minion last-hits lets you add cells at your base mid-match.
   - (b) Levels that raise cell health and damage.
   - (c) None: the design is everything.
4. **Hero roster for bots.** Bot designs with clear roles: tank, ranged spitter, snare catcher, nettle burst, healer with menders.
5. **Jungle.** Neutral camps in the middle, and maybe an objective boss.
6. **Multiplayer.** A Node and WebSocket server runs the match, and clients send input. Then a lobby for friends.

## Known limits
- Sim speed: the user reported very low fps. Fixes on 2026-10-27, each checked against unchanged swim speeds and passing tests:
  - Physics substeps cut from 8 to 4 (`SUB`).
  - Game steps of 1/40 s instead of 1/60.
  - Fluid flow runs every 1/20 s.
  - Faster vector lengths, and structures skip spring work.
  - The renderer draws bonds in one pass and only on-screen cells.
  - Smaller heroes (budget 50).

  Net result: about 77 ms of sim per game second, or about 3 ms per frame at 2.5x speed, down from about 840 ms per real second. The big showcase builds would cost about 2.5x as much.
- Kill credit: kills count per team only. There is no last-hit or assist tracking.
- Bots don't use the jungle or gank other lanes, and they retreat along their own lane.
