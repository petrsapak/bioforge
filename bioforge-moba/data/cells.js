'use strict';
// Cell types.
// fuel = O2 + energy burned per second at full activity (each unit burned becomes one unit of waste)
// cells that burn no fuel are pipes: they pass O2 and energy on to their neighbours but hold only a little (PIPE)
const PIPE = 0.3;
const C = (o) => ({ mass: 1, stiff: 1, rad: 1, swim: 1, cond: false, armor: 1, fuel: 0, capO: o.fuel ? 1 : PIPE, capS: o.fuel ? 1 : PIPE, ...o });
const CELLS = {
  nucleus:   C({ cat: 'Body',   name: 'Nucleus',   cost: 0, hp: 80, mass: 1.5, swim: 2, capO: 3, capS: 3, color: '#e8c547', desc: 'If it dies, the creature dies. Parts cut off from it float away and rot. Holds a small store of O₂ and energy.' }),
  tissue:    C({ cat: 'Body',   name: 'Tissue',    cost: 1, hp: 30, color: '#7c8a6e', desc: 'Cheap filler. Holds shape and blocks nerve signals, so use it to separate nerve circuits.' }),
  shell:     C({ cat: 'Body',   name: 'Shell',     cost: 2, hp: 90, mass: 2, stiff: 2, rad: 2, swim: 0.5, armor: 0.5, color: '#c9c2b0', desc: 'Armour. Takes half damage, very stiff and heavy.' }),
  joint:     C({ cat: 'Body',   name: 'Joint',     cost: 1, hp: 25, mass: 0.8, stiff: 0.03, rad: 0.35, color: '#9fb58a', desc: 'A soft hinge. The body bends here, so tails and tentacles flop.' }),
  cilia:     C({ cat: 'Body',   name: 'Cilia',     cost: 2, hp: 20, mass: 0.6, fuel: 0.05, color: '#6ac9a0', desc: 'Beating hairs. Swims 3.5x harder than a normal cell, but only while it is fed O₂ and energy.' }),
  nerve:     C({ cat: 'Nerve',  name: 'Nerve',     cost: 1, hp: 20, mass: 0.8, cond: true, color: '#d8b86a', desc: 'Carries nerve signals between neighbours.' }),
  ganglion:  C({ cat: 'Nerve',  name: 'Ganglion',  cost: 2, hp: 25, cond: true, cap: 10, color: '#c78f3c', desc: 'Carries signals but charges and discharges slowly. Use it to delay or smooth a signal.' }),
  pacemaker: C({ cat: 'Nerve',  name: 'Pacemaker', cost: 3, hp: 25, cond: true, gen: 'pulse', color: '#f2e35b', desc: 'Fires on and off about 1.4 times per second.' }),
  command:   C({ cat: 'Nerve',  name: 'Command',   cost: 2, hp: 25, cond: true, gen: 'key', color: '#f29b38', desc: 'Fires while you hold Space (the AI fires it when close).' }),
  eyespot:   C({ cat: 'Nerve',  name: 'Eyespot',   cost: 3, hp: 20, cond: true, gen: 'prox', color: '#4fd1c5', desc: 'Fires when an enemy cell is near it.' }),
  muscle:    C({ cat: 'Action', name: 'Muscle',    cost: 3, hp: 30, mass: 1.2, cond: true, fuel: 0.1, color: '#d9544f', desc: 'Contracts to 45% size on a nerve signal, pulling neighbours in and bending the body. Burns fuel.' }),
  bloater:   C({ cat: 'Action', name: 'Bloater',   cost: 3, hp: 30, cond: true, fuel: 0.1, color: '#b77ee0', desc: 'Swells to 180% size on a nerve signal, shoving enemies away. Burns fuel.' }),
  siphon:    C({ cat: 'Action', name: 'Siphon',    cost: 4, hp: 25, cond: true, fuel: 0.15, color: '#5fb8e8', desc: 'Squirts water backwards on a nerve signal, pushing the creature forward. Thirsty.' }),
  nettle:    C({ cat: 'Action', name: 'Nettle',    cost: 5, hp: 25, cond: true, fuel: 0.12, color: '#a7b8ff', desc: 'On a nerve signal, stings every enemy cell close to it. Burns fuel while signalled.' }),
  snare:     C({ cat: 'Action', name: 'Snare',     cost: 5, hp: 30, cond: true, fuel: 0.1, color: '#b07a48', desc: `On a nerve signal, shoots a sticky line up to ${SNARE_LEN} px at the nearest enemy. If it catches a cell, it reels that enemy in for ${SNARE_HOLD} s. Burns fuel while firing and holding.` }),
  spitter:   C({ cat: 'Action', name: 'Spitter',   cost: 4, hp: 25, cond: true, fuel: 0.12, color: '#c4ff5a', desc: `While signalled, spits an acid glob every ${SPIT_CD} s at the nearest enemy within ${SPIT_R} px (straight out if none). Burns fuel while signalled.` }),
  thorn:     C({ cat: 'Action', name: 'Thorn',    cost: 3, hp: 35, color: '#8fd16a', desc: 'Damages enemy cells it hits. Faster hits hurt more. Needs no fuel.' }),
  bud:       C({ cat: 'Action', name: 'Bud',       cost: 4, hp: 30, cond: true, fuel: 0.4, color: '#c8e07a', desc: 'Grows a saved part on its outer side from O₂ and energy. A nerve signal shoots the finished part away from the body, then it grows a new one. The part has its own nerves and fluids: with a Pacemaker or Eyespot, Fat, Gills and working cells it moves and stings on its own until its fuel runs out, then rots.' }),
  gill:      C({ cat: 'Fluid',  name: 'Gill',      cost: 2, hp: 20, mass: 0.8, capO: 1, color: '#e07a8a', desc: 'Makes O₂ from the water, more while swimming fast. Works anywhere in the body.' }),
  mouth:     C({ cat: 'Fluid',  name: 'Mouth',     cost: 2, hp: 35, capS: 2, color: '#d98a6a', desc: 'Eats food specks that touch the body, and bites enemies and debris it touches, for energy. Leaves food alone while full.' }),
  heart:     C({ cat: 'Fluid',  name: 'Heart',     cost: 3, hp: 30, fuel: 0.04, color: '#b8243a', desc: `Pumps. While fed, fluids flow about 7x faster between cells up to ${HEART_R} cells away from it.` }),
  valve:     C({ cat: 'Fluid',  name: 'Valve',     cost: 2, hp: 25, cond: true, color: '#7d97a8', desc: 'Lets no fluid through unless it gets a nerve signal. Wall off a reservoir with Valves to release it on command.' }),
  airsac:    C({ cat: 'Fluid',  name: 'Air sac',   cost: 2, hp: 25, capO: 10, color: '#e8a0a8', desc: 'Reservoir. Holds 10x the O₂ of a working cell.' }),
  fat:       C({ cat: 'Fluid',  name: 'Fat',       cost: 2, hp: 30, mass: 1.3, capS: 10, color: '#f0e0a0', desc: 'Reservoir. Holds 10x the energy of a working cell. Plain cells only pass energy along, so this is where food ends up.' }),
  pore:      C({ cat: 'Fluid',  name: 'Pore',      cost: 2, hp: 20, color: '#7a6a48', desc: 'Dumps waste into the water. Must be on the surface. Working cells full of waste are poisoned.' }),
  mender:    C({ cat: 'Gland',  name: 'Mender',    cost: 4, hp: 25, fuel: 0.12, color: '#58d858', desc: 'Turns O₂ and energy into repair fluid. Damaged cells that receive it heal, and lost cells regrow one at a time, nearest the Mender first.' }),
  adrenal:   C({ cat: 'Gland',  name: 'Adrenal',   cost: 3, hp: 25, cond: true, fuel: 0.2, color: '#e04090', desc: 'On a nerve signal, turns energy into adrenaline. Muscles, cilia, siphons, bloaters and nettles that receive it work up to 80% harder.' }),
};
