'use client';

import { useId, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { FaqCategory } from '@/data/faq';
import { Reveal } from '@/components/motion/Reveal';

function FaqRow({ q, a, accent, open, onToggle }: { q: string; a: string; accent: string; open: boolean; onToggle: () => void }) {
  const panelId = useId();

  return (
    <div className="border-b border-ss-line last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="group flex w-full items-center justify-between gap-4 py-4 text-left"
      >
        <span
          className="font-display text-sm font-semibold transition-colors"
          style={{ color: open ? accent : 'var(--ss-text)' }}
        >
          {q}
        </span>
        <motion.span
          animate={{ rotate: open ? 45 : 0, backgroundColor: open ? `${accent}33` : `${accent}1a` }}
          transition={{ type: 'spring', stiffness: 300, damping: 22 }}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold"
          style={{ color: accent }}
        >
          +
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <p className="pb-4 pr-10 text-sm leading-relaxed text-ss-text-secondary">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FaqAccordion({ categories }: { categories: FaqCategory[] }) {
  const [openKey, setOpenKey] = useState<string | null>(`${categories[0]?.title}-0`);

  return (
    <div className="flex flex-col gap-8">
      {categories.map((cat, catIdx) => (
        <Reveal key={cat.title} delay={catIdx * 0.08}>
          <motion.div
            whileHover={{ y: -2, boxShadow: `0 8px 30px -12px ${cat.accent}55` }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className="rounded-xl border border-ss-line bg-ss-card p-5"
            style={{ borderLeft: `4px solid ${cat.accent}` }}
          >
            <h2 className="mb-1 font-display text-sm font-semibold uppercase tracking-wide" style={{ color: cat.accent }}>
              {cat.title}
            </h2>
            <div className="mt-2 flex flex-col">
              {cat.items.map((item, i) => {
                const key = `${cat.title}-${i}`;
                return (
                  <FaqRow
                    key={key}
                    q={item.q}
                    a={item.a}
                    accent={cat.accent}
                    open={openKey === key}
                    onToggle={() => setOpenKey(openKey === key ? null : key)}
                  />
                );
              })}
            </div>
          </motion.div>
        </Reveal>
      ))}
    </div>
  );
}
