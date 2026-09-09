'use server';

import type { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { matchInputSchema, participantsInputSchema } from '@/lib/validation/match';
import { sniffImage } from '@/lib/validation/sanitize';

export type FormState = { error: string } | { error: null };

const SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024;

export async function createMatch(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const parsed = matchInputSchema.safeParse({
    god_id: formData.get('god_id'),
    enemy_god_id: formData.get('enemy_god_id') || null,
    role_played: formData.get('role_played'),
    game_mode: formData.get('game_mode'),
    result: formData.get('result'),
    kills: formData.get('kills'),
    deaths: formData.get('deaths'),
    assists: formData.get('assists'),
    rank_tier: formData.get('rank_tier') || null,
    duration_seconds: formData.get('duration_seconds') || null,
    gold_per_min: formData.get('gold_per_min') || null,
    damage_to_players: formData.get('damage_to_players') || null,
    damage_to_minions: formData.get('damage_to_minions') || null,
    damage_to_jungle: formData.get('damage_to_jungle') || null,
    damage_to_structures: formData.get('damage_to_structures') || null,
    damage_taken: formData.get('damage_taken') || null,
    damage_mitigated: formData.get('damage_mitigated') || null,
    self_healing: formData.get('self_healing') || null,
    ally_healing: formData.get('ally_healing') || null,
    wards_placed: formData.get('wards_placed') || null,
    items: formData.get('items') || null,
    played_at: formData.get('played_at'),
    notes: formData.get('notes') || null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  // Malformed/tampered participants JSON shouldn't block saving the match
  // itself - same "supplementary data" treatment as the screenshot upload.
  let participants: z.infer<typeof participantsInputSchema> = [];
  const participantsRaw = formData.get('participants');
  if (typeof participantsRaw === 'string' && participantsRaw) {
    try {
      const parsedParticipants = participantsInputSchema.safeParse(JSON.parse(participantsRaw));
      if (parsedParticipants.success) participants = parsedParticipants.data;
    } catch {
      // ignore malformed JSON, just skip participants
    }
  }

  // The screenshot is optional supplementary data - a failed/oversized/
  // wrong-type upload should never block saving the match itself, so any
  // problem here just leaves screenshot_path null instead of returning early.
  let screenshotPath: string | null = null;
  const screenshot = formData.get('screenshot');
  if (screenshot instanceof File && screenshot.size > 0 && screenshot.size <= SCREENSHOT_MAX_BYTES) {
    // Size is checked BEFORE reading any bytes, and the type comes from the
    // file's own magic number rather than the browser-supplied `File.type` -
    // that header is attacker-controlled, and it used to decide both the
    // stored extension and the contentType Storage serves the object back
    // with. The filename is never used at all: the path is user id + a fresh
    // UUID, so a crafted name can't traverse directories or collide.
    const sniffed = await sniffImage(screenshot);
    if (sniffed) {
      const path = `${user.id}/${crypto.randomUUID()}.${sniffed.ext}`;
      const { error: uploadError } = await supabase.storage
        .from('match-screenshots')
        .upload(path, screenshot, { contentType: sniffed.mime });
      if (!uploadError) screenshotPath = path;
    }
  }

  // user_id always comes from the server-verified session, never from the
  // client payload - prevents a tampered form from writing into someone
  // else's rows (RLS would also block it, this is defense in depth).
  const { data: inserted, error } = await supabase
    .from('matches')
    .insert({
      ...parsed.data,
      played_at: parsed.data.played_at.toISOString(),
      user_id: user.id,
      screenshot_path: screenshotPath,
    })
    .select('id')
    .single();

  if (error || !inserted) {
    return { error: 'No se pudo guardar la partida.' };
  }

  if (participants.length > 0) {
    const { error: participantsError } = await supabase.from('match_participants').insert(
      participants.map((p) => ({
        match_id: inserted.id,
        side: p.side,
        god_id: p.godId,
        role: p.role,
        items: p.items.length > 0 ? p.items : null,
      }))
    );
    // Non-fatal: the match itself already saved successfully, losing the
    // ally/enemy breakdown on this one match isn't worth failing the whole save.
    if (participantsError) console.error('Failed to save match participants:', participantsError.message);
  }

  revalidatePath('/');
  revalidatePath('/partidas');
  redirect('/?saved=1');
}
