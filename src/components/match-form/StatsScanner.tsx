'use client';

import { useEffect, useRef, useState } from 'react';
import {
  loadStatsColumnCalibration,
  saveStatsColumnCalibration,
  clearStatsColumnCalibration,
  subBoxAt,
  toColRelative,
  type CalibBox,
  type StatsColumnCalibration,
} from '@/lib/stats-table-fields';
import { OCR_FIELDS, parseOcrText } from '@/lib/ocr-fields';
import { recognizeRegion } from '@/lib/ocr-engine';

type Rect = { x: number; y: number; w: number; h: number }; // displayed CSS px

type ReviewRow = { key: string; label: string; targetIds: string[]; values: (number | null)[]; raw: string };

type CalibStep = { key: string; label: string; hint: string };

// Step 0 marks a reference column (any of the 10, doesn't matter which) -
// everything after it is calibrated relative to THAT box. Reused later on
// every future capture by drawing a fresh box around whichever column is
// actually the player's own that match (see `selfBox`).
const CALIB_STEPS: CalibStep[] = [
  { key: 'column', label: 'Una columna cualquiera, completa', hint: 'Dibuja cualquiera de las 10 columnas, de arriba a abajo entero: desde el retrato del dios hasta "Centinelas colocados". No importa cuál elijas, es solo de referencia.' },
  ...OCR_FIELDS.map((f) => ({
    key: f.key,
    label: f.label,
    hint: `Dentro de esa misma columna: marca solo el número de "${f.label}" en esa fila.`,
  })),
];

function boxPixels(box: CalibBox, natural: { w: number; h: number }) {
  return { sx: box.xPct * natural.w, sy: box.yPct * natural.h, sw: box.wPct * natural.w, sh: box.hPct * natural.h };
}

export function StatsScanner() {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [displaySize, setDisplaySize] = useState<{ w: number; h: number } | null>(null);

  const [calib, setCalib] = useState<StatsColumnCalibration | null>(null);
  const [calibrating, setCalibrating] = useState(false);
  const [calibStepIdx, setCalibStepIdx] = useState(0);
  const [calibDraft, setCalibDraft] = useState<CalibBox[]>([]);

  // Once calibrated, every future capture just needs ONE box drawn around
  // wherever the player's own column happens to be THIS match - no stepped
  // wizard, a single drag does it.
  const [selfBox, setSelfBox] = useState<CalibBox | null>(null);

  const [draft, setDraft] = useState<Rect | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number } | null>(null);
  const magnifierRef = useRef<HTMLCanvasElement>(null);

  const [scanning, setScanning] = useState(false);
  const [review, setReview] = useState<ReviewRow[] | null>(null);
  const [error, setError] = useState('');

  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = loadStatsColumnCalibration();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe localStorage read, same pattern as the other scanners
    if (saved) setCalib(saved);
  }, []);

  function loadImageFile(file: File) {
    const url = URL.createObjectURL(file);
    setImgSrc(url);
    setReview(null);
    setSelfBox(null);
    setError('');
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) loadImageFile(file);
  }

  useEffect(() => {
    if (imgSrc) return;
    function onPaste(e: ClipboardEvent) {
      const it = e.clipboardData?.items;
      if (!it) return;
      for (const item of it) {
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
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [imgSrc]);

  function onImgLoad() {
    const img = imgRef.current;
    if (!img) return;
    setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    setDisplaySize({ w: img.clientWidth, h: img.clientHeight });
  }

  const MAG_SIZE = 160;
  const MAG_ZOOM = 5;
  // Drawing happens either during the one-time calibration wizard, or -
  // afterwards, forever - marking the single "this is my column" box.
  const drawingActive = calibrating || (!!calib && !selfBox && !review);

  useEffect(() => {
    if (!drawingActive || !hoverPoint || !imgRef.current || !naturalSize || !displaySize) return;
    const canvas = magnifierRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const nx = (hoverPoint.x / displaySize.w) * naturalSize.w;
    const ny = (hoverPoint.y / displaySize.h) * naturalSize.h;
    const srcSize = MAG_SIZE / MAG_ZOOM;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, MAG_SIZE, MAG_SIZE);
    ctx.drawImage(imgRef.current, nx - srcSize / 2, ny - srcSize / 2, srcSize, srcSize, 0, 0, MAG_SIZE, MAG_SIZE);
    ctx.strokeStyle = '#16c8d4';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(MAG_SIZE / 2, 0);
    ctx.lineTo(MAG_SIZE / 2, MAG_SIZE);
    ctx.moveTo(0, MAG_SIZE / 2);
    ctx.lineTo(MAG_SIZE, MAG_SIZE / 2);
    ctx.stroke();
  }, [drawingActive, hoverPoint, naturalSize, displaySize]);

  function startCalibration() {
    setCalibrating(true);
    setCalibStepIdx(0);
    setCalibDraft([]);
    setDraft(null);
  }

  function pointFromEvent(e: React.PointerEvent) {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: Math.min(Math.max(e.clientX - rect.left, 0), rect.width), y: Math.min(Math.max(e.clientY - rect.top, 0), rect.height) };
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!drawingActive) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = pointFromEvent(e);
    setDragStart(p);
    setDraft({ x: p.x, y: p.y, w: 0, h: 0 });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drawingActive) return;
    const p = pointFromEvent(e);
    setHoverPoint(p);
    if (!dragStart) return;
    setDraft({ x: Math.min(dragStart.x, p.x), y: Math.min(dragStart.y, p.y), w: Math.abs(p.x - dragStart.x), h: Math.abs(p.y - dragStart.y) });
  }

  function onPointerUp(e: React.PointerEvent) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (!drawingActive || !draft || !displaySize) return;
    setDragStart(null);
    if (draft.w < 4 || draft.h < 4) {
      setDraft(null);
      return;
    }
    const box: CalibBox = { xPct: draft.x / displaySize.w, yPct: draft.y / displaySize.h, wPct: draft.w / displaySize.w, hPct: draft.h / displaySize.h };
    setDraft(null);

    if (!calibrating) {
      // Post-calibration mode: this single box IS the player's column for
      // this capture - nothing further to draw.
      setSelfBox(box);
      return;
    }

    const next = [...calibDraft, box];
    setCalibDraft(next);

    if (calibStepIdx + 1 < CALIB_STEPS.length) {
      setCalibStepIdx(calibStepIdx + 1);
    } else {
      const [colBox, ...fieldBoxes] = next;
      const fieldsRel: StatsColumnCalibration['fieldsRel'] = {};
      OCR_FIELDS.forEach((f, i) => {
        fieldsRel[f.key] = toColRelative(colBox, fieldBoxes[i]);
      });
      const finalCalib: StatsColumnCalibration = { fieldsRel };
      saveStatsColumnCalibration(finalCalib);
      setCalib(finalCalib);
      setCalibrating(false);
    }
  }

  async function runScan() {
    if (!calib || !selfBox || !imgRef.current || !naturalSize) return;
    setScanning(true);
    setError('');
    try {
      const img = imgRef.current;
      const results: ReviewRow[] = [];
      for (const field of OCR_FIELDS) {
        const rel = calib.fieldsRel[field.key];
        if (!rel) continue;
        const px = boxPixels(subBoxAt(selfBox, rel), naturalSize);
        const scale = 2;
        const canvas = document.createElement('canvas');
        canvas.width = px.sw * scale;
        canvas.height = px.sh * scale;
        const ctx = canvas.getContext('2d')!;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, px.sx, px.sy, px.sw, px.sh, 0, 0, canvas.width, canvas.height);
        const text = await recognizeRegion(canvas);
        const values = parseOcrText(field, text);
        results.push({ key: field.key, label: field.label, targetIds: field.targetIds, values, raw: text.trim() });
      }
      setReview(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fallo el escaneo.');
    } finally {
      setScanning(false);
    }
  }

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
  }

  const currentStep = CALIB_STEPS[calibStepIdx];
  const allBlank = review !== null && review.every((r) => r.values.every((v) => v == null));

  return (
    <div className="rounded-md border border-ss-line p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-ss-text-secondary">Tabla de comparar stats (tu columna, opcional)</p>
        {calib && !calibrating && (
          <button
            type="button"
            onClick={() => {
              clearStatsColumnCalibration();
              setCalib(null);
              startCalibration();
            }}
            className="text-xs text-ss-text-muted underline hover:text-ss-text"
          >
            Recalibrar
          </button>
        )}
      </div>

      {!imgSrc && (
        <div className="flex flex-col gap-2">
          <input
            type="file"
            aria-label="Captura de comparar estadísticas"
            accept="image/*"
            onChange={handleFile}
            className="block w-full text-xs text-ss-text-muted file:mr-3 file:rounded-md file:border-0 file:bg-ss-bg-raised file:px-3 file:py-1.5 file:text-xs file:text-ss-text hover:file:bg-ss-card"
          />
          <p className="text-[11px] text-ss-text-muted">
            o pega la captura con Ctrl+V - la pantalla de fin de partida que compara stats de los 10 jugadores en columnas
            (oro, daño, curación, centinelas...). Distinta al marcador de arriba.
          </p>
        </div>
      )}

      {imgSrc && (
        <div className="flex flex-col gap-2">
          {calibrating && currentStep && (
            <div className="rounded-md border border-ss-cyan/40 bg-ss-cyan/10 p-2.5">
              {calibStepIdx === 0 && (
                <div className="mb-2 rounded bg-ss-bg/60 p-2 text-[11px] text-ss-text-secondary">
                  <p className="mb-1 font-semibold text-ss-text">Cómo dibujar: haz click y arrastra</p>
                  <p>Mantén apretado el botón del ratón en una esquina, arrastra hasta la esquina opuesta, y suelta. Eso confirma el recuadro y pasa al siguiente paso automáticamente.</p>
                  <p className="mt-1.5">
                    Esto se calibra <strong>una sola vez, para siempre</strong>: marca una columna cualquiera completa, y después dónde está cada número
                    dentro de ella. En cada partida futura ya no vas a tener que repetir esto - solo vas a arrastrar UN rectángulo sobre tu propia
                    columna (la que sea esa vez) y listo.
                  </p>
                </div>
              )}

              <div className="mb-1.5 flex flex-wrap gap-1">
                {CALIB_STEPS.map((s, i) => (
                  <span
                    key={s.key}
                    className={`rounded-full px-2 py-0.5 text-[10px] ${
                      i === calibStepIdx
                        ? 'bg-ss-cyan text-ss-bg font-semibold'
                        : i < calibStepIdx
                          ? 'bg-ss-win/20 text-ss-win'
                          : 'bg-ss-bg/60 text-ss-text-muted'
                    }`}
                  >
                    {i < calibStepIdx ? '✓ ' : ''}
                    {s.label}
                  </span>
                ))}
              </div>

              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-ss-cyan">
                    Paso {calibStepIdx + 1} de {CALIB_STEPS.length}: {currentStep.label}
                  </p>
                  <p className="text-[11px] text-ss-text-muted">{currentStep.hint}</p>
                </div>
                {calibStepIdx > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setCalibDraft(calibDraft.slice(0, -1));
                      setCalibStepIdx(calibStepIdx - 1);
                      setDraft(null);
                    }}
                    className="shrink-0 whitespace-nowrap rounded-md border border-ss-line px-2 py-1 text-[11px] text-ss-text-muted hover:text-ss-text"
                  >
                    ← Deshacer
                  </button>
                )}
              </div>
            </div>
          )}
          {!calibrating && !calib && (
            <div className="flex flex-col gap-1.5 rounded-md border border-ss-cyan/40 bg-ss-cyan/10 p-2.5">
              <p className="text-xs text-ss-text">Sin calibrar todavía - necesario una sola vez, después se reusa siempre.</p>
              <button type="button" onClick={startCalibration} className="self-start rounded-md bg-ss-cyan px-3 py-1.5 text-xs font-semibold text-ss-bg hover:brightness-110">
                Calibrar ahora
              </button>
            </div>
          )}
          {!calibrating && calib && !selfBox && !review && (
            <p className="rounded-md border border-ss-cyan/40 bg-ss-cyan/10 px-2.5 py-1.5 text-xs text-ss-text">
              Dibuja un rectángulo sobre <strong>tu propia columna</strong>, de arriba a abajo entera (portrait hasta centinelas).
            </p>
          )}

          <div
            ref={containerRef}
            className="relative w-full max-w-3xl select-none touch-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onPointerLeave={() => setHoverPoint(null)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL, not optimizable */}
            <img ref={imgRef} src={imgSrc} alt="Captura de la tabla de stats" onLoad={onImgLoad} className="w-full rounded border border-ss-line" draggable={false} />

            {displaySize && selfBox && !review && (
              <div
                className="pointer-events-none absolute border-2 border-ss-cyan bg-ss-cyan/10"
                style={{ left: selfBox.xPct * displaySize.w, top: selfBox.yPct * displaySize.h, width: selfBox.wPct * displaySize.w, height: selfBox.hPct * displaySize.h }}
              />
            )}

            {draft && <div className="pointer-events-none absolute border-2 border-ss-cyan bg-ss-cyan/10" style={{ left: draft.x, top: draft.y, width: draft.w, height: draft.h }} />}

            {drawingActive && hoverPoint && displaySize && (
              <canvas
                ref={magnifierRef}
                width={MAG_SIZE}
                height={MAG_SIZE}
                className="pointer-events-none absolute rounded-md border-2 border-ss-cyan shadow-xl"
                style={{
                  left: Math.min(hoverPoint.x + 24, displaySize.w - MAG_SIZE),
                  top: Math.min(hoverPoint.y + 24, displaySize.h - MAG_SIZE),
                  background: '#0a0d15',
                }}
              />
            )}
          </div>

          {!calibrating && calib && selfBox && !review && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={runScan}
                disabled={scanning}
                className="self-start rounded-md bg-ss-cyan px-3 py-1.5 text-sm font-semibold text-ss-bg hover:brightness-110 disabled:opacity-50"
              >
                {scanning ? 'Leyendo tu columna...' : 'Leer mis stats'}
              </button>
              <button type="button" onClick={() => setSelfBox(null)} className="text-xs text-ss-text-muted underline hover:text-ss-text">
                Volver a marcar la columna
              </button>
            </div>
          )}

          {error && <p className="text-xs text-ss-loss">{error}</p>}

          {review && (
            <div className="flex flex-col gap-2 rounded-md border border-ss-line bg-ss-bg-raised p-2">
              {allBlank && (
                <p className="rounded-md border border-ss-loss/40 bg-ss-loss/10 px-2 py-1.5 text-xs text-ss-loss">
                  No se leyó ningún número. Prueba a marcar de nuevo tu columna (puede que el rectángulo no la cubra bien) o completa los valores a mano abajo.
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
                      // The visible name of each field is the row's <span>,
                      // which a screen reader never associates with the input
                      // on its own - so every one of these announced as an
                      // unlabelled number box.
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
              setSelfBox(null);
            }}
            className="self-start text-xs text-ss-text-muted underline hover:text-ss-text"
          >
            Sacar otra captura
          </button>
        </div>
      )}

      {calib && (
        <button
          type="button"
          onClick={() => {
            clearStatsColumnCalibration();
            setCalib(null);
          }}
          className="mt-2 text-[11px] text-ss-text-muted underline hover:text-ss-loss"
        >
          Borrar calibración guardada
        </button>
      )}
    </div>
  );
}
