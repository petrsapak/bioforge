# Bioforge Online — plan

An MMORPG built on the Bioforge-v3 cell sim. You start as a simple organism, then level up by killing organisms and completing quests in an open world.

The world has hubs, where PvP is off, and the open world outside them, where PvP is on. There are 5 biomes, each with its own enemies, bosses, hub and world boss. Players can form clans and chat.

Audience: a few friends for testing first, then public if it's fun.

## Phases
1. **Single-player open-world slice** (this doc): one biome, the full core loop.
2. **Data-driven content**: biomes, enemies, quests and loot defined as data. Adding content means no code changes.
3. **Multiplayer**: a Node + WebSocket server that runs all combat and checks every design against its budget. Each player only receives what's near them. Hub/PvP zones and the PvP rules below.
4. **Accounts, saves, chat, clans**: a database and login. Private server for friends first.
5. **Biomes 2–5 and world bosses.**

## Architecture rule (from day 1)
The simulation has no DOM or canvas code. It runs the same in the browser and in Node, so the phase 3 server reuses it unchanged.

Files are plain `<script src>` files that share one global namespace. This avoids ES modules, so `index.html` still opens straight from disk, and Node test scripts can load the same files with `vm`.

```
bioforge-online/
  index.html      shell + script tags
  sim.js          physics, cells, fluids, combat   (pure)
  world.js        map, zones, spawners, AI, aggro   (pure)
  progress.js     XP, levels, inventory, quests     (pure)
  data/*.js       cells, enemies, biomes, quests, loot (pure data)
  render.js       canvas drawing
  ui.js           builder, HUD, dialogs, menus
  game.js         main loop, input, save/load
  tests/*.js      headless checks (run with node)
```

## Phase 1 milestones
Each milestone ends with something playable and a test script.

1. **Port.** ✅ Done 2026-10-26. Copy v3 and split it into the files above. Behaviour must stay the same.
   - Test: the v3 test scripts pass against the new files (`node tests/all.js`).
   - `world.js` and `progress.js` don't exist yet; they arrive with milestones 2–3. `ui.js` is still the v3 builder and battle app in one function, and gets split when the open world replaces the wave arena.
2. **Open world.** One large biome, Tidepool, about 12000×12000 px.
   - Camera follows the player. Rocks and walls act as obstacles, plus current fields.
   - Spatial hash for collisions. Only creatures within about 1.5 screens of the player are simulated; the rest sleep.
   - Spawn zones respawn enemies on a timer. Enemy AI has idle, aggro radius, chase, leash back to spawn and flee.
   - Test: 200+ enemies in the world at 60 fps; leashing works.
   - ✅ Done 2026-10-26 (`world.js`, `data/biomes.js`, `tests/world.js`).
     - 209 enemies in 49 spawn zones across 8 kinds, placed in rings by difficulty from the centre start. Map layout is generated from a seed.
     - Sleeping enemies are taken out of the sim and put back unchanged. Sim time is about 2–6 ms per frame with 10–45 enemies awake.
     - The spatial hash covers only rocks. Creature-vs-creature collisions are still checked pair by pair; that's fine for the awake counts here, but needed for the server in phase 3.
     - Snare lines and eyespots still pass through rocks; globs don't.
     - The wave arena is gone and the Fight button now enters Tidepool. Sandbox is unchanged.
     - `ui.js` is not split yet. Splitting it makes sense with the hub, when the builder gets locked to town (milestone 5).
   - **Places pass** (2026-10-26, after playtest feedback "world unremarkable, starters too big"):
     - 11 named regions (nearest-centre areas), each with its own enemies, water colour and rock colour. Entering one shows its name as a banner; the HUD names it; M opens the full map with every name.
     - Landmarks are rings of rock in the data: 4 caves with a den of tougher enemies, The Maw (dungeon boss lair, sealed until milestone 7) and the Leviathan Ring (world boss arena, empty for now). The start area is labelled Haven, where the hub goes in milestone 5.
     - New smallest prey around the start: mote (5 cells, passive, runs when hurt) and nipper (6 cells, one thorn). 280 enemies in 65 spawn zones.
3. **Progression.**
   - XP per kill, scaled by the level gap. A level curve.
   - Each level raises the biomass budget and the cap on cell count.
   - Cell types unlock by level or as boss drops.
   - Test: level 1→5 with expected XP; a design over budget is rejected.
   - ✅ Done 2026-10-26 (`progress.js`, `tests/progress.js`).
     - Levels 1–20. XP to next level = 30·L^1.7 (30, 98, 194, 317…). A kill gives 15·m^1.3 XP for a level m enemy, +15% per level above you (at most +50%), −20% per level below (at least 10%). 2 even-level kills for level 2, then 3–4 per level early on.
     - Biomass 40 + 8 per level; cell cap 16 + 3 per level. The showcase builds fit around level 11.
     - Cell types unlock by level (`CELL_LVL`): basic body, thorn, muscle, bloater, pacemaker and heart at 1, up to Bud at 10. Locked cells can't be placed (except with Unlimited biomass) and block entering the world.
     - Enemy levels come from the biome zones (mote 1 … manta/crab 10; cave dens +1) and show over every enemy, coloured by the gap.
     - Kills: the world logs every enemy death and the game credits them all to you. The phase 3 server needs real credit (who did the damage).
     - Enemy AI after playtest: no heal on returning home (only Menders heal; an enemy that falls asleep far from every player is still reset home healed). Fleeing kinds flee once per fight at 60% speed, then turn back and fight; passive motes calm down where they are.
     - Game speed: the world and sandbox run at 2.5x real time (`GAME_SPEED` in `ui.js`), stepped at most 1/60 s at a time, so the sim runs about 3 times per frame. The HUD shows fps.
     - Level and XP are saved to localStorage now (key `bioforge-progress`) so a reload doesn't wipe them; full saving stays milestone 8.
4. **Cells as inventory.** You own a count of each cell type, and a design can only use cells you own. Kills and quests drop cells as pickups.
   - This is required for the red-name cell drops in phase 3, so it goes in now.
   - Test: build/unbuild keeps counts right; loot pickup works.
5. **Hub.** A safe zone with the respawn point, NPCs with dialogue, and a quest giver.
   - The **builder only works inside a hub**: you redesign your creature in town.
   - **Trading happens in the hub.** Phase 1 has an NPC vendor who buys and sells cells for a currency dropped by kills. Phase 3 adds player-to-player trade: a trade window where both players confirm, hub only.
   - Test: no damage inside the hub; the builder is locked outside; vendor buy/sell keeps inventory and currency right.
6. **Quests.** Quest types: kill N of X, collect N items, reach a place, kill a boss. They form a chain of about 8 that teaches the cell types. Quests are defined as data.
   - Test: every quest in the chain can be completed by a scripted bot.
7. **Dungeon + boss.** An entrance in the world leads to its own area: rooms with packs, a mini-boss, then the boss.
   - The boss is a big multi-part creature with phases. For example, phase 2 starts when its shell cells are gone.
   - Test: the boss changes phase and dies; the reward drops.
8. **Death + saving.** On death you respawn at the hub and lose a small amount of XP to monsters. Saved to the browser (localStorage) for now.
   - Test: save, reload, and level, inventory and quests are restored.

Then playtest. If the loop is fun, phase 2 starts.

## PvP rules (Lineage 2 style; built in phase 3)
| State | How you get it | If a player kills you |
|---|---|---|
| Normal (white name) | Default | Nothing lost |
| Flagged (purple name) | You attack a normal player outside a hub. Lasts 30 s after your last hit. | Lose 5% of the current level's XP |
| Red (PK) | You kill a normal player. Each such kill adds karma. | XP loss plus a chance to drop cells as pickups; more karma means a higher chance |

- Attacking a flagged or red player does not flag you.
- Killing flagged or red players gives no karma.
- Karma is burned off by killing monsters, as in L2.
- Hubs: no damage at all.

### Defaults to confirm
- Can losing XP drop you a level? Default: **no**.
- Red players in hubs: guards attack them, or they can't enter? Default: **they can enter, but the builder and quests are locked**.
- Cell drop chance per cell type: default **5% + 1% per karma point, at most 3 cells per death**.
- Do red players lose XP even when killed by monsters? Default: **yes, 5%**.

## Biomes (draft)
1. **Tidepool**: the starter biome; warm and food-rich.
2. **Kelp Forest**: currents and tangling; snare users.
3. **Hydrothermal Vents**: heat damage and toxic water; shells and menders.
4. **Frozen Brine**: low fluid flow, so creatures are slow; fat and hearts.
5. **Abyssal Trench**: dark (eyespots weak), huge predators.
