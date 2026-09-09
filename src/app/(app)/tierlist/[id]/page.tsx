import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TierListView } from '@/components/tierlist/TierListView';
import { DeleteTierListButton } from '@/components/tierlist/DeleteTierListButton';
import { relativeTime } from '@/lib/relative-time';
import { rankedCount } from '@/lib/tier-list';
import type { TierListRow } from '@/lib/supabase/database.types';
import godsCatalog from '@/data/gods.json';

type GodInfo = { id: string; name: string; icon_url: string | null };
const godById = new Map((godsCatalog as GodInfo[]).map((g) => [g.id, g]));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('tier_lists').select('title').eq('id', id).maybeSingle();
  return { title: data?.title ?? 'Tier list' };
}

export default async function TierListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Public read, signed out included.
  const { data } = await supabase.from('tier_lists').select('*').eq('id', id).maybeSingle();
  if (!data) notFound();

  const list = data as TierListRow;
  const isOwner = user?.id === list.user_id;

  return (
    <main id="contenido" tabIndex={-1} className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6">
        <Link href="/tierlist" className="text-xs text-ss-text-muted hover:text-ss-text">
          ← Volver a las tier lists
        </Link>
      </div>

      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ss-text">{list.title}</h1>
          <p className="mt-1 text-sm text-ss-text-muted">
            por <span className="text-ss-cyan">{list.author_name}</span> · {relativeTime(list.created_at)} ·{' '}
            {rankedCount(list.tiers)} dioses clasificados
          </p>
        </div>
        {isOwner && <DeleteTierListButton id={list.id} />}
      </div>

      <TierListView tiers={list.tiers} godById={godById} />
    </main>
  );
}
