import { createWorker, type Worker } from 'tesseract.js';

// Two separate workers rather than one whose whitelist gets swapped per
// call: the whitelist is worker-level state, so toggling it on a shared
// worker would race whenever a scan interleaves number and text crops (the
// scoreboard scan does exactly that, per row). Each is created lazily, so
// a page that only ever reads numbers never pays for the text one.
type OcrMode = 'digits' | 'text';

const WHITELIST: Record<OcrMode, string> = {
  // Digits (+ separators seen in the scoreboard: "/", ",", ".", space) only -
  // keeps recognition fast and avoids letters being mistaken for numbers.
  digits: '0123456789/., ',
  // Letters only, both cases, plus the accented characters a Spanish game
  // client actually renders in god names (SÓBEK, TÁNATOS, POSEIDÓN,
  // KUKULKÁN, QUIRÓN) and the space/hyphen in multi-word ones (NE ZHA,
  // AH PUCH, CU CHULAINN). Excluding digits here stops "O" being read as
  // "0" in names, which is the single most common god-name misread.
  text: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÁÉÍÓÚÜÑáéíóúüñ -\'',
};

const workers: Partial<Record<OcrMode, Promise<Worker>>> = {};

// Self-hosted (no CDN) - required by our CSP (script-src 'self', connect-src
// 'self'). All three files live in public/tesseract/.
function getWorker(mode: OcrMode): Promise<Worker> {
  if (!workers[mode]) {
    workers[mode] = createWorker('eng', 1, {
      workerPath: '/tesseract/worker.min.js',
      corePath: '/tesseract/tesseract-core-simd-lstm.wasm.js',
      langPath: '/tesseract',
      gzip: true,
    })
      .then(async (worker) => {
        await worker.setParameters({ tessedit_char_whitelist: WHITELIST[mode] });
        return worker;
      })
      .catch((err) => {
        // Without this, a single transient init failure (e.g. a WASM file
        // hiccup) poisons the module-level cache forever - every OCR
        // attempt for the rest of the page session would instantly re-throw
        // the same stale rejection instead of actually retrying.
        workers[mode] = undefined;
        throw err;
      });
  }
  return workers[mode]!;
}

/** Runs OCR on a cropped canvas region and returns the raw recognized text (digits only). */
export async function recognizeRegion(canvas: HTMLCanvasElement): Promise<string> {
  const worker = await getWorker('digits');
  const {
    data: { text },
  } = await worker.recognize(canvas);
  return text;
}

/** Same, but tuned for reading words (god/player names) instead of numbers. */
export async function recognizeText(canvas: HTMLCanvasElement): Promise<string> {
  const worker = await getWorker('text');
  const {
    data: { text },
  } = await worker.recognize(canvas);
  return text;
}

export async function terminateOcrWorker() {
  for (const mode of Object.keys(workers) as OcrMode[]) {
    const pending = workers[mode];
    if (!pending) continue;
    const worker = await pending;
    await worker.terminate();
    workers[mode] = undefined;
  }
}
