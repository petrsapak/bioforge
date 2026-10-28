# Bioforge Lab: plan

A single-player game about programming living creatures. Each level is a puzzle: you build a creature from cells, wire its nervous system, plumb its vessels, set its glands and plan its metabolism. Then you let it loose and watch it act **on its own**. When it fails you look inside it, find out why, and rewire it. The fun is the moment a creature you wired does something lifelike that you never explicitly told it to do.

Started 2026-10-28. It was copied from `bioforge-moba/`, which is now frozen.

## Decisions (2026-10-28)
- **The verb is programming, not piloting.** Creatures run on their own wiring. Nothing steers them in secret: no WASD and no AI steering of the player's creature.
- **Manual triggers stay:** Command cells bound to keys (1–9 or Space) let the player fire chosen circuits by hand. A level may limit or forbid them.
- **Signals are both analog and binary.** Graded levels (0..1) flow through nerves. Spiking cells and threshold cells turn levels into on/off pulses, and sensors give graded output (stronger when closer).
- **The nerve and fluid systems are redesigned as layers** with much more depth. See "Layers" below; that design is still a proposal.
- **The nerve layer (milestone 1), decided 2026-10-28:**
  - **Signals travel only along fibres.** Touching cells no longer pass signals to each other (user: "1 no", read as agreeing with "no more leaking"). The Nerve cell type goes.
  - **Pacemaker, Ganglion and Command become neurons** that sit inside any body cell. **Eyespot stays a body cell** (a sense organ), and its fibres carry what it senses.
  - **One step of delay per fibre:** a fibre delivers what its start cell had one nerve step earlier. Loops become oscillators that behave the same on every run, and long wiring is slower.
  - **Crossings are drawn with a small bridge arc.** Fibres connect only at their ends, so a crossing never connects anything.
  - **Limits come from `RULES`:** `maxNeurons` and `maxFibreUnits` (user: "limit with rules"). Neither costs biomass.
  - **The neuron set is a trial** (user: "don't know, have to try"): Pacemaker, Ganglion, Inhibitor, Synapse, Latch, Command. They are data, so any of them can be cut or changed after playing.
- **Metabolism:** creatures are built from materials, take materials from food and prey, store them, and secrete chemicals that break down or change materials. It is grounded in real biology and chemistry, but fun comes first. There are **5 materials**, introduced gradually (see Chapters).
- **Puzzles and metabolism:** the level's material kit is the budget, materials you don't spend become the creature's starting reserves, and growth during a run comes from planned cells.
- **Nerve fibres run from cell centre to cell centre** (changed 2026-10-28, user: "I don't like the nerves following the edges, make them connecting the centers of the cells instead"; until then they ran along hexagon sides). One step from a cell to its neighbour is one unit of nerve, and a level gives a limited number of units. Paths may cross.
- **Water (2026-10-28):** the water pushes on the skin, not on every cell. A skin cell moving face-on meets 10x the drag of one sliding along the skin, plus a part that grows with the square of the speed; the skin's direction at a cell runs from one skin neighbour to the other, so the hex zig-zag counts as smooth. So shape matters: a tail beating side to side swims, a wave running down it swims faster, a blob that just pulses stays put, and wide bodies are slower than narrow ones. Cilia and siphons stay the easy way to move. Until then every cell had the same drag (1 per px/s) and the skin only a little more sideways.
- **The default creature is the Jet** (2026-10-28, user: "create a simple creature that will be able to move and make it the default creature"; until then it was the Starter, which swam on cilia with no wiring). A Pacemaker in the Nucleus pulses two Siphons at the back, so it swims on its own and shows the nerve layer from the first second: 7 cells, 17 biomass, 1 neuron, 2 fibres, no warnings, about 23 px/s straight ahead.
- **The mouse is a light, not a steering wheel** (2026-10-28, user: "I want the creature to always follow the mouse cursor"; chosen: "Cursor as a sense"). A Light eye cell (`senses: 'light'`) signals, graded 0 to 1, how far the light lies on its side of the body; in the Sandbox the mouse is the light. A creature follows the mouse only if it is wired to: the Seeker template crosses two Light eyes to two Siphons (Braitenberg). Turning toward the cursor in the physics was turned down, because it is piloting. Levels can place their own lights later.
- **The sandbox runs in real time** (2026-10-28, user: "in the sandbox the creature moves so quickly why?", then "yes remove it"), like the builder's live grid; the speed button gives ½× and ¼×. Until then it ran 2.5 game s per real s, a leftover from steering with WASD.
- **Vessels** are still planned along hexagon edges (milestone 3). Whether they should follow the nerves to the centres is open.
- **Try before deciding:** whether chapter 1 uses Protein only, and whether hormones get their own layer, are decided after playing the first version.
- **Self-harm is on for now:** acid leaks and toxins can hurt your own creature. If it turns out frustrating, it gets toned down or removed.
- **Every mechanic must be removable** (see "Removable mechanics"). Any part that turns out frustrating can be switched off without breaking the rest.
- **Bit-identical determinism:** the same design, level and seed must give exactly the same result in every browser and in Node, for fair scoring, solvable puzzles and shareable solutions. The sim uses its own seeded random generator and its own math functions for sin, cos, atan2 and exp.
- **Code quality:** readable names, no one-letter variables, a 120-character line limit, and one system per file (rules in `CLAUDE.md`). The core is rebuilt to this standard in milestone 0.5, before any layer work.

## Design principles
These come from *A Theory of Fun for Game Design* (Raph Koster) and *The Art of Game Design* (Jesse Schell).
- **Fun is learning patterns (Koster).** Each chapter teaches one new pattern, and later levels combine the patterns already learned. Once a pattern is mastered, the game moves on before it turns boring.
- **Small rules, deep space.** Few blocks that don't overlap; the depth comes from combining them, for example base cells × material treatments instead of dozens of cell types. Before adding a block, ask what pattern it allows that can't already be built (Schell: Lens of Elegance).
- **Lens of the Toy.** Wiring a creature in the sandbox and watching it move must be fun even without a goal.
- **Lens of the Essential Experience:** "I built a brain and it came alive." Features that don't serve this are cut.
- **Lens of Feedback.** You can't debug what you can't see, so signal views, probes, slow motion and single-stepping are core features, not extras.
- **Lens of Emergence.** Simple wiring, rich behaviour. Braitenberg vehicles are the model: two eyes and two motors make a creature that seems "afraid" or "aggressive" depending only on whether the wires cross.
- **Puzzle principles (Schell):** a clear goal, an easy start, visible progress, many valid solutions, and hints.
- **Interest curve:** each chapter opens with a striking demo creature, rises in difficulty, and ends with a "boss" puzzle.
- **Mastery beyond solving:** scores for materials spent, cell count and time, so a solved level can still be solved better.
- **Test fun early (Schell's loop).** Every milestone ends with a playable chapter, so systems are judged in play and not on paper.

## How this differs from Primordialis
Primordialis (Kaliuresis, 2025) is a roguelike in which you build a cell creature on a hex grid, using springs and conductive cells, **pilot it in fights**, and **collect new cell types from enemies**. Bioforge already shares its base mechanics, so the difference has to come from the verb and the structure:
- **Bioforge Lab: you never pilot.** You program and watch, apart from the manual triggers you bind yourself.
- **The layers are the game:** nerves, vessels, hormones and metabolism are systems you design, not a side effect of placing cells.
- **Food gives raw materials, not cell types.** Your creature's own programmed metabolism processes them; you design the factory, you don't collect loot.
- **The structure is puzzles and levels, not a roguelite run.** There are no cell drops, mutations or runs.

Check every new feature against this list. If it pushes the game toward "pilot your fish through fights" or "collect parts from kills", it doesn't belong.

## Layers
The layer split is a proposal, to try in play first. The creature has 4 layers on the same hex grid, like a circuit board with several layers. **Each layer has its own timescale**, which is what keeps them distinct:

| Layer | What lives there | Timescale | Today it is |
|---|---|---|---|
| **Body** | Structural and organ cells: tissue, shell, muscle, gill, fat… They have mass, HP and shape, and each is made of materials. | Static | cells |
| **Nerve** | Neurons (logic nodes) and nerve fibres from cell centre to cell centre. It carries graded signals and spikes. | Fast (ms) | Neurons inside body cells, fibres between them |
| **Vascular** | Vessels along hexagon edges, a Heart that pumps along them, and valves on the vessels. It carries blood: O₂, sugar, waste and dissolved materials. | Medium (seconds) | Fluids seep cell to cell; a Heart boosts flow within 3 cells |
| **Chemical** | Glands release hormones (which spread slowly through the whole body, read by receptors) and secretions (which act on cells, your own or others'). | Slow (tens of seconds) | Adrenaline and repair fluid move like the other fluids |

- **Routing:** a nerve fibre runs from the centre of its start cell through the centres of the cells between, to its end cell. One step is one unit, and each level limits the units. Vessels are still planned along the sides of the hexagons, one side per unit; a nerve and a vessel never compete for room.
- **Crossing:** paths may cross, also inside a cell they both pass through; they stay separate, drawn with a bridge arc.
- **Fibres connect only at their two ends** (decided 2026-10-28). You drag from one cell to another and the fibre routes through the cells between. The cells it passes through aren't affected.
- **Fibres are directed** (decided 2026-10-28), drawn with an arrow, so a fibre is also a diode.
- **Neurons sit as an overlay inside a body cell** (decided 2026-10-28), one per cell, with fibres attached to it. Logic doesn't take up body space.
- Nerves and vessels **run through body cells and need them**: a fibre is cut when a cell it runs through dies, so injuries can disable circuits.
- Each layer is a separate view in the editor, and the other layers are dimmed while you edit one.
- **Metabolism is a system across the layers, not a 5th grid layer.** Materials travel in the blood, secretions come from glands, and body cells are made of materials. The editor gets a materials panel (stores, recipes), not a 5th view. Its timescale is the slowest: minutes.

### Interfaces between layers (where the depth comes from)
| From → to | Cells (ideas) |
|---|---|
| World → nerve | Eye with a facing cone (graded), chemoreceptor (smell, graded by distance), touch |
| Body → nerve | Pain (a neighbour is damaged), stretch (a muscle is contracted) |
| Vascular → nerve | Hunger (low sugar), breathlessness (low O₂), toxin (high waste), a store sensor (a material above or below a level) |
| Chemical → nerve | Receptor: fires while a hormone is above a level. **Hormones also modulate neurons:** adrenaline lowers thresholds, and a calming hormone raises them. |
| Nerve → body | Muscle, bloater, siphon, cilia, nettle, snare, spitter, bud, mouth (open/close) |
| Nerve → vascular | Valve on a vessel, Heart rate |
| Nerve → chemical | Gland: releases its hormone or secretion while signalled |
| Chemical → metabolism | "Fed" hormone sends materials to storage; "starved" hormone releases reserves and stops growth |

### Neuron set (ideas, to trim using the elegance principle)
| Function | Neuron | Notes |
|---|---|---|
| Relay | Nerve fibre (centre to centre) | Directed, so it doubles as a diode. Connects only at its ends. Paths may cross. |
| Clock | Pacemaker | Rate and phase can be set. |
| Delay / smoothing | Ganglion | Integrates its input. |
| NOT | Inhibitor | On while its input is off. |
| AND / threshold | Synapse | Fires when the sum of its inputs passes a threshold that can be set. Graded in, spike out. |
| Memory | Latch | A pulse toggles it, or set/reset inputs. |
| Input | Command | Bound to a key (1–9 or Space). |
| Gain | Amplifier / attenuator | Scales a graded signal. Maybe merge it into the synapse. |

## Metabolism
The kit-as-budget, reserves and growth-plan parts are confirmed; recipes and numbers are still to tune.
### Real biology behind it
- **Digestion** breaks food into building blocks: proteins into amino acids, starches into sugars, fats into fatty acids, shells into calcium.
- **External digestion:** starfish and fungi secrete enzymes onto their food.
- **Biomineralization:** shells and spines are built from calcium carbonate or silica.
- **Tanning:** insects harden chitin by crosslinking it.
- **Resilin:** a spring protein; fleas and mantis shrimp store energy in it and release it with a latch.

### Materials
| Material | Real basis | Comes from | Builds / used for | Chapter |
|---|---|---|---|---|
| **Protein** | Amino acids | Bacteria, other creatures' soft cells | Most cells: muscle, nerves, glands, enzymes | 1 |
| **Sugar** | Carbohydrates | Algae, plant-like specks | Fuel in the blood; chitin | 2 |
| **Fat** | Lipids | Most food | Long-term energy store, buoyancy | 3 |
| **Mineral** | Calcium, silica | Seawater (slowly), diatoms, eaten shells | Shell, spines, thorns | 4 |
| **Nucleic** (rare) | DNA/RNA | Only whole creatures | Growth, Buds, regrowth | 6 |

- **Each cell type has a recipe.** Eating a cell gives back its recipe minus a digestion loss, so a prey's body tells you what you'll get from it.
- **Storage cells:** Fat stores fat and sugar; a vacuole stores protein; a deposit stores mineral.

### Secretions
| Secretion | Does to others | Does to yourself | Real basis |
|---|---|---|---|
| **Protease** | Dissolves soft cells (digests prey) | Hurts soft cells if it leaks | Digestive enzymes |
| **Acid** | Dissolves shell and spines | Hurts your own cells if it leaks | Shell-boring snails |
| **Mineralizer** | — | Deposits mineral into a cell to make a shell or spine | Shell building |
| **Crosslinker** | — | Hardens a cell: more armour, stiffer, more brittle | Insect cuticle tanning |
| **Resilin** | — | Makes a cell springy: better joints, stores energy for a snap | Flea and mantis shrimp springs |
| **Toxin** | Paralyses: blocks the target's nerves | Costs nucleic; blocks your own nerves if it leaks | Venom |

- **Treatments change existing cells instead of adding cell types:** a tanned muscle is strong but slow, and a resilin joint plus a latch makes a spring-loaded strike.
- **Counterplay:** shell beats thorns, acid beats shell. A prey's armour tells you what to bring.

### How it fits the puzzles
A level has two phases:
1. **Design:** the level hands you a **material kit**, for example "Protein 30, Sugar 10, Mineral 0". This replaces the biomass budget. You build the creature from the kit, and **whatever you don't spend becomes the creature's starting reserves**. That's a real trade-off: a bigger body, or more fuel and building stock.
2. **Run:** the creature acts on its own. If the level has metabolism turned on, it can eat, digest, store, secrete and **grow**.

**Growth is programmed with planned cells.** The builder already has planned cells: cells drawn but not joined to the body. In Lab they become the **growth plan**. The creature grows them during the run, nearest the body first, when:
- it has the materials for the cell's recipe, and
- a growth signal is on, from a nerve or a hormone (for example "fed" + "mineral above 10").

This is like a developmental program: you draw the target body and wire the conditions, but you don't script morphogenesis cell by cell.

### Puzzle types that use metabolism
| Puzzle | Example | Teaches |
|---|---|---|
| **Self-sufficient** | Survive 3 minutes; the only energy is food in the water. | Feeding loop, storage |
| **Grow to size** | Start with 8 cells, reach 25. | The growth plan, feeding |
| **Gather and build** | A vent you can only cross with a shell; the kit has no mineral, but there's a field of diatoms. | Eat, then mineralize, then cross |
| **Armour race** | Catch a shelled prey. | Acid, counterplay |
| **Efficient factory** | Turn 20 algae into the most stored fat. | Digestion efficiency, valves, hormones |
| **Metamorphosis** (boss) | Start as a swimmer and finish as an armoured crawler: dissolve your own fins and recycle them into shell. | Everything together |

## Chapters
Each chapter teaches one new pattern set. Each development milestone ends with its chapter playable.

| Chapter | New pattern | Systems on | Materials |
|---|---|---|---|
| 1. **Reflexes** | Neurons and wiring: rhythm, steering (Braitenberg), sensing | Body, nerve | Protein only; it works like a single budget |
| 2. **Circulation** | Vessels, the Heart, valves; fuel delivery | + vascular | + Sugar (fuel in the blood) |
| 3. **Feeding** | Mouth, digestion, storage; self-sufficiency | + metabolism (eating, storage) | + Fat |
| 4. **Armour** | Shells, mineralizing, acid; counterplay | + secretions | + Mineral |
| 5. **Moods** | Hormones modulating neurons; the fed/starved economy; crosslinker and resilin | + chemical (hormones, treatments) | — |
| 6. **Growth** | Growth plan, Buds, regrowth; hunting for nucleic | + growth | + Nucleic |

## Removable mechanics
Every mechanic is a separate switch, so any part that turns out frustrating can be turned off or tuned without breaking the rest:
- **Global switches:** `data/rules.js` holds a `RULES` object, for example `{ selfHarm: true, crossingAxons: 'bridge', digestionLoss: 0.3 }`.
- **Per level:** each level lists the systems it uses (`systems: ['nerve', 'vascular', 'metabolism']`). A system that is off isn't stepped, isn't drawn, and its cells can't be placed.
- **One system per file:** each system (nerve, vascular, chemical, metabolism, growth) is its own pure file with its own step function, called from one place. Turning a system off must never need edits inside another system.
- **Tests run with systems on and off,** so turning one off is always known to work.

## Architecture
The same rules as the other projects apply: plain `<script src>` files and pure sim files (see `CLAUDE.md`). Each sim file registers its systems with `registerSystem({ name, order, switchable, update })`, and `step()` runs them in order. Switchable systems run only when the world's system list names them.

```
data/rules.js   RULES: budget, cell cap, selfHarm, switchable systems (pure data)
data/fluids.js  FLUIDS: the fluid channels (name, layer, flow rate, decay, capacity, start fill) (pure data)
math.js         deterministic sine, cosine, arcTangent2 and the seeded random generator (pure)
core.js         constants, hex and math helpers, world (newWorld, newTestTank, randomFraction), creature and cell
                factories, spawn, death and splitting, the system registry, step() and the cell-death hooks (pure);
                systems: clock 30, cleanup 110, particles 120
fibres.js       nerve fibre routing from cell centre to cell centre, units, adding fibres to a creature and
                cutting broken ones (pure)
physics.js      input, steering, springs, drag, collisions, integration (pure); systems: input 10, physics 20
nerve.js        signals along fibres, senses, the neuron rules (pure); system: nerve 40 (switchable)
fluid.js        work levels, fuel burning, products, fluid flow (pure); system: fluid 50 (switchable)
actuators.js    resizing, weapon triggers, timers, debris rot (pure); system: actuators 60
combat.js       damage, contact hits, aiming, snare lines, globs (pure); system: projectiles 70
growth.js       Bud parts and Mender regrowth (pure); systems: buds 80, regrow 90 (switchable)
food.js         food specks, eating, specks left by dead cells (pure); system: food 100 (switchable)
ai.js           sandbox enemy steering (pure)
design.js       hex lookup, buildCheck (cells, biomass, neurons, fibre units), design warnings, the saved design
                format, and the conversion of old saves and of designs from before the nerve layer (pure; loaded
                before data/templates.js, which uses the conversion)
builder.js      the edited design and every editing rule: cells, Bud parts and aim, Command keys, stamps,
                saving a selection, the library list (pure)
data/*.js       cells (stats and behaviour fields), neurons, fluids, templates (incl. the small builds), tips
render.js       canvas drawing of a world
windows.js      DOM and storage helpers, floating windows, remembered menu branches
tipdemo.js      live example tank in the cell tooltip
hud.js          HUD bars and vitals
dock.js         the cell dock
library.js      the template library window, saved in localStorage
toolbar.js      the toolbar down the left edge: Body / Nerves, Clear, Save, Unlimited, fluid views, keys, Sandbox
panel.js        the side panel: meters, a card with a picture of the clicked or chosen cell or neuron, stats
                chips, warnings
scope.js        the neuron scope: an animated input and output trace, run through the real neuron rules
coach.js        the How to box: small looping animations of each step, ticked off as the design does them
builderview.js  drawing the builder grid and the preview window; zoom and pan
tooltip.js      the hover tooltip
sandbox.js      sandbox mode: its bar, steps, drawing and HUD
ui.js           the app state, the controls, mouse and keyboard input, the frame loop
tests/*.js      headless checks: node tests/all.js (builder, design, determinism, editor, golden, sandbox,
                showcase, systems, weapons); helpers: load.js, dom.js (fake browser), check.js
```

**The saved design format** (2026-10-28): a design cell is `{ q, r, typeName }`, plus on a Bud `budPart`, `partRotation`, `partOffset` and `partAim`, and on a Command `boundKey`. A library entry is `{ name, isCreature, cells }`. `migrateLibraryEntry()` in `design.js` reads the old short names (`t`, `tpl`, `bind`, `rot`, `off`, `aim`, `full`). The library lives under `bioforge-lab-library`; the first time, Lab copies Bioforge Moba's `bioforge-templates` list from it, and it never writes to that key, because pages opened from disk can share storage and Moba still uses it. Every Lab storage key starts with `bioforge-lab-`.

**Cell behaviours.** Systems never check a cell's type name. Each cell type in `data/cells.js` declares behaviour fields (`work`, `product`, `trigger`, `resize`, `breathes`, `pumps`, `gatesFlow`, `needsSignal`…), and the systems read those, some through small registries (`WORK_LEVELS` and `PRODUCTS` in `fluid.js`, `TRIGGERS` in `actuators.js`). A new cell type made from existing behaviours needs only data. `tests/determinism.js` fails if a pure file compares `typeName`.

Planned additions: `data/levels.js`, `vascular.js`, `chemical.js`, `metabolism.js`, `level.js` (level loading, win checks, scores).

## Milestones
0. **Trim.** ✅ Done 2026-10-28.
   - Removed `moba.js`, `data/arena.js`, the arena drawing in `render.js`, the match code in `ui.js`, and `tests/match.js`. The match button is gone, and the sandbox is the only run mode until levels arrive.
   - The four small builds (Lancer, Stinger, Spitter, Snarer) moved into `data/templates.js`.
   - `data/rules.js` holds the budget (50 biomass / 24 cells), `selfHarm`, and the switchable systems: nerve, fluid, food, regrow. `newWorld(width, height, { systems })` takes a list, and `step()` skips the systems that are off. With fluid off, cells work at full power.
   - Test: `tests/systems.js` covers each system switched off, nothing firing with nerves off, no fluid change with fluids off, and the same result on every run.
0.5. **Core.** ✅ Done 2026-10-28. The sim core and the UI were rebuilt to the code-quality rules before layers are added. Problems it fixed:
   - Steering built into the physics (free swimming force on every cell, magic turning torque). It is fixed in milestone 2, behind a switch.
   - `Math.random` and engine-dependent math, which break determinism.
   - Cell behaviour scattered across about 8 functions as `if (c.t === …)` checks.
   - 5 hard-coded fluid channels.
   - Leftovers from the moba and online projects.

   Steps, each verified by the tests:
   1. ✅ **Golden tests** (2026-10-28): `tests/golden.js` hashes the exact sim state after 10 s of 10 scenarios (each design against a hunting Nettler, seed 7, all systems on, food included since step 3).
   2. ✅ **Readable naming** (2026-10-28): the sim, render, HUD, tooltip demo, design checks, cell data, templates and sim tests were rewritten to the code-quality rules. The golden fingerprints stayed bit-identical.
      - Steps 4 and 5 were mostly done along the way: `sim.js` was split into system files with a registry, and `map.js`, `pin`, `inv` and the map hooks were removed. One creature factory and one cell factory.
      - Speed: about 69 ms per 10 game s on the golden scenario, against about 107 ms for the old sim (the old run also spawned food).
      - **Not yet done:** `ui.js` and the UI tests (`dom.js`, `sandbox.js`, `showcase.js`) only had the sim names updated; their own style is unchanged. The saved design format (`{ q, r, t, tpl, bind, rot, off, aim }`) keeps its short field names, because renaming them needs a migration of creatures already saved in the browser.
   3. ✅ **Determinism** (2026-10-28): `math.js` has `sine`, `cosine` and `arcTangent2` built from `+ - * /` (fdlibm's polynomials, within 1 unit in the last place of `Math`), and a seeded mulberry32 generator. Each world has `randomState` (`newWorld(width, height, { seed })`), and `randomFraction(world)` is the sim's only source of chance. `**` became `square()` and `distanceSquared()`.
      - The golden fingerprints were recorded again once, on purpose. With food left out, all 10 scenarios end with the same positions (to 0.1 px), health and cell counts under `Math`'s trig and under ours, so only the last bits moved.
      - `exp` isn't written yet, because the sim doesn't use it. Add it to `math.js` when first needed.
      - Speed, with the scripts in Node's main context as in a browser: about 29 ms per 10 game s, about 5% more than with `Math`'s trig.
   4. ✅ **Leftovers out** (2026-10-28): `isTestTank` is gone. `newTestTank()` builds the builder preview and the tooltip demos from plain world settings: the food system off, `waterFeedRate` (the water feeds Mouths) and `spaceFiresAllSources`. Dead cells leave food through the food system's `onCellDeath` hook, so with food off there are none.
   5. ✅ **Systems split:** done in step 2 (see Architecture).
   6. ✅ **Cell behaviour hooks** (2026-10-28): see "Cell behaviours" under Architecture. The sim and `design.js` no longer name cell types. Golden fingerprints unchanged.
   7. ✅ **Channel registry** (2026-10-28): `data/fluids.js` lists the fluids as data (id, name, layer, flow rate, decay rate, capacity, start fill). A cell's capacities and start amounts come from it; adrenaline's decay and the flow rate are read from it. Golden fingerprints unchanged.
   - Test: `tests/golden.js` (unchanged by steps 2, 4, 6, 7 and 8), `tests/determinism.js` (math accuracy, the random sequence, seeds, and the pure-file rules), `tests/systems.js` (the test tank), `tests/builder.js` (editing rules, the format migration), `tests/editor.js` (the builder driven by mouse and keys).
   8. ✅ **UI rewrite** (2026-10-28): `ui.js` (730 dense lines) became `builder.js` (pure editing rules), `dock.js`, `library.js`, `panel.js`, `builderview.js`, `tooltip.js`, `sandbox.js` and a smaller `ui.js` that holds one `app` state object and the input. `windows.js`, `data/tips.js`, `style.css` and the HTML ids and classes were rewritten with full names too. The saved format was renamed (see Architecture), with a migration of saved creatures. The UI tests were rewritten, and `tests/builder.js` and `tests/editor.js` were added.
      - Bugs found on the way: the tooltip used the old names `DEMO_W` and `DEMO_H` and threw after 1 s of hovering (since step 2); the library window's position and the library itself were stored under the same name (found in a headless Edge run, fixed by giving windows their own `window-` prefix).
   - Milestone 0.5 is done. All 8 steps passed their tests; the golden fingerprints changed once, on purpose, in step 3.
1. **Nerve layer.** ✅ Done 2026-10-28. Nerve fibres from cell centre to cell centre (along hexagon edges at first, changed the same day), with limited units; crossing paths; the neuron set; the editor's layer views. Blood keeps today's seeping for now.
   - Built: `fibres.js`, `data/neurons.js`, the rewritten `nerve.js`, fibres and neurons in `core.js` (spawn, cleanup), `growth.js` (Bud parts and regrowth), `design.js` (limits, warnings, conversion), `builder.js` (neurons, settings, fibres, stamps and Bud parts keep them), the Nerve view in `ui.js`, `dock.js`, `panel.js` and `builderview.js`, and fibres and neuron badges in `render.js`.
   - The Nerve, Ganglion, Pacemaker and Command cell types are gone; Eyespot is a sense organ (`senses: 'enemy'`); `conductsSignal` and `signalCapacity` are gone.
   - **The model.** Every nerve step, each cell adds up what its incoming fibres deliver, plus its own sense (an Eyespot near an enemy gives 1). A cell with no neuron passes the sum on, clamped to 0..1, so plain cells are relays. A cell with a neuron hands the sum to the neuron, which decides the cell's signal. Actuators react to their cell's signal as before.
   - **The neurons** (trial set, `data/neurons.js`):
     - Pacemaker: on and off at its rate (setting: rate in Hz); ignores its inputs.
     - Command: on while its key is held (Space, or the number key bound to it); ignores its inputs.
     - Ganglion: follows its input slowly, as a delay and smoother.
     - Inhibitor (NOT): on while its input is off.
     - Synapse: on while its input sum reaches its threshold (setting: threshold). Threshold 1 is OR; with two inputs, 2 is AND.
     - Latch: each new pulse on its input flips it on or off.
   - **Fibres** are routed automatically from the start cell's centre through the fewest cells to the end cell's centre. Neighbours are 1 unit. A fibre is cut when its start, its end or a cell it runs through dies. Regrown cells and growing Bud parts get their fibres back once both ends are there.
   - **Old designs** (built-in, tooltip examples, saved creatures) are converted when loaded: Nerve cells become Tissue, Pacemaker, Ganglion and Command cells become Tissue with that neuron, and the old touch-wiring becomes fibres. Each signal source is wired outward through the cells that used to carry signals.
   - **The editor** gets a Body view and a Nerve view. In the Nerve view the dock shows the neurons; a click puts the chosen neuron into a cell, and a drag from one cell to another lays a fibre. A right-click takes out whatever is drawn red under the mouse: the neuron near a cell's centre, otherwise the fibre whose line is nearest (changed 2026-10-28, user: "we need better system for fibre removal"; until then a right-click only took out neurons, and a fibre went only by repeating its drag, which still works). The panel shows the units used, the clicked cell's neuron setting, and its fibres, each with a × that removes it.
   - Chosen without asking: two fibres may share cells and steps; fibres are routed automatically (choosing a route by hand can come later); the sandbox limits are 12 neurons and 40 fibre units.
   - Test: the logic neurons give the expected truth tables, a chain of fibres delays by one step each, fibres route and get cut as described, old designs still move after conversion, and the same design gives the same result on every run.
2. **Autonomy, debugging and chapter 1.** No hidden steering. Probes with signal traces, slow motion and single-stepping. The level format, win checks, scores, and 5 Reflexes levels ending in a Braitenberg hunt.
   - Test: a scripted reference solution beats every level headless.
   - Done so far (2026-10-28): autonomy and time controls. The player's creature is `autonomous`: no free swimming, no held heading, no WASD and no autopilot; Space and 1–9 still reach its Command neurons. Cilia push toward the front from where they sit, so cilia on one side turn it. Muscles move a creature only by pushing water (decided 2026-10-28, user: "I would like the movement behave like in water"; for a few hours before, a contracting muscle kicked the creature forward directly). See "Water" below. The sandbox has pause (P), one step (.) and speeds 1×, ½×, ¼× (,). Test: `tests/autonomy.js`, `tests/sandbox.js`.
3. **Vascular layer and chapter 2.** Vessels, the Heart, valves; Sugar as fuel.
4. **Metabolism and chapter 3.** Material recipes, eating, digestion, storage; Fat.
5. **Secretions and chapter 4.** Mineral, mineralizer, acid, protease, self-harm.
6. **Chemical layer and chapter 5.** Hormones, modulation, crosslinker and resilin.
7. **Growth and chapter 6.** The growth plan, Buds, regrowth, Nucleic, and the metamorphosis boss.

## Open questions
- **How does a crossing look in the editor?** (milestone 1)
- **Is the 4-layer split right?** Should hormones merge into the vascular layer? Decide after trying it.
- **Which current cells stay, change or go?** Nerve cells and the Heart radius are replaced by the layers.
- **Is Protein-only in chapter 1 too abstract?** Decide after trying it.
- **Do neurons cost materials** from the kit, or only nerve units?

## Known limits
- There is no map code: rocks and currents were removed with `map.js` and come back with levels (milestone 2).
- Sandbox enemies are still steered by the AI (`ai.js`), with free swimming and a held heading. Only the player's creature is autonomous. Prey and enemies with their own wiring come with the chapter 1 levels.
- The light has no range or falloff: a Light eye sees only the direction, so a Seeker reacts the same to a light 20 px or 2000 px away, and once it reaches the light it parks on it.
- Muscle swimming is touchy. The Paddler template (two muscle columns taking turns at the front, a wide body of organs behind, 45 biomass) swims about 32 px/s at 1.6 Hz, but at 1.2 Hz it spins and at 2 Hz it stalls. Its muscles are more than 3 cells from its Heart (a warning), because a Heart in the spine stiffens the front and it no longer swims. The same body drawn head-first swims backwards, muscle end first.
- Muscle swimming is slow next to cilia. In 10 game s: a 6-muscle-a-side tail with a Pacemaker and an Inhibitor 7.6 px/s, the same tail driven by a perfect travelling wave 24 px/s, two cilia about 28 px/s. A Ganglion delay made it slower (5 px/s), because it smooths the signal; a neuron that delays a signal unchanged would help.
- Free swimming (the AI enemies) now depends on shape: at `SWIM_FORCE` 200 they average 48 px/s as before (46), but the wide Manta went from 54 to 32 px/s and the narrow Starter from 64 to 62.
- The showcase designs were built for WASD. Those without cilia, siphons or a muscle wave no longer move on their own; they are rewired with chapter 1.
- **Nerve layer (2026-10-28):**
  - Fibres are routed automatically by the shortest path; a player can't choose a route yet. Two fibres that share a step are drawn on top of each other.
  - The built-in designs and the tooltip examples are still written in the old format and converted when loaded. Hand-wired versions come with the chapter 1 levels.
  - Neurons have no live tooltip demo; their dock buttons show the description as a plain tooltip.
  - Converted designs act on sharper signals: the old leaking signals faded slowly, fibres switch off at once. The Puffer's bloaters are on in 137 of 400 golden-scenario steps instead of 194.
- The tests run the scripts in a Node `vm` context, where every call of a global function goes through a slow lookup. The sim runs about 8x slower there than in a browser, and `node tests/all.js` takes about 18 s.
- `sine` and `cosine` are within 1 unit in the last place for ordinary angles. Right next to a multiple of π/2 the error is larger relative to the tiny result, about 1e-26 in absolute terms, which doesn't matter for the game.
