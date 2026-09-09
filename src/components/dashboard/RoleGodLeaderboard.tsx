import Link from 'next/link';
import { GodAvatar } from '@/components/GodAvatar';
import { roleIconUrl, ROLE_LABEL } from '@/lib/god-assets';
import type { Role } from '@/lib/supabase/database.types';
import type { GodRoleStat } from '@/lib/stats';

type Row = { role: string; best: GodRoleStat | null; worst: GodRoleStat | null };

export function RoleGodLeaderboard({ rows }: { rows: Row[] }) {
  const withData = rows.filter((r) => r.best);
  if (withData.length === 0) {
    return <p className="text-sm text-ss-text-muted">Carga partidas de al menos 2 dioses en el mismo rol para ver esto.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {withData.map(({ role, best, worst }) => (
        <div key={role} className="rounded-lg border border-ss-line bg-ss-bg-raised p-3">
          <div className="mb-2 flex items-center gap-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element -- external CDN icon */}
            <img src={roleIconUrl(role as Role)} alt="" className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide text-ss-text-muted">{ROLE_LABEL[role as Role] ?? role}</span>
          </div>

          {best && (
            <Link href={`/gods/${best.godId}`} className="flex items-center gap-2 rounded-md py-1 transition hover:bg-ss-card">
              <GodAvatar iconUrl={best.iconUrl} name={best.name} size={28} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ss-text">{best.name}</p>
                <p className="text-[10px] text-ss-text-muted">{best.games} partidas</p>
              </div>
              <span className="font-display text-sm font-bold text-ss-win">{best.winratePct}%</span>
            </Link>
          )}

          {worst && (
            <Link href={`/gods/${worst.godId}`} className="flex items-center gap-2 rounded-md py-1 transition hover:bg-ss-card">
              <GodAvatar iconUrl={worst.iconUrl} name={worst.name} size={28} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ss-text">{worst.name}</p>
                <p className="text-[10px] text-ss-text-muted">{worst.games} partidas</p>
              </div>
              <span className="font-display text-sm font-bold text-ss-loss">{worst.winratePct}%</span>
            </Link>
          )}

          {!worst && (
            <p className="mt-1 text-[10px] text-ss-text-muted">Único dios jugado en este rol (con suficientes partidas).</p>
          )}
        </div>
      ))}
    </div>
  );
}
