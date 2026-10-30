# Bioforge: working rules

Games about soft-body creatures built from cells. [`README.md`](README.md) has the overview and the version table.

## Projects
- **Active:** `bioforge-lab/` (Bioforge Lab: program a creature through its layers, then watch it act on its own). Work happens here unless the user names another folder.
- **Frozen:** `bioforge-moba/`, `bioforge-online/`, `bioforge-v3/`, `bioforge-v2/`, `bioforge/`. Don't edit them unless asked. Read them for reference only.
- A new direction gets a new folder copied from the active one, as `bioforge-lab` was copied from `bioforge-moba`. The old folder is then frozen, and README.md's version table is updated.

## Code rules
- **No dependencies and no build step.** Every `index.html` must open straight from disk. Don't add npm packages, bundlers, TypeScript or ES modules.
  - The one exception is `desktop/` (user, 2026-10-29: "let's introduce versioning and Electron"). It wraps `bioforge-lab/` in an Electron window and has its own npm packages (Electron, electron-builder) and build. The game folder itself stays dependency-free and never needs `desktop/` to run. Code that only the desktop build needs goes in `desktop/`; the game only checks whether `window.desktopSaves` and `window.desktopWindow` (Quit and Fullscreen in the menus) exist.
- **Plain `<script src>` files in one global namespace.** A new script goes into `index.html` in load order. The tests read that list (`tests/load.js`), so they pick it up automatically.
  - Top-level names are shared by every file, so check that a new global name isn't taken (`grep -n "^const NAME\|^function NAME"`).
- **Pure files have no DOM.** In Lab these are the sim files (`math.js`, `core.js`, `fibres.js`, `physics.js`, `nerve.js`, `fluid.js`, `vascular.js`, `chemical.js`, `scent.js`, `metabolism.js`, `actuators.js`, `secretions.js`, `treatments.js`, `combat.js`, `growth.js`, `food.js`, `ai.js`, `levels.js`), `design.js`, `builder.js`, `fieldguide.js`, `snapshot.js`, `savegame.js`, `titlescene.js` and `data/*.js`. They must not touch `document`, `window`, canvas or `localStorage`, so that a Node server can run them later. Browser-only code goes in `cellart.js`, `render.js`, `lens.js`, `windows.js`, `dialog.js`, `tipdemo.js`, `guideview.js`, `hud.js`, `dock.js`, `library.js`, `toolbar.js`, `panel.js`, `coach.js`, `builderview.js`, `tooltip.js`, `probes.js`, `sandbox.js`, `levelview.js`, `progress.js`, `titleview.js`, `menus.js`, `music.js`, `sound.js`, `ui.js` or `game.js`. A new file goes in one of these lists, and a new pure file also in `SIM_FILES` in `tests/determinism.js`; `tests/style.js` checks both.
- **New sim systems** go in their own file and register with `registerSystem({ name, order, switchable, update })` (see `core.js`). The order number sets their place in `step()`. A system that reacts to dying cells adds `onCellDeath(world, cell)`, which runs only while the system is on.
- **Systems never check a cell's type name** (`cell.typeName === 'mouth'`). Cell types declare behaviour fields in `data/cells.js` (`work`, `trigger`, `breathes`, `needsSignal`…), and the systems and `design.js` read those. `tests/determinism.js` checks this.
- **Every file starts** with `'use strict';` and a one-line comment saying what it holds, and whether it is pure or browser-only.
- **Line endings are CRLF** in the working tree (user, 2026-10-28). `.gitattributes` (`* text=auto eol=crlf`) keeps the repository itself in LF. Claude's file tools may write LF, both for new files and sometimes for edits, so run `node tests/line-endings.js --fix` after changing files and before committing (`node tests/all.js` fails on LF).
- **Tuning values** are named constants at the top of their file, with a trailing comment giving the unit (`// game seconds dead`).
- **Bioforge Lab must stay clear of Primordialis.** The player programs and watches, and doesn't pilot. Check every feature against "How this differs from Primordialis" in `bioforge-lab/PLAN.md`.
- **Every Lab mechanic must be removable.** Each system (nerve, vascular, chemical, metabolism, growth) lives in its own file with its own step function, and is switched on by the level's `systems` list and by `RULES` in `data/rules.js`. Turning one off must not need edits inside another, and the tests cover systems both on and off. The user may cut any mechanic that turns out frustrating.
- **Content is data.** Cells, templates, tips, the arena, waves and bot designs live in `data/*.js`. Adding content shouldn't need code changes.
- **Readable code is required** (user, 2026-10-28: "I want quality software engineering"). The old dense style of the frozen projects is not the model. For Lab code:
  - **Names say what a thing is.** `cell`, `creature`, `neighbour`, `bond`, `voltage`, `fluidAmount`, not `c`, `cr`, `n`, `b`, `V`, `f`. **No one-letter names**, except `i`/`j` as loop counters, `x`/`y` as coordinates, and `q`/`r` as hex coordinates. Common terms such as `dt` are fine.
  - **Constants have full names:** `BOND_STIFFNESS`, not `K_RAD`. Each has a comment with its unit.
  - **Line limit: 120 characters.** One statement per line; no `a = 1; b = 2;` chains. Prefer early `return`s over deep nesting.
  - **Functions do one thing** and are named with a verb (`applyBondForces`). Data objects are built by one factory function, never as copied literals in several places.
  - **Comments explain why,** and every function gets a one-line comment on what it does.
  - **2-space indent,** `const` by default, and `let` only when the value changes.
- **Bit-identical determinism (Lab).** The same design, level and seed must give the same result in every browser and in Node. In sim code:
  - Use the world's seeded random generator (`randomFraction(world)`), never `Math.random`.
  - Use the deterministic helpers in `math.js` and `core.js` (`sine`, `cosine`, `arcTangent2`, `square`, `distanceSquared`) instead of `Math.sin`, `Math.cos`, `Math.atan2`, `Math.exp`, `Math.pow`, `Math.hypot` and `**`, because these are not guaranteed identical across engines. A missing one (such as `exp`) is added to `math.js`. `+ - * /`, `Math.sqrt`, `Math.abs`, `Math.min`, `Math.max`, `Math.floor` and `Math.round` are exact and fine.
  - Browser-only files (`render.js`, `ui.js`…) may use `Math` freely, since they don't change the sim's state.
  - Iterate arrays and Maps in insertion order, and only use stable sorts with a full tie-break.
- **Golden tests** (`tests/golden.js`) record a fingerprint of the sim's exact state for fixed scenarios. A refactor must keep them unchanged. A deliberate behaviour change updates them with `node tests/golden.js --update`, and the session log says why.
- **UI code (Lab):** the app state is one `app` object built by `createApp()` in `ui.js`, and the browser files take it as a parameter. Editing rules that don't need the DOM go in `builder.js`, so they can be tested in Node. `ui.js` keeps only the state, the input and the frame loop; anything else gets its own file, as `dock.js`, `library.js`, `toolbar.js`, `panel.js`, `coach.js`, `builderview.js`, `tooltip.js` and `sandbox.js` did.
- **Storage (Lab):** use `readStorage` and `writeStorage` (`windows.js`). Their keys start with `bioforge-lab-`, because pages opened from disk may share `localStorage` with the frozen projects. Never write to another project's key.
- **Performance:** the user has reported low fps before. After changing the sim or the renderer, note the cost (ms of sim per game second, or per frame) in the session log. Keep swim speeds unchanged unless the user asks for a change.

## Tests
- Run `npm test` (lab), `npm run test:moba`, `npm run test:online`, `npm run test:desktop` or `npm run test:all` from the repo root. Inside a project folder, `node tests/all.js` does the same. Node.js is required.
- **Run the tests before saying a change is done.** If they can't run (for example, Node is missing), say so plainly.
- New pure logic gets a check in `tests/`. Use `load()` from `tests/load.js` for sim-only tests, and `startApp()` from `tests/dom.js` (Lab; `app()` in the frozen projects) for UI tests. Print `PASS`/`FAIL` lines through `check` from `tests/check.js`, and end with `done()`.
- The fake DOM can't show layout or drawing problems. After a UI change, also run the page in a real browser if one is available (headless Edge works; see the 2026-10-28 session log).
- Don't weaken a failing check to make it pass. If the check was wrong, explain why in a comment next to it.

## Git
- Commit only when the user asks. The default branch is `main`. Always tag a version (user, 2026-10-30: "always do the tag"): when a commit finishes a changelog entry, tag it `lab-v<version>` (`lab-v0.4.1`). A tagged version is finished: the next change players notice starts a new patch entry.
- Commit messages say what changed, such as `moba: split ui.js into design/windows/tipdemo/hud`, not `updates`. Start the message with the project folder's short name (`moba:`, `online:`, `docs:`).

## Versions (Lab)
- The version is `GAME_VERSION` in `bioforge-lab/data/version.js`, and `desktop/package.json` carries the same number. `bioforge-lab/tests/version.js` checks both against the top entry of `bioforge-lab/CHANGELOG.md`.
- Until the first release it is `0.<milestone>.<patch>`. Finishing a milestone raises the minor number and resets the patch. Otherwise a change that players notice goes into the top changelog entry; once a build of that version has been given out (`npm run dist` in `desktop/`, shared with someone), the next such change starts a new patch entry.
- Changelog lines are written for players: what changed in the game, not which files.

## Documentation
| File | What goes in it | When to update it |
|---|---|---|
| `README.md` (root) | What Bioforge is, the version table, how to run and test, the code layout | When a project is added, frozen or its status changes |
| `CLAUDE.md` (root) | These working rules | When the user gives a lasting rule or a convention changes |
| `bioforge-lab/CHANGELOG.md` | What each version brought, for players | With every change players notice (see "Versions") |
| `<project>/PLAN.md` | The design and the decisions that shape it (see below) | Whenever a decision is made or changed, or a milestone is finished |
| `<project>/sessions/session_YYYY-MM-DD.md` | What happened in one working session | At the end of every session that changed code or decisions |

### PLAN.md
It keeps this order:
1. **A short pitch:** one paragraph.
2. **Decisions (date):** each one is a bullet with a bold topic. If a decision changes later, edit the bullet and add the old value with the date, for example "The budget was 120 / 50 until the fps fix". Don't keep contradicting lines.
3. **Architecture:** a code block listing every file with a one-line role, and pure files marked. Update it when files are added, removed or renamed.
4. **Milestones:** numbered.
   - A finished milestone is marked `✅ Done YYYY-MM-DD`, with a short list of what was built and a `Test:` line naming the test file.
   - Open milestones list the questions still to decide.
5. **Known limits:** problems you know about, with numbers where they exist.

PLAN.md describes the current state. History belongs in the session logs.

### Session logs
- One file per day per project: `<project>/sessions/session_YYYY-MM-DD.md`. If that day's file already exists, add to it. Don't start a second one.
- Logs are a record. Don't rewrite old logs, except to fix facts that have become wrong, such as moved paths. When you do, add a short note in brackets.
- Use this template, leaving out sections that are empty:

```markdown
# Session YYYY-MM-DD: <project name> (<topic>)

## Discussed / decided
- The user's requests and answers, quoted where the exact words matter.
- Chosen without asking: decisions Claude made alone, so the user can overrule them.

## Done
- What was built or changed, grouped by file or feature.

## <Problem> (user: "<their words>")
- Cause, then fixes, then the measured result. One section per problem.

## Tests
- What ran and the result (`all passed`, or what failed and why).

## Action items / next
- What the user should try, open questions, and the next milestone.
```

### Writing style for docs
- Plain words and short sentences. Use absolute dates (2026-10-28), never "today" or "yesterday".
- Give numbers with their units (ms per frame, game s, px).
- Use repo-relative paths (`bioforge-moba/ui.js`), never absolute machine paths.
