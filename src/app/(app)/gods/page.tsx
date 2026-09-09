import { GodsExplorer } from '@/components/gods/GodsExplorer';
import type { Role } from '@/lib/supabase/database.types';
import godsCatalog from '@/data/gods.json';

// The god catalog is static reference data and gods.json is its SOURCE OF
// TRUTH - scripts/seed-gods.ts pushes this exact file INTO the `gods` table,
// so reading the table here was reading a copy of the file we already ship.
//
// It was also the reason this page showed "0 dioses" to signed-out visitors:
// /gods is public (see supabase/middleware.ts) but the `gods` table was never
// granted to `anon`, so Postgres refused the read at the privilege layer.
// Reading the catalog directly removes that failure mode instead of patching
// around it, drops a network round-trip per page load, and matches what
// /items, GodSearch and both tier-list pages already do.
//
// The `gods` TABLE still matters - matches.god_id references it - it just
// isn't what this page needs.
const gods = godsCatalog as { id: string; name: string; pantheon: string; primary_role: string; damage_type: string; icon_url: string | null }[];

const ROLES: Role[] = ['solo', 'jungle', 'mid', 'adc', 'support'];

export default async function GodsIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const { role } = await searchParams;
  const activeRole = ROLES.includes(role as Role) ? (role as Role) : null;

  return (
    <main id="contenido" tabIndex={-1} className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="mb-1 font-display text-2xl font-bold text-ss-text">Dioses</h1>
      <p className="mb-4 text-sm text-ss-text-muted">{gods.length} dioses</p>

      <GodsExplorer gods={gods} initialRole={activeRole} />
    </main>
  );
}
