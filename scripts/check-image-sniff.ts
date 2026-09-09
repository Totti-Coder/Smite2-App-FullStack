// Verifies that uploaded screenshots are identified by their magic bytes and
// not by the browser-supplied File.type, which a client controls entirely.
// Run: npx tsx scripts/check-image-sniff.ts
import { sniffImage } from '../src/lib/validation/sanitize';

const f = (bytes: number[], type: string, name: string) =>
  new File([new Uint8Array(bytes)], name, { type });

const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const jpg = [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0];
const webp = [0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50];
const svg = [...Buffer.from('<svg onload=alert(1)>')];
const html = [...Buffer.from('<html><script>x</script>')];

const cases: [string, File, string | null][] = [
  ['PNG real', f(png, 'image/png', 'a.png'), 'image/png'],
  ['JPEG real', f(jpg, 'image/jpeg', 'a.jpg'), 'image/jpeg'],
  ['WebP real', f(webp, 'image/webp', 'a.webp'), 'image/webp'],
  ['SVG disfrazado de PNG', f(svg, 'image/png', 'x.png'), null],
  ['HTML disfrazado de PNG', f(html, 'image/png', 'x.png'), null],
  ['PNG real con type mentido', f(png, 'text/html', 'x.png'), 'image/png'],
];

async function main() {
  let pass = 0;
  let fail = 0;
  for (const [name, file, expected] of cases) {
    const got = await sniffImage(file);
    const ok = (got?.mime ?? null) === expected;
    if (ok) pass++;
    else fail++;
    console.log((ok ? 'PASS' : 'FAIL').padEnd(5), name, '->', got?.mime ?? 'rechazado');
  }
  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
}

main();
