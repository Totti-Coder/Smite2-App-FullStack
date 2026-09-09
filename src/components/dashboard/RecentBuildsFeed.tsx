import Link from 'next/link';
import { GodAvatar } from '@/components/GodAvatar';
import { ItemIcon } from '@/components/ItemIcon';
import { roleIconUrl, ROLE_LABEL } from '@/lib/god-assets';
import { relativeTime } from '@/lib/relative-time';
import type { MatchWithGod } from '@/lib/stats';
import type { Role } from '@/lib/supabase/database.types';

export function RecentBuildsFeed({ matches }: { matches: MatchWithGod[] }) {
  if (matches.length === 0) {
    return <p className="py-4 text-sm text-ss-text-muted">Carga tu primera partida.</p>;
  }

  return (
    <div className="flex flex-col divide-y divide-ss-line">
      {matches.map((m) => {
        const godName = m.gods?.name ?? m.god_id;
        const kda = m.deaths === 0 ? m.kills + m.assists : (m.kills + m.assists) / m.deaths;

        return (
          // Deliberately just flex-col with two independent full-width rows
          // (not a single "sm:flex-row" row relying on a basis-full item to
          // wrap onto its own line) - that only works with flex-wrap on the
          // parent, which this never had, so items/badges could get forced
          // onto the same cramped line as the god info in any panel narrower
          // than expected (a bento-grid cell doesn't get to just assume
          // "sm: means room enough" the way a full-page column would).
          <div key={m.id} className="flex flex-col gap-3 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link href={`/gods/${m.god_id}`} className="flex min-w-0 items-center gap-3 rounded-md transition hover:opacity-80">
                <GodAvatar iconUrl={m.gods?.icon_url ?? null} name={godName} size={44} />
                <div className="min-w-0">
                  <p className="truncate font-display text-sm font-bold text-ss-text">
                    {ROLE_LABEL[m.role_played]} {godName}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ss-text-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element -- external CDN icon */}
                    <img src={roleIconUrl(m.role_played as Role)} alt="" className="h-3.5 w-3.5 shrink-0" />
                    {m.rank_tier && (
                      <span className="rounded bg-ss-bg-raised px-1.5 py-0.5 text-[11px] font-medium text-ss-cyan">
                        {m.rank_tier}
                      </span>
                    )}
                    <span className="whitespace-nowrap">{relativeTime(m.played_at)}</span>
                  </div>
                </div>
              </Link>

              <div className="flex flex-wrap items-center gap-3">
                <div className="text-right">
                  <p className={`font-display text-lg font-bold whitespace-nowrap ${m.result === 'win' ? 'text-ss-win' : 'text-ss-loss'}`}>
                    {m.result === 'win' ? 'Victoria' : 'Derrota'}
                  </p>
                  <p className="text-xs whitespace-nowrap text-ss-text-muted">
                    {m.kills}/{m.deaths}/{m.assists} · {kda.toFixed(1)} KDA
                  </p>
                </div>
                {m.gold_per_min != null && (
                  <span className="whitespace-nowrap rounded-md border border-ss-line bg-ss-bg-raised px-2.5 py-1 text-xs font-semibold text-ss-orange">
                    🪙 {m.gold_per_min}/min
                  </span>
                )}
              </div>
            </div>

            {m.items && m.items.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {m.items.map((item, i) => (
                  <ItemIcon key={i} name={item} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
