import { z } from 'zod';
import { MAX_AUTHOR, MAX_TIERS, MAX_TITLE } from '@/lib/tier-list';
import { singleLineText } from '@/lib/validation/sanitize';

// Mirrors the CHECK constraints in supabase/migrations/0010_tier_lists.sql.
// This is the real gate for the jsonb `tiers` column, which Postgres itself
// can't constrain in any useful way - and since these rows are PUBLICLY
// readable, unvalidated content here would be world-visible.
const tierSchema = z.object({
  id: z.string().min(1).max(40),
  label: singleLineText(12).pipe(z.string().min(1, 'Cada tier necesita una etiqueta')),
  // Hex only - this value is interpolated into an inline style on a public
  // page, so anything else (a url(), a CSS expression) has no business here.
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color inválido'),
  // God ids come from our own catalog; the server action cross-checks them
  // against gods.json so a tampered payload can't inject arbitrary strings.
  godIds: z.array(z.string().min(1).max(40)).max(200),
});

// title and author_name are the two strings on this page that strangers read,
// which makes them the place where invisible/bidi characters actually matter:
// they'd let someone pad a name to impersonate another author in the gallery,
// or reorder how a title renders. singleLineText strips them and measures the
// length AFTER cleaning, so padding can't smuggle a value past the cap.
export const tierListInputSchema = z.object({
  title: singleLineText(MAX_TITLE).pipe(z.string().min(1, 'Ponle un título')),
  author_name: singleLineText(MAX_AUTHOR).pipe(z.string().min(1, 'Ponle un nombre de autor')),
  tiers: z.array(tierSchema).min(1, 'Necesitas al menos un tier').max(MAX_TIERS),
});

export type TierListInput = z.infer<typeof tierListInputSchema>;
