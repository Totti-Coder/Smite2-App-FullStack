import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { bestWorstByRole, currentStreak, kdaTrend, overallStats, statsByGameMode, statsByGod, statsByGodRole, statsByMatchup, statsByParticipant, statsByRole, type MatchWithGod } from '@/lib/stats';
import { StatCard } from '@/components/dashboard/StatCard';
import { KdaTrendChart } from '@/components/dashboard/KdaTrendChart';
import { WinLossDonut } from '@/components/dashboard/WinLossDonut';
import { GameModePieChart } from '@/components/dashboard/GameModePieChart';
import { RoleWinrateBarChart } from '@/components/dashboard/RoleWinrateBarChart';
import { RecentBuildsFeed } from '@/components/dashboard/RecentBuildsFeed';
import { GodLeaderboard } from '@/components/dashboard/GodLeaderboard';
import { MatchupHighlights } from '@/components/dashboard/MatchupHighlights';
import { RoleGodLeaderboard } from '@/components/dashboard/RoleGodLeaderboard';
import { AllyEnemyCharts } from '@/components/dashboard/AllyEnemyCharts';
import { SavedToast } from '@/components/dashboard/SavedToast';
import { Panel } from '@/components/dashboard/Panel';
import { PlayerCountChart } from '@/components/dashboard/PlayerCountChart';
import { getPlayerCountHistory } from '@/lib/steam-player-count';
import { Reveal } from '@/components/motion/Reveal';
import { Spotlight } from '@/components/motion/Spotlight';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already gates unauthenticated requests, this is a defense-in-depth check.
  if (!user) {
    return null;
  }

  const { data } = await supabase
    .from('matches')
    .select(
      '*, gods!god_id(name, primary_role, icon_url), enemy_god:gods!enemy_god_id(name, icon_url, primary_role), match_participants(side, god_id, role, gods(name, icon_url))'
    )
    .eq('user_id', user.id)
    .order('played_at', { ascending: false });

  const matches = (data ?? []) as unknown as MatchWithGod[];

  const overall = overallStats(matches);
  const streak = currentStreak(matches);
  const byGod = statsByGod(matches);
  const byRole = statsByRole(matches);
  const byGameMode = statsByGameMode(matches);
  const matchups = statsByMatchup(matches);
  const roleLeaders = bestWorstByRole(statsByGodRole(matches), ['solo', 'jungle', 'mid', 'adc', 'support']);
  const allyStats = statsByParticipant(matches, 'ally');
  const enemyStats = statsByParticipant(matches, 'enemy');
  const trend = kdaTrend([...matches].reverse());
  // Not personal data at all (global Steam concurrent-player count) - fine
  // to fetch after everything else, it never blocks on the user's own rows.
  const playerCountHistory = await getPlayerCountHistory(supabase);

  return (
    <main id="contenido" tabIndex={-1} className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="sr-only">Dashboard de Smite 2 Tracker</h1>
      <Suspense fallback={null}>
        <SavedToast />
      </Suspense>

      <Spotlight
        className="mb-8 flex flex-col items-start gap-4 rounded-2xl border border-ss-line bg-ss-card p-6 sm:flex-row sm:items-center sm:justify-between"
        style={{ borderLeft: '4px solid #16c8d4' }}
      >
        <div>
          <p className="font-display text-3xl font-bold text-ss-text">Tu dashboard</p>
          <p className="mt-1 text-sm text-ss-text-muted">{user.email}</p>
          {overall.totalMatches === 0 ? (
            <p className="mt-2 text-sm text-ss-text-secondary">Todavía no has cargado ninguna partida. Empieza ahora.</p>
          ) : (
            <p className="mt-2 text-sm text-ss-text-secondary">
              {overall.totalMatches} partidas registradas · {overall.winratePct}% winrate
            </p>
          )}
        </div>
        <Link
          href="/matches/new"
          className="w-full shrink-0 rounded-md bg-ss-cyan px-6 py-3 text-center text-sm font-semibold text-ss-bg transition duration-200 hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_10px_30px_-10px_var(--ss-cyan)] sm:w-auto"
        >
          + Registrar partida
        </Link>
      </Spotlight>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Winrate" value={`${overall.winratePct}%`} sub={`${overall.wins}W / ${overall.losses}L`} accent="win" />
        <StatCard label="KDA" value={overall.kda.toFixed(2)} sub={`${overall.avgKills.toFixed(1)}/${overall.avgDeaths.toFixed(1)}/${overall.avgAssists.toFixed(1)}`} accent="cyan" />
        <StatCard label="Partidas" value={String(overall.totalMatches)} />
        <StatCard
          label="Racha"
          value={streak.type ? `${streak.count} ${streak.type === 'win' ? 'W' : 'L'}` : '-'}
          sub={streak.type === 'win' ? 'ganando' : streak.type === 'loss' ? 'perdiendo' : undefined}
          accent={streak.type === 'win' ? 'win' : streak.type === 'loss' ? 'loss' : undefined}
        />
      </div>

      {/* Bento grid: the two circular charts (winrate donut, modo de juego) and
          the role winrate bar chart stay front and center - that's the core
          Smite 2 stat trio - with the KDA trend given the most real estate
          since it's the one you actually watch move over time. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Reveal className="lg:col-span-8">
          <Panel id="panel-kda" title="Tendencia de KDA" subtitle="Últimas partidas, en orden" accent="#16c8d4" className="h-full">
            <KdaTrendChart data={trend} />
          </Panel>
        </Reveal>

        <Reveal delay={0.05} className="lg:col-span-4">
          <Panel id="panel-winloss" title="Victorias / Derrotas" accent="#34d399" className="h-full">
            <WinLossDonut wins={overall.wins} losses={overall.losses} />
          </Panel>
        </Reveal>

        <Reveal delay={0.1} className="lg:col-span-6">
          <Panel id="panel-role" title="Winrate por rol" accent="#a78bfa" className="h-full">
            <RoleWinrateBarChart data={byRole} />
          </Panel>
        </Reveal>

        <Reveal delay={0.15} className="lg:col-span-6">
          <Panel id="panel-mode" title="Partidas por modo de juego" accent="#fb923c" className="h-full">
            <GameModePieChart data={byGameMode} />
          </Panel>
        </Reveal>

        <Reveal delay={0.18} className="lg:col-span-12">
          <Panel id="panel-role-leaders" title="Mejor y peor dios por rol" subtitle="Winrate por rol jugado, mínimo 2 partidas" accent="#34d399">
            <RoleGodLeaderboard rows={roleLeaders} />
          </Panel>
        </Reveal>

        <Reveal delay={0.2} className="lg:col-span-12">
          <MatchupHighlights matchups={matchups} />
        </Reveal>

        <Reveal delay={0.22} className="lg:col-span-12">
          <Panel id="panel-ally-enemy" title="Aliados y enemigos" subtitle="Con quién ganas más, contra quién pierdes más - de todo el marcador, no solo tu carril" accent="#a78bfa">
            <AllyEnemyCharts allies={allyStats} enemies={enemyStats} />
          </Panel>
        </Reveal>

        <Reveal delay={0.25} className="lg:col-span-8">
          <Panel
            id="panel-recent"
            title="Partidas recientes"
            subtitle="Tus últimas partidas y builds"
            accent="#16c8d4"
            className="h-full"
            action={
              <Link href="/partidas" className="group flex items-center gap-1 text-xs text-ss-cyan hover:underline">
                Ver todas <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
              </Link>
            }
          >
            <RecentBuildsFeed matches={matches.slice(0, 10)} />
          </Panel>
        </Reveal>

        <Reveal delay={0.3} className="lg:col-span-4">
          <GodLeaderboard byGod={byGod} />
        </Reveal>

        <Reveal delay={0.32} className="lg:col-span-12">
          <Panel
            id="panel-player-count"
            title="Jugadores de Smite 2 en Steam"
            subtitle="Últimas 24 horas - se va actualizando solo con cada visita al dashboard"
            accent="#16c8d4"
          >
            <PlayerCountChart data={playerCountHistory} />
          </Panel>
        </Reveal>
      </div>
    </main>
  );
}
