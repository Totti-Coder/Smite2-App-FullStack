import { z } from 'zod';
import godsCatalog from '@/data/gods.json';
import itemsCatalog from '@/data/items.json';

/**
 * Shared input hardening for every server action.
 *
 * WHAT THIS IS NOT FOR: SQL injection. Every query in this app goes through
 * supabase-js/PostgREST, which sends values as bound parameters - there is no
 * string concatenation into SQL anywhere (no raw SQL, no `.rpc()`). Stripping
 * quotes here would add nothing and would actively corrupt real data: Smite
 * has gods like Chang'e, and people have names like O'Brien. Parameterised
 * queries are the defence, and they are already in place.
 *
 * Nor is it the defence against XSS in rendered text - React escapes every
 * interpolated string by default, and this app has no `dangerouslySetInnerHTML`
 * anywhere. Escaping handles the markup-syntax characters (`<`, `&`, quotes).
 *
 * WHAT IT IS FOR is the gap escaping does NOT cover: codepoints that are
 * invisible or that reorder text when displayed. Escaping passes them through
 * untouched because they aren't markup, yet they let someone:
 *   - pad a name with zero-width characters to impersonate another user's
 *     display name on the public tier-list gallery, or slip past a length or
 *     uniqueness check that counts codepoints;
 *   - use bidi overrides (U+202A-202E, U+2066-2069) to make text render in an
 *     order that has nothing to do with what is stored - the "Trojan Source"
 *     trick, which works on any rendered string, not just source code;
 *   - inject C0/C1 control characters that break logs and CSV exports.
 *
 * These are display-integrity problems on pages other people read, so removing
 * the characters outright is the right call - unlike quotes, no legitimate
 * input needs them.
 */

// C0/C1 controls (keeping \t \n \r, which multi-line text legitimately uses),
// zero-width and directional-marker characters, bidi overrides/isolates, and
// the BOM.
const INVISIBLE_OR_BIDI = new RegExp(
  [
    '[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]', // C0 controls + DEL (tab/LF/CR deliberately kept)
    '[\u0080-\u009F]', // C1 controls
    '[\u200B-\u200F]', // zero-width space/joiners + LRM/RLM
    '[\u202A-\u202E]', // bidi embeddings and overrides
    '[\u2060-\u2064]', // word joiner + invisible maths operators
    '[\u2066-\u2069]', // bidi isolates
    '\uFEFF', // BOM / zero-width no-break space
  ].join('|'),
  'g'
);

function stripInvisible(value: string): string {
  // NFC first so visually identical strings normalise to one representation
  // before anything measures or compares them.
  return value.normalize('NFC').replace(INVISIBLE_OR_BIDI, '');
}

/**
 * Single-line free text: no newlines or tabs survive, runs of whitespace
 * collapse to one space, and the value is trimmed. Length is checked AFTER
 * cleaning, so padding a string with invisible characters can't smuggle it
 * past the cap.
 */
export function singleLineText(max: number) {
  return z
    .string()
    .transform((v) => stripInvisible(v).replace(/[\t\n\r]+/g, ' ').replace(/ {2,}/g, ' ').trim())
    .pipe(z.string().max(max));
}

/**
 * Multi-line free text (textareas). Keeps newlines, normalises CRLF, and caps
 * consecutive blank lines so a note can't be padded into an enormous vertical
 * gap on the page.
 */
export function multiLineText(max: number) {
  return z
    .string()
    .transform((v) =>
      stripInvisible(v)
        .replace(/\r\n?/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim()
    )
    .pipe(z.string().max(max));
}

// Allowlists built from the catalogs this app ships. Checking an id against a
// known set is a far stronger guarantee than any amount of character
// filtering: the value either names something real or it is rejected.
export const VALID_GOD_IDS = new Set((godsCatalog as { id: string }[]).map((g) => g.id));
export const VALID_ITEM_NAMES = new Set((itemsCatalog as { name: string }[]).map((i) => i.name));

/** Postgres `uuid` columns reject anything else anyway - this turns that into
 *  a clean validation failure instead of a database error surfacing as a
 *  generic "something went wrong". */
export const uuidSchema = z.string().uuid();

export type SniffedImage = { mime: string; ext: string };

/**
 * Identify an upload from its leading bytes instead of trusting `File.type`.
 *
 * `File.type` is set by the browser from the file's extension and is fully
 * attacker-controlled - a request can claim `image/png` for any bytes at all.
 * Since that value was being used both to pick the stored file extension AND
 * as the `contentType` Supabase Storage serves the object back with, the
 * client effectively chose how its own upload would later be served. Reading
 * the magic number makes the stored type a property of the actual content.
 *
 * Deliberately no SVG: it is the one image format that is also a script host.
 */
export async function sniffImage(file: File): Promise<SniffedImage | null> {
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const at = (i: number, ...bytes: number[]) => bytes.every((b, n) => head[i + n] === b);

  // \x89 P N G \r \n \x1a \n
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return { mime: 'image/png', ext: 'png' };
  // JPEG SOI + marker
  if (at(0, 0xff, 0xd8, 0xff)) return { mime: 'image/jpeg', ext: 'jpg' };
  // "RIFF" .... "WEBP"
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) {
    return { mime: 'image/webp', ext: 'webp' };
  }
  return null;
}
