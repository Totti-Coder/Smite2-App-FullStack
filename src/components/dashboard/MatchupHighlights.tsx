import Link from 'next/link';
import { GodAvatar } from '@/components/GodAvatar';
import { ROLE_LABEL } from '@/lib/god-assets';
import type { Role } from '@/lib/supabase/database.types';

type Matchup = { enemyGodId: string; name: string; iconUrl: string | null; role: string | null; games: number; wins: number; winratePct: number };

function MatchupList({ title, accent, rows }: { title: string; accent: string; rows: Matchup[] }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: accent }}>
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="text-xs text-ss-text-muted">Sin datos todavía.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {rows.map((r) => (
            <Link
              key={r.enemyGodId}
              href={`/gods/${r.enemyGodId}`}
              className="flex items-center gap-2 rounded-md px-1 py-1 transition hover:bg-ss-bg-raised/60"
            >
              <GodAvatar iconUrl={r.iconUrl} name={r.name} size={28} />
              <span className="flex-1 text-sm text-ss-text">
                {r.name}
                {r.role && <span className="ml-1 text-[10px] text-ss-text-muted">({ROLE_LABEL[r.role as Role] ?? r.role})</span>}
              </span>
              <span className="font-display text-sm font-bold" style={{ color: accent }}>
                {r.winratePct}%
              </span>
              <span className="w-16 text-right text-xs text-ss-text-muted">{r.games}p</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function MatchupHighlights({ matchups }: { matchups: Matchup[] }) {
  const withGames = matchups.filter((m) => m.games > 0);
  const worst = [...withGames].sort((a, b) => a.winratePct - b.winratePct).slice(0, 3);
  const best = [...withGames].sort((a, b) => b.winratePct - a.winratePct).slice(0, 3);

  return (
    <div className="rounded-xl border border-ss-line bg-ss-card p-4">
      <h2 className="mb-4 font-display text-sm font-semibold uppercase tracking-wide text-ss-text-secondary">
        Matchups (todos tus dioses)
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MatchupList title="Te cuestan más" accent="#fb3b5c" rows={worst} />
        <MatchupList title="Te salen mejor" accent="#34d399" rows={best} />
      </div>
    </div>
  );
}
