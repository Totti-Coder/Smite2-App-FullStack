import Link from 'next/link';
import { GodAvatar } from '@/components/GodAvatar';

type GodStat = { godId: string; name: string; iconUrl: string | null; games: number; wins: number; winratePct: number };

export function GodLeaderboard({ byGod }: { byGod: GodStat[] }) {
  const ranked = [...byGod].sort((a, b) => b.winratePct - a.winratePct || b.games - a.games);

  return (
    <div className="rounded-xl border border-ss-line bg-ss-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ss-text-secondary">
          ⭐ Top dioses
        </h2>
      </div>

      {ranked.length === 0 ? (
        <p className="text-sm text-ss-text-muted">Sin partidas todavía.</p>
      ) : (
        <div className="flex flex-col divide-y divide-ss-line">
          {ranked.slice(0, 10).map((g, i) => (
            <Link
              key={g.godId}
              href={`/gods/${g.godId}`}
              className="flex items-center gap-3 py-2.5 transition hover:bg-ss-bg-raised/40"
            >
              <span className="w-4 text-xs font-semibold text-ss-text-muted">{i + 1}</span>
              <GodAvatar iconUrl={g.iconUrl} name={g.name} size={32} />
              <span className="flex-1 truncate text-sm text-ss-text">{g.name}</span>
              <div className="text-right">
                <p className={`font-display text-sm font-bold ${g.winratePct >= 50 ? 'text-ss-win' : 'text-ss-loss'}`}>
                  {g.winratePct}%
                </p>
                <p className="text-[11px] text-ss-text-muted">{g.games}p</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
