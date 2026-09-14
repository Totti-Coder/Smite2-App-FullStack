import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { currentStreak, kdaTrend, overallStats, statsByMatchup, statsByRole, type MatchWithGod } from '@/lib/stats';
import type { DamageType } from '@/lib/supabase/database.types';
import { KdaTrendChart } from '@/components/dashboard/KdaTrendChart';
import { GodAvatar } from '@/components/GodAvatar';
import { GodPicker } from '@/components/GodPicker';
import { RoleMixBar } from '@/components/RoleMixBar';
import { AbilitiesList } from '@/components/AbilitiesList';
import { GodOrbitalBuild } from '@/components/gods/GodOrbitalBuild';
import { godModelPath } from '@/lib/god-models';
import { DAMAGE_TYPE_COLOR, DAMAGE_TYPE_LABEL, ROLE_LABEL } from '@/lib/god-assets';
import type { GodAbility, Role } from '@/lib/supabase/database.types';
import godsCatalog from '@/data/gods.json';

// Same reasoning as the /gods index: gods.json is the source of truth that
// scripts/seed-gods.ts loads into the `gods` table, and this page is public,
// so reading the file avoids depending on a table grant that signed-out
// visitors don't have. Abilities still come from the DB (god_abilities IS
// granted to anon, migration 0004) and personal matches obviously do too.
type CatalogGod = { id: string; name: string; pantheon: string; primary_role: string; damage_type: string; icon_url: string | null };
const allGods = godsCatalog as CatalogGod[];
const godById = new Map(allGods.map((g) => [g.id, g]));

export default async function GodDetailPage({ params }: { params: Promise<{ godId: string }> }) {
  const { godId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // God info/abilities are public reference data - browsable without an
  // account. Personal stats (the `matches` query) obviously aren't, so it's
  // just skipped entirely for a signed-out visitor rather than gating the
  // whole page like before.
  const god = godById.get(godId);
  if (!god) notFound();

  const [matchesResult, { data: abilitiesData }] = await Promise.all([
    user
      ? supabase
          .from('matches')
          .select('*, gods!god_id(name, primary_role, icon_url), enemy_god:gods!enemy_god_id(name, icon_url, primary_role)')
          .eq('user_id', user.id)
          .eq('god_id', godId)
          .order('played_at', { ascending: false })
      : Promise.resolve({ data: [] as MatchWithGod[] }),
    supabase.from('god_abilities').select('*').eq('god_id', godId).order('sort_order'),
  ]);

  const matches = (matchesResult.data ?? []) as unknown as MatchWithGod[];
  const overall = overallStats(matches);
  const streak = currentStreak(matches);
  const byRole = statsByRole(matches);
  const matchups = statsByMatchup(matches);
  const trend = kdaTrend([...matches].reverse());
  const accent = DAMAGE_TYPE_COLOR[god.damage_type as DamageType];
  const abilities = (abilitiesData ?? []) as GodAbility[];

  // The orbital view shows the build from the most recent match with this god.
  // `matches` is already ordered played_at desc, and is an empty array for a
  // signed-out visitor - so this is null for them and the orbit falls back to
  // empty slots, which is the same thing it does for a signed-in player who
  // simply hasn't recorded a game yet.
  const modelSrc = godModelPath(god.id);
  const lastMatch = matches[0] ?? null;
  const lastBuild = lastMatch?.items ?? null;

  return (
    <main id="contenido" tabIndex={-1} className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-6">
        <Link href="/" className="text-xs text-ss-text-muted hover:text-ss-text">← Volver al dashboard</Link>
      </div>

      {/* Hero */}
      <div
        className="mb-8 flex flex-wrap items-center justify-between gap-6 rounded-xl border border-ss-line bg-ss-card p-6"
        style={{ borderLeft: `4px solid ${accent}` }}
      >
        <div className="flex items-center gap-5">
          <GodAvatar iconUrl={god.icon_url} name={god.name} size={100} />
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
              <span style={{ color: accent }}>{DAMAGE_TYPE_LABEL[god.damage_type as DamageType]}</span>
              <span className="text-ss-text-muted">·</span>
              <span className="text-ss-text-secondary">{ROLE_LABEL[god.primary_role as Role]}</span>
              <span className="text-ss-text-muted">·</span>
              <span className="text-ss-text-muted">{god.pantheon}</span>
            </div>
            <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-ss-text">{god.name}</h1>
          </div>
        </div>

        {user ? (
          <div className="flex items-center gap-8">
            <div className="text-center">
              <p className="font-display text-3xl font-bold text-ss-win">{overall.winratePct}%</p>
              <p className="text-xs uppercase tracking-wide text-ss-text-muted">Win rate</p>
            </div>
            <div className="text-center">
              <p className="font-display text-3xl font-bold text-ss-cyan">{overall.kda.toFixed(2)}</p>
              <p className="text-xs uppercase tracking-wide text-ss-text-muted">KDA</p>
            </div>
            <div className="text-center">
              <p className="font-display text-3xl font-bold text-ss-text">{overall.totalMatches}</p>
              <p className="text-xs uppercase tracking-wide text-ss-text-muted">Partidas</p>
            </div>
          </div>
        ) : (
          <Link
            href="/login"
            className="rounded-md border border-ss-cyan/40 bg-ss-cyan/10 px-4 py-2 text-sm font-semibold text-ss-cyan transition hover:bg-ss-cyan/20"
          >
            Inicia sesión para ver tu winrate →
          </Link>
        )}
      </div>

      <div className="mb-6 flex justify-end">
        <GodPicker gods={allGods ?? []} currentGodId={god.id} />
      </div>

      {/* Only for gods that actually ship a model (see lib/god-models.ts) -
          every other god page renders exactly as before and downloads none of
          the three.js/r3f bundle. */}
      {modelSrc && (
        <div className="mb-8">
          <GodOrbitalBuild
            godName={god.name}
            accent={accent}
            modelSrc={modelSrc}
            buildItems={lastBuild}
            playedAt={lastMatch?.played_at ?? null}
          />
        </div>
      )}

      <div className="mb-8 rounded-xl border border-ss-line bg-ss-card p-5">
        <h2 className="mb-1 font-display text-sm font-semibold uppercase tracking-wide text-ss-text-secondary">Habilidades</h2>
        <p className="mb-2 text-xs text-ss-text-muted">Escalado a nivel máximo</p>
        <AbilitiesList abilities={abilities} />
      </div>

      {!user ? (
        <div className="rounded-xl border border-ss-line bg-ss-card p-8 text-center">
          <p className="text-sm text-ss-text-muted">Inicia sesión para ver tu winrate, builds e historial con {god.name}.</p>
          <Link href="/login" className="mt-3 inline-block rounded-md bg-ss-cyan px-3 py-1.5 text-sm font-semibold text-ss-bg hover:brightness-110">
            Iniciar sesión
          </Link>
        </div>
      ) : matches.length === 0 ? (
        <div className="rounded-xl border border-ss-line bg-ss-card p-8 text-center">
          <p className="text-sm text-ss-text-muted">Todavía no cargaste partidas con {god.name}.</p>
          <Link href="/matches/new" className="mt-3 inline-block rounded-md bg-ss-cyan px-3 py-1.5 text-sm font-semibold text-ss-bg hover:brightness-110">
            + Cargar partida
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-8 rounded-xl border border-ss-line bg-ss-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ss-text-secondary">Rendimiento</h2>
                <p className="text-xs text-ss-text-muted">{overall.wins}W · {overall.losses}L</p>
              </div>
              {streak.type && (
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${streak.type === 'win' ? 'bg-ss-win/10 text-ss-win' : 'bg-ss-loss/10 text-ss-loss'}`}>
                  Racha: {streak.count} {streak.type === 'win' ? 'ganadas' : 'perdidas'}
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-4 border-t border-ss-line pt-4 text-center">
              <div>
                <p className="font-display text-lg font-bold text-ss-text">{overall.avgKills.toFixed(1)}</p>
                <p className="text-xs text-ss-text-muted">Kills prom.</p>
              </div>
              <div>
                <p className="font-display text-lg font-bold text-ss-text">{overall.avgDeaths.toFixed(1)}</p>
                <p className="text-xs text-ss-text-muted">Deaths prom.</p>
              </div>
              <div>
                <p className="font-display text-lg font-bold text-ss-text">{overall.avgAssists.toFixed(1)}</p>
                <p className="text-xs text-ss-text-muted">Assists prom.</p>
              </div>
            </div>

            {(overall.avgGoldPerMin || overall.avgDamageToPlayers || overall.avgDamageTaken || overall.avgDamageMitigated || overall.avgWardsPlaced) && (
              <div className="grid grid-cols-2 gap-4 border-t border-ss-line pt-4 text-center sm:grid-cols-5">
                {overall.avgGoldPerMin != null && (
                  <div>
                    <p className="font-display text-sm font-bold text-ss-text">{Math.round(overall.avgGoldPerMin)}</p>
                    <p className="text-xs text-ss-text-muted">Oro/min prom.</p>
                  </div>
                )}
                {overall.avgDamageToPlayers != null && (
                  <div>
                    <p className="font-display text-sm font-bold text-ss-text">{Math.round(overall.avgDamageToPlayers).toLocaleString('es-ES')}</p>
                    <p className="text-xs text-ss-text-muted">Daño a jugador</p>
                  </div>
                )}
                {overall.avgDamageTaken != null && (
                  <div>
                    <p className="font-display text-sm font-bold text-ss-text">{Math.round(overall.avgDamageTaken).toLocaleString('es-ES')}</p>
                    <p className="text-xs text-ss-text-muted">Daño recibido</p>
                  </div>
                )}
                {overall.avgDamageMitigated != null && (
                  <div>
                    <p className="font-display text-sm font-bold text-ss-text">{Math.round(overall.avgDamageMitigated).toLocaleString('es-ES')}</p>
                    <p className="text-xs text-ss-text-muted">Daño mitigado</p>
                  </div>
                )}
                {overall.avgWardsPlaced != null && (
                  <div>
                    <p className="font-display text-sm font-bold text-ss-text">{overall.avgWardsPlaced.toFixed(1)}</p>
                    <p className="text-xs text-ss-text-muted">Centinelas prom.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {matches[0]?.items && matches[0].items.length > 0 && (
            <div className="mb-8 rounded-xl border border-ss-line bg-ss-card p-5">
              <h2 className="mb-1 font-display text-sm font-semibold uppercase tracking-wide text-ss-text-secondary">Última build</h2>
              <p className="mb-3 text-xs text-ss-text-muted">
                {new Date(matches[0].played_at).toLocaleDateString('es-ES')} · {matches[0].result === 'win' ? 'Victoria' : 'Derrota'}
              </p>
              <div className="flex flex-wrap gap-2">
                {matches[0].items.map((item, i) => (
                  <Link
                    key={i}
                    href={`/items?q=${encodeURIComponent(item)}`}
                    className="rounded-md border border-ss-line bg-ss-bg-raised px-2.5 py-1 text-xs text-ss-text-secondary transition hover:border-ss-cyan hover:text-ss-text"
                  >
                    {item}
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="mb-8 rounded-xl border border-ss-line bg-ss-card p-4">
            <h2 className="mb-4 font-display text-sm font-semibold uppercase tracking-wide text-ss-text-secondary">Tendencia de KDA</h2>
            <KdaTrendChart data={trend} />
          </div>

          {byRole.length > 1 && (
            <div className="mb-8 rounded-xl border border-ss-line bg-ss-card p-5">
              <h2 className="mb-4 font-display text-sm font-semibold uppercase tracking-wide text-ss-text-secondary">Role mix</h2>
              <RoleMixBar byRole={byRole} />
            </div>
          )}

          {matchups.length > 0 && (
            <div className="mb-8 rounded-xl border border-ss-line bg-ss-card p-5">
              <h2 className="mb-1 font-display text-sm font-semibold uppercase tracking-wide text-ss-text-secondary">Matchups</h2>
              <p className="mb-3 text-xs text-ss-text-muted">Contra qué dios rival te va peor/mejor con {god.name}</p>
              <div className="flex flex-col divide-y divide-ss-line">
                {matchups.map((mu) => (
                  <Link
                    key={mu.enemyGodId}
                    href={`/gods/${mu.enemyGodId}`}
                    className="flex items-center gap-3 py-2.5 text-sm transition hover:bg-ss-bg-raised/40"
                  >
                    <GodAvatar iconUrl={mu.iconUrl} name={mu.name} size={32} />
                    <span className="flex-1 text-ss-text">
                      vs {mu.name}
                      {mu.role && <span className="ml-1 text-xs text-ss-text-muted">({ROLE_LABEL[mu.role as Role] ?? mu.role})</span>}
                    </span>
                    <span className={`font-display font-bold ${mu.winratePct >= 50 ? 'text-ss-win' : 'text-ss-loss'}`}>
                      {mu.winratePct}%
                    </span>
                    <span className="w-20 text-right text-xs text-ss-text-muted">{mu.games} partidas</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-ss-line bg-ss-card p-4">
            <h2 className="mb-4 font-display text-sm font-semibold uppercase tracking-wide text-ss-text-secondary">Historial</h2>
            <div className="flex flex-col divide-y divide-ss-line">
              {matches.map((m) => (
                <div key={m.id} className="py-2.5 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="w-16 text-ss-text-muted">{ROLE_LABEL[m.role_played]}</span>
                    <span className="text-ss-text-muted">{m.kills}/{m.deaths}/{m.assists}</span>
                    {m.enemy_god && (
                      <span className="text-xs text-ss-text-muted">vs {m.enemy_god.name}</span>
                    )}
                    <span className={`flex-1 text-right font-semibold ${m.result === 'win' ? 'text-ss-win' : 'text-ss-loss'}`}>
                      {m.result === 'win' ? 'Victoria' : 'Derrota'}
                    </span>
                    <span className="w-20 text-right text-ss-text-muted">{new Date(m.played_at).toLocaleDateString('es-ES')}</span>
                  </div>
                  {m.items && m.items.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {m.items.map((item, i) => (
                        <Link
                          key={i}
                          href={`/items?q=${encodeURIComponent(item)}`}
                          className="rounded border border-ss-line bg-ss-bg-raised px-1.5 py-0.5 text-[11px] text-ss-text-muted transition hover:border-ss-cyan hover:text-ss-text"
                        >
                          {item}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
