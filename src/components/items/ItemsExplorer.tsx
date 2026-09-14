'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ItemArt } from '@/components/ItemArt';
import { AnimatePresence, motion } from 'motion/react';
import { Reveal } from '@/components/motion/Reveal';
import { SwordIcon, OrbIcon, ShieldIcon, SparkleIcon, SearchIcon, CloseIcon, CoinIcon } from '@/components/icons';
import type { Item } from '@/lib/item-types';

const TIER_ORDER = ['All', 'Starter', 'T1', 'T2', 'T3', 'Relic', 'Curio', 'Consumable', 'GodSpecific'];
const TIER_LABEL: Record<string, string> = {
  All: 'Todos',
  Starter: 'Starter',
  T1: 'Tier 1',
  T2: 'Tier 2',
  T3: 'Tier 3',
  Relic: 'Relics',
  Curio: 'Curios',
  Consumable: 'Consumibles',
  GodSpecific: 'Específicos de dios',
};
const TIER_COLOR: Record<string, string> = {
  Starter: '#8b97a8',
  T1: '#60a5fa',
  T2: '#16c8d4',
  T3: '#fb923c',
  Relic: '#a78bfa',
  Curio: '#34d399',
  Consumable: '#fb3b5c',
  GodSpecific: '#e8edf4',
};

type Category = 'physical' | 'magical' | 'defense' | 'utility';
const CATEGORY_LABEL: Record<Category, string> = { physical: 'Físico', magical: 'Mágico', defense: 'Defensa', utility: 'Utilidad' };
const CATEGORY_COLOR: Record<Category, string> = { physical: '#fb923c', magical: '#a78bfa', defense: '#60a5fa', utility: '#34d399' };
const CATEGORY_ICON: Record<Category, (props: { size?: number }) => React.ReactElement> = {
  physical: SwordIcon,
  magical: OrbIcon,
  defense: ShieldIcon,
  utility: SparkleIcon,
};

function categoryOf(item: Item): Category {
  const s = item.stats ?? {};
  if ('PhysicalPower' in s || 'PhysicalPenetrationFlat' in s || 'PhysicalPenetrationPercent' in s) return 'physical';
  if ('MagicalPower' in s || 'MagicalPenetrationFlat' in s || 'MagicalPenetrationPercent' in s) return 'magical';
  if ('PhysicalProtection' in s || 'MagicalProtection' in s || 'MaxHealth' in s) return 'defense';
  return 'utility';
}

function statLabel(key: string): string {
  return key
    .replace(/Percent$/, '')
    .replace(/([A-Z])/g, ' $1')
    .replace(/\s+/g, ' ')
    .trim();
}

function ItemDetailModal({ item, onClose }: { item: Item; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const category = categoryOf(item);
  const catColor = CATEGORY_COLOR[category];
  const tierColor = TIER_COLOR[item.tier] ?? '#8b97a8';
  const CatIcon = CATEGORY_ICON[category];

  useEffect(() => {
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="item-modal-title"
    >
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
        className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border bg-ss-card p-5 shadow-2xl"
        style={{ borderColor: `${tierColor}55` }}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Cerrar detalle del item"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-ss-text-muted transition hover:bg-ss-bg-raised hover:text-ss-text"
        >
          <CloseIcon />
        </button>

        <div className="flex items-start gap-3 pr-8">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border"
            style={{ borderColor: `${tierColor}66`, background: `radial-gradient(circle, ${tierColor}22, transparent 70%)` }}
          >
            <ItemArt iconUrl={item.icon_url} name={item.name} size={48} />
          </div>
          <div className="min-w-0">
            <h2 id="item-modal-title" className="font-display text-base font-bold leading-tight text-ss-text">
              {item.name}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded px-1.5 py-0.5 font-semibold" style={{ color: tierColor, backgroundColor: `${tierColor}1a` }}>
                {TIER_LABEL[item.tier] ?? item.tier}
              </span>
              <span className="flex items-center gap-1 font-semibold" style={{ color: catColor }}>
                <CatIcon size={11} /> {CATEGORY_LABEL[category]}
              </span>
            </div>
            {item.cost > 0 && (
              <p className="mt-1.5 flex items-center gap-1 text-sm font-semibold text-ss-orange">
                <CoinIcon size={13} /> {item.cost.toLocaleString('es-ES')}
              </p>
            )}
          </div>
        </div>

        {item.owner_god && <p className="mt-3 text-xs text-ss-text-muted">Exclusivo de {item.owner_god}</p>}

        {item.stats && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-ss-line pt-3">
            {Object.entries(item.stats).map(([k, v]) => (
              <div key={k} className="rounded-lg border border-ss-line bg-ss-bg-raised px-2.5 py-1.5">
                <p className="font-display text-sm font-bold text-ss-text">
                  +{v}
                  {k.endsWith('Percent') ? '%' : ''}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-ss-text-muted">{statLabel(k)}</p>
              </div>
            ))}
          </div>
        )}

        {item.passive && (
          <p className="mt-3 whitespace-pre-line border-t border-ss-line pt-3 text-xs leading-relaxed text-ss-text-secondary">
            <span className="font-semibold text-ss-cyan">Pasiva: </span>
            {item.passive}
          </p>
        )}
        {item.active && (
          <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-ss-text-secondary">
            <span className="font-semibold text-ss-purple">Activa: </span>
            {item.active}
          </p>
        )}
      </motion.div>
    </motion.div>
  );
}

export function ItemsExplorer({ items, initialQuery }: { items: Item[]; initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery ?? '');
  const [tier, setTier] = useState('All');
  const [category, setCategory] = useState<Category | null>(null);
  const [selected, setSelected] = useState<Item | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (tier !== 'All' && i.tier !== tier) return false;
      if (category && categoryOf(i) !== category) return false;
      if (q && !i.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, query, tier, category]);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative w-full sm:max-w-xs">
        <label htmlFor="item-search" className="sr-only">
          Buscar item por nombre
        </label>
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
          <SearchIcon />
        </span>
        <input
          id="item-search"
          type="text"
          placeholder="Buscar item..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-md border border-ss-line bg-ss-bg-raised py-2 pl-9 pr-3 text-sm text-ss-text placeholder:text-ss-text-muted focus:border-ss-cyan"
        />
      </div>

      <span className="sr-only" role="status" aria-live="polite">
        {filtered.length} de {items.length} items
      </span>

      <div className="flex flex-wrap gap-1.5">
        {TIER_ORDER.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTier(t)}
            aria-pressed={tier === t}
            className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition"
            style={
              tier === t
                ? { borderColor: TIER_COLOR[t] ?? '#16c8d4', backgroundColor: `${TIER_COLOR[t] ?? '#16c8d4'}1a`, color: TIER_COLOR[t] ?? '#16c8d4' }
                : { borderColor: 'var(--ss-line)', color: 'var(--ss-text-muted)' }
            }
          >
            {t !== 'All' && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: TIER_COLOR[t] }} />}
            {TIER_LABEL[t] ?? t}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => {
          const Icon = CATEGORY_ICON[c];
          const active = category === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(active ? null : c)}
              aria-pressed={active}
              className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition"
              style={{
                borderColor: active ? CATEGORY_COLOR[c] : 'var(--ss-line)',
                backgroundColor: active ? `${CATEGORY_COLOR[c]}1a` : 'transparent',
                color: active ? CATEGORY_COLOR[c] : 'var(--ss-text-muted)',
              }}
            >
              <Icon size={12} />
              {CATEGORY_LABEL[c]}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-ss-text-muted">Ningún item coincide con esa búsqueda.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
          {filtered.map((item, i) => {
            const tierColor = TIER_COLOR[item.tier] ?? '#8b97a8';
            const cat = categoryOf(item);
            const CatIcon = CATEGORY_ICON[cat];

            return (
              <li key={item.id}>
                <Reveal delay={Math.min(i, 20) * 0.015}>
                  <motion.button
                    type="button"
                    onClick={() => setSelected(item)}
                    whileHover={{ y: -3 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                    aria-label={`${item.name}, ${TIER_LABEL[item.tier] ?? item.tier}${item.cost > 0 ? `, ${item.cost} oro` : ''}`}
                    className="group relative flex w-full flex-col items-center gap-1 rounded-xl border bg-ss-card p-2.5 text-center transition-shadow duration-200"
                    style={{ borderColor: 'var(--ss-line)' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = `${tierColor}88`;
                      e.currentTarget.style.boxShadow = `0 10px 26px -14px ${tierColor}99`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--ss-line)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <span className="absolute left-1.5 top-1.5" style={{ color: CATEGORY_COLOR[cat] }} aria-hidden="true">
                      <CatIcon size={10} />
                    </span>
                    {item.cost > 0 && (
                      <span className="absolute right-1.5 top-1.5 text-[9px] font-semibold text-ss-orange" aria-hidden="true">
                        {item.cost >= 1000 ? `${Math.round(item.cost / 100) / 10}k` : item.cost}
                      </span>
                    )}
                    <div
                      className="mt-2 flex h-12 w-12 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105"
                      style={{ background: `radial-gradient(circle, ${tierColor}26, transparent 72%)` }}
                    >
                      <ItemArt iconUrl={item.icon_url} name={item.name} size={40} className="border border-ss-line/60" />
                    </div>
                    <p className="line-clamp-2 text-[11px] leading-tight text-ss-text-secondary">{item.name}</p>
                  </motion.button>
                </Reveal>
              </li>
            );
          })}
        </ul>
      )}

      <AnimatePresence>{selected && <ItemDetailModal item={selected} onClose={() => setSelected(null)} />}</AnimatePresence>
    </div>
  );
}
