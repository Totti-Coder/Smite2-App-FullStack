'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { uuidSchema } from '@/lib/validation/sanitize';

export async function deleteMatch(matchId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado.' };

  // A server action is a public HTTP endpoint: this argument is whatever the
  // caller sent, not whatever the delete button passed in. Validating the
  // shape turns a malformed id into a clean rejection rather than a Postgres
  // uuid cast error surfacing as a generic failure.
  if (!uuidSchema.safeParse(matchId).success) return { error: 'Identificador inválido.' };

  // Look up the screenshot path before deleting the row - the FK cascade on
  // match_participants cleans itself up automatically, but Storage objects
  // aren't tied to the row at all and would otherwise pile up orphaned forever.
  const { data: match } = await supabase
    .from('matches')
    .select('screenshot_path')
    .eq('id', matchId)
    .eq('user_id', user.id)
    .maybeSingle();

  // user_id filter here is defense in depth - RLS already scopes deletes to
  // the owner, this just makes it explicit and gives a clean "not yours/
  // doesn't exist" no-op instead of relying solely on the policy.
  const { error } = await supabase.from('matches').delete().eq('id', matchId).eq('user_id', user.id);
  if (error) return { error: 'No se pudo eliminar la partida.' };

  if (match?.screenshot_path) {
    // Non-fatal: the match row is already gone either way, a leftover file
    // in Storage isn't worth surfacing as an error to the user.
    await supabase.storage.from('match-screenshots').remove([match.screenshot_path]);
  }

  revalidatePath('/partidas');
  revalidatePath('/');
  return { error: null };
}
