# Bioforge Lab: changelog

What each version brought, newest first. The version number lives in `data/version.js` and `desktop/package.json`
(`tests/version.js` checks they match this file's top entry).

Numbering until the first release: `0.<milestone>.<patch>`. The minor number is the last finished milestone in
`PLAN.md`, and the patch number counts the changes released since. The versions before 0.4.1 were numbered
afterwards, from the git history.

## 0.5.2 (2026-10-29)
- You choose where a nerve fibre runs: drag through the cells you want it to pass, and it follows the mouse. Go back
  over the path to undo a step. Drawing a fibre that is already there along a new path moves it.
- Fibres are thinner. Fibres that share a cell run side by side in different colours instead of on top of each
  other. Point at a fibre, or at its row in the cell card, to light it up from start to end.
- Metronome's hint says to keep the body even, and why.
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
