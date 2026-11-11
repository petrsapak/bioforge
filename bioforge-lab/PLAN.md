# Bioforge Lab: plan

A single-player game about programming living creatures. Each level is a puzzle: you build a creature from cells,
wire its nervous system, beat its Heart, set its glands and plan its metabolism. Then you let it loose and watch it
act **on its own**. When it fails you look inside it, find out why, and rewire it. The fun is the moment a creature
you wired does something lifelike that you never explicitly told it to do.

Started 2026-10-28, copied from `bioforge-moba/`, which is now frozen. This file describes the game as it is. How
it got here is in `sessions/`; the long form of this plan up to version 0.8.0 is in git (`lab-v0.8.0`).

## Decisions (2026-10-28 to 2026-11-10)

### The game
- **The verb is programming, not piloting** (2026-10-28). Creatures run on their own wiring. Nothing steers the
  player's creature: no WASD, no AI, no held heading, in a level, the Sandbox, the Lab's Preview or anywhere else
  (2026-11-10; until then the Preview and the Reference window held their creature facing up, so a design that
  steers itself hardly turned there, and the sim still had a direction input only they and the tests used).
- **Manual triggers stay:** a Command neuron fires while its key is held. An unbound one fires on Space; a bound
  one on any letter or number key with no job of its own (user, 2026-10-28: "command can bind to any key on
  keyboard apart from the important ones"). Reserved: 1, 2, C, E, F, G, H, M, N, P, Q, R, T. Only Metastasis
  brings the Command to a level's dock; it is also in the Sandbox and in every level once the last one is won.
- **Bit-identical determinism:** the same design, level and seed give exactly the same run in every browser and in
  Node, for fair scoring, solvable puzzles and shareable solutions. The sim uses its own seeded random generator
  and its own sine, cosine and arc tangent.
- **Every run steps in 1/40 game s** (`GAME_STEP`, 2026-11-10), whatever the frame rate and the speed: a frame's
  time is saved up until it makes a step, and the screen draws part of the way between the last two steps, so
  motion is smooth at 60 Hz, 144 Hz and in slow motion. Until then each frame's time was cut into steps of its
  own length, and the same design gave different results on different screens (First stroke: 17.35 s at 40 Hz,
  17.31 s at 144 Hz), though the headless run that sets the pars always used 1/40 s.
- **Every mechanic must be removable** (see "Removable mechanics"). The user may cut any that turns out
  frustrating.
- **Simple rules over engine quirks** (2026-11-02, user: "it requires detailed knowledge of the quirks of the
  engine and that is not fun. I want it to be simple"). A piece that needs engine knowledge to use is changed or
  cut.
- **Loose limits, tight par** (2026-10-29, user: "I want the levels to be completable by everyone on 1 star"). A
  level's budget or kit leaves room to spare; the par time and par biomass sit at the reference solution.
- **Code quality:** readable names, no one-letter variables, a 120-character line limit, one system per file
  (rules in `CLAUDE.md`).

### Nerves
- **Signals travel only along fibres** (2026-10-28). Touching cells pass nothing on. A fibre runs from the centre
  of its start cell through the cells between to its end cell, is directed (drawn with an arrow), and connects
  only at its two ends. One step from a cell to its neighbour is one unit. A fibre is cut when a cell on it dies.
- **Neurons sit inside body cells,** one per cell, and take no body space. The set (data, so any can be cut):
  Pacemaker (a clock, rate in Hz), Inhibitor (on while its input is off), Synapse (on once its inputs add up to
  its threshold), Latch (each new pulse flips it), Delay (its input, 0.05 to several s late), Ganglion (follows
  its input slowly) and Command (a key).
- **Signals are graded and on/off.** Senses give 0 to 1 (stronger when closer), fibres carry levels, and a plain
  cell passes on the sum of its inputs, clamped to 0..1.
- **A pulse reaches every wired cell at once** (2026-11-02, user: "Simple pulse from pacemaker should arrive into
  every connected cell at the same time"). Each nerve step the cells settle in order, each after the cells its
  fibres come from. Only a Delay, a Ganglion or a loop makes a signal late; a fibre that closes a loop delivers
  the signal of the nerve step before. Until then every fibre took one nerve step (1/160 game s).
- **Limits come from `RULES`:** 12 neurons and 40 fibre units; a level may set its own (Shape allows none).
  Neurons cost no materials (user, 2026-10-28).
- **The player chooses a fibre's route** (2026-10-29): a drag lays it through the cells the mouse passes over,
  kept as the fibre's `via` list; a fibre without one takes the shortest way. Fibres crossing one cell side lie
  side by side, spread evenly round its middle, each in a colour no neighbour has (8 colours); the fibre under the
  mouse is drawn bold from end to end (user, 2026-10-29 and 2026-11-05).
- **Neurons only in Tissue and the Nucleus:** decided 2026-11-02, not built. Today 14 templates keep a neuron in
  another cell, mostly an Inhibitor in a Heart.

### Body, water and senses
- **The water pushes on the skin** (2026-10-28). A skin cell moving face-on meets 10x the drag of one sliding
  along the skin, plus a part that grows with the square of the speed. So shape matters: a tail beating side to
  side swims, a wave down it swims faster, a blob that pulses stays put. Siphons and Cilia are the easy movers.
- **A Muscle's timing comes only from its wiring** (2026-11-02, user: "If I want delay I will add delay"). It
  contracts while its signal is on; two Muscles on one source always move together. The game adds no rhythm,
  side turns or wave. A Muscle pulls by the square root of its signal, and a body turns toward the side whose
  Muscles are held shut for a second or more (`MUSCLE_TURN_TORQUE` 10), so Light eyes can steer a Muscle swimmer.
- **Muscle swimming is a regular way to travel** (2026-11-01): a well-wired fish of about 15 cells swims as fast
  as the Jet (23 px/s), faster with a wave. A Bloater lets go at 6 per s, a little slower than it swells.
- **Light has a reach** (450 px by default): a Light eye's signal is its direction factor times a brightness that
  falls evenly to 0 at the edge. In the Sandbox the mouse is the light ("Cursor as a sense", 2026-10-28). A lit
  Photophore is a light too (400 px), seen by every creature but its own.
- **The Nose** smells the nearest food speck within 300 px, graded like a Light eye. The **Eyespot** signals
  while an enemy cell is within 120 px.
- **Pieces taken out,** each loading as Tissue with its neuron kept (`REMOVED_CELL_TYPES` in `design.js`): the
  Valve (2026-11-02), the Resilin gland and the Tanner (2026-11-07), the hormone glands and the Receptor
  (2026-11-08, with hormones, moods, the hormone view and their five levels).

### Fluids, materials and growth
- **Cells burn O₂ and sugar and make waste,** where a level runs the fluid system. Fluids seep between touching
  cells at 0.1 flow per unit of fill difference; cold water (`seepFactor`) slows that, and stale water
  (`waterOxygen`) lets Gills make less.
- **The Heart pumps an area and beats on a signal** (2026-11-01, user: "Heart areas only", "5 cells", "Wired
  beat"). It pumps every fluid between touching cells within 5 hex steps of it, about 25x faster than seeping, as
  hard as its signal, and burns 0.15 fuel at a full beat, as much as a Siphon. Until then it pumped vessels laid
  by hand in a third view; they went because every Heart level had one winning layout.
- **Material kits** (2026-10-29): Protein, Sugar, Fat and Mineral (`data/materials.js`). Each cell type has a
  recipe. A level may hand out a kit instead of a biomass budget: the body must fit it, and what is left is the
  creature's starting reserves (sugar spread over the body, fat only into Fat cells, protein kept for growing).
- **Fat and feeding:** a Fat cell stores up to 10 fat, turns spare sugar into fat and back (2.5 and 2 sugar per
  fat, 0.25 fat per s). Any cell touching a speck eats it while a Mouth has room, so a Mouth needs a store.
- **Secretions never hurt their own creature** (2026-10-29, "No self-harm"). The Acid gland does 24 health per s
  to hard enemy cells in reach (2 to soft ones), the Protease gland 10 per s to soft ones (none to hard), 12 px
  beyond touching. The Mineralizer hardens one of its own cells every 1.5 s for 1 mineral.
- **Hard cells** (Shell, Thorn, hardened cells) feel a quarter of a thorn hit or sting, and a Mouth can't bite
  them (2026-11-05). Shell beats spikes, acid beats shell.
- **Growing costs protein** from the kit's leftover (2026-11-07). A Mender regrows lost cells of the design; a
  Bud grows a saved part and shoots it off with its share of the body's O₂ and sugar. Hunters chase launched
  parts that still have fuel.

### Levels
- **A level is data** (`data/levels.js`): an arena, the systems that run, limits or a kit, the start, an optional
  light, rock and currents, other creatures (wired, or steered by the AI: hunt, flee, guard), a goal, a time limit
  and a par. Goals: `reach`, `stayNear`, `restIn`, `eat`, `survive`, `kill`, `spread`. A win earns a star, one
  more for the par time and one for the par biomass.
- **Levels unlock in order;** `RULES.allLevelsOpen` opens them all and stays on for now (user, 2026-11-07: "do
  not switch it off").
- **The dock fills level by level** (2026-11-01): each level lists what it brings (`unlocks`), and its dock has
  that and everything before it; the rest is greyed out with a lock. A design holding a locked or banned piece
  can't run in the level. Everything is open in the Sandbox and once the last level is won.
- **Rock and currents** (2026-11-01, user: "walls and stones to be constructed from hexes"): rock is hex tiles on
  the cells' own grid, which push cells out and grip them by friction; a current is a box of moving water.
- **A level may leave out cell types** (`bannedCells`), allow no neurons or fibres (`maxNeurons` and
  `maxFibreUnits` 0), and be bigger than the screen (`view`: the camera follows the creature, an arrow at the
  screen's edge points at a ring out of view, and the goal banner counts the px to go).
- **The Muscle and the Bloater stay, and levels must need them** (user, 2026-11-01): Tail and Crevice.
- **Every cell has a level that needs it** (2026-11-10, user chose "A level for each" for Cilia and the Snare):
  Shape and Reel.
- **Chapters 3 and 4 no longer repeat one chase** (2026-11-10, user chose "Cut Marathon, regoal one"). Marathon
  is gone, and Packed lunch is a crossing instead of Long haul's chase from a kit. Until then six levels asked to
  stay near the drifting light for 100 to 200 s, and their answers were one body with parts added.
- **Metastasis is the one exception to "you never pilot"** (see "How this differs from Primordialis"). It stays
  the last level of chapter 7 until players say whether they want more of it (user, 2026-11-10: "Leave it for
  now").
- **The briefing** (2026-11-05): the first time the Lab builds for a level not won yet, a card shows what it
  asks, its arena, the pieces it brings and its rules.

### Runs
- **Runs are in real time,** with pause (P), one step (.) and speeds 1×, 2×, 4×, ½×, ¼× (,).
- **Signal probes:** a 6 s trace per sense, neuron and signalled cell of the player's creature, up to 8 lanes; a
  click on a cell adds or removes its lane; T hides them.
- **The timeline** (2026-11-10): a level run is recorded (the keys of every step, a snapshot every 5 game s,
  thinned past 120 snapshots). A slider in the level bar shows any moment it has been through, paused there, with
  the traces of the 6 s before it; ← and → move 1 s. Running on from the past plays the run as it went, so a look
  back never changes a result. **Result** (Enter) runs the level to its end at once: Bloom's 320 game s take
  about 0.3 real s. Not in an adventure, which is played by hand.
- **Marks on the timeline** (2026-11-10, user: "I want just #1", of three ideas to make players want to
  experiment). A recorded run notes what happens, told from its state step by step, so the sim knows nothing of
  it (`runevents.js`): cells lost with their names, a Bud part launched, cells out of O₂ or sugar, waste
  poisoning, a hit taken, a hit landed, the first food, a creature arriving or dying, the host rule broken, a
  timed goal's count starting and stopping, the end, and in a lost run the moment nearest to the ring. Events of
  one kind within 2 game s are one mark; a run keeps 80 at most. Each is a tick under the slider (green good, red
  bad, yellow a note) with its time and words on hover. A click, or Shift with ← or →, shows the moment one step
  before it, paused, so one step shows it happen. The goal banner shows a mark's words for 1.5 game s after it.
- **The ghost** (2026-11-10): a recording keeps the player's pose in every step. When a run of another design
  starts in the same level, the run before (if it lasted 2 game s) becomes the ghost: its cells drawn as faint
  rings where they were after the same number of steps, its whole way as a dashed line, and a label that says how
  it ended once it is over; its end is a grey mark on the timeline. A Retry of the same design keeps the ghost
  it had, since its own run would lie exactly under the creature. G or the Ghost button hides it. The ghost
  lives in memory only: it is gone after a reload, and Continue brings none back.
- **The result box** offers Retry and Lab. After a first win the Lab builds for the next level.

### The Lab
- **The screen where the creature is built is the Lab** in every text (user, 2026-11-01); the code says builder.
- **Two views, tabs at the top:** 1 Body, 2 Nerves. The Body view is drawn still; the Nerve view and the Preview
  show the creature live in a test tank, where Space fires every signal source.
- **The dock** at the bottom: a tab per category, two rows of hexagons, no labels; the hover hint (after 200 ms)
  gives the name, cost, description, how to use it and a live example. Where fluids run, a block in it gives what
  the cell burns, makes and dumps per second as a bar per fluid (against the most any cell burns), when, and how
  long its own full store lasts (user, 2026-11-11: "more visible", "add bars"; until then one dim "burns
  0.025/s").
- **Nothing is chosen at first** (user, 2026-10-30); Esc lets go of what the mouse holds, then opens the menu.
- **Building fast:** drag to paint cells, right-drag to remove, and Symmetry mirrors cells, neurons and fibres
  across up to six axes through the Nucleus. Ctrl+A selects every cell; Delete (or Backspace, or the save menu's
  Delete) removes the selected cells, or with nothing selected the clicked cell, never the Nucleus, and asks first
  if a selection would leave only the Nucleus (user, 2026-11-11).
- **The panels:** the limits line under the tabs (only the current view's limits, in large numbers), a card for
  the clicked cell when it has something to set, the Needs card (Sugar lasts N s, a bar each for the O₂, sugar and waste per second with marks for the Gills and Pores, then a row per need with a ✓, ✗
  or ~ and one "Next:" line), and the Traces window in the Nerve view.
- **Saving:** Shift+right-drag a box round cells and name them (with the Nucleus a creature, without it a part);
  Ctrl+S saves the creature; F5 and F8 quick save and load. The **Templates screen** (T) has My creatures, My
  parts and Examples; Export and Import use `<name>.bioforge.json` files. **Study** shows any creature in the
  floating Reference window beside the Lab.
- **The corner buttons:** Templates and Sandbox at the bottom left; Levels and the big green Run level N at the
  bottom right, which runs the first level not won yet (user, 2026-11-03).

### Menus and saves
- **Main menu** over a living title scene (the real sim, seeded): Continue, New game, Load game, Sandbox, Field
  guide, Settings, Quit (desktop). The **Esc menu** pauses a run. **Settings:** music, sounds, tutorial voice,
  fullscreen, keys, Replay tutorial, Reset level progress.
- **Games** (2026-11-01): each keeps its own design, level results, library, quick save, tutorial and briefings
  under `bioforge-lab-game-<id>-<name>`; settings are shared. Switching games reloads the page.
- **Continue** picks up the Lab's design, the chosen level and a running level or Sandbox, saved whole as a
  snapshot. A run saved by another game version, or in a level whose data changed, is dropped.
- **Save version 4** (`SAVE_UPGRADES` in `savegame.js`). The step to 4 (2026-11-10) forgets every game's results
  in Marathon and Packed lunch, since one is gone and the other is another level now.
- **Storage** is `localStorage`, or the desktop build's `save.json`. Every key starts with `bioforge-lab-`.

### Look, sound and help
- **Cell look: Microscope** (2026-10-29): see-through cells with a coloured membrane and a line-art symbol per
  type; neuron badges are small nerve cells.
- **Music:** one ambient track looping without a seam at 0.2 volume (M). **Sound effects** in one soft underwater
  style, heard by comparing the world from frame to frame, so the sim knows nothing about sound (N).
- **The title** reads "Bioforge" in Megrim; a CSS splash plays once, before the main menu.
- **The tutorial** (2026-11-05): a spotlight and a speech bubble with a voice line; a step moves on when the
  player has done it, and everything else is locked meanwhile. Lessons are data: First stroke, Lighthouse, the
  Lab tour, Long haul (fluids) and Packed lunch (kits). Voice: ElevenLabs' Will, made by `tools/make-voice.js`.
- **The field guide** (G): cells, neurons, 13 topics and a glossary, told in pictures and live examples, with
  facts read from the game's data. No level solutions. Pieces not met yet are dimmed but open.
- **Help texts are checked:** a level's words name only pieces its dock has and levels before it
  (`tests/hints.js`).

### Desktop and versions
- **Desktop build** in `desktop/` (Electron, 2026-10-29): a maximized window without a menu bar, one save file
  written through a temporary file, one copy at a time, Quit and Fullscreen through `window.desktopWindow`.
- **Versions:** `0.<milestone>.<patch>` in `data/version.js`, with `CHANGELOG.md` for players and a
  `lab-v<version>` tag per version. 0.8.0 was the game jam release (2026-11-08, Windows only).

### Late-game ideas (2026-10-30, none built unless said)
- **Spread levels:** grow out of control, like cancer; Tumour (chapter 7) is the first.
- **The reprogramming cell (Vector):** a cell carrying a small program that is written into an enemy when its
  fibre reaches a foreign cell. Conversion and takeover are one mechanism; converted cells are free.
- **Hallmarks, the finale:** the player is a cancer in a host body and breaks the rules a body puts on its cells
  (divide only when told, stop at a neighbour, die when told, no blood supply, stay put), unseen by guard cells
  that compare each cell with the host's self pattern. Breaking a rule is wiring, never a button.
- **Arena:** two or more players submit creatures and one survives. Determinism lets a fight be replayed
  anywhere from the designs and the seed.

## Design principles
From *A Theory of Fun for Game Design* (Raph Koster) and *The Art of Game Design* (Jesse Schell).
- **Fun is learning patterns.** Each chapter teaches one new pattern, and later levels combine those learned.
- **Small rules, deep space.** Few blocks that don't overlap. Before adding one, ask what pattern it allows that
  can't already be built.
- **Lens of the Toy.** Wiring a creature in the Sandbox and watching it move must be fun without a goal.
- **Lens of the Essential Experience:** "I built a brain and it came alive."
- **Lens of Feedback.** You can't debug what you can't see: probes, slow motion, single steps and the timeline
  are core features.
- **Lens of Emergence.** Simple wiring, rich behaviour; Braitenberg's vehicles are the model.

## How this differs from Primordialis
Primordialis (Kaliuresis, 2025) is a roguelike in which you build a cell creature on a hex grid, **pilot it in
fights**, and **collect new cell types from enemies**. Bioforge shares its base mechanics, so the difference has
to come from the verb and the structure:
- **Bioforge Lab: you never pilot.** You program and watch, apart from the manual triggers you bind yourself.
- **The layers are the game:** nerves, blood, secretions and metabolism are systems you design.
- **Food gives raw materials, not cell types.** You design the factory; you don't collect loot.
- **The structure is puzzles and levels, not a roguelite run.** No cell drops, mutations or runs.

**The one exception** (2026-11-08, user: "can the breaking the rules level be more like a single player game ...
I want 20 minute adventure, command unlocked - so that player can steer the creature, spots where he can
customize his creature and fighting"): Metastasis, the last level of chapter 7, breaks these rules on purpose as
the game jam's theme. There you steer (with Commands you wire) and take what you kill. No other level does.

Check every new feature against this list. If it pushes the game toward "pilot your fish through fights" or
"collect parts from kills", it doesn't belong.

## Layers
The creature has layers on one hex grid, each with its own timescale.

| Layer | What lives there | Timescale | Code |
|---|---|---|---|
| **Body** | Cells with mass, health and shape, each built from materials | Static | `core.js`, `physics.js` |
| **Nerve** | Neurons inside cells and fibres between them | Fast | `nerve.js`, `fibres.js` |
| **Vascular** | Fluids seeping between cells, and Hearts pumping their areas | Seconds | `fluid.js`, `vascular.js` |
| **Chemical** | Glands whose secretions act on cells | Seconds | `secretions.js` |

Metabolism runs across the layers, not as a fifth one: materials travel in the blood, and cells are made of them.

Ideas for cells that join layers, none built: pain and stretch senses, hunger and breathlessness senses, a store
sensor, a Mouth that opens on a signal, an amplifier.

## Metabolism
| Material | Comes from | Builds / used for | Since chapter |
|---|---|---|---|
| **Protein** | The kit | Most cells; growing | 1 |
| **Sugar** | The kit, food specks, bites | Fuel in the blood | 3 |
| **Fat** | The kit, spare sugar | A long-term store in Fat cells | 4 |
| **Mineral** | The kit, mineral specks, broken hard cells | Shell, Thorns, hardening | 5 |

Built secretions: acid, protease, the Mineralizer. Ideas not built: a toxin that blocks nerves, digestion loss,
food that gives protein or fat, a growth plan drawn as planned cells, and the metamorphosis boss (dissolve your
fins and recycle them into shell).

## Chapters
| Chapter | New pattern | Systems on | Levels |
|---|---|---|---|
| 1. **Reflexes** | Rhythm, steering by crossed eyes, the body's shape as steering | nerve | First stroke, Lighthouse, Shade, Hunt, Shape |
| 2. **Memory and logic** | Holding still, waiting, timing, thresholds; swimming and crawling by muscle | nerve | Freeze, False start, Metronome, Dock, Tail, Crevice |
| 3. **Circulation** | Stores, waste, the Heart | + fluid, vascular | Long haul, Stale water, Cold water |
| 4. **Feeding** | Kits and reserves, smelling and eating food | + metabolism, food | Packed lunch, Grazing, Bloom |
| 5. **Armour** | Weapons, shell, acid and protease, lures | + secretions | Sting, Reel, Bulwark, Pincushion, Clam, Anglerfish, Quarry, Siege, Spit |
| 6. **Growth** | Regrowth, Buds | + regrow | Grazed, Swarm |
| 7. **Breaking the rules** | A host's rule and its loophole; the adventure | all | Tumour, Metastasis |
| 8. Takeover (not built) | Writing your program into an enemy | + takeover | |
| 9. Hallmarks (not built) | Breaking a host body's rules, with everything open | + host | |

What each level brings to the dock: First stroke Tissue, the Siphon and the Pacemaker; Lighthouse the Light eye;
Hunt Cilia; Freeze the Inhibitor; False start the Latch; Metronome the Delay; Dock the Synapse and the Ganglion;
Tail the Muscle and the Joint; Crevice the Bloater; Long haul Fat, the Gill and the Pore; Stale water the Air
sac; Cold water the Heart; Grazing the Nose and the Mouth; Sting the Nettle and the Eyespot; Reel the Snare;
Bulwark the Shell; Pincushion the Thorn; Clam the Acid and Protease glands; Anglerfish the Photophore; Quarry
the Mineralizer; Spit the Spitter; Grazed the Mender; Swarm the Bud; Metastasis the Command. Shade, Shape,
Packed lunch, Bloom, Siege and Tumour bring nothing.

## Removable mechanics
- **Global switches:** `RULES` in `data/rules.js` holds the limits and the list of switchable systems.
- **Per level:** each level lists the systems it runs. A system that is off isn't stepped or drawn.
- **One system per file** (nerve, fluid, vascular, metabolism, secretions, growth, food), each with its own step
  function. Turning one off never needs edits inside another.
- **Tests run with systems on and off** (`tests/systems.js`).

## Architecture
Plain `<script src>` files in one global scope, pure sim files apart from browser files (see `CLAUDE.md`). Each
sim file registers its systems with `registerSystem({ name, order, switchable, update })`, and `step()` runs
them in order.

```
data/version.js GAME_VERSION (pure data)
data/rules.js   RULES: budget, cell cap, neuron and unit limits, switchable systems (pure data)
data/fluids.js  FLUIDS: the fluid channels (name, capacity, start fill) (pure data)
math.js         deterministic sine, cosine, arcTangent2 and the seeded random generator (pure)
core.js         constants (GAME_STEP), hex helpers, the world, creature and cell factories, spawn, death and
                splitting, the system registry, step() and the cell-death hooks (pure); systems: clock 30,
                cleanup 110, particles 120
fibres.js       nerve fibre routing, units, lanes and colours for drawing, adding fibres to a creature and cutting
                broken ones (pure)
terrain.js      a level's rock (hex tiles that push cells out and grip them) and currents (pure)
physics.js      Command keys and AI input, turning and thrust, springs, drag, collisions, integration (pure);
                systems: input 10, physics 20
nerve.js        signals along fibres, senses, the neuron rules, the settle order (pure); system: nerve 40
                (switchable)
fluid.js        work levels, fuel burning, products, fluids seeping between cells (pure); system: fluid 50
                (switchable)
vascular.js     the Heart's beat and blood pumped within its reach (pure); system: vascular 55 (switchable)
metabolism.js   Fat cells storing sugar as fat and back; a kit's leftovers as reserves (pure); system:
                metabolism 57 (switchable)
actuators.js    resizing, a Muscle's pull and held pull, weapon triggers, timers, debris rot (pure); system:
                actuators 60
secretions.js   hard cells; acid and protease glands, the Mineralizer (pure); system: secretions 62 (switchable)
combat.js       damage, contact hits, aiming, snare lines, globs (pure); system: projectiles 70
growth.js       Bud parts and Mender regrowth (pure); systems: buds 80, regrow 90 (switchable)
food.js         the food supply, eating, specks left by dead cells (pure); system: food 100 (switchable)
ai.js           AI steering: hunters, guards once woken, prey fleeing in tiring sprints (pure)
levels.js       building a level's world, its light, creatures arriving later, stepping it (counting the steps),
                the host rule, the goal checks, the score, a headless run (pure)
adventure.js    Metastasis: the bank, pickups and drops, sleepers, dens, giving the body up (pure)
tutorial.js     the tutorial's rules: which lesson is next, which steps are skipped or done (pure)
design.js       buildCheck, material kits, design warnings and the Needs rows, the saved design format and the
                conversion of old saves (pure)
snapshot.js     any web of objects as plain JSON data and back, shared objects and loops kept (pure)
savegame.js     the save's version and upgrade steps, the games, the resume state, a run's snapshot, creature
                files (pure)
runevents.js    what happened in a level run, told from its state step by step: the events the timeline marks
                and the nearest moment to the goal's ring (pure)
replay.js       the recording of a level run: every step's keys, a snapshot every few seconds, the player's pose
                in every step and the run's events; the run as it was at any step (pure)
titlescene.js   the title screen's living scene (pure)
builder.js      the edited design and every editing rule: cells, neurons, fibres, symmetry, Bud parts, Command
                keys, stamps, the library list (pure)
fieldguide.js   the field guide's entries and facts read from the game's data; an example build running in open
                water (pure)
data/*.js       cells, materials, neurons, fluids, templates, tips, levels and their creatures, sounds, the title
                scene, the field guide's words, the tutorial's lessons
cellart.js      how each cell and neuron badge looks (Microscope style)
render.js       canvas drawing of a world: bonds, cells, overlays, glows, fibres in lanes, food
windows.js      DOM and storage helpers (localStorage, or the desktop save file), floating windows
dialog.js       the game's own question box, with a name field
tipdemo.js      draws the live example in the tooltips and the field guide
hud.js          HUD bars and vitals
dock.js         the cell dock and the neurons in the Nerve view
library.js      the Templates screen (T) and the library
toolbar.js      the Body / Nerves tabs, Unlimited, Symmetry, Delete all; the keys sheet (H); the fluid views
panel.js        the limits line, the message line, the clicked cell's card and the Needs card
builderview.js  drawing the builder grid and the Preview; zoom and pan; the cursor
reference.js    the Reference window: a creature to study beside the Lab
tooltip.js      the hover hint
guideview.js    the field guide sheet
probes.js       signal probes in runs and in the Lab's Traces window
ghost.js        the ghost in a level run: the run before, drawn faint at the same moment along its way
timeline.js     a level run's timeline: the slider over what the run has been through, a look back at any
                moment, the marks where something happened, and Result, which runs the level to its end at once
sandbox.js      Sandbox mode; the fixed-step clock, blended drawing, time controls and vitals HUD it shares with
                levels
levelview.js    the Run level and Levels buttons, the levels sheet, a level run with its bar, arena, HUD, the
                arrow to a far ring and the result box, the best results
adventureview.js an adventure in the app: the camera that follows the player, dens and pickups, E and R
briefing.js     the level briefing card
music.js        the background music
sound.js        sound effects, and the creature's sounds from world changes
titleview.js    the title screen and the dimming between it and the Lab
progress.js     Continue, quick save and load, exporting and importing creature files
gamesview.js    the Load game screen
tutorialview.js the tutorial on screen: spotlight, bubble, voice, Skip and Next
menus.js        the main menu, the Esc menu and Settings
ui.js           the app state, the controls, mouse and keyboard input, the frame loop
game.js         the entry point
fonts/, audio/  Megrim and its licence; the music, the sound effects (audio/sfx/bank.js holds them as base64)
                and the tutorial's voice lines
tools/make-voice.js  makes the voice lines with ElevenLabs; Node only, run by hand
tests/*.js      headless checks: node tests/all.js (adventure, autonomy, builder, crowd, design, determinism,
                editor, ghost, golden, growth, guide, hints, levels, line-endings, menus, metabolism, music, nerve,
                probes, replay, sandbox, savegame, secretions, showcase, sound, soundbank, style, systems,
                terrain, tips, title, tutorial, vascular, version, weapons); helpers: load.js, dom.js, check.js
```

**The saved design format:** a design is `{ cells, fibres }`; a fibre is `{ from: { q, r }, to: { q, r } }` with
an optional `via` list. A design cell is `{ q, r, typeName }`, plus `neuron`, on a Bud `budPart`, `partRotation`,
`partOffset` and `partAim`, and on a Command `boundKey`. A library entry is `{ name, isCreature, cells, fibres }`.
`migrateLibraryEntry()` in `design.js` reads older forms.

**Cell behaviours.** Systems never check a cell's type name. Each cell type in `data/cells.js` declares behaviour
fields (`work`, `product`, `trigger`, `resize`, `breathes`, `pumps`, `needsSignal`…), and the systems read those.

The desktop build, in `desktop/` (Node and Electron, not loaded by the page):

```
main.js         the Electron window around the game page, fullscreen keys, the save file's and window's messages
preload.js      gives the page window.desktopSaves and window.desktopWindow
saves.js        the save file: one JSON file, written after a delay through a temporary file, retried
copy-game.js    copies bioforge-lab into game/ before a build, without tests, logs and plans
make-icon.js    npm run icon: draws icon.html in headless Edge and writes the icons
icon.html       the icon page; icon.js draws it with the game's own cellart.js
tests/          the save file test, and a CRLF check of these files
```

## Milestones
0. **Trim.** ✅ Done 2026-10-28. The moba's match code out; `RULES` and switchable systems in.
   Test: `tests/systems.js`.
0.5. **Core.** ✅ Done 2026-10-28. Golden tests, readable names, deterministic math and random numbers, systems
   split into files, cell behaviour fields, the fluid registry, the UI split out of `ui.js`.
   Test: `tests/golden.js`, `tests/determinism.js`, `tests/builder.js`, `tests/editor.js`.
1. **Nerve layer.** ✅ Done 2026-10-28. Fibres with limited units, the neuron set, the Nerve view, old designs
   converted. Test: `tests/nerve.js`.
2. **Autonomy, debugging and chapters 1 and 2.** ✅ Done 2026-10-28. No hidden steering; pause, single steps and
   speeds; probes; the level format, goals and scores; chapter 1 and chapter 2's first four levels.
   - Added 2026-11-01: Tail and Crevice (rock, currents, banned cells).
   - Added 2026-11-10: the fixed step, the timeline and Result, the Preview without a held heading, and Shape;
     then the marks on the timeline and the ghost.
   - Test: `tests/autonomy.js`, `tests/sandbox.js`, `tests/probes.js`, `tests/levels.js`, `tests/terrain.js`,
     `tests/replay.js`, `tests/ghost.js`.
3. **Vascular layer and chapter 3.** ✅ Done 2026-10-29. Sugar as fuel, the Heart (areas since 2026-11-01), Long
   haul, Stale water and Cold water (Marathon until 2026-11-10). Test: `tests/vascular.js`, `tests/levels.js`.
4. **Metabolism and chapter 4.** ✅ Done 2026-10-29. Recipes and kits, Fat, the Nose, food and the eat goal;
   Packed lunch (a crossing since 2026-11-10), Grazing, Bloom. Test: `tests/metabolism.js`, `tests/levels.js`.
5. **Secretions and chapter 5.** ✅ Done 2026-10-29. Mineral, hard cells, acid, protease, the Mineralizer;
   survive and kill goals, late arrivals, anchored creatures; nine levels, Reel since 2026-11-10.
   Test: `tests/secretions.js`, `tests/weapons.js`, `tests/levels.js`.
6. **Menus and saves.** ✅ Done 2026-10-30. The main menu and title scene, the Esc menu, Settings, games,
   Continue, creature files, save upgrades. Test: `tests/savegame.js`, `tests/menus.js`, `tests/title.js`.
7. **Chemical layer.** ✅ Done 2026-10-30, removed 2026-11-08. What stays from it: the Photophore with
   Anglerfish, and the field guide. Test: `tests/guide.js`; the removal in `tests/vascular.js`, `tests/hints.js`.
8. **Growth and chapters 6 and 7.** Partly built for the jam (2026-11-07 and 2026-11-08): the Mender (Grazed),
   the Bud (Swarm), Tumour (a host rule and guards) and Metastasis (the adventure).
   Test: `tests/growth.js`, `tests/adventure.js`, `tests/levels.js`.
   - Open: more Spread levels (what is counted, what limits spreading), the growth plan, Nucleic, the
     metamorphosis boss.
9. **Takeover and chapter 8.** The reprogramming cell, as its own switchable system.
   - Open: how a fibre reaches an enemy during a run; what the program is; whether a converted cell keeps the
     enemy's wiring; which cells take over a whole creature; how long it lasts; counterplay; whether enemies can
     do it to the player.
10. **Hallmarks and chapter 9, the finale.** The host body, its stop and die signals, guard cells, the host goals.
   - Open: how the host's signals reach the creature, what an alarmed guard does, how the host is drawn, the
     level list and the boss.
11. **Arena.** Open: local or online, the same kit for everyone, a time limit and tie-break, rounds or a league.
12. **Hints, animations and a tutorial.** ✅ Done 2026-11-05. Help texts and examples rewritten for the game as
   it is; five tutorial lessons with 32 voice lines (Long haul's and Packed lunch's lines are not made yet).
   Test: `tests/tips.js`, `tests/hints.js`, `tests/tutorial.js`.
13. **Clean gates: nerve logic like a program.** Asked 2026-11-07 (user: "I want to be able to build a logic like
   in a computer ... if, for, while, and, or ... I want to keep the bilogical names though"); the user chose
   approach A of four.
   - **The plan:** on or off between neurons, nothing adds up (a sense wired straight into a Siphon or Muscle
     stays graded, so Braitenberg steering works as now). A **veto fibre** (drawn with a bar end): while it is
     on, its target is off. **Coincidence** (∧) replaces the Synapse: on while all its inputs are on; "or" is two
     fibres into one cell. **Integrator** (∑, count 1 to 9): one pulse out on every Nth pulse in. **Engram** (◐)
     replaces the Latch: a fibre switches it on, a veto fibre off. A brightness setting on senses in 2 or 3 named
     steps. The Synapse's threshold and the Ganglion's smoothing go.
   - **Levels:** chapter 1 and most answers stay. Dock is rebuilt on Coincidence and a bright eye. New levels,
     one per piece: Hunter (eyes veto a Pacemaker), Third flash (an Integrator counts 3 flashes) and Stinger as
     the boss.
   - Open: queue or drop a pulse that arrives while an Integrator is counting; whether brightness is set on the
     eye or on the fibre.

## Open questions
- **Movement:** whether the water should forgive the beat rate (a fish's speed swings with its Pacemaker's rate),
  and whether a body one cell heavier on one side should still swim in circles.
- **How a Heart keeps beating** once neurons sit only in Tissue and the Nucleus.
- **Metastasis:** a mode of its own, or the one exception it is now. Waiting for players.
- **`RULES.allLevelsOpen`:** on since testing; switch it off for a release that should unlock levels in order.

## Known limits
- **Sim cost** (2026-11-10, Node, every script in one scope as in a browser, ms of sim per game second): Seeker
  against a Nettler 1.8; Eel against a Crab 9.2; Siege 2.0; Metastasis 13.3 (14.4 before the settle order was
  kept and the bounds boxes reused); 30 Crabs and a Jet (1417 cells) 146 (162 before). Angle springs and their
  arc tangents are about a third of the sim's time, and can't be made cheaper without changing results. The
  collision check tests every pair of creatures whose boxes overlap; it is about 3% of the time in these scenes.
- **The tests' sim is slower:** Node's `vm` context makes every global call slow, about 8x.
- **The timeline:** a look back replays up to 11 game s (5 to the snapshot, 6 for the traces): 14 ms in Bloom and
  38 ms in Siege in headless Edge, so dragging the slider there runs at about 25 frames a second. A snapshot takes
  0.5 to 0.6 ms. Metastasis has no timeline.
- **Marks and the ghost** (2026-11-10): noting the events and the pose adds about 0.05 ms per game second to a
  recorded run. A hit is told from a cell's hit flash, so damage that makes no flash (acid, protease, poison,
  rot) marks nothing until a cell is lost. A creature that arrives or dies has no name in its mark. A stayNear
  level that is lost has no "nearest" mark. The ghost shows the body only, not its launched Bud parts, and each
  pose takes 8 bytes per cell (about 3 MB for 30 cells over 300 game s).
- **Drawing between steps** blends cells and spit globs only; a creature's centre (the adventure's camera, a
  carried light) moves in whole steps, at most 2 px at a time.
- **Drawing cost:** 225 cells and 486 bonds take 6.9 ms per frame in headless Edge with software rendering.
- **Levels with one idea:** Bulwark and Siege, since a ring of Mouths stopped working (2026-11-05). Bloom should
  need the Nose and the light together and doesn't.
- **Shape** (2026-11-10): of 1372 bodies tried (rows of Cilia and Tissue left and right of the Nucleus, and two
  cells behind it) 60 swim into the ring. The reference (two Cilia left, a Tissue right, two Cilia behind) takes
  22.6 s with 9 biomass.
- **Packed lunch** (2026-11-10): 3800 px to the ring. A body with no stores runs dry at 3100 px; two Fats and a
  Pore without Gills run out of O₂ at 3060 px. The reference (an
  Inhibitor in the Nucleus on two Siphons, a Fat each side, two Gills in front, a Pore behind; 18 biomass)
  crosses in 98 s, on a Pacemaker in 152 s. A pair of Cilia crosses in 58 s with no stores, so Cilia are banned.
- **Reel** (2026-11-10): the Whirler's ring comes within 100 px of the player; Nettles reach 45 px. An Eyespot
  wired to a Snare and two Nettles wins in 17.5 s; a Snare with no Nettles, Nettles with no Snare and Sting's
  build lose. At a gap of 115 px a Snare in front with the Nettles beside it loses: the Nettles must sit where
  the catch ends up.
- **Crevice:** the reference worm crawls 560 px in 19 s. It wins with 3 or 5 Muscle rows at 1 to 2 Hz, not with
  an even number of rows, not at 2.5 Hz or faster, and not without the back Bloaters.
- **Muscle swimming** is touchy about the rate: the Wiggler does 6 px/s at 1.6 Hz, 24 at 2.2 and 14 at 2.8; one
  cell more or less can halve the speed. Mass has to match on both sides. Flapping both sides together can't
  swim. Speeds over 10 s: the Paddler 30 px/s, the Eel 37, the Wiggler 20, the Jet 23.
- **Hunting enemies** get a free swim force from every cell (`ai.js`), so their Muscles only add to it. Only
  creatures the player wires, and a level's 'wired' ones, move by their cells alone.
- **A Seeker crawls at the edge of the light's reach:** from 400 px away (450 px range) it needs 22 game s.
- **Fights with a hunting Puffer are chaotic:** which mixed ring of Shell and Thorns wins changes with the angle
  of the first hit. The reference solutions are robust.
- **Foraging in open water is chaotic:** a Nose smells only the nearest speck, so Grazing lays a fixed trail and
  Bloom grows food near the light.
- **The Heart matters only in cold water.** One Heart reaches almost any body of 24 cells, so where it sits
  matters for balance, not for blood. Runs show no blood moving.
- **The Lab's Needs card** assumes stores two thirds full, not a level's kit, and doesn't know about cold water
  or a Mineralizer with no mineral to get. A Fat cell's fat isn't shown in the fluid views or the HUD bars.
- **Dock has one working threshold:** 1.5.
- **Chapter 2's first four levels share one arena.**
- **Nerve drawing:** with many fibres through one cell the lanes squeeze together, and colours repeat after 8.
- **Long levels:** Long haul, Stale water, Cold water and Bloom still take 150 to 250 game s; Result runs them at
  once.
- **The Solutions page** (`docs/bioforge-solutions-0.7.42.html`) is for 0.7.42: it lacks Shape and Reel, and
  still shows Marathon and the old Packed lunch.
