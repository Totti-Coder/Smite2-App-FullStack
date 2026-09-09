import { createClient } from '@/lib/supabase/server';
import { MatchForm } from '@/components/match-form/MatchForm';

export default async function NewMatchPage() {
  const supabase = await createClient();
  const { data: gods } = await supabase
    .from('gods')
    .select('id, name, primary_role, icon_url')
    .order('name');

  return (
    <main id="contenido" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-6 font-display text-2xl font-bold text-ss-text">Registrar partida</h1>
      <MatchForm gods={gods ?? []} />
    </main>
  );
}
