const fs = require('fs');
const [, , inFile, outFile] = process.argv;
const content = fs.readFileSync(inFile, 'utf8');

function extractJSONStringLiteral(s, start) {
  // s[start] must be '"'
  let i = start + 1,
    esc = false;
  while (i < s.length) {
    const c = s[i];
    if (esc) {
      esc = false;
      i++;
      continue;
    }
    if (c === '\\') {
      esc = true;
      i++;
      continue;
    }
    if (c === '"') return s.slice(start, i + 1);
    i++;
  }
  throw new Error('no closing quote found in string literal');
}

function unwrap(s) {
  s = s.trim();
  if (s.startsWith('[') && s.includes('"text"')) {
    const idx = s.indexOf('"text"');
    const colonIdx = s.indexOf(':', idx);
    let j = colonIdx + 1;
    while (s[j] === ' ') j++;
    const lit = extractJSONStringLiteral(s, j);
    const inner = JSON.parse(lit);
    return unwrap(inner);
  }
  if (s.startsWith('"')) {
    const lit = extractJSONStringLiteral(s, 0);
    const inner = JSON.parse(lit);
    return unwrap(inner);
  }
  return s; // assume plain JSON array text already
}

const arrText = unwrap(content);
let arr;
try {
  arr = JSON.parse(arrText);
} catch (e) {
  console.error('PARSE_ERROR: ' + e.message);
  process.exit(1);
}

const SLOT_TO_CODE = { 0: 'PSV', 1: 'A01', 2: 'A02', 3: 'A03', 4: 'A04', 100: 'Inhand' };

const normalized = arr.map((a) => ({
  name: a.name,
  abilityCode: a.abilityCode ?? SLOT_TO_CODE[a.slot] ?? null,
  slot: a.slot,
  description: a.description,
  imgPath: a.imgPath,
  levelStats: a.levelStats ?? {},
  namedFormulas: a.namedFormulas ?? {},
  namedValueScalings: a.namedValueScalings ?? {},
  notes: a.notes ?? [],
}));

const lines = normalized.map((o) => '  ' + JSON.stringify(o));
const out = '[\n' + lines.join(',\n') + '\n]\n';
fs.writeFileSync(outFile, out);
console.log('OK wrote ' + outFile + ' with ' + normalized.length + ' abilities');
