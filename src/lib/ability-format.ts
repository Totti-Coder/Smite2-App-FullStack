type ValueScaling = { values: number[]; statTag: string }[];
type NamedValueScalings = Record<string, ValueScaling>;
type LevelStats = Record<string, number[]>;

const STAT_LABEL: Record<string, string> = {
  'Character.Stat.PhysicalPower': 'Physical Power',
  'Character.Stat.MagicalPower': 'Magical Power',
  'Character.Stat.ItemHealth': 'Bonus Health',
  'Character.Stat.InhandPower': 'Basic Attack Power',
  'Character.Stat.Protections': 'Protections',
};

function statLabel(tag: string): string {
  return STAT_LABEL[tag] ?? tag.replace('Character.Stat.', '').replace(/([A-Z])/g, ' $1').trim();
}

function scalingText(scaling: ValueScaling, rankIdx: number): string {
  return scaling
    .map((s) => {
      const v = s.values[rankIdx] ?? s.values[s.values.length - 1] ?? s.values[0];
      if (v == null) return null;
      return `${Math.round(v * 1000) / 10}% ${statLabel(s.statTag)}`;
    })
    .filter(Boolean)
    .join(' + ');
}

// Sentinel markers wrapped around resolved numeric/scaling values so the UI
// can split the text back apart and render those bits as highlighted chips -
// without this every ability read as one flat wall of grey text.
const HL_OPEN = '';
const HL_CLOSE = '';

/** Resolves {Token} placeholders in an ability description at the given rank (0-indexed). */
export function resolveAbilityText(
  description: string,
  levelStats: LevelStats,
  namedFormulas: Record<string, string>,
  namedValueScalings: NamedValueScalings,
  rankIdx: number,
  depth = 0
): string {
  if (depth > 5) return description; // guard against pathological self-reference
  return description.replace(/\{([A-Za-z0-9_]+)\}/g, (_match, token: string) => {
    if (token.endsWith('_Percent')) {
      const base = token.slice(0, -'_Percent'.length);
      const scaling = namedValueScalings[base];
      if (scaling) return `${HL_OPEN}${scalingText(scaling, rankIdx)}${HL_CLOSE}`;
      return token;
    }
    if (levelStats[token]) {
      const arr = levelStats[token];
      const v = arr[rankIdx] ?? arr[arr.length - 1];
      return v != null ? `${HL_OPEN}${Math.round(v * 100) / 100}${HL_CLOSE}` : token;
    }
    if (namedValueScalings[token]) {
      return `${HL_OPEN}${scalingText(namedValueScalings[token], rankIdx)}${HL_CLOSE}`;
    }
    if (namedFormulas[token]) {
      // Nested formula: resolve inline, don't double-wrap (the recursive call
      // already wraps its own leaf values).
      return resolveAbilityText(namedFormulas[token], levelStats, namedFormulas, namedValueScalings, rankIdx, depth + 1);
    }
    return token;
  });
}

/** Splits resolveAbilityText's output into plain-text and highlighted-value segments. */
export function splitHighlighted(text: string): { value: string; highlight: boolean }[] {
  return text
    .split(new RegExp(`${HL_OPEN}(.*?)${HL_CLOSE}`, 'g'))
    .map((part, i) => ({ value: part, highlight: i % 2 === 1 }))
    .filter((p) => p.value !== '');
}

/** Key stats worth surfacing as a compact grid (skips internal/"Cheat" tuning values). */
export function displayStats(levelStats: LevelStats, rankIdx: number): { label: string; value: number }[] {
  return Object.entries(levelStats)
    .filter(([key]) => !/cheat/i.test(key))
    .map(([key, arr]) => ({
      label: key.replace(/([A-Z])/g, ' $1').trim(),
      value: arr[rankIdx] ?? arr[arr.length - 1],
    }))
    .filter((s) => s.value != null);
}
