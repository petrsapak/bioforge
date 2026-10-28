// Line endings: every text file of the project uses CRLF in the working tree (user, 2026-10-28; .gitattributes keeps
// LF inside the repository). Editors and tools that write LF are caught here.
//   node tests/line-endings.js         checks
//   node tests/line-endings.js --fix   converts LF files to CRLF
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./load');
const { check, done } = require('./check');

const TEXT_EXTENSIONS = new Set(['.js', '.json', '.html', '.css', '.md']);
const shouldFix = process.argv.includes('--fix');

// every text file under the folder, as paths relative to the project
function textFiles(folder) {
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap(entry => {
    const fullPath = path.join(folder, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : textFiles(fullPath);
    return TEXT_EXTENSIONS.has(path.extname(entry.name)) ? [fullPath] : [];
  });
}

// a line feed without a carriage return before it
const hasBareLineFeed = text => /(^|[^\r])\n/.test(text);

const badFiles = [];
for (const file of textFiles(ROOT)) {
  const text = fs.readFileSync(file, 'utf8');
  if (!hasBareLineFeed(text)) continue;
  if (shouldFix) fs.writeFileSync(file, text.replace(/\r?\n/g, '\r\n'));
  else badFiles.push(path.relative(ROOT, file));
}
check('every text file uses CRLF line endings', !badFiles.length,
  badFiles.length ? `LF in: ${badFiles.join(', ')} (fix: node tests/line-endings.js --fix)` : '');
done();
