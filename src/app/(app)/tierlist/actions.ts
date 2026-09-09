'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { tierListInputSchema } from '@/lib/validation/tier-list';
import { uuidSchema, VALID_GOD_IDS } from '@/lib/validation/sanitize';

export type TierListFormState = { error: string | null };

export async function createTierList(
  _prev: TierListFormState,
  formData: FormData
): Promise<TierListFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Publishing requires an account (browsing doesn't) - RLS enforces this
  // too, this is the friendly half of that same rule.
  if (!user) redirect('/login');

  let tiersRaw: unknown;
  try {
    tiersRaw = JSON.parse(String(formData.get('tiers') ?? ''));
  } catch {
    return { error: 'No se pudieron leer los tiers.' };
  }

  const parsed = tierListInputSchema.safeParse({
    title: formData.get('title'),
    author_name: formData.get('author_name'),
    tiers: tiersRaw,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  // Cross-check every id against our own catalog. The zod schema only proves
  // they're plausible strings; this proves they're real gods, so a tampered
  // payload can't plant arbitrary text on a world-readable page.
  const tiers = parsed.data.tiers.map((t) => ({
    ...t,
    godIds: t.godIds.filter((id) => VALID_GOD_IDS.has(id)),
  }));

  if (tiers.every((t) => t.godIds.length === 0)) {
    return { error: 'Coloca al menos un dios en algún tier.' };
  }

  const { data: inserted, error } = await supabase
    .from('tier_lists')
    // user_id from the verified session, never the client payload.
    .insert({ ...parsed.data, tiers, user_id: user.id })
    .select('id')
    .single();

  if (error || !inserted) {
    return { error: 'No se pudo publicar la tier list.' };
  }

  revalidatePath('/tierlist');
  redirect(`/tierlist/${inserted.id}`);
}

export async function deleteTierList(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado.' };

  // Server actions are a public HTTP endpoint - this argument is whatever the
  // caller sent, not whatever the button passed. Checking the shape turns a
  // malformed id into a clean rejection instead of a Postgres uuid cast error.
  if (!uuidSchema.safeParse(id).success) return { error: 'Identificador inválido.' };

  // user_id filter is defense in depth - RLS already scopes deletes to the
  // owner; this makes "not yours" a clean no-op rather than relying only on
  // the policy.
  const { error } = await supabase.from('tier_lists').delete().eq('id', id).eq('user_id', user.id);
  if (error) return { error: 'No se pudo eliminar la tier list.' };

  revalidatePath('/tierlist');
  return { error: null };
}
