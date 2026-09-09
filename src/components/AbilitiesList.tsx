'use client';

import { useState } from 'react';
import type { GodAbility } from '@/lib/supabase/database.types';
import { displayStats, resolveAbilityText, splitHighlighted } from '@/lib/ability-format';

const TYPE_ACCENT: Record<string, string> = {
  Passive: '#a78bfa',
  'Basic Attack': '#8b97a8',
  'Ability 1': '#16c8d4',
  'Ability 2': '#16c8d4',
  'Ability 3': '#16c8d4',
  'Ability 4': '#fb923c',
};

// Keybind chip shown on the icon corner, the same way SmiteSource/in-game
// HUD label abilities - makes the row scannable at a glance.
const TYPE_KEY: Record<string, string> = {
  Passive: 'P',
  'Basic Attack': 'LMB',
  'Ability 1': '1',
  'Ability 2': '2',
  'Ability 3': '3',
  'Ability 4': '4',
};

// Ability data is stored at 5 ranks; showing the max-rank (last index)
// numbers reads closest to "what this ability actually does at full build".
const MAX_RANK_IDX = 4;

function AbilityText({ text }: { text: string }) {
  const parts = splitHighlighted(text);
  return (
    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ss-text-secondary">
      {parts.map((p, i) =>
        p.highlight ? (
          <span key={i} className="font-semibold text-ss-cyan">
            {p.value}
          </span>
        ) : (
          <span key={i}>{p.value}</span>
        )
      )}
    </p>
  );
}

export function AbilitiesList({ abilities }: { abilities: GodAbility[] }) {
  const [activeId, setActiveId] = useState<string | null>(abilities[0]?.id ?? null);

  if (abilities.length === 0) {
    return (
      <p className="text-sm text-ss-text-muted">
        Sin datos de habilidades cargados para este dios todavía.
      </p>
    );
  }

  const active = abilities.find((a) => a.id === activeId) ?? abilities[0];
  const isUltimate = active.ability_type === 'Ability 4';
  const accent = TYPE_ACCENT[active.ability_type] ?? '#8b97a8';

  const levelStats = active.stats?.levelStats ?? {};
  const namedFormulas = active.stats?.namedFormulas ?? {};
  const namedValueScalings = active.stats?.namedValueScalings ?? {};
  const text = resolveAbilityText(active.description, levelStats, namedFormulas, namedValueScalings, MAX_RANK_IDX);
  const stats = displayStats(levelStats, MAX_RANK_IDX);

  return (
    <div className="flex flex-col gap-4">
      {/* Keybind strip - click an icon to switch the detail card below,
          same interaction pattern as the in-game ability bar. */}
      <div className="flex flex-wrap gap-2">
        {abilities.map((a) => {
          const isActive = a.id === active.id;
          const c = TYPE_ACCENT[a.ability_type] ?? '#8b97a8';
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => setActiveId(a.id)}
              title={a.name}
              className="group relative shrink-0 rounded-lg transition"
              style={{
                boxShadow: isActive ? `0 0 0 2px ${c}, 0 0 16px 0 ${c}66` : `0 0 0 1px var(--ss-line)`,
              }}
            >
              {a.icon_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- external CDN icon
                <img
                  src={a.icon_url}
                  alt={a.name}
                  className="h-14 w-14 rounded-lg object-cover transition group-hover:brightness-110"
                  style={{ opacity: isActive ? 1 : 0.55 }}
                />
              ) : (
                <div className="h-14 w-14 rounded-lg bg-ss-bg-raised" />
              )}
              <span
                className="absolute -bottom-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded px-1 font-display text-[10px] font-bold text-ss-bg"
                style={{ backgroundColor: c }}
              >
                {TYPE_KEY[a.ability_type] ?? '?'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Detail card for the selected ability. */}
      <div
        className="relative overflow-hidden rounded-xl border p-5 transition"
        style={{
          borderColor: isUltimate ? '#fb923c66' : 'var(--ss-line)',
          background: isUltimate
            ? 'linear-gradient(135deg, rgba(251,146,60,0.08), var(--ss-card) 60%)'
            : 'var(--ss-card)',
        }}
      >
        {isUltimate && (
          <span className="absolute right-4 top-4 rounded-full bg-ss-orange/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ss-orange">
            Ultimate
          </span>
        )}

        <div className="flex items-start gap-4">
          {active.icon_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- external CDN icon
            <img
              src={active.icon_url}
              alt={active.name}
              className="h-16 w-16 shrink-0 rounded-lg border object-cover"
              style={{ borderColor: `${accent}55` }}
            />
          ) : (
            <div className="h-16 w-16 shrink-0 rounded-lg border border-ss-line bg-ss-bg-raised" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-base font-bold text-ss-text">{active.name}</h3>
              <span
                className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                style={{ color: accent, backgroundColor: `${accent}1a` }}
              >
                {active.ability_type}
              </span>
            </div>
            <AbilityText text={text} />
          </div>
        </div>

        {stats.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-ss-line pt-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className="flex flex-col items-start rounded-lg border border-ss-line bg-ss-bg-raised px-2.5 py-1.5"
              >
                <span className="text-[10px] uppercase tracking-wide text-ss-text-muted">{s.label}</span>
                <span className="font-display text-sm font-bold" style={{ color: accent }}>
                  {s.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {active.notes && (
          <div className="mt-4 flex flex-col gap-1 border-t border-ss-line pt-4">
            {active.notes.split('\n').map((line, i) => (
              <p key={i} className="text-xs text-ss-text-muted">
                <span style={{ color: accent }}>•</span> {line.replace(/^•\s*/, '')}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
