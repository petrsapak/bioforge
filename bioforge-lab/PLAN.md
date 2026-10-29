# Bioforge Lab: plan

A single-player game about programming living creatures. Each level is a puzzle: you build a creature from cells, wire its nervous system, plumb its vessels, set its glands and plan its metabolism. Then you let it loose and watch it act **on its own**. When it fails you look inside it, find out why, and rewire it. The fun is the moment a creature you wired does something lifelike that you never explicitly told it to do.

Started 2026-10-28. It was copied from `bioforge-moba/`, which is now frozen.

## Decisions (2026-10-28)
- **The verb is programming, not piloting.** Creatures run on their own wiring. Nothing steers them in secret: no WASD and no AI steering of the player's creature.
- **Manual triggers stay:** Command cells bound to keys let the player fire chosen circuits by hand. A level may limit or forbid them. An unbound Command fires on Space. A bound one fires on any letter or number key that has no job of its own (2026-10-28, user: "command can bind to any key on keyboard apart from the important ones"; until then only 1–9). Reserved: 1, 2, 3 (the builder's tabs), Q, E, F, H, M, and P, R, T (runs). Click the Command, then press the key; the same key again unbinds it.
- **Signals are both analog and binary.** Graded levels (0..1) flow through nerves. Spiking cells and threshold cells turn levels into on/off pulses, and sensors give graded output (stronger when closer).
- **The nerve and fluid systems are redesigned as layers** with much more depth. See "Layers" below; that design is still a proposal.
- **The nerve layer (milestone 1), decided 2026-10-28:**
  - **Signals travel only along fibres.** Touching cells no longer pass signals to each other (user: "1 no", read as agreeing with "no more leaking"). The Nerve cell type goes.
  - **Pacemaker, Ganglion and Command become neurons** that sit inside any body cell. **Eyespot stays a body cell** (a sense organ), and its fibres carry what it senses.
  - **One step of delay per fibre:** a fibre delivers what its start cell had one nerve step earlier. Loops become oscillators that behave the same on every run, and long wiring is slower.
  - **Crossings are drawn with a small bridge arc.** Fibres connect only at their ends, so a crossing never connects anything.
  - **Limits come from `RULES`:** `maxNeurons` and `maxFibreUnits` (user: "limit with rules"). Neither costs biomass.
  - **Neurons cost no materials** (2026-10-28, user: "neurons do not cost material now"); only the neuron count limits them. This can be revisited when the material kits arrive (milestone 4).
  - **The neuron set is a trial** (user: "don't know, have to try"): Pacemaker, Ganglion, Inhibitor, Synapse, Latch, Command, and Delay (added 2026-10-28, user: "Delay neuron - ok"). They are data, so any of them can be cut or changed after playing.
- **Metabolism:** creatures are built from materials, take materials from food and prey, store them, and secrete chemicals that break down or change materials. It is grounded in real biology and chemistry, but fun comes first. There are **5 materials**, introduced gradually (see Chapters).
- **Puzzles and metabolism:** the level's material kit is the budget, materials you don't spend become the creature's starting reserves, and growth during a run comes from planned cells.
- **Nerve fibres run from cell centre to cell centre** (changed 2026-10-28, user: "I don't like the nerves following the edges, make them connecting the centers of the cells instead"; until then they ran along hexagon sides). One step from a cell to its neighbour is one unit of nerve, and a level gives a limited number of units. Paths may cross.
- **Water (2026-10-28):** the water pushes on the skin, not on every cell. A skin cell moving face-on meets 10x the drag of one sliding along the skin, plus a part that grows with the square of the speed; the skin's direction at a cell runs from one skin neighbour to the other, so the hex zig-zag counts as smooth. So shape matters: a tail beating side to side swims, a wave running down it swims faster, a blob that just pulses stays put, and wide bodies are slower than narrow ones. Cilia and siphons stay the easy way to move. Until then every cell had the same drag (1 per px/s) and the skin only a little more sideways.
- **The default creature is the Jet** (2026-10-28, user: "create a simple creature that will be able to move and make it the default creature"; until then it was the Starter, which swam on cilia with no wiring). A Pacemaker in the Nucleus pulses two Siphons at the back, so it swims on its own and shows the nerve layer from the first second: 7 cells, 17 biomass, 1 neuron, 2 fibres, no warnings, about 23 px/s straight ahead.
- **Background music** (2026-10-28, user: "I have an ambient music mp3 file that should be wired"). One ambient track, `audio/cellular-bloom.mp3` (Cellular Bloom, 180 s), loops at 0.2 volume in the builder and the Sandbox (0.4 until 2026-10-29, user: "The ambient music is too loud"). It loops without a seam (user, 2026-10-29: "the loop is hearable"): the track fades in over its first 5 s and out over its last 5 s, so after the first play two copies take turns, each running from 6 s to 174 s, with a 4 s equal-power crossfade. The fade follows the track's own clock and is updated every frame; a copy that plays to its end (frames stop in a hidden tab) hands over at full volume. It starts on the first click or key, because browsers block sound before that. The toolbar's note button and M switch it off and on; off is remembered (`bioforge-lab-music-off`).
- **Sound effects** (2026-10-29, user: "I want also UX sounds and in simulation sounds. Keep everything in one style - like the ambient background music"). Short sounds in `audio/sfx/`, made with ElevenLabs sound generation; the user picked each from 2 to 4 candidates whose prompts describe a concrete, soft underwater sound (a first set made from one abstract style prompt was "not as good" and too loud). Each pick was then trimmed (silence before the sound, a tail more than 45 dB down), given a 3 ms fade-in and a smooth fade-out, cleared of DC offset and leveled to -18 dB (peaks at most -1 dB), and saved as 16-bit WAV (3.2 MB in all), since a browser can decode MP3 but not encode it. `data/sounds.js` lists each sound's files (several are picked from at random), each file's measured loudness, the level it is heard at (UX near -42 dB, the creature -40 to -44, win and loss -36; the music peaks near -26), the shortest gap between two plays, and whether each play varies pitch and volume by up to 6% (sounds heard over and over). UX: any button click, removing a cell, neuron, fibre or vessel, laying a fibre or vessel, a refused edit, opening the levels sheet, placing a cell or neuron, starting a run. The goal: a 5 s calm victorious tune (glassy bells over warm pads), played the first time the goal counts up in a run (into a stayNear ring, or resting in a restIn ring), not on every return; the user turned down 5 short chimes and asked for "longer calm vicorious tune". A sound without files is skipped. The creature, heard only in runs (not in the builder's test tank) by comparing the world from frame to frame, so the sim knows nothing about sound: a Siphon whose signal comes on, and again every 0.7 real s while it stays on (a stroke, at most every 0.25 s); a weapon firing: a Spitter spitting and a Nettle stinging (its cooldown jumps up; `TRIGGER_SOUNDS` maps the trigger to the sound), a Snare shooting its line and catching (user, 2026-10-29: "the spitters and snare don't make sounds now?"). Every creature is heard (user, 2026-10-29: "the enemies and other organism don't have sound efects"): the player's cells in full, other creatures' 4 dB quieter right beside the player and fading out 700 px away, only the nearest of each sound per frame, with their own gaps so they never hold back the player's, a Mouth that eats, a cell dying (quieter for other creatures). In a level, the goal tune, then the win or loss. The toolbar's speaker button and N switch them off and on; off is remembered (`bioforge-lab-sounds-off`).
- **Levels** (2026-10-28, user: "I want you to continue working on the game"; the format was chosen without asking). A level is data in `data/levels.js`: an arena (1400 x 800 px), the systems that run (chapter 1: nerve only, so cells work at full power and nothing starves), design limits, the player's spawn, an optional light (fixed, going round a path, or carried by a creature; shining all the time, blinking, or flashing once), other creatures (wired, or hunting by the AI), a goal (`reach` a ring, `stayNear` the light for some seconds in all, or `restIn` a ring: inside it and slower than a speed for some seconds without a break), optional stillness rules (`stillWhileLit`: lost when moving while the light has been on for a moment; `stillUntilLit`: lost when moving before the flash), a time limit and a par. Levels are grouped in chapters (`CHAPTER_NAMES`): 1 Reflexes, 2 Memory and logic. A win earns 1 star, plus one for beating the par time and one for staying within the par biomass. The player builds in the builder with the level's limits, runs the design, and watches; Space and the bound keys still reach Command neurons. Levels unlock in order (user, 2026-10-28: "levels unlock in order"): the first is open, and each win opens the next; until then all levels were open from the start. The best result per level is kept under `bioforge-lab-level-results`.
- **Light has a reach** (2026-10-28, user: "light range yes"). A light (`createLight` in `core.js`) reaches 450 px by default (`LIGHT_RANGE`); a Light eye's signal is its direction factor times a brightness that falls evenly from 1 at the light to 0 at the edge. So a crossed Seeker speeds up as it nears the light, Braitenberg's "aggressive" vehicle. Levels can give each light its own range. The Sandbox draws the reach as a dashed ring.
- **The mouse is a light, not a steering wheel** (2026-10-28, user: "I want the creature to always follow the mouse cursor"; chosen: "Cursor as a sense"). A Light eye cell (`senses: 'light'`) signals, graded 0 to 1, how far the light lies on its side of the body; in the Sandbox the mouse is the light. A creature follows the mouse only if it is wired to: the Seeker template crosses two Light eyes to two Siphons (Braitenberg). Turning toward the cursor in the physics was turned down, because it is piloting. Levels can place their own lights later.
- **The sandbox runs in real time** (2026-10-28, user: "in the sandbox the creature moves so quickly why?", then "yes remove it"), like the builder's live grid; the speed button gives 2×, 4×, ½× and ¼× (2× and 4× added 2026-10-28 for chapter 3's long levels; until then only ½× and ¼×). Until then it ran 2.5 game s per real s, a leftover from steering with WASD.
- **Vessels** (2026-10-28, chosen without asking with "commit and continue"; until then they were planned along hexagon edges). A vessel runs from cell centre to cell centre like a fibre, routed the same way, and is laid in the builder's Vessels view (tab 3) by dragging from cell to cell. It has no direction and **connects only its two end cells**: blood (O₂, Sugar, waste, repair fluid; not hormones) flows between them from the fuller to the emptier, and the cells between only carry it. A fed **Heart anywhere on a vessel pumps it**: 0.4 flow per unit of fill difference unpumped (4x seeping between touching cells, which is 0.1; it was 0.4, the same as a vessel, until 2026-10-28, when it was lowered so that distance from a store matters), 4.4 with one Heart, up to 8. An unsignalled **Valve** on a vessel shuts it. The Heart no longer speeds up every link within 3 cells of itself; without vessels it pumps nothing. Vessels cost no biomass; `RULES.maxVesselUnits` (30) and a level's `maxVesselUnits` limit their steps. A vessel is cut when a cell it runs through dies, and comes back when the cell regrows. The vascular system is switchable (`vascular` in a level's `systems`).
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
| **Vascular** | Vessels from cell centre to cell centre, a Heart that pumps the vessels it sits on, and valves on the vessels. It carries blood: O₂, sugar, waste and dissolved materials. | Medium (seconds) | Vessels (2026-10-28); fluids also seep cell to cell |
| **Chemical** | Glands release hormones (which spread slowly through the whole body, read by receptors) and secretions (which act on cells, your own or others'). | Slow (tens of seconds) | Adrenaline and repair fluid move like the other fluids |

- **Routing:** a nerve fibre runs from the centre of its start cell through the centres of the cells between, to its end cell. One step is one unit, and each level limits the units. Vessels are routed the same way on their own layer (2026-10-28; until then planned along the hexagon sides), so a nerve and a vessel never compete for room.
- **Crossing:** paths may cross, also inside a cell they both pass through; they stay separate, drawn with a bridge arc.
- **Fibres connect only at their two ends** (decided 2026-10-28). You drag from one cell to another and the fibre routes through the cells between. The cells it passes through aren't affected.
- **Fibres are directed** (decided 2026-10-28), drawn with an arrow, so a fibre is also a diode.
- **Neurons sit as an overlay inside a body cell** (decided 2026-10-28), one per cell, with fibres attached to it. Logic doesn't take up body space.
- Nerves and vessels **run through body cells and need them**: a fibre is cut when a cell it runs through dies, so injuries can disable circuits.
- Each layer is a separate view in the editor, and the other layers are dimmed while you edit one. The views are tabs at the top centre: 1 Body (the default), 2 Nerves, 3 Vessels (2026-10-28, user: "I want to introduce tabs with shortcuts, 1 body, 2 nerves, 3 veins. The tabs will be on top - centered, with body the default"; until then they were buttons at the top of the left toolbar, with N and V switching to Nerves and Vessels and back). 1–3 always switch tabs, so a Command can't be bound to them.
- **The cell dock** (2026-10-28, user: "the bottom menu change it to tabs as well, also remove the names from the cells and the biomass price and move that to the hint"): a tab per category (Body, Sense, Action, Fluid, Gland), and the open tabs' cells as two interlocking rows of hexagons with no labels. A click opens or closes a tab, so several can be open side by side (user, 2026-10-28: "allow the player to expand the tabs - even multiple at once"; for a few hours only one tab was open at a time); the last open one can't be closed. The open tabs are remembered (`bioforge-lab-dock-categories`). Until then every category showed at once in folding sections, in as few rows as fitted the window, each hexagon with its name and cost. The Nerve view's neurons are two rows too. The dock is 75% of the window wide (user, 2026-10-28), with the tabs in the middle of its head and the hexagons centred.
- **The hover hint** shows after 200 ms (it was 1 s until 2026-10-28) and starts with the name and the biomass cost (◆). Over a dock button it sits above the button, centred on it; over a cell on the grid it sits beside the mouse, on the side towards the middle of the screen. Placed cells give a hint only in the Body view (user, 2026-10-28: "in nerves and fluids we don't need to show so agressive hints about the cells already on the creature"); in the Nerve and Vessels views only the dock's buttons do. Neuron buttons get a hint in the same format as the cells (user, 2026-10-28: "I would like them to follow the same format as the hints in the body layer"): symbol, name and cost (◆ 0), a facts line (makes its own signal or reads the fibres coming in; the setting and its range), the description, How to use, and a live example tank with the neuron's cells ringed and numbered, and a signal lane per numbered cell under it. Until then a neuron's hint was only its name and description.
- **The builder's panels** (2026-10-28, user: "It contains some bars - which are very small with no description - they are just noise ... That is too much, it is noisy and nobody will watch it"). Until then the left panel had five unlabelled meter bars for every view, a card with a picture and the description of the chosen cell or neuron, a neuron scope with made-up inputs, five figure chips (health, mass, burn, O₂, sugar) and every design warning as a sentence, with an orange "!" on every cell each warning was about.
  - **Limits line:** under the tabs, in words, only the current tab's limits (Body: biomass and cells; Nerves: neurons and fibre; Vessels: vessel units). A full limit turns orange; a design over any limit says so below it.
  - **Card:** shows only for the part being stamped, or a clicked cell that has something to set up: a neuron (its setting, a Command's key), a Bud, or any cell in the Nerve view (its fibres). No picture, no description: the hover hint tells what a cell is. Messages (saved, can't place) have their own line above it.
  - **Needs card** (user: "if you place muscles 52 warnings shows up, that is not a good experience"): "Sugar lasts N s" in big type (the stock at the start over the most the cells burn, every cell working), then fixed rows Signal, Oxygen, Sugar, Waste, Blood, Weapon (and Buds when there are Buds), each ✓, ✗ with a fix in a few words, ~ when it works poorly (cells far from a pumped vessel, blocked Bud parts) or – when nothing needs it yet. One "Next:" line gives the full text of the first ✗. The "!" marks on the grid show only while the mouse is on a row. "No weapons" is a – in the Weapon row, not an error. Health, mass and O₂ per second are no longer shown.
  - **Traces window** (user: "I like the graphs, but they should be in some tracing windows when in nerves layer"): a floating window, shown only in the Nerve view, with the run's probe lanes for the builder's test tank: up to 8 senses, neurons and signalled cells of the real creature, 6 s each, with matching number tags on the grid. Space and bound keys fire Commands in it. It replaced the scope, which ran one neuron on made-up inputs.
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
| Input | Command | Bound to a free key, or Space. |
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
| **Sugar** | Carbohydrates | Algae, plant-like specks | Fuel in the blood; chitin | 3 |
| **Fat** | Lipids | Most food | Long-term energy store, buoyancy | 4 |
| **Mineral** | Calcium, silica | Seawater (slowly), diatoms, eaten shells | Shell, spines, thorns | 5 |
| **Nucleic** (rare) | DNA/RNA | Only whole creatures | Growth, Buds, regrowth | 7 |

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
Each chapter teaches one new pattern set. Each development milestone ends with its chapter playable. Memory and logic became chapter 2 on 2026-10-28, so the chapters after it moved up by one (Circulation was chapter 2).

| Chapter | New pattern | Systems on | Materials |
|---|---|---|---|
| 1. **Reflexes** | Neurons and wiring: rhythm, steering (Braitenberg), sensing | Body, nerve | Protein only; it works like a single budget |
| 2. **Memory and logic** | Inhibitor, Latch, Delay, Synapse: holding still, waiting, timing, thresholds | Body, nerve | Protein only |
| 3. **Circulation** | Vessels, the Heart, valves; fuel delivery | + fluid, vascular | + Sugar (fuel in the blood) |
| 4. **Feeding** | Mouth, digestion, storage; self-sufficiency | + metabolism (eating, storage) | + Fat |
| 5. **Armour** | Shells, mineralizing, acid; counterplay | + secretions | + Mineral |
| 6. **Moods** | Hormones modulating neurons; the fed/starved economy; crosslinker and resilin | + chemical (hormones, treatments) | — |
| 7. **Growth** | Growth plan, Buds, regrowth; hunting for nucleic | + growth | + Nucleic |

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
fibres.js       nerve fibre routing from cell centre to cell centre (vessels use it too), units, adding fibres to
                a creature and cutting broken ones (pure)
physics.js      input, steering, springs, drag, collisions, integration (pure); systems: input 10, physics 20
nerve.js        signals along fibres, senses, the neuron rules (pure); system: nerve 40 (switchable)
fluid.js        work levels, fuel burning, products, fluids seeping between touching cells (pure); system: fluid
                50 (switchable)
vascular.js     blood vessels: units, adding a design's vessels to a creature, cutting broken ones, blood flow
                between their ends pumped by Hearts and shut by Valves (pure); system: vascular 55 (switchable)
actuators.js    resizing, weapon triggers, timers, debris rot (pure); system: actuators 60
combat.js       damage, contact hits, aiming, snare lines, globs (pure); system: projectiles 70
growth.js       Bud parts and Mender regrowth (pure); systems: buds 80, regrow 90 (switchable)
food.js         food specks, eating, specks left by dead cells (pure); system: food 100 (switchable)
ai.js           sandbox enemy steering (pure)
levels.js       levels: building a level's world, its light, stepping it, the goal checks, the score, a headless
                run (pure)
design.js       hex lookup, buildCheck (cells, biomass, neurons, fibre and vessel units), design warnings and the
                Needs rows they fill, the sugar supply, the saved design format, and the conversion of old saves and of designs from before the nerve layer (pure; loaded
                before data/templates.js, which uses the conversion)
builder.js      the edited design and every editing rule: cells, Bud parts and aim, Command keys, vessels, stamps,
                saving a selection, the library list (pure)
data/*.js       cells (stats and behaviour fields), neurons, fluids, templates (incl. the small builds), tips,
                levels and the creatures that live in them, sound effects
render.js       canvas drawing of a world
windows.js      DOM and storage helpers, floating windows, remembered menu branches
tipdemo.js      live example tank in the cell and neuron tooltips, with signal lanes under a neuron's example
hud.js          HUD bars and vitals
dock.js         the cell dock: a tab per category, two rows of hexagons; the neurons in the Nerve view
library.js      the template library window, saved in localStorage
toolbar.js      the Body / Nerves / Vessels tabs at the top; the toolbar down the left edge: Clear, Save,
                Unlimited, fluid views, keys, Sandbox
panel.js        the limits line under the tabs, a message line, the card of the clicked cell or the stamp, and the
                Needs card (sugar time, a row per need, the next fix)
coach.js        the How to box: small looping animations of each step, ticked off as the design does them
builderview.js  drawing the builder grid and the preview window; zoom and pan
tooltip.js      the hover hint: name, cost, description, how to use, live example
probes.js       signal probes: a live 6 s trace per sense, neuron and signalled cell, with number tags on the
                cells; in runs for the player (or the cells the player clicked), in the builder's Traces window
                (Nerve view) for the test tank's creature
sandbox.js      sandbox mode: its bar, steps, drawing and HUD; the time controls and vitals HUD it shares with levels
levelview.js    levels in the app: the levels sheet (level tiles, and the chosen level's card beside them), a
                level run with its bar, arena, HUD and result box, the best results
music.js        the background music: starts on the first click or key, loops by crossfading two copies; the
                toolbar button and M switch it
sound.js        sound effects: playing them, the toolbar button and N, the creature's sounds from world changes
audio/          the music track (mp3) and the sound effects in audio/sfx/ (wav)
ui.js           the app state, the controls, mouse and keyboard input, the frame loop
tests/*.js      headless checks: node tests/all.js (autonomy, builder, design, determinism, editor, golden,
                levels, music, nerve, probes, sandbox, showcase, sound, systems, vascular, weapons); helpers: load.js,
                dom.js (fake browser), check.js
```

**The saved design format** (2026-10-28): a design is `{ cells, fibres, vessels }`; fibres and vessels are `{ from: { q, r }, to: { q, r } }`. A design cell is `{ q, r, typeName }`, plus on a Bud `budPart`, `partRotation`, `partOffset` and `partAim`, and on a Command `boundKey`. A library entry is `{ name, isCreature, cells, fibres, vessels }`; one saved before vessels loads with none. `migrateLibraryEntry()` in `design.js` reads the old short names (`t`, `tpl`, `bind`, `rot`, `off`, `aim`, `full`). The library lives under `bioforge-lab-library`; the first time, Lab copies Bioforge Moba's `bioforge-templates` list from it, and it never writes to that key, because pages opened from disk can share storage and Moba still uses it. Every Lab storage key starts with `bioforge-lab-`.

**Cell behaviours.** Systems never check a cell's type name. Each cell type in `data/cells.js` declares behaviour fields (`work`, `product`, `trigger`, `resize`, `breathes`, `pumps`, `gatesFlow`, `needsSignal`…), and the systems read those, some through small registries (`WORK_LEVELS` and `PRODUCTS` in `fluid.js`, `TRIGGERS` in `actuators.js`). A new cell type made from existing behaviours needs only data. `tests/determinism.js` fails if a pure file compares `typeName`.

Planned additions: `chemical.js`, `metabolism.js`.

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
2. **Autonomy, debugging and chapter 1.** ✅ Done 2026-10-28. No hidden steering. Probes with signal traces, slow motion and single-stepping. The level format, win checks, scores, and 5 Reflexes levels ending in a Braitenberg hunt.
   - Test: a scripted reference solution beats every level headless.
   - Done so far (2026-10-28): autonomy and time controls. The player's creature is `autonomous`: no free swimming, no held heading, no WASD and no autopilot; Space and the bound keys still reach its Command neurons. Cilia push toward the front from where they sit, so cilia on one side turn it. Muscles move a creature only by pushing water (decided 2026-10-28, user: "I would like the movement behave like in water"; for a few hours before, a contracting muscle kicked the creature forward directly). See "Water" below. The sandbox has pause (P), one step (.) and speeds 1×, 2×, 4×, ½×, ¼× (,). Test: `tests/autonomy.js`, `tests/sandbox.js`.
   - Done 2026-10-28: the Delay neuron, light with a reach, and the level format with chapter 1's 5 levels: First stroke (reach a ring ahead: a Pacemaker on two Siphons), Lighthouse (reach a light: crossed Light eyes), Moth (keep near a light going round: crossed eyes keep up), Shade (turn away from a light to a dark ring: same-side eyes plus a Pacemaker), Hunt (keep near the Darter, prey that jets off when its Eyespot sees you). Each has a reference solution that wins with 3 stars headless, and a wrong tool that loses. Test: `tests/levels.js`.
   - Done 2026-10-28: chapter 2, Memory and logic: Freeze (swim to a ring, hold still while a blinking light is on: two Light eyes into an Inhibitor) and False start (hold still until a single flash, then swim: two Light eyes into a Latch). The levels sheet shows chapter headings; a blinking light that is off shows as a dim lamp; the HUD says "Light on: hold still", "Dark: go" or "Wait for the flash". Test: `tests/levels.js`.
   - Done 2026-10-28: signal probes. In Sandbox and level runs the box at the bottom left shows a lane per sense, neuron and signalled cell of the player (senses first, up to 8), each with its last 6 game s of signal; a number tag on each probed cell matches its lane. T hides or shows them, remembered under `bioforge-lab-probes-shown`. With pause and one step, they show a circuit working step by step. Test: `tests/probes.js`.
   - Done 2026-10-28: levels unlock in order (a locked row is dimmed, shows a lock and names the win that opens it), and Metronome, chapter 2's third level: the light comes on every 4 s and you must already be still (0.25 s grace): a Delay of 2.5–3 s in one Light eye stops the Freeze build before the next flash. Test: `tests/levels.js`.
   - Done 2026-10-28: Dock, chapter 2's fourth level and its Synapse level: a fixed light (900 px reach) above a ring; come to rest in the ring for 2 s. The eyes grow brighter on the way in, and a Synapse at threshold 1.5 into an Inhibitor stops the creature in the ring. New goal kind `restIn`. Test: `tests/levels.js`.
   - Done 2026-10-28: choosing which cells to probe. While the signals show, a left click on one of your own cells in a run adds its lane at the end, or removes it if it is probed (the rest are numbered again; a ninth lane replaces the eighth). In the Sandbox a click anywhere else still spawns an enemy. The choice is kept through respawns and retries, and a new run from the builder goes back to the automatic pick. Test: `tests/probes.js`.
3. **Vascular layer and chapter 3.** ✅ Done 2026-10-29. Vessels, the Heart, valves; Sugar as fuel. Chapter 3 has 4 levels: Long haul (reserves), Exhaust (waste), Cold water (vessels) and Marathon (all three at once). (Until 2026-10-28 this was "chapter 2"; the later milestones moved up by one with it.)
   - Test: `tests/levels.js`, `tests/vascular.js`.
   - Done 2026-10-28: vessels (see Decisions). `vascular.js` with its own switchable system; the Heart pumps only the vessels it sits on, and the old "within 3 cells" boost is gone from `fluid.js`. The builder has a Vessels view (toolbar button or V): drag from cell to cell to lay a vessel or remove the one there, right-click a vessel to take it out, a vessel meter, and its own How to steps. Vessels are drawn bright while pumped, dark while idle, grey and dashed while a Valve shuts them, in the builder and in runs. Stamps, saved parts and creatures keep their vessels. Warnings: a Heart on no vessel, and fuel-burning cells more than 2 cells from the end of a pumped vessel. The Jet, Seeker, Paddler and the four small builds got vessels from their Hearts; their swim speeds are unchanged. Test: `tests/vascular.js`, `tests/editor.js`.
   - Done 2026-10-28: seeping between touching cells is 4x slower (0.1 flow per unit of fill difference), so a busy cell far from a store runs short: two Siphons held on behind a 1-cell neck get 59% of their fuel, behind 5 cells 40%, and 100% on a pumped vessel. The templates swim as before (Jet 22.8 px/s, Paddler 30–35 px/s). Level runs and the Sandbox have 2× and 4× (,).
   - Done 2026-10-28: Long haul, chapter 3's first level, the first with the fluid and vascular systems on: follow the drifting light of Moth for 150 s in all, within 240 s. A bare crossed Seeker is poisoned by its waste and loses its Siphons (127 s near the light), with a Fat each side it runs out of O₂ (94 s), and with a Gill at the back too it wins in 169 s. Test: `tests/levels.js`.
   - Done 2026-10-28: Exhaust, chapter 3's second level: the same drifting light at 24 px/s, 120 s near it in all, within 240 s. Its answer is a Pore at the back touching both Siphons: a Seeker with a Fat, an Air sac and the Pore (20 biomass) wins in 176 s. Every build without a Pore is poisoned first: the Long haul build reaches 105 s near the light, the same body with Tissue for the Pore 95 s. Test: `tests/levels.js`.
   - Done 2026-10-28: the fuel is called Sugar (it was "energy"): the fluid, the HUD bar, the cell texts and tips, and the code names (`FLUID_SUGAR`, `sugarCapacity`, `storesSugar`). The Fat cell holds Sugar until metabolism (milestone 4) turns fat into sugar. Test: `tests/all.js` (golden fingerprints unchanged).
   - Done 2026-10-29: Cold water, chapter 3's third level and the first that needs vessels: Exhaust's chase in cold water. A level's `seepFactor` (0.05 here, 1 elsewhere) slows seeping between cells and the unpumped flow in vessels 20x; a Heart's pumping is not slowed. Its answer is Exhaust's body with a Heart at the front between the eyes and a vessel from it to the Fat, the Air sac, each Siphon and the Pore (23 biomass, 14 vessel units): it wins in 174 s, never starving or poisoned. Without a pumped vessel the Siphons starve: of the 120 s near the light, the Exhaust build reaches 16 s, with a Gill 17 s, with a Fat for the Air sac and a Gill 15 s, the same vessels without a Heart 80 s, and a Heart with vessels to the stores only 15 s. A Heart whose vessels skip the Pore is poisoned (88 s). Test: `tests/levels.js`, `tests/vascular.js`.
   - Done 2026-10-29: Marathon, chapter 3's last level: cold water and the drifting light at Long haul's 18 px/s, 200 s near it in all, within 300 s. Its answer is the Cold water build with a Fat for the Air sac and a Gill beside each Siphon, the Heart's vessels reaching both Gills too (27 biomass, 20 vessel units): it wins in 267 s. The Cold water build runs out of O₂ and sugar together (193 s near the light); with an Air sac for the second Fat it runs out of sugar (163 s); Gills off the vessels feed nothing (87 s); a Gill in place of the Pore is poisoned (127 s); without the Heart 45 s. Test: `tests/levels.js`.
   - Decided 2026-10-29 (user chose "Capstone level" over reworking the vessel numbers):
     - **The Heart's rate stays fixed.** It was tried following a nerve signal (up to 2x pumping and fuel), but a resting Heart already delivers about 100x what two Siphons burn: Cold water still wins with the Heart at 3% of its beat. A faster Heart would change nothing unless the vessel numbers, and with them the templates, were retuned.
     - **Blood stays two-way,** from fuller to emptier.
     - **Vessels in Bud parts** move to milestone 7 (growth).
     - A capstone joining chapter 2's logic with circulation was tried and dropped: a blinking drifting light (a Delay echo, a Ganglion or a cruising Pacemaker to swim through the dark) won only at a few settings, and Freeze in cold water ends in about 30 s, before the Siphons' own stores run dry.
4. **Metabolism and chapter 4.** Material recipes, eating, digestion, storage; Fat.
5. **Secretions and chapter 5.** Mineral, mineralizer, acid, protease, self-harm.
6. **Chemical layer and chapter 6.** Hormones, modulation, crosslinker and resilin.
7. **Growth and chapter 7.** The growth plan, Buds, regrowth, Nucleic, and the metamorphosis boss.
   - Open: vessels in Bud parts (moved from milestone 3 on 2026-10-29).

## Open questions
- **Where do the levels live in the UI?** Since 2026-10-28 (user: "this why this stretches from top to bottom, make it more UX friendly. Also remove this window from the screen and make it visible once someone clicks on a challenge") the flag button opens a sheet with the levels as small tiles (number, name, stars) in a grid under their chapter headings, and down the sheet's whole right side one level's card: the chosen level, or at first the latest open one (user: "By default select the latest unlocked level"). The card has the goal, the limits and what earns the stars as a list, the best result, Build for it and Hint, and a big Run level at the bottom; its header holds the sheet's ✕. A click on a tile only shows its card; Build for it and Run level choose the level. While a level is chosen, a "Leave …: back to free build" line under the tiles leaves it (for a few hours that was a "Free build" button in the card, which the user found unclear). The sheet closes with ✕, Esc or a click outside. In the builder the flag button lights up while a level is chosen, and the limits line shows its limits; there is no level card on screen any more. Until then the sheet was a column of full-width rows with each brief, taller than the screen, and choosing one closed it and put the card above the side panel. Still open: whether running the chosen level should take fewer than two clicks from the builder.
- **How does a crossing look in the editor?** (milestone 1)
- **Is the 4-layer split right?** Should hormones merge into the vascular layer? Decide after trying it.
- **Which current cells stay, change or go?** Nerve cells and the Heart radius were replaced by the layers (2026-10-28).
- **Is Protein-only in chapter 1 too abstract?** Decide after trying it.

## Known limits
- There is no map code: rocks and currents were removed with `map.js` and come back with levels (milestone 2).
- Sandbox enemies are still steered by the AI (`ai.js`), with free swimming and a held heading. Only the player's creature is autonomous. Prey and enemies with their own wiring come with the chapter 1 levels.
- A Seeker crawls at the edge of the light's reach: from 400 px away (450 px range) it needs 22 game s to reach the light, from 220 px about 10 s. Once there it parks on it (within 5 px).
- Three chapter 1 levels (Lighthouse, Moth, Hunt) are beaten by the same 5-cell crossed Seeker. They teach one idea three times. Chapter 2 has the Inhibitor, the Latch, the Delay and the Synapse (Dock). A blinking light far away (Afterimage) didn't need the Delay: a Seeker with a Pacemaker cruises through the dark, and far light is too faint to drive the Siphons fast anyway.
- All four chapter 2 levels share the same arena (spawn at the bottom, ring and light at the top).
- Dock has one working threshold: 1.5 (thresholds step by 0.5; 1 stops at y 478 px, short of the ring, and 2 never stops). Its reference build needs a second Tissue cell only to keep the body even, or it turns.
- A Seeker can't win by damage: it slows to a stop on the light, so Thorns barely hit (they need speed), and a Darter's 80-health Nucleus outlasts a 60 s level. So the Hunt asks to keep near the prey, not to kill it; the `kill` goal was left out until combat is tuned for wired creatures.
- Muscle swimming is touchy. The Paddler template (two muscle columns taking turns at the front, a wide body of organs behind, 45 biomass) swims about 32 px/s at 1.6 Hz, but at 1.2 Hz it spins and at 2 Hz it stalls. Its Heart sits behind the organs, because a Heart in the spine stiffens the front and it no longer swims; two vessels (10 units) carry blood from it to the middle of each muscle column (2026-10-28; until then its muscles were more than 3 cells from the Heart, a warning). The same body drawn head-first swims backwards, muscle end first.
- Muscle swimming is slow next to cilia. In 10 game s: a 6-muscle-a-side tail with a Pacemaker and an Inhibitor 7.6 px/s, the same tail driven by a perfect travelling wave 24 px/s, two cilia about 28 px/s. A Ganglion delay made it slower (5 px/s), because it smooths the signal; the Delay neuron (2026-10-28) delays it unchanged, but no template uses it yet.
- Free swimming (the AI enemies) now depends on shape: at `SWIM_FORCE` 200 they average 48 px/s as before (46), but the wide Manta went from 54 to 32 px/s and the narrow Starter from 64 to 62.
- The showcase designs were built for WASD. Those without cilia, siphons or a muscle wave no longer move on their own; they are rewired with chapter 1.
- **Nerve layer (2026-10-28):**
  - Fibres are routed automatically by the shortest path; a player can't choose a route yet. Two fibres that share a step are drawn on top of each other.
  - The built-in designs and the tooltip examples are still written in the old format and converted when loaded. Hand-wired versions come with the chapter 1 levels.
  - Converted designs act on sharper signals: the old leaking signals faded slowly, fibres switch off at once. The Puffer's bloaters are on in 137 of 400 golden-scenario steps instead of 194.
- **Vascular layer (2026-10-28):**
  - Bud parts have no vessels: a part saved with vessels grows without them.
  - The Vessels view is there in every level, also where the vascular system is off (chapters 1 and 2), where vessels do nothing.
  - Vessels still change little for the templates: each burner runs on its own store between beats, so the Paddler without its vessels swims as far (both run dry of Sugar after about 100 s). Delivery matters only for cells that work hard for long, far from a store.
  - Long haul takes 150 game s near the light; at 4× that is about 50 real s. It teaches reserves (Fat, Gill), and Exhaust teaches the Pore; neither needs vessels. Cold water and Marathon (2026-10-29) are the only levels that do. Marathon takes 267 game s, about 67 real s at 4×.
  - Valves are in the builder, but no level needs one: nothing yet makes a creature want to shut a vessel or wall off a store.
  - Bodies longer than 3 rows steer badly in the chase: Marathon's Gills only work as a pair beside the Siphons; a Pore with two Gills behind it reaches 54 s near the light of 200, fully fuelled.
  - Vessels matter only in cold water (a level's `seepFactor`). At the usual seeping, a working cell burns little beside its own store (a Siphon at full work 0.0375 O₂ and Sugar per second, from a store of 1 that lasts about 27 s), so seeping from the next cell keeps it at full efficiency. In long chases every build is poisoned by waste long before it runs short of fuel, and a Heart's vessels spread the waste rather than remove it. Vessels would matter there if working cells held less or burned more, which changes how the templates swim; cold water was chosen instead (2026-10-29), since it leaves the templates and the other levels as they were.
  - The builder's Needs card and warnings don't know about cold water, so they don't warn that a build without a pumped vessel will starve there.
  - Of the two Heart placements tried in Cold water, only the front one (between the eyes) wins. A Heart behind the Siphons makes the body steer badly (35 s near the light), not starve.
  - With the slower seep, waste builds up more in big bodies: the Paddler holds 6.9 waste after 90 s instead of 2.4, with no cell poisoned.
  - The cell card lists a cell's fibres but not its vessels.
- The tests run the scripts in a Node `vm` context, where every call of a global function goes through a slow lookup. The sim runs about 8x slower there than in a browser, and `node tests/all.js` takes about 18 s.
- `sine` and `cosine` are within 1 unit in the last place for ordinary angles. Right next to a multiple of π/2 the error is larger relative to the tiny result, about 1e-26 in absolute terms, which doesn't matter for the game.
