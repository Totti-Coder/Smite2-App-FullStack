// Records the demo walkthrough as a sequence of 1920x1080 PNG frames.
// scripts/build-gif.ts turns them into the GIF/WebP afterwards.
//
// Why a headless browser instead of the editor's own preview pane: that pane
// caps screenshots at 800x450 regardless of the viewport it emulates, which is
// below HD and not something a resize can fix. Driving Chrome directly also
// removes the browser chrome from the frame and makes the timing deterministic,
// so the recording is reproducible rather than hand-timed.
//
// Uses playwright-core with `channel: 'chrome'`, so it drives the Chrome that
// is already installed rather than downloading a second browser.
//
// Prerequisites: `npm run dev` on :3000, and `npm run seed:demo` already run.
//   npx tsx --env-file=.env.local scripts/capture-demo.ts [--headed] [--out DIR]
import { chromium, type Page } from 'playwright-core';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { DEMO_EMAIL } from './seed-demo';

const BASE = process.env.DEMO_BASE_URL ?? 'http://localhost:3000';
const PASSWORD = process.env.DEMO_USER_PASSWORD;

const outArg = process.argv.indexOf('--out');
const OUT = outArg !== -1 ? process.argv[outArg + 1] : join(import.meta.dirname, '..', '.demo-frames');

// 1080p source. The GIF is downscaled from this rather than captured at its
// final size: shrinking a sharp 1080p frame keeps text legible after GIF's
// 256-colour quantisation, where capturing small would just look soft.
const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 12;

if (!PASSWORD) {
  console.error('Falta DEMO_USER_PASSWORD. Ejecuta primero: npm run seed:demo');
  console.error('(y lanza este script con --env-file=.env.local)');
  process.exit(1);
}

let frame = 0;
let page: Page;

/** Captures `count` frames spaced at the target frame rate, letting animations run between them. */
async function shoot(count: number, label = '') {
  for (let i = 0; i < count; i++) {
    await page.screenshot({ path: join(OUT, `f${String(frame++).padStart(4, '0')}.png`) });
    await page.waitForTimeout(1000 / FPS);
  }
  if (label) console.log(`  ${label.padEnd(34)} -> ${frame} frames`);
}

/** Scrolls by `distance` over `steps` frames, so the pan reads as motion rather than a jump cut. */
async function pan(distance: number, steps: number, label = '') {
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, distance / steps);
    await page.screenshot({ path: join(OUT, `f${String(frame++).padStart(4, '0')}.png`) });
    await page.waitForTimeout(1000 / FPS);
  }
  if (label) console.log(`  ${label.padEnd(34)} -> ${frame} frames`);
}

async function goto(path: string) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
}

async function main() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: !process.argv.includes('--headed'),
    // SwiftShader keeps the WebGL background and the three.js god model
    // rendering when there is no GPU in a headless session - without it those
    // panels come out black, which is precisely the content worth showing.
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars'],
  });

  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
    colorScheme: 'dark',
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
  });

  // Opt into animations for the recording. The app defaults to 'auto', which
  // follows the OS - and a machine with reduced motion enabled would record a
  // completely static page. Set before any script runs, so the first paint
  // already has it.
  await context.addInitScript(() => {
    try {
      window.localStorage.setItem('smite2-motion-pref', 'on');
    } catch {
      // Private mode / blocked storage: the recording still works, just calmer.
    }
  });

  page = await context.newPage();

  console.log(`Grabando ${WIDTH}x${HEIGHT} @ ${FPS}fps -> ${OUT}`);

  // --- 1. login screen --------------------------------------------------
  await goto('/login');
  await page.waitForTimeout(600);
  await shoot(14, 'login (terminal animada)');

  await page.getByPlaceholder('tu@email.com').click();
  await page.getByPlaceholder('tu@email.com').type(DEMO_EMAIL, { delay: 55 });
  await shoot(4);
  await page.getByPlaceholder('contraseña').click();
  // The field masks its own input, so what lands in the frames is dots - but
  // keep the typing delay short so the number of dots isn't a length hint.
  await page.getByPlaceholder('contraseña').type(PASSWORD!, { delay: 25 });
  await shoot(6, 'credenciales');

  await Promise.all([
    page.waitForURL(`${BASE}/`, { timeout: 20000 }),
    page.getByRole('button', { name: /Entrar/ }).last().click(),
  ]);
  await page.waitForTimeout(1200);

  // --- 2. dashboard -------------------------------------------------------
  await shoot(16, 'dashboard (tarjetas + racha)');
  await pan(900, 22, 'tendencia KDA / winrate');
  await shoot(8);
  await pan(1100, 24, 'rol, modo, mejor y peor dios');
  await shoot(8);
  await pan(1200, 24, 'aliados, enemigos, matchups');
  await shoot(10);

  // --- 3. the feature that makes it more than a form ----------------------
  await goto('/matches/new');
  await page.waitForTimeout(800);
  await shoot(14, 'registrar partida');
  await pan(700, 16);
  await shoot(10, 'selector de dios / build');

  // --- 4. catalogue + the 3D view ----------------------------------------
  await goto('/gods');
  await page.waitForTimeout(900);
  await shoot(14, 'catalogo de dioses');

  // Ix Chel specifically: she is the only god shipping a .glb, so hers is the
  // only page that renders the orbital build view (lib/god-models.ts).
  await goto('/gods/ix_chel');
  // The .glb is 9 MB and loads behind an IntersectionObserver, so this needs
  // noticeably longer than a normal page before there is anything to film.
  await page.waitForTimeout(4000);
  await shoot(8, 'ficha de dios');
  // Bring the orbital view into frame and then hold on it - the earlier pass
  // scrolled straight past it and filmed the stats panels instead.
  await pan(420, 10);
  await shoot(28, 'vista orbital 3D');

  // Abilities are filmed on a DIFFERENT god on purpose. Ix Chel is one of
  // only two gods in the catalog (with Artemis) whose ability icons are
  // missing, so her abilities panel is a row of blank squares - the one part
  // of her page not worth showing. Neith has complete icons and scaling data,
  // and the demo account has four matches on her.
  await goto('/gods/neith');
  await page.waitForTimeout(900);
  await pan(520, 12);
  await shoot(14, 'habilidades y escalados');

  await goto('/items');
  await page.waitForTimeout(800);
  await shoot(12, 'catalogo de items');

  await goto('/tierlist');
  await page.waitForTimeout(800);
  await shoot(12, 'tier lists');

  // Close the loop on the dashboard, so the GIF cycles without a visible cut.
  await goto('/');
  await page.waitForTimeout(1200);
  await shoot(14, 'vuelta al dashboard');

  await browser.close();
  console.log(`\n${frame} frames escritos en ${OUT}`);
  console.log(`Duracion aproximada: ${(frame / FPS).toFixed(1)}s`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
