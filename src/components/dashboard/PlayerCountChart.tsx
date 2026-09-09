'use client';

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { PlayerSnapshot } from '@/lib/steam-player-count';

export function PlayerCountChart({ data }: { data: PlayerSnapshot[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-ss-text-muted">Todavía no hay muestras - se van a ir acumulando en cada visita al dashboard.</p>;
  }

  // One point per hour (see getPlayerCountHistory's bucketing) - just the
  // time reads cleanly here, no need for the date on a 24h-wide chart.
  const chartData = data.map((p) => ({
    count: p.player_count,
    label: new Date(p.sampled_at).toLocaleString('es-ES', { hour: '2-digit', minute: '2-digit' }),
  }));

  const latest = chartData[chartData.length - 1];
  const peak = Math.max(...chartData.map((p) => p.count));

  return (
    <div>
      <div className="mb-2 flex items-baseline gap-4">
        <div>
          <p className="font-display text-2xl font-bold text-ss-cyan">{latest.count.toLocaleString('es-ES')}</p>
          <p className="text-[11px] text-ss-text-muted">jugadores ahora en Steam</p>
        </div>
        <div>
          <p className="font-display text-sm font-semibold text-ss-text-secondary">{peak.toLocaleString('es-ES')}</p>
          <p className="text-[11px] text-ss-text-muted">pico últimas 24h</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <defs>
            <linearGradient id="playerCountFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#16c8d4" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#16c8d4" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#212631" />
          <XAxis dataKey="label" tick={{ fill: '#8b97a8', fontSize: 10 }} minTickGap={40} />
          <YAxis
            tick={{ fill: '#8b97a8', fontSize: 12 }}
            width={60}
            allowDecimals={false}
            // Explicit round-number domain instead of Recharts' auto-domain -
            // with only 1-2 points on record (this just started collecting),
            // "auto" produced a nonsensical/cramped tick set (labels out of
            // order, clipped digits). This always gives a clean 0..~peak axis.
            domain={[0, (max: number) => Math.ceil((max * 1.15) / 100) * 100]}
            tickFormatter={(v) => Number(v).toLocaleString('es-ES')}
          />
          <Tooltip
            contentStyle={{ background: '#11161f', border: '1px solid #212631', borderRadius: 8 }}
            labelStyle={{ color: '#e8edf4' }}
            formatter={(value) => [Number(value).toLocaleString('es-ES'), 'Jugadores']}
          />
          <Area type="monotone" dataKey="count" stroke="#16c8d4" strokeWidth={2} fill="url(#playerCountFill)" dot={{ r: 3, fill: '#16c8d4', strokeWidth: 0 }} />
        </AreaChart>
      </ResponsiveContainer>
      {chartData.length < 3 && (
        <p className="mt-1 text-[11px] text-ss-orange">
          Recién empezó a juntar muestras hoy - va a mostrar una tendencia real a medida que visites el dashboard en distintos momentos/días.
        </p>
      )}
      <p className="mt-1 text-[10px] text-ss-text-muted">Fuente: API pública de Steam (jugadores concurrentes de Smite 2).</p>
    </div>
  );
}
