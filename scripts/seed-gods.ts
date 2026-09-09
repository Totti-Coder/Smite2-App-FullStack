// Run once after creating the Supabase project: npm run seed:gods
// Requires SUPABASE_SERVICE_ROLE_KEY (server-only secret, never expose to the client).
import { createClient } from '@supabase/supabase-js';
import gods from '../src/data/gods.json';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

async function main() {
  const { error, count } = await supabase
    .from('gods')
    .upsert(gods, { onConflict: 'id', count: 'exact' });

  if (error) {
    console.error('Seed failed:', error.message);
    process.exit(1);
  }

  console.log(`Seeded ${count ?? gods.length} gods.`);
}

main();
