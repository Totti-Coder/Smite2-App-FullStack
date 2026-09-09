'use client';

import { useEffect, useRef, useState } from 'react';
import { OCR_FIELDS, loadCalibration, saveCalibration, clearCalibration, parseOcrText, type CalibrationBox } from '@/lib/ocr-fields';
import { recognizeRegion } from '@/lib/ocr-engine';

type Rect = { x: number; y: number; w: number; h: number }; // in displayed (CSS) px, relative to image

type ReviewRow = { key: string; label: string; targetIds: string[]; values: (number | null)[]; raw: string };

export function ScreenshotImport({ onFileReady }: { onFileReady?: (file: File | null) => void }) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [displaySize, setDisplaySize] = useState<{ w: number; h: number } | null>(null);
  const [calibrating, setCalibrating] = useState(false);
  const [calibIndex, setCalibIndex] = useState(0);
  // Starts empty (matching what the server renders, since there's no
  // localStorage during SSR) and gets populated client-side in an effect
  // below - reading localStorage in the initializer itself caused a
  // hydration mismatch on first paint whenever calibration was already
  // saved from a previous session (the "Recalibrar" button would appear
  // in the client's first render but not in the server HTML).
  const [boxes, setBoxes] = useState<CalibrationBox[]>([]);

  useEffect(() => {
    const saved = loadCalibration();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate hydration-safe pattern: read localStorage (an external system, unavailable during SSR) only after mount, then patch state to match. The one extra render this causes is the intended fix, not a bug.
    if (saved) setBoxes(saved);
  }, []);
  const [draft, setDraft] = useState<Rect | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [status, setStatus] = useState<'idle' | 'recognizing' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [review, setReview] = useState<ReviewRow[] | null>(null);

  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Guards the auto-recognition effect below so it fires exactly once per
  // loaded image instead of looping (runRecognition flips status back to
  // 'idle' on success, which would otherwise re-satisfy its own trigger).
  const autoRunDoneRef = useRef(false);

  function loadImageFile(file: File) {
    const url = URL.createObjectURL(file);
    setImgSrc(url);
    setReview(null);
    setStatus('idle');
    autoRunDoneRef.current = false;
    // Hand the raw file up to the match form so it can be attached to the
    // final submission - intentionally NOT cleared when the review step
    // resets imgSrc back to null (applyToForm), only when the user
    // explicitly discards/replaces the capture.
    onFileReady?.(file);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) loadImageFile(file);
  }

  // Paste a screenshot straight from the clipboard (Ctrl+V), same as Discord -
  // no need to save the file first. Only wired up while no image is loaded,
  // so it can't clobber an in-progress calibration/review by accident.
  useEffect(() => {
    if (imgSrc) return;
    function onWindowPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            loadImageFile(file);
          }
          break;
        }
      }
    }
    window.addEventListener('paste', onWindowPaste);
    return () => window.removeEventListener('paste', onWindowPaste);
  }, [imgSrc]);

  function onImgLoad() {
    const img = imgRef.current;
    if (!img) return;
    setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    setDisplaySize({ w: img.clientWidth, h: img.clientHeight });
  }

  function startCalibration() {
    setCalibrating(true);
    setCalibIndex(0);
    setBoxes([]);
    setDraft(null);
  }

  function pointFromEvent(e: React.PointerEvent) {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: Math.min(Math.max(e.clientX - rect.left, 0), rect.width), y: Math.min(Math.max(e.clientY - rect.top, 0), rect.height) };
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!calibrating) return;
    const p = pointFromEvent(e);
    setDragStart(p);
    setDraft({ x: p.x, y: p.y, w: 0, h: 0 });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!calibrating || !dragStart) return;
    const p = pointFromEvent(e);
    setDraft({
      x: Math.min(dragStart.x, p.x),
      y: Math.min(dragStart.y, p.y),
      w: Math.abs(p.x - dragStart.x),
      h: Math.abs(p.y - dragStart.y),
    });
  }

  function onPointerUp() {
    if (!calibrating || !draft || !displaySize) return;
    setDragStart(null);
    if (draft.w < 4 || draft.h < 4) {
      setDraft(null);
      return; // too small, ignore accidental clicks
    }
    const field = OCR_FIELDS[calibIndex];
    const box: CalibrationBox = {
      key: field.key,
      xPct: draft.x / displaySize.w,
      yPct: draft.y / displaySize.h,
      wPct: draft.w / displaySize.w,
      hPct: draft.h / displaySize.h,
    };
    const next = [...boxes, box];
    setBoxes(next);
    setDraft(null);

    if (calibIndex + 1 < OCR_FIELDS.length) {
      setCalibIndex(calibIndex + 1);
    } else {
      saveCalibration(next);
      setCalibrating(false);
    }
  }

  async function runRecognition() {
    if (!imgRef.current || !naturalSize) return;
    setStatus('recognizing');
    setErrorMsg('');
    try {
      const results: ReviewRow[] = [];
      for (const field of OCR_FIELDS) {
        const box = boxes.find((b) => b.key === field.key);
        if (!box) continue;

        // Crop at full natural resolution, upscaled 2x - small UI text OCRs
        // far more reliably at higher pixel density.
        const sx = box.xPct * naturalSize.w;
        const sy = box.yPct * naturalSize.h;
        const sw = box.wPct * naturalSize.w;
        const sh = box.hPct * naturalSize.h;
        const scale = 2;
        const canvas = document.createElement('canvas');
        canvas.width = sw * scale;
        canvas.height = sh * scale;
        const ctx = canvas.getContext('2d')!;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(imgRef.current, sx, sy, sw, sh, 0, 0, sw * scale, sh * scale);

        const text = await recognizeRegion(canvas);
        const values = parseOcrText(field, text);
        results.push({ key: field.key, label: field.label, targetIds: field.targetIds, values, raw: text.trim() });
      }
      setReview(results);
      setStatus('idle');
    } catch (err) {
      setStatus('error');
      // Tesseract/WASM failures often reject with something that isn't an
      // Error instance (a bare string, or an emscripten abort object) - the
      // old fallback swallowed those into a useless generic message. Surface
      // whatever we actually got, plus log the raw value for devtools.
      let msg: string;
      if (err instanceof Error) msg = err.message;
      else if (typeof err === 'string') msg = err;
      else {
        try {
          msg = JSON.stringify(err);
        } catch {
          msg = String(err);
        }
      }
      setErrorMsg(msg || 'Fallo el OCR (error sin mensaje - mira la consola del navegador, F12).');
      console.error('OCR error:', err);
    }
  }

  // Autofill without an extra click: as soon as an image is loaded AND
  // zones are already calibrated (returning user - most of the time after
  // the first setup), run OCR immediately instead of waiting for the
  // "Reconocer números" button. First-time users still see the calibration
  // prompt/button since there's nothing to auto-run against yet.
  useEffect(() => {
    if (!imgSrc || !displaySize || calibrating) return;
    if (boxes.length !== OCR_FIELDS.length) return;
    if (autoRunDoneRef.current) return;
    autoRunDoneRef.current = true;
    runRecognition();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runRecognition closes over state that changes every render; the ref guard is what actually controls re-firing, not this dep list.
  }, [imgSrc, displaySize, calibrating, boxes.length]);

  const allBlank = review !== null && review.every((r) => r.values.every((v) => v == null));

  function updateReviewValue(rowIdx: number, valueIdx: number, raw: string) {
    setReview((prev) => {
      if (!prev) return prev;
      const copy = [...prev];
      const values = [...copy[rowIdx].values];
      values[valueIdx] = raw === '' ? null : Number(raw);
      copy[rowIdx] = { ...copy[rowIdx], values };
      return copy;
    });
  }

  function applyToForm() {
    if (!review) return;
    for (const row of review) {
      row.targetIds.forEach((id, i) => {
        const val = row.values[i];
        if (val == null) return;
        const el = document.getElementById(id) as HTMLInputElement | null;
        if (el) el.value = String(val);
      });
    }
    const details = document.getElementById('advanced-stats-details') as HTMLDetailsElement | null;
    if (details) details.open = true;
    setReview(null);
    setImgSrc(null);
  }

  const currentField = OCR_FIELDS[calibIndex];

  return (
    <div className="rounded-md border border-ss-line p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-ss-text-secondary">Importar desde screenshot (opcional, beta)</p>
        {boxes.length === OCR_FIELDS.length && !calibrating && (
          <button type="button" onClick={startCalibration} className="text-xs text-ss-text-muted underline hover:text-ss-text">
            Recalibrar
          </button>
        )}
      </div>

      {!imgSrc && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="file"
              aria-label="Captura de la partida"
              accept="image/*"
              onChange={handleFile}
              className="block w-full text-xs text-ss-text-muted file:mr-3 file:rounded-md file:border-0 file:bg-ss-bg-raised file:px-3 file:py-1.5 file:text-xs file:text-ss-text hover:file:bg-ss-card"
            />
            {/* capture="environment" is a no-op on desktop browsers (they just
                open the normal file picker) but on mobile it launches the
                camera directly instead of the "choose source" dialog -
                one tap instead of two. Only worth showing on small screens. */}
            <input
              type="file"
              aria-label="Hacer una foto de la partida con la cámara"
              accept="image/*"
              capture="environment"
              onChange={handleFile}
              className="block w-full text-xs text-ss-text-muted file:mr-3 file:rounded-md file:border-0 file:bg-ss-cyan/15 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ss-cyan hover:file:bg-ss-cyan/25 sm:hidden"
            />
          </div>
          <p className="text-[11px] text-ss-text-muted">o pega la captura con Ctrl+V (Cmd+V en Mac), en cualquier parte de la página</p>
          <p className="text-[11px] text-ss-text-muted">
            📱 Desde el móvil puedes sacarle una foto directamente a la pantalla. Sácala bien de frente (sin ángulo)
            y sin reflejos para que el OCR lea mejor - y calibra las zonas por separado la primera vez, porque una
            captura de PC y una foto de móvil no tienen el mismo encuadre.
          </p>
        </div>
      )}

      {imgSrc && (
        <div className="flex flex-col gap-2">
          {calibrating && currentField && (
            <p className="text-xs text-ss-cyan">
              Dibuja un rectángulo alrededor de: <strong>{currentField.label}</strong> ({calibIndex + 1}/{OCR_FIELDS.length})
            </p>
          )}
          {!calibrating && boxes.length < OCR_FIELDS.length && (
            <div className="flex flex-col gap-1.5 rounded-md border border-ss-cyan/40 bg-ss-cyan/10 p-2.5">
              <p className="text-xs text-ss-text">
                Sin calibrar todavía — sin esto no se puede leer nada de la imagen. Si es una tabla con varios
                jugadores, dibuja cada cuadro sobre <strong>tu propia columna</strong>, no la de un compañero.
              </p>
              <button
                type="button"
                onClick={startCalibration}
                className="self-start rounded-md bg-ss-cyan px-3 py-1.5 text-xs font-semibold text-ss-bg hover:brightness-110"
              >
                Calibrar zonas ahora
              </button>
            </div>
          )}

          <div
            ref={containerRef}
            className="relative w-full max-w-3xl select-none touch-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL, not optimizable */}
            <img ref={imgRef} src={imgSrc} alt="Screenshot cargado" onLoad={onImgLoad} className="w-full rounded border border-ss-line" draggable={false} />
            {displaySize &&
              boxes.map((b) => (
                <div
                  key={b.key}
                  className="pointer-events-none absolute border-2 border-ss-win"
                  style={{ left: b.xPct * displaySize.w, top: b.yPct * displaySize.h, width: b.wPct * displaySize.w, height: b.hPct * displaySize.h }}
                />
              ))}
            {draft && (
              <div className="pointer-events-none absolute border-2 border-ss-cyan bg-ss-cyan/10" style={{ left: draft.x, top: draft.y, width: draft.w, height: draft.h }} />
            )}
          </div>

          {!calibrating && boxes.length === OCR_FIELDS.length && !review && (
            <button
              type="button"
              onClick={runRecognition}
              disabled={status === 'recognizing'}
              className="self-start rounded-md bg-ss-cyan px-3 py-1.5 text-sm font-semibold text-ss-bg hover:brightness-110 disabled:opacity-50"
            >
              {status === 'recognizing' ? 'Leyendo imagen...' : 'Reconocer números'}
            </button>
          )}

          {status === 'error' && <p className="text-xs text-ss-loss">{errorMsg}</p>}

          {review && (
            <div className="flex flex-col gap-2 rounded-md border border-ss-line bg-ss-bg-raised p-2">
              {allBlank && (
                <p className="rounded-md border border-ss-loss/40 bg-ss-loss/10 px-2 py-1.5 text-xs text-ss-loss">
                  No se leyó ningún número. Prueba a recalibrar las zonas (puede que la captura tenga otra resolución/escala) o completa los valores a mano abajo.
                </p>
              )}
              <p className="text-xs text-ss-text-muted">Revisa y corrige antes de aplicar:</p>
              {review.map((row, rowIdx) => (
                <div key={row.key} className="flex items-center gap-2 text-xs">
                  <span className="w-40 shrink-0 text-ss-text-secondary">{row.label}</span>
                  {row.values.map((v, i) => (
                    <input
                      key={i}
                      type="number"
                      aria-label={row.label}
                      value={v ?? ''}
                      onChange={(e) => updateReviewValue(rowIdx, i, e.target.value)}
                      className="w-20 rounded border border-ss-line bg-ss-bg px-1.5 py-1 text-ss-text"
                    />
                  ))}
                  {row.raw && <span className="text-[10px] text-ss-text-muted">leído: &quot;{row.raw}&quot;</span>}
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={applyToForm} className="rounded-md bg-ss-win px-3 py-1.5 text-xs font-semibold text-ss-bg hover:brightness-110">
                  Aplicar al formulario
                </button>
                <button type="button" onClick={() => setReview(null)} className="rounded-md border border-ss-line px-3 py-1.5 text-xs text-ss-text-muted hover:text-ss-text">
                  Descartar
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setImgSrc(null);
              setReview(null);
              setCalibrating(false);
              onFileReady?.(null);
            }}
            className="self-start text-xs text-ss-text-muted underline hover:text-ss-text"
          >
            Sacar otra captura
          </button>
        </div>
      )}

      {boxes.length > 0 && (
        <button
          type="button"
          onClick={() => {
            clearCalibration();
            setBoxes([]);
          }}
          className="mt-2 text-[11px] text-ss-text-muted underline hover:text-ss-loss"
        >
          Borrar calibración guardada
        </button>
      )}
    </div>
  );
}
