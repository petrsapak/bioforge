# Bioforge

Games about soft-body creatures built from cells. You design a creature on a hex grid from cells such as thorns, muscles, nerves, gills and hearts, then play it. Nerves decide when cells act, and oxygen, energy and waste flow from cell to cell.

## Versions

| Folder | What it is | Status |
|---|---|---|
| [`bioforge-lab/`](bioforge-lab/) | **Bioforge Lab**: single player. Program a creature through its nerve, vessel and hormone layers, then watch it solve challenges on its own. | **Active.** See [`PLAN.md`](bioforge-lab/PLAN.md). |
| [`bioforge-moba/`](bioforge-moba/) | Bioforge Arena: a 5v5 MOBA against bots. Two lanes, towers, minion waves, one core per team. | Dropped on 2026-10-28, kept as it was. |
| [`bioforge-online/`](bioforge-online/) | Bioforge Online: an open-world MMORPG slice (Tidepool biome, levels, unlocks). | Dropped on 2026-10-27, kept as it was. |
| [`bioforge-v3/`](bioforge-v3/) | Single-file prototype: the full builder and a wave arena. The later versions are built from it. | Frozen. |
| [`bioforge-v2/`](bioforge-v2/), [`bioforge/`](bioforge/) | Earlier single-file prototypes. | Frozen. |

## Running

There is no build step and there are no dependencies. Open `index.html` from any version folder straight from disk in a browser.

## Tests

The tests are headless and need [Node.js](https://nodejs.org/) (any recent LTS):

```
npm test              # bioforge-lab
npm run test:moba     # bioforge-moba
npm run test:online   # bioforge-online
npm run test:all      # all three
```

You can also run `node tests/all.js` inside a project folder.

## Code layout (lab, moba and online)

- The scripts are plain `<script src>` files that share one global namespace, with no ES modules. That way the page opens from disk, and the tests load the same files into a Node `vm` context, in the order `index.html` lists them.
- The simulation and game rules never touch the DOM, so a Node server can run them unchanged later. In moba and online these are `sim.js`, `moba.js` / `world.js`, `map.js` and `design.js`. In lab the sim is split into one file per system (`core.js`, `physics.js`, `nerve.js`, `fluid.js`…, listed in [`bioforge-lab/PLAN.md`](bioforge-lab/PLAN.md)), and it is bit-identical across browsers and Node.
- Game content is data, in `data/*.js`.
- Each project keeps its decisions in `PLAN.md` and a log of each working session in `sessions/`. [`CLAUDE.md`](CLAUDE.md) has the working rules, the doc structure and the session log template.

`bioforge-moba` started as a copy of `bioforge-online`, and `bioforge-lab` as a copy of `bioforge-moba`. The copies of `sim.js`, `render.js` and `ui.js` diverge from there; lab has since rewritten its sim and renderer.
