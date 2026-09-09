// Reference snippet: paste into the browser devtools console on a
// smitesource.com/god/<slug> page to pull that god's exact ability data
// straight out of the page's own Next.js RSC payload (self.__next_f).
// Copy the printed JSON into src/data/abilities/<god-id>.json, then run
// `npm run seed:abilities -- <god-id>`.
(function () {
  const scripts = Array.from(document.querySelectorAll('script'));
  const pieces = [];
  for (const s of scripts) {
    const t = s.textContent || '';
    if (!t.includes('self.__next_f.push(')) continue;
    const m = t.match(/self\.__next_f\.push\((\[[\s\S]*\])\)/);
    if (!m) continue;
    try {
      const arr = Function('"use strict";return (' + m[1] + ')')();
      if (Array.isArray(arr) && typeof arr[1] === 'string') pieces.push(arr[1]);
    } catch {}
  }
  const joined = pieces.join('');
  const keyIdx = joined.indexOf('"abilities":[');
  const startBracket = joined.indexOf('[', keyIdx);
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let i = startBracket; i < joined.length; i++) {
    const c = joined[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === '[') depth++;
    else if (c === ']') { depth--; if (depth === 0) { end = i; break; } }
  }
  const abilities = JSON.parse(joined.slice(startBracket, end + 1));
  const trimmed = abilities.map((a) => ({
    name: a.name,
    abilityCode: a.abilityCode,
    slot: a.slot,
    description: a.description,
    imgPath: a.imgPath,
    levelStats: a.levelStats,
    namedFormulas: a.namedFormulas,
    namedValueScalings: a.namedValueScalings,
    notes: a.notes,
  }));
  console.log(JSON.stringify(trimmed, null, 2));
})();
