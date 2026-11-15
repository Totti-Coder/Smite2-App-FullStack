// Turns the frames from capture-demo.ts into the animated files the README
// embeds. Produces two, because neither format alone does the job:
//
//   docs/demo.gif   - GIF is capped at 256 colours per frame. On a dark UI
//                     with neon accents and soft gradients that is genuinely
//                     tight, so this is the compatible fallback, not the good
//                     one. Downscaled from 1080p rather than captured small:
//                     shrinking a sharp frame keeps text readable after
//                     quantisation, where capturing small just looks soft.
//   docs/demo.webp  - animated WebP, full resolution, true colour, and far
//                     smaller than the GIF despite being much better. GitHub
//                     renders it in a README via <img>.
//
// Two passes on purpose. Holding 300 frames of 1920x1080 RGBA in memory is
// ~2.5 GB, so each frame is resized to a temporary file first and the encoder
// then joins those from disk.
//
//   npx tsx scripts/build-gif.ts [--gif-width 960] [--webp-width 1440]
import sharp from 'sharp';
import { readdirSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const FRAMES = join(ROOT, '.demo-frames');
const OUT_DIR = join(ROOT, 'docs');
const TMP = join(ROOT, '.demo-frames', '_scaled');

const FPS = 12;
const DELAY = Math.round(1000 / FPS);

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : Number(process.argv[i + 1]);
}

const GIF_WIDTH = arg('gif-width', 960);
const WEBP_WIDTH = arg('webp-width', 1440);

function frameFiles(): string[] {
  return readdirSync(FRAMES)
    .filter((f) => /^f\d+\.png$/.test(f))
    .sort()
    .map((f) => join(FRAMES, f));
}

/** Resizes every frame to `width` on disk and returns the new paths, in order. */
async function scaleAll(files: string[], width: number, tag: string): Promise<string[]> {
  const dir = join(TMP, tag);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  const out: string[] = [];
  for (const [i, file] of files.entries()) {
    const target = join(dir, `${String(i).padStart(4, '0')}.png`);
    // kernel: lanczos3 is sharp's default and the right one here - the frames
    // are full of small text, which is what a sharper kernel protects.
    await sharp(file).resize({ width, kernel: 'lanczos3' }).png({ compressionLevel: 1 }).toFile(target);
    out.push(target);
  }
  return out;
}

function mb(path: string): string {
  return `${(statSync(path).size / 1024 / 1024).toFixed(1)} MB`;
}

async function main() {
  const files = frameFiles();
  if (files.length === 0) {
    console.error(`No hay frames en ${FRAMES}. Ejecuta primero: npm run demo:capture`);
    process.exit(1);
  }
  mkdirSync(OUT_DIR, { recursive: true });
  console.log(`${files.length} frames @ ${FPS}fps (${(files.length / FPS).toFixed(1)}s)`);

  // --- WebP: the good one ------------------------------------------------
  if (process.argv.includes('--gif-only')) {
    console.log('\n(--gif-only: se conserva el WebP existente)');
  } else {
  console.log(`\nEscalando a ${WEBP_WIDTH}px para WebP...`);
  const webpFrames = await scaleAll(files, WEBP_WIDTH, 'webp');
  const webpPath = join(OUT_DIR, 'demo.webp');
  await sharp(webpFrames, { join: { animated: true } })
    .webp({ quality: 70, effort: 5, loop: 0, delay: new Array(files.length).fill(DELAY) })
    .toFile(webpPath);
  console.log(`docs/demo.webp  ${WEBP_WIDTH}px  ${mb(webpPath)}`);
  }

  // --- GIF: the compatible one -------------------------------------------
  console.log(`\nEscalando a ${GIF_WIDTH}px para GIF...`);
  const gifFrames = await scaleAll(files, GIF_WIDTH, 'gif');
  const gifPath = join(OUT_DIR, 'demo.gif');
  await sharp(gifFrames, { join: { animated: true } })
    .gif({
      // Full palette: the UI is dark with cyan/purple accents, and dropping
      // below 256 makes the gradients band visibly.
      colours: 256,
      // Dithering trades file size for smooth gradients. At 1.0 the dark
      // panels stay smooth instead of posterising into flat blocks.
      dither: 1,
      effort: 8,
      // Re-use pixels between frames where they barely changed. Most of this
      // recording is a static page under a slow scroll, so this is where the
      // size actually comes from - and it dominates every other knob here.
      // Measured on this recording at 960px: 8 -> 10.8 MB, 16 -> 6.6 MB,
      // and 24 -> smaller still but with visible smearing on the scrolling
      // text. 16 is the last value where the panels stay clean.
      interFrameMaxError: 16,
      loop: 0,
      delay: new Array(files.length).fill(DELAY),
    })
    .toFile(gifPath);
  console.log(`docs/demo.gif   ${GIF_WIDTH}px  ${mb(gifPath)}`);

  rmSync(TMP, { recursive: true, force: true });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
