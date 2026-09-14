// One-time (re-run when the catalogs change) precompute step: downloads
// every god portrait, item icon, and role icon, and stores a perceptual
// hash for each in src/data/icon-hashes.json. This is what the client-side
// screenshot matcher (icon-match.ts) compares crops against at runtime -
// doing the fetch+hash server-side means the browser never needs to touch
// the actual reference images (no CORS headaches reading cross-origin
// canvas pixels, no re-hosting 345 icons ourselves).
//
// Usage: npx tsx scripts/build-icon-hashes.ts
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dHashFromRgb, HASH_WIDTH, HASH_HEIGHT } from '../src/lib/icon-hash-core';
import gods from '../src/data/gods.json';
import items from '../src/data/items.json';
import { roleIconUrl } from '../src/lib/god-assets';
import type { Role } from '../src/lib/supabase/database.types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROLES: Role[] = ['solo', 'jungle', 'mid', 'adc', 'support'];

async function hashUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const { data } = await sharp(buf)
      .resize(HASH_WIDTH, HASH_HEIGHT, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return dHashFromRgb(data);
  } catch (e) {
    console.warn(`  failed: ${url} - ${(e as Error).message}`);
    return null;
  }
}

async function main() {
  const godHashes: Record<string, string> = {};
  const itemHashes: Record<string, string> = {};
  const roleHashes: Record<string, string> = {};

  console.log(`Hashing ${gods.length} god portraits...`);
  for (const g of gods as { id: string; icon_url: string | null }[]) {
    if (!g.icon_url) continue;
    const h = await hashUrl(g.icon_url);
    if (h) godHashes[g.id] = h;
  }

  console.log(`Hashing ${items.length} item icons...`);
  for (const it of items as { id: string; icon_url: string | null }[]) {
    // Items with no known CDN asset yet simply have nothing to hash.
    if (!it.icon_url) continue;
    const h = await hashUrl(it.icon_url);
    if (h) itemHashes[it.id] = h;
  }

  console.log('Hashing 5 role icons...');
  for (const r of ROLES) {
    const h = await hashUrl(roleIconUrl(r));
    if (h) roleHashes[r] = h;
  }

  const out = { gods: godHashes, items: itemHashes, roles: roleHashes };
  const outPath = path.join(__dirname, '..', 'src', 'data', 'icon-hashes.json');
  writeFileSync(outPath, JSON.stringify(out));
  console.log(
    `Wrote ${outPath}: ${Object.keys(godHashes).length} gods, ${Object.keys(itemHashes).length} items, ${Object.keys(roleHashes).length} roles.`
  );
}

main();
