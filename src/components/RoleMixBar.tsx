import Link from 'next/link';
import { ROLE_COLOR, ROLE_LABEL, roleIconUrl } from '@/lib/god-assets';
import type { Role } from '@/lib/supabase/database.types';

type RoleStat = { role: string; games: number; wins: number; winratePct: number };

export function RoleMixBar({ byRole }: { byRole: RoleStat[] }) {
  const total = byRole.reduce((sum, r) => sum + r.games, 0);
  if (total === 0) return null;

  const sorted = [...byRole].sort((a, b) => b.games - a.games);

  return (
    <div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-ss-bg-raised">
        {sorted.map((r) => (
          <div
            key={r.role}
            style={{ width: `${(r.games / total) * 100}%`, backgroundColor: ROLE_COLOR[r.role as Role] }}
          />
        ))}
      </div>

      <div className="mt-4 flex flex-col divide-y divide-ss-line">
        {sorted.map((r) => (
          <Link
            key={r.role}
            href={`/gods?role=${r.role}`}
            className="flex items-center gap-3 py-2.5 text-sm transition hover:bg-ss-bg-raised/40"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- external CDN icon */}
            <img src={roleIconUrl(r.role as Role)} alt="" className="h-5 w-5 shrink-0" />
            <span className="flex-1 text-ss-text">{ROLE_LABEL[r.role as Role] ?? r.role}</span>
            <span className="w-14 text-right font-display font-semibold text-ss-cyan">
              {Math.round((r.games / total) * 100)}%
            </span>
            <span className={`w-16 text-right font-display font-semibold ${r.winratePct >= 50 ? 'text-ss-win' : 'text-ss-loss'}`}>
              {r.winratePct}% WR
            </span>
            <span className="w-20 text-right text-xs text-ss-text-muted">{r.games} partidas</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
