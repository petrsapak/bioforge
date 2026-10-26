'use strict';
// Built-in creature designs.
const bp = list => list.map(([q, r, t]) => ({ q, r, t }));
const tpl = list => ({ cells: bp(list) });
// hex art: one letter per cell, each row shifted half a cell from the row above, N = nucleus
const ART = { N: 'nucleus', t: 'tissue', S: 'shell', j: 'joint', c: 'cilia', n: 'nerve', g: 'ganglion', p: 'pacemaker', k: 'command',
              e: 'eyespot', m: 'muscle', b: 'bloater', s: 'siphon', x: 'nettle', T: 'thorn', G: 'gill', M: 'mouth', h: 'heart',
              v: 'valve', a: 'airsac', f: 'fat', o: 'pore', r: 'mender', d: 'adrenal', H: 'snare', P: 'spitter' };
function art(rows) {
  const at = []; let n;
  rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ART[ch]) { at.push([i, j, ART[ch]]); if (ch === 'N') n = [i, j]; } }));
  return tpl(at.map(([i, j, t]) => [(i - n[0] - (j - n[1])) / 2, j - n[1], t]));
}
const TEMPLATES = {
  wiggler:  tpl([[0, 0, 'nucleus'], [0, -1, 'thorn'], [1, -1, 'mouth'], [-1, 0, 'gill'], [1, 0, 'heart'], [1, 1, 'pore'],
                 [-1, 1, 'muscle'], [0, 1, 'bloater'], [-2, 2, 'muscle'], [-1, 2, 'pacemaker'], [0, 2, 'bloater'],
                 [-2, 3, 'muscle'], [-1, 3, 'bloater'], [-2, 4, 'joint'], [2, 0, 'fat']]),
  squirter: tpl([[0, 0, 'nucleus'], [0, -1, 'thorn'], [1, -1, 'mouth'], [-1, 0, 'shell'], [1, 0, 'shell'],
                 [0, 1, 'command'], [-1, 1, 'siphon'], [1, 1, 'gill'], [-1, 2, 'siphon'], [0, 2, 'siphon'], [1, 2, 'pore'], [-2, 2, 'fat']]),
  nettler:  tpl([[0, 0, 'nucleus'], [0, -1, 'eyespot'], [1, -1, 'nettle'], [-1, 0, 'nettle'], [-1, -1, 'nettle'], [1, 0, 'nettle'],
                 [-1, 1, 'gill'], [0, 1, 'pore'], [1, 1, 'heart']]),
  puffer:   tpl([[0, 0, 'nucleus'], [0, -1, 'eyespot'], [1, -1, 'bloater'], [1, 0, 'bloater'], [0, 1, 'bloater'], [-1, 1, 'bloater'], [-1, 0, 'bloater'],
                 [0, -2, 'thorn'], [2, -1, 'thorn'], [1, 1, 'thorn'], [-1, -1, 'thorn'], [-1, 2, 'gill'], [-2, 1, 'pore'], [0, 2, 'fat']]),
  starter:  tpl([[0, 0, 'nucleus'], [0, -1, 'thorn'], [1, -1, 'mouth'], [-1, 0, 'gill'], [1, 0, 'tissue'],
                 [-1, 1, 'cilia'], [0, 1, 'cilia'], [-1, 2, 'pore']]),
  // showcase builds, drawn as hex art (see art below); they cost more than the starting biomass
  eel: art([
    '    T M T',
    '   x e e x',
    '  G f N f G',
    '   a h r f',
    '  c f d k c',
    '   o t t o',
    '    p t t',
    '     m b',
    '    m b',
    '     p b',
    '    m b',
    '     b m',
    '    b p',
    '     b m',
    '    b m',
    '     j',
    '    T']),
  jelly: art([
    '   M x e x M',
    '    G t f t G',
    '   b p h a p b',
    '  b t r N f t b',
    '   b p f t p b',
    '    b b o b b',
    '   j   j   j',
    '    j   j   j',
    '   j   j   j',
    '    j   j   j',
    '   T   T   T']),
  manta: art([
    '          T M T',
    '         G h r G',
    '  T b p b p N p b p b T',
    '   m m m m f a f m m m m',
    '          t k t',
    '         o s s o',
    '          c d c',
    '           j j',
    '            T']),
  crab: art([
    '  T           T',
    ' b m         m b',
    '  b m       m b',
    '   b m T M T m b',
    '    j k S S k j',
    '   G S S N S S G',
    '    a h r f h o',
    '   c t s k s t c',
    '    o   s s   o']),
};
const bpCost = o => o.cells.reduce((s, b) => s + CELLS[b.t].cost, 0);
