import { ItemsExplorer } from '@/components/items/ItemsExplorer';
import type { Item } from '@/lib/item-types';
import itemsCatalog from '@/data/items.json';

// The JSON module's inferred type is a union of every distinct object shape
// present in the array (varying stats keys per item) rather than a single
// Item shape - a plain data cast is correct here, not a type error to fix.
const items = itemsCatalog as unknown as Item[];

export default async function ItemsIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  return (
    <main id="contenido" tabIndex={-1} className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="mb-1 font-display text-2xl font-bold text-ss-text">Items</h1>
      <p className="mb-6 text-sm text-ss-text-muted">{items.length} items</p>
      <ItemsExplorer items={items} initialQuery={q} />
    </main>
  );
}
