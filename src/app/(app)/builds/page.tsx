import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { mostUsedItems, type MatchWithGod } from '@/lib/stats';
import { patchForDate, currentPatch, type Patch } from '@/lib/patches';
import { GodAvatar } from '@/components/GodAvatar';
import { ItemIcon } from '@/components/ItemIcon';
import { roleIconUrl, ROLE_LABEL } from '@/lib/god-assets';
import { relativeTime } from '@/lib/relative-time';
import type { Role } from '@/lib/supabase/database.types';

export const metadata: Metadata = { title: 'Builds' };

const MAX_PATCH_GROUPS = 6;

export default async function BuildsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('matches')
    .select('*, gods!god_id(name, primary_role, icon_url)')
    .eq('user_id', user.id)
    .order('played_at', { ascending: false });

  const matches = (data ?? []) as unknown as MatchWithGod[];
  const withItems = matches.filter((m) => m.items && m.items.length > 0);
  const topItems = mostUsedItems(matches).slice(0, 16);

  // Grouped by patch (OB##) instead of a flat "last N" - matches (already
  // sorted newest-first by the query) fall into the patch active when they
  // were played, per src/lib/patches.ts's manually-maintained calendar.
  const groupsByPatchId = new Map<string, { patch: Patch | null; matches: MatchWithGod[] }>();
  for (const m of withItems) {
    const patch = patchForDate(m.played_at);
    const key = patch?.id ?? 'sin-parche';
    const entry = groupsByPatchId.get(key) ?? { patch, matches: [] };
    entry.matches.push(m);
    groupsByPatchId.set(key, entry);
  }
  const patchGroups = Array.from(groupsByPatchId.values())
    .sort((a, b) => {
      const ta = a.patch ? new Date(a.patch.startDate).getTime() : -Infinity;
      const tb = b.patch ? new Date(b.patch.startDate).getTime() : -Infinity;
      return tb - ta;
    })
    .slice(0, MAX_PATCH_GROUPS);
  const activePatchId = currentPatch()?.id;

  return (
    <main id="contenido" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-1 font-display text-2xl font-bold text-ss-text">Builds</h1>
      <p className="mb-8 text-sm text-ss-text-muted">
        {withItems.length} partidas con build registrada de {matches.length} en total.
      </p>

      <section className="mb-10 glass-panel rounded-2xl p-5" style={{ borderTop: '3px solid #fb923c' }}>
        <h2 className="mb-4 font-display text-sm font-semibold uppercase tracking-wide text-ss-text-secondary">Items más usados</h2>
        {topItems.length === 0 ? (
          <p className="text-sm text-ss-text-muted">Todavía no cargaste ninguna build.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {topItems.map((it) => (
              <div key={it.name} className="flex flex-col items-center gap-1.5 rounded-lg border border-ss-line bg-ss-bg-raised/60 p-3 text-center">
                <ItemIcon name={it.name} size={40} games={it.games} winratePct={it.winratePct} />
                <p className="line-clamp-2 text-[11px] leading-tight text-ss-text-secondary">{it.name}</p>
                <p className="text-[10px] text-ss-text-muted">
                  {it.games}x · <span className={it.winratePct >= 50 ? 'text-ss-win' : 'text-ss-loss'}>{it.winratePct}%</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {patchGroups.length === 0 ? (
        <section className="glass-panel rounded-2xl p-5" style={{ borderTop: '3px solid #16c8d4' }}>
          <h2 className="mb-1 font-display text-sm font-semibold uppercase tracking-wide text-ss-text-secondary">Builds por parche</h2>
          <p className="text-sm text-ss-text-muted">Carga una partida con build para verla aquí.</p>
        </section>
      ) : (
        <div className="flex flex-col gap-8">
          {patchGroups.map(({ patch, matches: patchMatches }) => {
            const isActive = patch != null && patch.id === activePatchId;
            return (
              <section key={patch?.id ?? 'sin-parche'} className="glass-panel rounded-2xl p-5" style={{ borderTop: `3px solid ${isActive ? '#34d399' : '#16c8d4'}` }}>
                <div className="mb-4 flex items-center gap-2">
                  <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ss-text-secondary">
                    {patch ? patch.label : 'Antes de OB33'}
                  </h2>
                  {isActive && (
                    <span className="rounded-full bg-ss-win/15 px-2 py-0.5 text-[10px] font-semibold text-ss-win">Parche actual</span>
                  )}
                  {patch && <span className="text-xs text-ss-text-muted">desde {new Date(patch.startDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>}
                </div>

                <div className="flex flex-col divide-y divide-ss-line">
                  {patchMatches.map((m) => {
                    const godName = m.gods?.name ?? m.god_id;
                    return (
                      <div key={m.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <Link href={`/gods/${m.god_id}`} className="flex items-center gap-3 transition hover:opacity-80">
                          <GodAvatar iconUrl={m.gods?.icon_url ?? null} name={godName} size={40} />
                          <div>
                            <p className="font-display text-sm font-bold text-ss-text">{godName}</p>
                            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ss-text-muted">
                              {/* eslint-disable-next-line @next/next/no-img-element -- external CDN icon */}
                              <img src={roleIconUrl(m.role_played as Role)} alt="" className="h-3.5 w-3.5" />
                              {ROLE_LABEL[m.role_played]}
                              <span>· {relativeTime(m.played_at)}</span>
                              <span className={m.result === 'win' ? 'text-ss-win' : 'text-ss-loss'}>
                                {m.result === 'win' ? 'Victoria' : 'Derrota'}
                              </span>
                            </div>
                          </div>
                        </Link>

                        <div className="flex flex-wrap gap-1.5 sm:justify-end">
                          {m.items!.map((item, i) => (
                            <ItemIcon key={i} name={item} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
