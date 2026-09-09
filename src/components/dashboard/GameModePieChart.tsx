'use client';

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { GAME_MODE_COLOR, GAME_MODE_LABEL } from '@/lib/god-assets';

type ModeStat = { gameMode: string; games: number; winratePct: number };

export function GameModePieChart({ data }: { data: ModeStat[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-ss-text-muted">Sin partidas todavía.</p>;
  }

  const chartData = data.map((d) => ({
    name: GAME_MODE_LABEL[d.gameMode] ?? d.gameMode,
    value: d.games,
    winratePct: d.winratePct,
    color: GAME_MODE_COLOR[d.gameMode] ?? '#8b97a8',
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={0} outerRadius={90} paddingAngle={2} stroke="none">
          {chartData.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Pie>
        <Legend
          verticalAlign="bottom"
          height={36}
          formatter={(value) => <span style={{ color: '#cdd6e3', fontSize: 12 }}>{value}</span>}
        />
        <Tooltip
          contentStyle={{ background: '#11161f', border: '1px solid #212631', borderRadius: 8 }}
          labelStyle={{ color: '#e8edf4' }}
          formatter={(value, _name, item) => [`${value} partidas · ${item.payload.winratePct}% WR`, item.payload.name]}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
