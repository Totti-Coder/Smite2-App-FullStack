'use client';

import { useMemo, useState } from 'react';
import { MAX_BUILD_ITEMS, type Item } from '@/lib/item-types';
import { ItemArt } from '@/components/ItemArt';


// Smite 2 builds have 7 item slots (not 6, that was Smite 1) - plus the
// active relic, which isn't part of this build picker at all. Imported rather
// than redeclared: this number and the server-side validation cap drifted
// apart once already, and the schema silently dropped the 7th item.
const MAX_ITEMS = MAX_BUILD_ITEMS;
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
  GodSpecific: 'Específicos',
};

export function ItemSelectGrid({
  items,
  value,
  onChange,
}: {
  items: Item[];
  // Optional controlled mode, same idea as GodSelectGrid - lets a screenshot
  // scan auto-fill the build and have it show up as real chips here.
  value?: Item[];
  onChange?: (items: Item[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [tier, setTier] = useState('All');
  const [internalSelected, setInternalSelected] = useState<Item[]>([]);
  const selected = value !== undefined ? value : internalSelected;
  const setSelected = onChange ?? setInternalSelected;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let pool = items;
    if (tier !== 'All') pool = pool.filter((i) => i.tier === tier);
    if (q) pool = pool.filter((i) => i.name.toLowerCase().includes(q));
    return pool.filter((i) => !selected.some((s) => s.id === i.id));
  }, [items, query, tier, selected]);

  function addItem(item: Item) {
    if (selected.length >= MAX_ITEMS) return;
    // Computed from the current `selected` value rather than a functional
    // updater - setSelected may be a plain callback (controlled mode), not
    // a React dispatch, so it can't be trusted to support that form.
    setSelected([...selected, item]);
    setQuery('');
  }

  function removeItem(id: string) {
    setSelected(selected.filter((i) => i.id !== id));
  }

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name="items" value={selected.map((i) => i.name).join(',')} />

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => removeItem(item.id)}
              className="flex items-center gap-1.5 rounded-md border border-ss-cyan bg-ss-bg-raised py-1 pl-1 pr-2"
              title="Quitar"
            >
              <ItemArt iconUrl={item.icon_url} name={item.name} size={24} />
              <span className="text-xs text-ss-text">{item.name}</span>
              <span className="text-ss-text-muted">×</span>
            </button>
          ))}
        </div>
      )}

      {selected.length < MAX_ITEMS ? (
        <>
          <input
            type="text"
            aria-label="Buscar item para la build"
            placeholder={`Buscar item... (${selected.length}/${MAX_ITEMS})`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="rounded-md border border-ss-line bg-ss-bg-raised px-3 py-2 text-sm text-ss-text outline-none focus:border-ss-cyan"
          />
          <div className="flex flex-wrap gap-1.5">
            {TIER_ORDER.map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => setTier(t)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                  tier === t
                    ? 'border-ss-cyan bg-ss-cyan/10 text-ss-cyan'
                    : 'border-ss-line text-ss-text-muted hover:text-ss-text'
                }`}
              >
                {TIER_LABEL[t] ?? t}
              </button>
            ))}
          </div>
          <div className="grid max-h-72 grid-cols-5 gap-2 overflow-y-auto rounded-md border border-ss-line bg-ss-bg-raised p-2 sm:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12">
            {filtered.slice(0, 64).map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => addItem(item)}
                className="flex flex-col items-center gap-1 rounded-md p-1 text-center hover:bg-ss-card"
                title={[item.name, item.passive, item.active].filter(Boolean).join('\n')}
              >
                <ItemArt iconUrl={item.icon_url} name={item.name} size={36} className="border border-ss-line" />
                <span className="line-clamp-1 text-[10px] text-ss-text-secondary">{item.name}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="col-span-full py-4 text-center text-xs text-ss-text-muted">Sin resultados.</p>
            )}
          </div>
        </>
      ) : (
        <p className="text-xs text-ss-text-muted">Máximo {MAX_ITEMS} items. Quita uno para agregar otro.</p>
      )}
    </div>
  );
}
