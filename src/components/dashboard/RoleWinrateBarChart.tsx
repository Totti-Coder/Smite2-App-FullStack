'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ROLE_COLOR, ROLE_LABEL } from '@/lib/god-assets';
import type { Role } from '@/lib/supabase/database.types';

type RoleStat = { role: string; games: number; wins: number; winratePct: number };

export function RoleWinrateBarChart({ data }: { data: RoleStat[] }) {
  const router = useRouter();
  const withGames = data.filter((r) => r.games > 0);
  if (withGames.length === 0) {
    return <p className="text-sm text-ss-text-muted">Sin partidas todavía.</p>;
  }

  const chartData = withGames
    .map((r) => ({ ...r, label: ROLE_LABEL[r.role as Role] ?? r.role, color: ROLE_COLOR[r.role as Role] ?? '#8b97a8' }))
    .sort((a, b) => b.winratePct - a.winratePct);

  return (
    <div>
      <ResponsiveContainer width="100%" height={Math.max(180, chartData.length * 44)}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 28, left: 0, bottom: 4 }}>
          <XAxis type="number" domain={[0, 100]} hide />
          <YAxis
            type="category"
            dataKey="label"
            width={72}
            tick={{ fill: '#cdd6e3', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.03)' }}
            contentStyle={{ background: '#11161f', border: '1px solid #212631', borderRadius: 8 }}
            labelStyle={{ color: '#e8edf4' }}
            formatter={(value, _name, item) => [`${value}% WR · ${item.payload.games} partidas`, item.payload.label]}
          />
          <Bar
            dataKey="winratePct"
            radius={[0, 6, 6, 0]}
            barSize={18}
            className="cursor-pointer"
            onClick={(entry) => router.push(`/gods?role=${entry.role}`)}
          >
            {chartData.map((d) => (
              <Cell key={d.role} fill={d.color} />
            ))}
            <LabelList
              dataKey="winratePct"
              position="right"
              formatter={(v: unknown) => `${v}%`}
              style={{ fill: '#e8edf4', fontSize: 12, fontWeight: 700 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Keyboard/screen-reader accessible equivalent of the bar click-through -
          the chart itself isn't focusable per-bar. */}
      <nav aria-label="Filtrar dioses por rol" className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
        {chartData.map((r) => (
          <Link key={r.role} href={`/gods?role=${r.role}`} className="text-xs text-ss-text-muted underline decoration-dotted hover:text-ss-text">
            Ver {r.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
