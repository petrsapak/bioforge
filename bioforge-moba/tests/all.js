// node tests/all.js -- runs every test file in this folder, prints only failures and a summary
const { execFileSync } = require('child_process'), fs = require('fs'), path = require('path');
const skip = new Set(['all.js', 'load.js', 'dom.js']);
let bad = 0;
for (const f of fs.readdirSync(__dirname).filter(f => f.endsWith('.js') && !skip.has(f))) {
  let out, ok = true;
  try { out = execFileSync(process.execPath, [path.join(__dirname, f)], { encoding: 'utf8' }); }
  catch (e) { out = (e.stdout || '') + (e.stderr || ''); ok = false; }
  const fails = out.split('\n').filter(l => l.startsWith('FAIL'));
  ok = ok && !fails.length;
  if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${f}`);
  for (const l of ok ? [] : fails.length ? fails : out.trim().split('\n').slice(-8)) console.log('     ' + l);
}
console.log(bad ? `${bad} file(s) failed` : 'all passed');
process.exitCode = bad ? 1 : 0;
