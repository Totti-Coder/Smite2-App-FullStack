import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TierListEditor } from '@/components/tierlist/TierListEditor';

export const metadata: Metadata = { title: 'Crear tier list' };

export default async function NewTierListPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Creating requires an account (browsing the gallery doesn't). Middleware
  // gates this route too; this is the in-page half of the same rule.
  if (!user) redirect('/login');

  const { data: gods } = await supabase
    .from('gods')
    .select('id, name, primary_role, icon_url')
    .order('name');

  return (
    <main id="contenido" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6">
        <Link href="/tierlist" className="text-xs text-ss-text-muted hover:text-ss-text">
          ← Volver a las tier lists
        </Link>
      </div>

      <h1 className="font-display text-2xl font-bold text-ss-text">Crear tier list</h1>
      <p className="mt-1 mb-8 text-sm text-ss-text-muted">
        Arrastra los dioses a cada tier (o tócalos y luego toca el tier, en móvil). Al publicarla la verá todo el mundo.
      </p>

      <TierListEditor gods={gods ?? []} />
    </main>
  );
}
