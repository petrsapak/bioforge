'use strict';
// What happened in a level run, told from its state step by step: the events the timeline marks (a cell lost, cells
// out of fuel, a hit taken or landed, food, a kill, the goal held or let go, the end) and how near the player came to
// the goal's ring. The sim knows nothing of it. Pure: no DOM.

const EVENT_MERGE_STEPS = 80;                             // steps (2 game s): events of a kind this close are one mark
const MAX_RUN_EVENTS = 80;                                // events a run keeps; a longer story isn't marked further
// what a goal that counts time says when the count starts, and when it stops short
const GOAL_EVENT_TEXTS = {
  stayNear: { held: 'Near the light', letGo: 'Left the light' },
  restIn: { held: 'At rest in the ring', letGo: 'No longer at rest in the ring' },
  spread: { held: 'Enough cells alive', letGo: 'Too few cells again' },
};

// The one place an event is built. step: the run's step count right after it happened, and seconds: its clock then
// (game s); lastStep: the step of the latest event merged into it; tone: 'good', 'bad' or 'note' (the mark's
// colour); cellNames: the cells a 'lost' event has lost so far.
function createRunEvent(step, seconds, kind, tone, text) {
  return { step, seconds, lastStep: step, kind, tone, text, cellNames: [] };
}

// A run's log. watch: what the run looked like after the last step looked at (readRunWatch); events: oldest first;
// closest: { step, seconds, distance } of the player's nearest moment to the goal's ring, or null for a goal
// without one; outcome: the run's, once it has ended.
function createRunLog(run) {
  const log = { watch: readRunWatch(run), events: [], closest: null, outcome: null };
  noteClosestApproach(log, run);
  return log;
}

// What the events are told from: the run's state as plain values, with the player's cells as a list of its own.
// before: the watch of the step before, whose cell list is kept while the body is the same.
function readRunWatch(run, before = null) {
  const player = run.player;
  const cells = player.alive ? player.cells : [];
  const hasSameCells = before && before.cells.length === cells.length &&
    cells.every((cell, i) => cell === before.cells[i]);
  return {
    run,
    cells: hasSameCells ? before.cells : [...cells],
    isHit: cells.some(cell => cell.hitFlash > 0),
    isStriking: run.world.cells.some(cell => cell.hitFlash > 0 && isEnemyBody(player, cell.creature)),
    starvingText: starvingText(cells),
    isPoisoned: cells.some(cell => cell.poisoned),
    hasEaten: player.foodEaten > 0,
    isRuleBroken: run.ruleBroken,
    arrivedCount: run.creatures.filter(Boolean).length,
    deadCount: run.creatures.filter(creature => creature && !creature.alive).length,
    goalTime: run.goalTime,
    isGoalHeld: before ? run.goalTime > before.goalTime : false,
  };
}

// whether a creature is a living body of another team than the player's (not a piece cut off one)
const isEnemyBody = (player, creature) => creature.team !== player.team && !creature.debris;

// which fuel the first starving cell is out of, with the cell's name; '' while none starves
function starvingText(cells) {
  const starving = cells.find(cell => cell.starving);
  if (!starving) return '';
  const isOutOfOxygen = starving.fluids[FLUID_OXYGEN] <= starving.fluids[FLUID_SUGAR];
  return `Out of ${isOutOfOxygen ? 'O₂' : 'sugar'}: ${starving.type.name}`;
}

// Makes the log's watch one of this run. After a look back along the timeline the run stepped on is another object
// with the same state, so its watch is read again; nothing happened in between.
function followRun(log, run) {
  if (log.watch.run === run) return;
  log.watch = { ...readRunWatch(run), isGoalHeld: log.watch.isGoalHeld };
}

// Notes what the run's last step brought: called after every step taken for the first time, with the log following
// the run (followRun) since before the step.
function noteRunEvents(log, run) {
  const before = log.watch;
  const now = readRunWatch(run, before);
  log.watch = now;
  noteClosestApproach(log, run);
  noteBodyEvents(log, run, before, now);
  noteFightEvents(log, run, before, now);
  noteGoalEvents(log, run, before, now);
  if (!run.outcome) return;
  log.outcome = run.outcome;
  const isWon = run.outcome === 'won';
  const text = isWon ? 'Level done' : run.reason;
  log.events.push(createRunEvent(run.steps, run.time, 'end', isWon ? 'good' : 'bad', text));
}

// Adds an event, unless one of its kind happened within EVENT_MERGE_STEPS: then that one stands for both. Returns
// the event that now stands for it, or null once the log is full.
function addRunEvent(log, run, kind, tone, text) {
  const step = run.steps;
  const last = log.events.filter(event => event.kind === kind).pop();
  if (last && step - last.lastStep <= EVENT_MERGE_STEPS) {
    last.lastStep = step;
    return last;
  }
  if (log.events.length >= MAX_RUN_EVENTS) return null;
  const event = createRunEvent(step, run.time, kind, tone, text);
  log.events.push(event);
  return event;
}

// the body: cells lost (destroyed or cut off), a Bud part launched, cells out of fuel or poisoned by waste, food
function noteBodyEvents(log, run, before, now) {
  if (now.starvingText && !before.starvingText) addRunEvent(log, run, 'starving', 'bad', now.starvingText);
  if (now.isPoisoned && !before.isPoisoned) addRunEvent(log, run, 'poisoned', 'bad', 'Waste is poisoning a cell');
  if (now.hasEaten && !before.hasEaten) addRunEvent(log, run, 'food', 'good', 'First food eaten');
  if (now.cells === before.cells || !run.player.alive) return;   // the Nucleus's end is the run's end
  const gone = before.cells.filter(cell => !now.cells.includes(cell));
  const lost = gone.filter(cell => !cell.creature.launchedPart);
  if (gone.length > lost.length) addRunEvent(log, run, 'launch', 'note', 'Launched a Bud part');
  if (!lost.length) return;
  const event = addRunEvent(log, run, 'lost', 'bad', '');
  if (!event) return;
  event.cellNames.push(...lost.map(cell => cell.type.name));
  event.text = lostCellsText(event.cellNames);
}

// "Lost a cell: Siphon", or "Lost 3 cells: Siphon, Muscle" with each name once
function lostCellsText(cellNames) {
  const names = [...new Set(cellNames)].join(', ');
  return cellNames.length === 1 ? `Lost a cell: ${names}` : `Lost ${cellNames.length} cells: ${names}`;
}

// the fight: a hit taken, a hit landed, a creature arriving or dying, the host rule broken
function noteFightEvents(log, run, before, now) {
  if (now.isHit && !before.isHit) addRunEvent(log, run, 'hit', 'bad', 'Under attack');
  if (now.isStriking && !before.isStriking) addRunEvent(log, run, 'strike', 'good', 'Hit an enemy');
  if (now.arrivedCount > before.arrivedCount) addRunEvent(log, run, 'arrival', 'note', 'A creature arrives');
  if (now.deadCount > before.deadCount) addRunEvent(log, run, 'kill', 'good', 'A creature dies');
  if (now.isRuleBroken && !before.isRuleBroken) {
    addRunEvent(log, run, 'rule', 'bad', 'Host rule broken: the guards wake');
  }
}

// a goal that counts time: the moment the count starts, and the moment it stops before the goal is met
function noteGoalEvents(log, run, before, now) {
  const texts = GOAL_EVENT_TEXTS[run.level.goal.kind];
  if (!texts || run.outcome || now.isGoalHeld === before.isGoalHeld) return;
  if (now.isGoalHeld) addRunEvent(log, run, 'goalHeld', 'good', texts.held);
  else addRunEvent(log, run, 'goalLetGo', 'bad', texts.letGo);
}

// keeps the step at which the player was nearest to the edge of the goal's ring (the first such step)
function noteClosestApproach(log, run) {
  const ring = goalRingOf(run);
  if (!ring) return;
  const distance = Math.max(0, distanceToPlayer(run, ring.x, ring.y) - ring.radius);
  if (!log.closest || distance < log.closest.distance) log.closest = { step: run.steps, seconds: run.time, distance };
}

// The marks of a run's timeline, oldest first: its events, in a lost run the nearest moment to the ring, and any
// more given (the ghost's end, timeline.js).
function runMarks(log, moreMarks = []) {
  const marks = [...log.events, ...moreMarks];
  if (log.outcome === 'lost' && log.closest) {
    const distance = Math.round(log.closest.distance);
    const text = distance ? `Nearest to the ring: ${distance} px away` : 'First inside the ring';
    marks.push(createRunEvent(log.closest.step, log.closest.seconds, 'closest', 'note', text));
  }
  return marks.sort((first, second) => first.step - second.step);
}
