import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { TierListView } from '@/components/tierlist/TierListView';
import { relativeTime } from '@/lib/relative-time';
import type { TierListRow } from '@/lib/supabase/database.types';
import godsCatalog from '@/data/gods.json';

export const metadata: Metadata = { title: 'Tier lists' };

type GodInfo = { id: string; name: string; icon_url: string | null };
const godById = new Map((godsCatalog as GodInfo[]).map((g) => [g.id, g]));

export default async function TierListGalleryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Public read - this query works signed out too (RLS policy
  // tier_lists_select_public), which is the whole point of the gallery.
  const { data } = await supabase
    .from('tier_lists')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(60);

  const lists = (data ?? []) as TierListRow[];

  return (
    <main id="contenido" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ss-text">Tier lists de la comunidad</h1>
          <p className="mt-1 text-sm text-ss-text-muted">
            {lists.length === 0 ? 'Todavía no hay ninguna publicada.' : `${lists.length} publicadas`} · cualquiera puede verlas, hace falta cuenta para crear una.
          </p>
        </div>
        {user ? (
          <Link
            href="/tierlist/nueva"
            className="neu-raised whitespace-nowrap rounded-md bg-ss-cyan px-4 py-2 text-sm font-semibold text-ss-bg transition hover:brightness-110"
          >
            + Crear tier list
          </Link>
        ) : (
          <Link
            href="/login"
            className="whitespace-nowrap rounded-md border border-ss-cyan/50 px-4 py-2 text-sm font-semibold text-ss-cyan transition hover:bg-ss-cyan/10"
          >
            Inicia sesión para crear la tuya →
          </Link>
        )}
      </div>

      {lists.length === 0 ? (
        <div className="glass-panel rounded-2xl p-8 text-center">
          <p className="text-sm text-ss-text-muted">Sé el primero en publicar una tier list.</p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {lists.map((list) => (
            <Link
              key={list.id}
              href={`/tierlist/${list.id}`}
              className="glass-panel rounded-2xl p-4 transition hover:-translate-y-0.5 hover:border-ss-cyan/40"
            >
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="truncate font-display text-sm font-bold text-ss-text">{list.title}</h2>
                <span className="shrink-0 text-[11px] text-ss-text-muted">{relativeTime(list.created_at)}</span>
              </div>
              <TierListView tiers={list.tiers} godById={godById} size="preview" />
              <p className="mt-3 text-xs text-ss-text-muted">
                por <span className="text-ss-cyan">{list.author_name}</span>
              </p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
