'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

export function WinLossDonut({ wins, losses }: { wins: number; losses: number }) {
  const total = wins + losses;
  if (total === 0) {
    return <p className="text-sm text-ss-text-muted">Sin partidas todavía.</p>;
  }

  const data = [
    { name: 'Victorias', value: wins, color: '#34d399' },
    { name: 'Derrotas', value: losses, color: '#fb3b5c' },
  ];

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={65}
            outerRadius={95}
            paddingAngle={3}
            stroke="none"
          >
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: '#11161f', border: '1px solid #212631', borderRadius: 8 }}
            labelStyle={{ color: '#e8edf4' }}
            formatter={(value, name) => [`${value} (${((Number(value) / total) * 100).toFixed(0)}%)`, name]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-2xl font-bold text-ss-text">
          {((wins / total) * 100).toFixed(0)}%
        </span>
        <span className="text-xs text-ss-text-muted">winrate</span>
      </div>
    </div>
  );
}
