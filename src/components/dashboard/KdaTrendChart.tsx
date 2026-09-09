'use client';

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type Point = { date: string; kda: number };

export function KdaTrendChart({ data }: { data: Point[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-ss-text-muted">Sin partidas todavía.</p>;
  }

  const chartData = data.map((p) => ({
    ...p,
    label: new Date(p.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#212631" />
        <XAxis dataKey="label" tick={{ fill: '#8b97a8', fontSize: 12 }} />
        <YAxis tick={{ fill: '#8b97a8', fontSize: 12 }} />
        <Tooltip
          contentStyle={{ background: '#11161f', border: '1px solid #212631', borderRadius: 8 }}
          labelStyle={{ color: '#e8edf4' }}
          formatter={(value) => [Number(value).toFixed(2), 'KDA']}
        />
        <Line type="monotone" dataKey="kda" stroke="#16c8d4" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
