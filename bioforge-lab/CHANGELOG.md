# Bioforge Lab: changelog

What each version brought, newest first. The version number lives in `data/version.js` and `desktop/package.json`
(`tests/version.js` checks they match this file's top entry).

Numbering until the first release: `0.<milestone>.<patch>`. The minor number is the last finished milestone in
`PLAN.md`, and the patch number counts the changes released since. The versions before 0.4.1 were numbered
afterwards, from the git history.

## 0.7.4 (2026-10-30)
- Nerve fibres and blood vessels are drawn in smooth curves through the cells they pass, instead of zig-zagging
  from middle to middle. A fibre starts beside its neuron and its arrow now points into the cell it ends in, so
  you can tell at a glance where each one goes.
- Siphons no longer puff water across the builder's grid, where the puff covered the cell behind them. The
  preview window still shows them squirting.

## 0.7.3 (2026-10-30)
- Symmetry now covers wiring too. With an axis on, a neuron put into a cell goes into its mirror cell as well, and
  so do its setting and a Receptor's hormone; a fibre or vessel laid, rerouted or taken out is copied onto the
  mirror cells. While you drag, faint copies show where they will go. A fibre between two mirrored cells gets no
  copy running back the other way, as the two would signal each other in a loop. Command keys aren't copied, so
  the left and right sides can still be steered apart.

## 0.7.2 (2026-10-30)
- Hormones leak into the water. Every cell gives off a scent of the hormones it holds, and takes in what the
  water around it holds more of than it does, so moods are catching: swim through another creature's Calm and
  you calm down too.
- The chemical lens: press C (or the new Hormones button by the layer tabs) to see the hormones. The bodies dim,
  every cell glows with the hormones it holds, and the clouds in the water show. Works in the builder, in levels
  and in the Sandbox.
- Vessels are drawn thin, like nerve fibres, each in its own lane in its own shade of red, so several vessels and
  fibres through one cell no longer hide each other. A pumped vessel has a light core; a shut one is grey dashes.
- New cell: the Photophore. It glows while signalled, and other creatures' Light eyes see it and swim to it, as
  prey swims to an anglerfish's lure. Your own Light eyes ignore it.
- Two new levels. Anglerfish (chapter 5): lure a Seeker in the dark onto your glands. Lullaby (chapter 6): calm
  a stinging urchin with a cloud of Calm before you go in.
- The field guide: Field guide in every menu, G in the builder, or Guide on a clicked cell's card. Every cell and
  neuron with its numbers, a live example, how to use it, what to watch out for and what it works well with;
  pages on how the game works (signals, fuel, blood, materials, armour, light, moods, the water); a glossary.
  It has no level solutions. It shows rather than tells: every entry in the list has its picture; a page shows
  the cell big, its cost as coloured pips, its health and fuel as bars, a neuron's setting as a slider, the
  example's wiring as pictures joined by moving fibres and vessels, and what it works with as picture tiles. Every
  topic runs its own live tank, and pages about hormones show them glowing.
- New scrollbars everywhere in the game: a thin teal bar with no arrows, in place of the system's grey one.
- Fixed: on a slow computer (under 20 fps) a creature with Muscles could fly apart in the builder's test tank or a
  tooltip's example. They now take short steps, as levels and the Sandbox always did.
- A gland or a Photophore holding an Inhibitor with nothing wired in no longer shows "wire it" in the Needs card:
  it is on by itself.

## 0.7.1 (2026-10-30)
- Profiles: each player keeps their own creatures, level results, saved run and quick save; the settings are
  shared. Profile on the main menu lists them: click one to play as them, add a new one, rename or delete one
  (it asks first). Switching starts the game again at the main menu. What you had before is in a profile called
  Player.
- Renaming a saved creature or template asks in the game's own box instead of the browser's.
- Esc in the builder lets go of the clicked cell (its card closes) before it opens the menu.

## 0.7.0 (2026-10-30)
- Milestone 7, the chemical layer: moods. Glands release hormones that spread through the body, seeping from cell to
  cell and riding in the blood, and change how every cell they reach behaves.
- Four hormones. Adrenaline makes working cells stronger, Synapses quicker to fire and Pacemakers faster. Calm
  halves what a cell burns, but slows its Pacemakers and makes its Synapses harder to fire. Fed makes Fat store sugar
  as fat early, fast and without loss; Starved halves what a cell burns and makes Fat give its stores back early.
  Starved cancels Fed.
- New cells: the Receptor (a sense: it signals how much of a hormone it holds; click it to choose which), the Calm,
  Fed and Starved glands, the Tanner (crosslinks the cells round it: they take 60% less damage and blunt thorns like
  Shell, but their muscles move at half speed) and the Resilin gland (makes muscles springy: one held contracted, then
  let go, snaps open and strikes everything it touches, Shell too).
- A cell's rim shows the hormone it holds most of; tanned cells get a brown ring, springy muscles a gold one that
  glows as they charge. Shift+1–9 shows each fluid, the hormones too.
- Chapter 6, Moods, with six levels: Fight or flight, Lie low, Feast and famine, Tanned hide, Snap and Moods.

## 0.6.1 (2026-10-30)
- The tool bar on the left is gone. Unlimited biomass and Symmetry sit beside the Body, Nerves and Vessels tabs, with
  a red Delete all button that asks before it clears the creature, in the game's own box (Enter or Esc), as does
  deleting a saved creature or template.
- Right-click the Nucleus to save the whole creature to My creatures (the Save creature button is gone).
- Quick save: F5 or Ctrl+S keeps the creature in a quick slot, and F8 loads it back, also from a running level or
  the Sandbox.

## 0.6.0 (2026-10-30)
- Milestone 6, menus and saves.
- A title screen when the game starts: the main menu (Continue, Levels, Free build, Settings, and Quit in the desktop
  game) over a living reef. Seekers swarm round a drifting light, Jellies pulse, and two rival packs of hunters (an
  Eel and a Manta against a Crab, a Snarer and a Spitter) fight it out, while the camera drifts from one to the next.
- Choosing where to go dims the screen with a soft sound, and the lab fades in; the Main menu fades back to the reef.
- Esc opens a menu. In a level or the Sandbox it pauses the run: resume it, retry the level, go back to the builder,
  change the settings or go to the main menu. In the builder, Esc first lets go of what you hold (a stamp, a drag,
  the selected cells); with nothing in hand it opens the menu.
- Settings: music, sounds, fullscreen, and the keys. Their buttons are gone from the toolbar; M, N and H still work.
- Levels and the Sandbox are big buttons in the bottom-left corner of the builder: a green play button for Levels,
  and a sand-coloured one with a lab flask for the Sandbox, where you try a creature out.
- The game remembers where you left off. Your creature in the builder and the chosen level are kept as you work, and
  Continue picks up a level or Sandbox run right where it was, even after closing the game.
- Save your creature to a file, and load creature files, to back them up or share them.
- Saves now carry a version number, so later versions of the game can bring older saves up to date.

## 0.5.2 (2026-10-29)
- You choose where a nerve fibre runs: drag through the cells you want it to pass, and it follows the mouse. Go back
  over the path to undo a step. Drawing a fibre that is already there along a new path moves it.
- Fibres are thinner. Fibres that share a cell run side by side in different colours instead of on top of each
  other. Point at a fibre, or at its row in the cell card, to light it up from start to end.
- Metronome's hint says to keep the body even, and why.
- The numbered circles on probed cells are gone; they were large and covered the fibres.
- Fixed: pointing at a Bud in the builder froze the game. The screen stopped updating, cells couldn't be added or
  removed, and the Sandbox didn't start.

## 0.5.1 (2026-10-29)
- A new look for cells: see-through, as under a microscope, with a coloured membrane and a clearer symbol for
  each type. Tissue, Joint and Bloater now have one, and the Nose and Light eye no longer look like the Eyespot.
  The bonds between cells are soft see-through flesh, and hardened cells wear a faceted mineral crust. Neurons
  match: small see-through nerve cells with a drawn symbol for each kind (a wave, a key, chevrons…).
- The side column keeps its width again: a long hint no longer stretches the Creature card across the grid.

## 0.5.0 (2026-10-29)
- Milestone 5, secretions. Chapter 5, Armour: Bulwark, Clam, Quarry, Siege.
- Mineral, a new material. Shell and Thorns are built with it, and a broken Shell or Thorn leaves a mineral speck
  that a creature with a Mouth can eat.
- Shell, Thorns and hardened cells now shrug off thorn hits and nettle stings (a quarter of the damage, on top of
  Shell's armour).
- Three new glands: the Acid gland eats Shell and Thorns, the Protease gland digests soft cells and feeds on them,
  and the Mineralizer spends stored mineral to harden your own cells. None of them hurt your own creature.
- Levels can have creatures that arrive later, clams fixed to the rock, and goals to survive or to destroy a
  creature.

## 0.4.1 (2026-10-29)
- Faster building: hold and drag to paint or remove cells, symmetry axes through the Nucleus, Shift highlights every
  cell of the chosen type, a hex cursor in the chosen cell's colour.
- The desktop build (Electron, `desktop/`): a Windows app with saves in a file, fullscreen on F11.
- Version numbers and this changelog. The version shows on the keys sheet (H).
- Runs and the preview tank no longer draw nerve fibres and blood vessels; they show only in the builder and the tips.
- The fluid view dots on the toolbar are gone: click the Oxygen, Sugar or Waste row of the Creature card instead to see
  that fluid, and click it again to go back. Shift+1–6 still work.

## 0.4.0 (2026-10-29)
- Milestone 4, metabolism. Chapter 4, Feeding: Packed lunch, Grazing, Bloom.
- Material kits (Protein, Sugar, Fat), Fat storage, the Nose, level food supplies and the eat goal.
- Looser level limits with the par kept tight. Every level open for testing.

## 0.3.0 (2026-10-29)
- Milestone 3, the vascular layer: vessels, the Heart, valves, Sugar as fuel.
- Chapter 3: Long haul, Exhaust, Cold water, Marathon.
- The Body / Nerves / Vessels tabs, the dock as category tabs, the builder panels and hints.
- Sound effects and a seamless music loop.

## 0.2.0 (2026-10-28)
- Milestone 2, autonomy and debugging: no hidden steering, signal probes, slow motion and single steps.
- Levels with goals, scores and unlocks. Chapter 1 (five levels ending in a hunt) and chapter 2 (Freeze, False
  start, Metronome, Dock).
- Background music.

## 0.1.0 (2026-10-28)
- Milestone 1, the nerve layer: fibres, the neuron set, the editor's layer views.
- The core rebuilt for readable code and bit-identical determinism (milestone 0.5), with golden tests.
