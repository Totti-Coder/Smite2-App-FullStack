import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { MatchesList } from '@/components/partidas/MatchesList';
import type { MatchWithGod } from '@/lib/stats';

export const metadata: Metadata = { title: 'Partidas' };

const PAGE_SIZE = 15;

export default async function PartidasPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, count } = await supabase
    .from('matches')
    .select('*, gods!god_id(name, primary_role, icon_url), enemy_god:gods!enemy_god_id(name, icon_url, primary_role)', { count: 'exact' })
    .eq('user_id', user.id)
    .order('played_at', { ascending: false })
    .range(from, to);

  const matches = (data ?? []) as unknown as MatchWithGod[];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  // Batch-sign every screenshot on this page in one call rather than one
  // round trip per match - createSignedUrls still respects the same RLS
  // that guards plain reads, so a user can only ever get URLs for their
  // own screenshots.
  const paths = matches.map((m) => m.screenshot_path).filter((p): p is string => Boolean(p));
  const signedMap = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage.from('match-screenshots').createSignedUrls(paths, 3600);
    signed?.forEach((s) => {
      if (s.signedUrl) signedMap.set(s.path ?? '', s.signedUrl);
    });
  }

  return (
    <main id="contenido" tabIndex={-1} className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ss-text">Partidas</h1>
          <p className="mt-1 text-sm text-ss-text-muted">{count ?? 0} partidas registradas en total</p>
        </div>
        <Link
          href="/matches/new"
          className="whitespace-nowrap rounded-md bg-ss-cyan px-4 py-2 text-sm font-semibold text-ss-bg transition hover:brightness-110"
        >
          + Registrar partida
        </Link>
      </div>

      <MatchesList
        matches={matches.map((m) => ({ ...m, screenshotUrl: m.screenshot_path ? (signedMap.get(m.screenshot_path) ?? null) : null }))}
      />

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          {page > 1 && (
            <Link href={`/partidas?page=${page - 1}`} className="rounded-md border border-ss-line px-3 py-1.5 text-sm text-ss-text-muted hover:text-ss-text">
              ← Anterior
            </Link>
          )}
          <span className="px-2 text-sm text-ss-text-muted">
            Página {page} de {totalPages}
          </span>
          {page < totalPages && (
            <Link href={`/partidas?page=${page + 1}`} className="rounded-md border border-ss-line px-3 py-1.5 text-sm text-ss-text-muted hover:text-ss-text">
              Siguiente →
            </Link>
          )}
        </div>
      )}
    </main>
  );
}
