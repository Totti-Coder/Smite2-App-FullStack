import Link from 'next/link';
import type { Item } from '@/lib/item-types';
import itemsCatalog from '@/data/items.json';

// Matches (and the aggregate item stats) are keyed by item NAME, not
// catalog id (see ItemSelectGrid's hidden input) - so this lookup is by
// name too, shared by every place that renders a build's items as icons.
const itemByName = new Map((itemsCatalog as unknown as Item[]).map((i) => [i.name, i]));

export function ItemIcon({
  name,
  size = 32,
  games,
  winratePct,
}: {
  name: string;
  size?: number;
  // Optional aggregate context (e.g. "used in 12 games, 58% winrate") shown
  // in the hover card alongside the item's own passive/active - callers that
  // don't have this (a single match's build) just omit it.
  games?: number;
  winratePct?: number;
}) {
  const item = itemByName.get(name);
  const px = `${size}px`;

  // Not every stored name is guaranteed to still be in the catalog (items
  // get renamed/removed between patches) - fall back to a plain "?" tile
  // with the raw name as a native title tooltip rather than silently
  // dropping the item from the build.
  if (!item) {
    return (
      <Link
        href={`/items?q=${encodeURIComponent(name)}`}
        title={name}
        style={{ height: px, width: px }}
        className="flex shrink-0 items-center justify-center rounded border border-ss-line bg-ss-bg-raised text-[10px] text-ss-text-muted transition hover:border-ss-cyan"
      >
        ?
      </Link>
    );
  }

  return (
    <Link href={`/items?q=${encodeURIComponent(item.name)}`} className="group relative block shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element -- external CDN icon */}
      <img
        src={item.icon_url}
        alt={item.name}
        style={{ height: px, width: px }}
        className="rounded border border-ss-line transition group-hover:border-ss-cyan"
      />

      <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-56 -translate-x-1/2 rounded-lg border border-ss-line bg-ss-card p-3 text-left opacity-0 shadow-xl shadow-black/50 transition-opacity duration-150 group-hover:opacity-100">
        <p className="font-display text-xs font-bold text-ss-text">{item.name}</p>
        <p className="mt-0.5 text-[10px] uppercase tracking-wide text-ss-text-muted">
          {item.tier}
          {item.cost ? ` · ${item.cost}g` : ''}
        </p>
        {games != null && winratePct != null && (
          <p className="mt-1 text-[11px] text-ss-text-secondary">
            Usado en <span className="font-semibold text-ss-text">{games}</span> partidas ·{' '}
            <span className={`font-semibold ${winratePct >= 50 ? 'text-ss-win' : 'text-ss-loss'}`}>{winratePct}%</span> winrate
          </p>
        )}
        {item.passive && (
          <p className="mt-1.5 text-[11px] leading-snug text-ss-text-secondary">
            <span className="font-semibold text-ss-purple">Pasiva: </span>
            {item.passive}
          </p>
        )}
        {item.active && (
          <p className="mt-1 text-[11px] leading-snug text-ss-text-secondary">
            <span className="font-semibold text-ss-orange">Activa: </span>
            {item.active}
          </p>
        )}
        {!item.passive && !item.active && <p className="mt-1.5 text-[11px] text-ss-text-muted">Sin pasiva/activa registrada.</p>}
      </div>
    </Link>
  );
}
