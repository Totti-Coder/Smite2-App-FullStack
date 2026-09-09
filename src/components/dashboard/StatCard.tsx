'use client';

import { motion } from 'motion/react';
import { AnimatedNumber } from '@/components/motion/AnimatedNumber';

const NUMERIC = /^(-?\d+(?:\.\d+)?)(.*)$/;

export function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: 'win' | 'loss' | 'cyan' | 'purple' }) {
  const accentClass = accent
    ? { win: 'text-ss-win', loss: 'text-ss-loss', cyan: 'text-ss-cyan', purple: 'text-ss-purple' }[accent]
    : 'text-ss-text';

  const numMatch = value.match(NUMERIC);

  return (
    <motion.div
      whileHover={{ y: -3, borderColor: 'var(--ss-cyan)' }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      className="rounded-xl border border-ss-line bg-ss-card p-4"
    >
      <p className="text-xs font-medium uppercase tracking-wider text-ss-text-muted">{label}</p>
      <p className={`mt-1 font-display text-3xl font-bold ${accentClass}`}>
        {numMatch ? (
          <AnimatedNumber
            value={Number(numMatch[1])}
            decimals={numMatch[1].includes('.') ? numMatch[1].split('.')[1].length : 0}
            suffix={numMatch[2]}
          />
        ) : (
          value
        )}
      </p>
      {sub && <p className="mt-1 text-xs text-ss-text-muted">{sub}</p>}
    </motion.div>
  );
}
