// design.js (builder checks, sim only): hex lookup, reach from the nucleus, and the design warnings
const { load } = require('./load');
const { check, done } = require('./dom');
const { X } = load({}, ['pxToHex', 'inGrid', 'reach', 'designWarnings', 'hexPx', 'key', 'bp', 'GR', 'TEMPLATES']);
const { pxToHex, inGrid, reach, designWarnings, hexPx, key, bp, GR, TEMPLATES } = X;
const texts = (l, planned = []) => designWarnings(l, planned).map(w => w.text).join(' | ');

check('pxToHex inverts hexPx', [[0, 0], [3, -2], [-4, 1], [2, 5]].every(([q, r]) => String(pxToHex(...hexPx(q, r))) === String([q, r])));
check('inGrid edge', inGrid(GR, 0) && inGrid(0, -GR) && !inGrid(GR + 1, 0) && !inGrid(GR, 1));

const has = new Set([key(0, 0), key(1, 0), key(2, 0), key(5, 5)]);
const seen = reach(k => has.has(k));
check('reach follows neighbours, skips islands', seen.has(key(2, 0)) && !seen.has(key(5, 5)) && seen.size === 3);

check('bare nucleus: no weapons', /No weapons/.test(texts(bp([[0, 0, 'nucleus']]))));
check('muscle without a signal source', /need a nerve signal source/.test(texts(bp([[0, 0, 'nucleus'], [1, 0, 'muscle'], [0, 1, 'thorn']]))));
const fed = texts(bp([[0, 0, 'nucleus'], [1, 0, 'cilia'], [0, 1, 'thorn']]));
check('fuel burner without gill, food or pore', /No Gill/.test(fed) && /No Mouth or Fat/.test(fed) && /No Pore/.test(fed), fed);
const pl = designWarnings(bp([[0, 0, 'nucleus'], [0, 1, 'thorn']]), [key(4, 4)]);
check('planned cells reported with their keys', pl.some(w => /planned cell/.test(w.text) && w.keys[0] === key(4, 4)));
// the Heart-distance note is only a hint (the Stinger has one such cell); anything else means a broken hero
const hard = l => designWarnings(l, []).filter(w => !/from a Heart/.test(w.text)).map(w => w.text).join(' | ');
for (const n of ['lancer', 'stinger', 'spitter', 'snarer'])
  check(n + ' has no warnings', hard(TEMPLATES[n].cells) === '', hard(TEMPLATES[n].cells));
done();
