'use client';

import Link from 'next/link';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { GodAvatar } from '@/components/GodAvatar';
import type { ParticipantGodStat } from '@/lib/stats';

// A fixed, visually distinct palette cycled across whichever gods show up
// most - there's no fixed "this god = this color" mapping like role/damage
// type has, so this just needs enough contrast between adjacent slices.
const PALETTE = ['#16c8d4', '#a78bfa', '#fb923c', '#34d399', '#fb3b5c', '#60a5fa', '#f472b6', '#facc15'];

function FrequencyPie({ data }: { data: ParticipantGodStat[] }) {
  const top = data.slice(0, 8);
  if (top.length === 0) return <p className="text-sm text-ss-text-muted">Sin datos todavía.</p>;

  const chartData = top.map((g, i) => ({ name: g.name, value: g.games, winratePct: g.winratePct, color: PALETTE[i % PALETTE.length] }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2} stroke="none">
          {chartData.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ background: '#11161f', border: '1px solid #212631', borderRadius: 8 }}
          labelStyle={{ color: '#e8edf4' }}
          formatter={(value, _name, item) => [`${value} partidas · ${item.payload.winratePct}% WR`, item.payload.name]}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

function WinrateList({ data, accent }: { data: ParticipantGodStat[]; accent: string }) {
  const withGames = data.filter((g) => g.games >= 2);
  const best = [...withGames].sort((a, b) => b.winratePct - a.winratePct).slice(0, 3);
  const worst = [...withGames].sort((a, b) => a.winratePct - b.winratePct).slice(0, 3);

  if (withGames.length === 0) return null;

  return (
    <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
      <div>
        <p className="mb-1 font-semibold text-ss-win">Mejor winrate</p>
        {best.map((g) => (
          <Link key={g.godId} href={`/gods/${g.godId}`} className="flex items-center gap-1.5 rounded py-1 hover:bg-ss-bg-raised/60">
            <GodAvatar iconUrl={g.iconUrl} name={g.name} size={20} />
            <span className="flex-1 truncate text-ss-text-secondary">{g.name}</span>
            <span className="font-semibold text-ss-win">{g.winratePct}%</span>
          </Link>
        ))}
      </div>
      <div>
        <p className="mb-1 font-semibold text-ss-loss">Peor winrate</p>
        {worst.map((g) => (
          <Link key={g.godId} href={`/gods/${g.godId}`} className="flex items-center gap-1.5 rounded py-1 hover:bg-ss-bg-raised/60">
            <GodAvatar iconUrl={g.iconUrl} name={g.name} size={20} />
            <span className="flex-1 truncate text-ss-text-secondary">{g.name}</span>
            <span className="font-semibold text-ss-loss">{g.winratePct}%</span>
          </Link>
        ))}
      </div>
      <p className="col-span-2 text-[10px] text-ss-text-muted" style={{ color: accent }}>
        Mínimo 2 partidas para entrar en el ranking.
      </p>
    </div>
  );
}

export function AllyEnemyCharts({ allies, enemies }: { allies: ParticipantGodStat[]; enemies: ParticipantGodStat[] }) {
  if (allies.length === 0 && enemies.length === 0) {
    return (
      <p className="text-sm text-ss-text-muted">
        Escanea el marcador completo al cargar una partida (no solo tu fila) para ver con qué dioses aliados ganas más y contra
        cuáles pierdes más.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ss-win">Aliados</h3>
        <FrequencyPie data={allies} />
        <WinrateList data={allies} accent="#34d399" />
      </div>
      <div>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ss-loss">Enemigos</h3>
        <FrequencyPie data={enemies} />
        <WinrateList data={enemies} accent="#fb3b5c" />
      </div>
    </div>
  );
}
