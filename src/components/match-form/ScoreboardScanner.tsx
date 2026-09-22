'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  loadScoreboardCalibration,
  saveScoreboardCalibration,
  clearScoreboardCalibration,
  rowBoxAt,
  subBoxAt,
  toRowRelative,
  SCOREBOARD_ROWS,
  ITEM_SLOTS_PER_ROW,
  type CalibBox,
  type ScoreboardCalibration,
} from '@/lib/scoreboard-fields';
import { hashCanvasRegion, matchIcon, isLikelyEmptySlot, confidenceLevel } from '@/lib/icon-match';
import { matchIconLearned, saveLearnedHash, clearLearnedHashes, learnedCount } from '@/lib/icon-learn';
import { matchGodByName, rememberGodName } from '@/lib/god-name-match';
import { recognizeText } from '@/lib/ocr-engine';
import { ROLE_LABEL } from '@/lib/god-assets';
import type { Role } from '@/lib/supabase/database.types';
import { ItemArt } from '@/components/ItemArt';

type Rect = { x: number; y: number; w: number; h: number }; // displayed CSS px

type GodInfo = { id: string; name: string; primary_role: string; icon_url: string | null };
// icon_url is nullable, matching the catalog: an item can ship before its
// CDN asset name is known (see components/ItemArt.tsx).
type ItemInfo = { id: string; name: string; icon_url: string | null; tier: string };

// Ally/enemy items always empty - items are only ever detected for the
// player's OWN row (see `selfItems` below), never for the other 9 players.
export type Participant = { side: 'ally' | 'enemy'; godId: string | null; role: Role | null; items: string[] };

export type ScanApplyResult = {
  participants: Participant[];
  itemIds: string[]; // the player's own detected build, empty if none/no self row found
};

type RowState = {
  side: 'self' | 'ally' | 'enemy';
  godId: string | null;
  godConfidence: number | null;
  godHash: string; // kept so `apply()` can learn from whatever the user ends up confirming
  nameText: string; // raw OCR of the name cell - shown as a diagnostic and learned from on apply
  godSource: 'name' | 'hash' | null; // which signal produced godId, for the review UI
  role: Role | null;
  roleConfidence: number | null;
  roleHash: string;
  roleThumb: string; // diagnostic preview - so a bad match is visibly "wrong crop" vs "wrong guess"
  thumb: string;
};

const CALIB_STEPS: { key: string; phase: 'table' | 'fields'; label: string; hint: string }[] = [
  { key: 'row1', phase: 'table', label: 'Toda la fila 1 (aliados)', hint: 'Marca el jugador de arriba del todo (fila 1), de punta a punta: desde el borde izquierdo hasta el borde derecho, altura completa de esa fila.' },
  { key: 'row5', phase: 'table', label: 'Toda la fila 5 (aliados)', hint: 'La última fila del equipo de ARRIBA (jugador #5, justo antes de la línea divisoria "E M A Oro Objetos").' },
  { key: 'row6', phase: 'table', label: 'Toda la fila 6 (enemigos)', hint: 'Ahora el PRIMER jugador del equipo de ABAJO (justo después de la línea divisoria) - es una fila nueva, no reutiliza la de arriba.' },
  { key: 'row10', phase: 'table', label: 'Toda la fila 10 (enemigos)', hint: 'La última fila del equipo de ABAJO (jugador #10, el último de todos).' },
  { key: 'portraitRel', phase: 'fields', label: 'Retrato del dios', hint: 'Dentro de la fila 1: marca solo la fotito/ícono del dios (el círculo o cuadrado con su cara), sin el nombre ni los números.' },
  { key: 'nameRel', phase: 'fields', label: 'Nombre del dios (texto)', hint: 'Dentro de la fila 1: el NOMBRE del dios escrito en letras (ej. "JANO", "SÓBEK"), no el del jugador. Este es el paso que más importa: de aquí sale la detección del dios.' },
  { key: 'roleRel', phase: 'fields', label: 'Ícono de rol', hint: 'Dentro de la fila 1: la insignia chiquita pegada arriba del retrato que indica el rol (jungla, solo, etc).' },
  { key: 'itemsRel', phase: 'fields', label: 'Franja de items', hint: 'Dentro de la fila 1: toda la tira de íconos de la build, de punta a punta (aunque tenga menos de 7 todavía). Solo se usa en tu propia fila.' },
];

function boxPixels(box: CalibBox, natural: { w: number; h: number }) {
  return { sx: box.xPct * natural.w, sy: box.yPct * natural.h, sw: box.wPct * natural.w, sh: box.hPct * natural.h };
}

export function ScoreboardScanner({
  gods,
  items,
  selectedGodId,
  onApply,
  onFileReady,
}: {
  gods: GodInfo[];
  items: ItemInfo[];
  selectedGodId: string | null;
  onApply: (result: ScanApplyResult) => void;
  // The raw screenshot File, so the parent can attach it to the match
  // submission for permanent storage - independent of everything this
  // component detects out of it.
  onFileReady?: (file: File | null) => void;
}) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [displaySize, setDisplaySize] = useState<{ w: number; h: number } | null>(null);

  const [calib, setCalib] = useState<ScoreboardCalibration | null>(null);
  const [calibrating, setCalibrating] = useState(false);
  const [calibStepIdx, setCalibStepIdx] = useState(0);
  const [calibDraft, setCalibDraft] = useState<CalibBox[]>([]); // raw drawn boxes, image-relative fractions
  const [draft, setDraft] = useState<Rect | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  // Drives the zoom magnifier during calibration - the actual pixel targets
  // (role badges especially) are tiny at normal zoom, near-impossible to box
  // precisely with a mouse without seeing a magnified view of what's under it.
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number } | null>(null);
  const magnifierRef = useRef<HTMLCanvasElement>(null);

  // Starts at 0 (matching what the server renders, no localStorage during
  // SSR) and gets the real count client-side in an effect - reading
  // localStorage directly during render caused the exact same hydration
  // mismatch the `boxes` state had before (see the comment on the
  // calibration-load effect below).
  const [learnedTotal, setLearnedTotal] = useState(0);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe localStorage read, same pattern as calib below
    setLearnedTotal(learnedCount());
  }, []);

  const [scanning, setScanning] = useState(false);
  const [rows, setRows] = useState<RowState[] | null>(null);
  const [selfHalf, setSelfHalf] = useState<'top' | 'bottom' | null>(null);
  // Detected ONLY for the player's own row, never for the other 9 - a
  // separate array/thumb rather than another RowState field since it's a
  // one-off, not something every row carries.
  const [selfItems, setSelfItems] = useState<string[]>([]);
  const [selfItemsStripThumb, setSelfItemsStripThumb] = useState<string | null>(null);
  const [error, setError] = useState('');

  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const godById = useRef(new Map(gods.map((g) => [g.id, g])));
  const itemById = useRef(new Map(items.map((i) => [i.id, i])));

  useEffect(() => {
    const saved = loadScoreboardCalibration();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe localStorage read, same pattern as ScreenshotImport
    if (saved) setCalib(saved);
  }, []);

  // useCallback, not a plain function: the paste listener below captures it,
  // and a listener registered on one render would otherwise keep calling that
  // render's closure - including its copy of the onFileReady prop.
  const loadImageFile = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    setImgSrc(url);
    setRows(null);
    setSelfItems([]);
    setSelfItemsStripThumb(null);
    setError('');
    onFileReady?.(file);
  }, [onFileReady]);

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
  }, [imgSrc, loadImageFile]);

  function onImgLoad() {
    const img = imgRef.current;
    if (!img) return;
    setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    setDisplaySize({ w: img.clientWidth, h: img.clientHeight });
  }

  const MAG_SIZE = 160; // canvas px
  const MAG_ZOOM = 5;

  useEffect(() => {
    if (!calibrating || !hoverPoint || !imgRef.current || !naturalSize || !displaySize) return;
    const canvas = magnifierRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // hoverPoint is in displayed CSS px - convert to the <img>'s own
    // natural pixel space, since that's the coordinate system drawImage's
    // source rectangle actually uses.
    const nx = (hoverPoint.x / displaySize.w) * naturalSize.w;
    const ny = (hoverPoint.y / displaySize.h) * naturalSize.h;
    const srcSize = MAG_SIZE / MAG_ZOOM;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, MAG_SIZE, MAG_SIZE);
    ctx.drawImage(imgRef.current, nx - srcSize / 2, ny - srcSize / 2, srcSize, srcSize, 0, 0, MAG_SIZE, MAG_SIZE);

    // Crosshair marking exactly where the cursor is, so the box corner you
    // place lands on the pixel you actually meant.
    ctx.strokeStyle = '#16c8d4';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(MAG_SIZE / 2, 0);
    ctx.lineTo(MAG_SIZE / 2, MAG_SIZE);
    ctx.moveTo(0, MAG_SIZE / 2);
    ctx.lineTo(MAG_SIZE, MAG_SIZE / 2);
    ctx.stroke();
  }, [calibrating, hoverPoint, naturalSize, displaySize]);

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
    if (!calibrating) return;
    // Without this, dragging the cursor even slightly outside the image
    // (easy near the edges, or just moving fast) hands pointermove/pointerup
    // to whatever element is now under the cursor instead of this container -
    // the drag would silently stop updating or never "release" at all. Pointer
    // capture pins all of this pointer's events to this element regardless of
    // where it physically ends up, so the release always registers.
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = pointFromEvent(e);
    setDragStart(p);
    setDraft({ x: p.x, y: p.y, w: 0, h: 0 });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!calibrating) return;
    const p = pointFromEvent(e);
    setHoverPoint(p); // drives the magnifier below, independent of whether a drag is in progress
    if (!dragStart) return;
    setDraft({ x: Math.min(dragStart.x, p.x), y: Math.min(dragStart.y, p.y), w: Math.abs(p.x - dragStart.x), h: Math.abs(p.y - dragStart.y) });
  }

  function onPointerUp(e: React.PointerEvent) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (!calibrating || !draft || !displaySize) return;
    setDragStart(null);
    if (draft.w < 4 || draft.h < 4) {
      setDraft(null);
      return;
    }
    const box: CalibBox = { xPct: draft.x / displaySize.w, yPct: draft.y / displaySize.h, wPct: draft.w / displaySize.w, hPct: draft.h / displaySize.h };
    const next = [...calibDraft, box];
    setCalibDraft(next);
    setDraft(null);

    if (calibStepIdx + 1 < CALIB_STEPS.length) {
      setCalibStepIdx(calibStepIdx + 1);
    } else {
      const [row1, row5, row6, row10, portrait, name, role, itemsBox] = next;
      const finalCalib: ScoreboardCalibration = {
        row1,
        allySpacingPct: (row5.yPct - row1.yPct) / 4,
        enemyRow1: row6,
        enemySpacingPct: (row10.yPct - row6.yPct) / 4,
        portraitRel: toRowRelative(row1, portrait),
        nameRel: toRowRelative(row1, name),
        roleRel: toRowRelative(row1, role),
        itemsRel: toRowRelative(row1, itemsBox),
      };
      saveScoreboardCalibration(finalCalib);
      setCalib(finalCalib);
      setCalibrating(false);
    }
  }

  async function runScan() {
    if (!calib || !imgRef.current || !naturalSize) return;
    setScanning(true);
    setError('');
    try {
      const img = imgRef.current;
      const results: RowState[] = [];

      for (let i = 0; i < SCOREBOARD_ROWS; i++) {
        const portraitPx = boxPixels(subBoxAt(calib, calib.portraitRel, i), naturalSize);
        const namePx = boxPixels(subBoxAt(calib, calib.nameRel, i), naturalSize);
        const rolePx = boxPixels(subBoxAt(calib, calib.roleRel, i), naturalSize);

        // PRIMARY god signal: the name the scoreboard prints as text.
        // Upscaled 3x with smoothing off - scoreboard name text is small,
        // and Tesseract's accuracy climbs sharply with pixel density.
        const nameCanvas = document.createElement('canvas');
        nameCanvas.width = namePx.sw * 3;
        nameCanvas.height = namePx.sh * 3;
        const nameCtx = nameCanvas.getContext('2d')!;
        nameCtx.imageSmoothingEnabled = false;
        nameCtx.drawImage(img, namePx.sx, namePx.sy, namePx.sw, namePx.sh, 0, 0, nameCanvas.width, nameCanvas.height);
        const nameText = (await recognizeText(nameCanvas)).trim();
        const nameMatch = matchGodByName(nameText, gods);

        // FALLBACK: portrait hash, only consulted when the name didn't
        // resolve (unreadable crop, a god whose localized name isn't known
        // yet). Kept because it costs nothing and covers that gap.
        const godHash = hashCanvasRegion(img, portraitPx.sx, portraitPx.sy, portraitPx.sw, portraitPx.sh);
        const hashMatch = nameMatch ? null : matchIconLearned(godHash, 'gods', (h, c) => matchIcon(h, c));

        const roleHash = hashCanvasRegion(img, rolePx.sx, rolePx.sy, rolePx.sw, rolePx.sh);
        const roleMatch = matchIconLearned(roleHash, 'roles', (h, c) => matchIcon(h, c, 24));

        const cropThumb = (sx: number, sy: number, sw: number, sh: number, w: number, h: number) => {
          const c = document.createElement('canvas');
          c.width = w;
          c.height = h;
          c.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
          return c.toDataURL();
        };
        const thumb = cropThumb(portraitPx.sx, portraitPx.sy, portraitPx.sw, portraitPx.sh, 44, 44);
        const roleThumb = cropThumb(rolePx.sx, rolePx.sy, rolePx.sw, rolePx.sh, 28, 28);

        results.push({
          side: 'ally', // resolved below once we know which half is "self"
          godId: nameMatch?.id ?? hashMatch?.id ?? null,
          // A name hit is reported as distance 0 ("high" confidence) since
          // its edit distance isn't comparable to a 64-bit Hamming distance.
          godConfidence: nameMatch ? 0 : (hashMatch?.distance ?? null),
          godHash,
          nameText,
          godSource: nameMatch ? 'name' : hashMatch ? 'hash' : null,
          role: (roleMatch?.id as Role) ?? null,
          roleConfidence: roleMatch?.distance ?? null,
          roleHash,
          roleThumb,
          thumb,
        });
      }

      const selfIdx = results.findIndex((r) => r.godId === selectedGodId);
      const half: 'top' | 'bottom' = selfIdx === -1 ? 'top' : selfIdx < SCOREBOARD_ROWS / 2 ? 'top' : 'bottom';
      setSelfHalf(half);
      applySides(results, half, selfIdx);
      setRows(results);

      // Items are only ever read for the player's own row - scanning all 10
      // would be 70 crops for build data nobody but you needs, this is 7.
      if (selfIdx !== -1) {
        const itemsPx = boxPixels(subBoxAt(calib, calib.itemsRel, selfIdx), naturalSize);
        const slotW = itemsPx.sw / ITEM_SLOTS_PER_ROW;
        const detected: string[] = [];
        for (let s = 0; s < ITEM_SLOTS_PER_ROW; s++) {
          const sx = itemsPx.sx + s * slotW;
          if (isLikelyEmptySlot(img, sx, itemsPx.sy, slotW, itemsPx.sh)) continue;
          const h = hashCanvasRegion(img, sx, itemsPx.sy, slotW, itemsPx.sh);
          const m = matchIconLearned(h, 'items', (hh, c) => matchIcon(hh, c, 32));
          if (m) detected.push(m.id);
        }
        setSelfItems(detected);

        const stripCanvas = document.createElement('canvas');
        stripCanvas.width = 210;
        stripCanvas.height = 30;
        stripCanvas.getContext('2d')!.drawImage(img, itemsPx.sx, itemsPx.sy, itemsPx.sw, itemsPx.sh, 0, 0, 210, 30);
        setSelfItemsStripThumb(stripCanvas.toDataURL());
      } else {
        setSelfItems([]);
        setSelfItemsStripThumb(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fallo el escaneo.');
    } finally {
      setScanning(false);
    }
  }

  function applySides(list: RowState[], half: 'top' | 'bottom', selfIdx: number) {
    const boundary = SCOREBOARD_ROWS / 2;
    list.forEach((r, i) => {
      if (i === selfIdx) {
        r.side = 'self';
      } else {
        const rowHalf: 'top' | 'bottom' = i < boundary ? 'top' : 'bottom';
        r.side = rowHalf === half ? 'ally' : 'enemy';
      }
    });
  }

  function setTeamHalf(half: 'top' | 'bottom') {
    if (!rows) return;
    setSelfHalf(half);
    const next = [...rows];
    const selfIdx = next.findIndex((r) => r.side === 'self');
    applySides(next, half, selfIdx);
    setRows(next);
  }

  function updateRow(i: number, patch: Partial<RowState>) {
    if (!rows) return;
    const next = [...rows];
    next[i] = { ...next[i], ...patch };
    setRows(next);
  }

  function apply() {
    if (!rows) return;

    // Whatever the user is confirming here - auto-detected right, or
    // corrected by hand - IS a real, correctly-labeled crop straight from
    // Smite 2's actual scoreboard UI. Save it so the next scan recognizes
    // this exact god/role instantly.
    for (const r of rows) {
      if (r.godId) {
        saveLearnedHash('gods', r.godId, r.godHash);
        // Also teach the NAME spelling. This is what makes an unknown
        // localization self-correcting: whatever the client actually
        // printed (and however Tesseract read it) maps to the god the user
        // just confirmed, so the next scan resolves it with no guessing -
        // no need for the alias table in god-name-match.ts to ever be
        // complete.
        if (r.nameText) rememberGodName(r.nameText, r.godId);
      }
      if (r.role) saveLearnedHash('roles', r.role, r.roleHash);
    }
    setLearnedTotal(learnedCount());

    const participants: Participant[] = rows
      .filter((r) => r.side !== 'self')
      .map((r) => ({ side: r.side as 'ally' | 'enemy', godId: r.godId, role: r.role, items: [] }));

    onApply({ participants, itemIds: selfItems });
  }

  function removeSelfItem(id: string) {
    setSelfItems((prev) => prev.filter((x) => x !== id));
  }

  const currentStep = CALIB_STEPS[calibStepIdx];

  return (
    <div className="rounded-md border border-ss-line p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-ss-text-secondary">Escanear marcador final (dioses y roles de los 10, tu build)</p>
        {calib && !calibrating && (
          <button
            type="button"
            onClick={() => {
              clearScoreboardCalibration();
              setCalib(null);
              startCalibration();
            }}
            className="text-xs text-ss-text-muted underline hover:text-ss-text"
          >
            Recalibrar
          </button>
        )}
      </div>

      {learnedTotal > 0 && (
        <div className="mb-2 flex items-center justify-between rounded-md border border-ss-win/30 bg-ss-win/10 px-2 py-1.5">
          <p className="text-[11px] text-ss-win">
            🧠 {learnedTotal} íconos aprendidos de tus correcciones - se usan antes que la base genérica (menos errores con cada partida que cargás).
          </p>
          <button
            type="button"
            onClick={() => {
              clearLearnedHashes();
              setLearnedTotal(learnedCount());
            }}
            className="shrink-0 text-[11px] text-ss-text-muted underline hover:text-ss-loss"
          >
            Borrar
          </button>
        </div>
      )}

      {!imgSrc && (
        <div className="flex flex-col gap-2">
          <input
            type="file"
            aria-label="Captura del marcador de la partida"
            accept="image/*"
            onChange={handleFile}
            className="block w-full text-xs text-ss-text-muted file:mr-3 file:rounded-md file:border-0 file:bg-ss-bg-raised file:px-3 file:py-1.5 file:text-xs file:text-ss-text hover:file:bg-ss-card"
          />
          <p className="text-[11px] text-ss-text-muted">o pega la captura con Ctrl+V, del scoreboard completo de fin de partida (los 10 jugadores) - detecta dios/rol de todos y tu build. Tus stats numéricas (K/D/A, daño, etc) van aparte, en la sección de abajo.</p>
          {!selectedGodId && (
            <p className="rounded-md border border-ss-orange/40 bg-ss-orange/10 px-2 py-1.5 text-xs text-ss-orange">
              Elige primero tu dios en la sección de arriba - así el escaneo sabe cuál de las 10 filas eres tú (para separar aliados de enemigos).
            </p>
          )}
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
                    Son <strong>8 pasos</strong> en total: los primeros 4 marcan dónde empieza y termina cada equipo (fila 1, fila 5, fila 6 y fila 10) - con eso el programa
                    calcula solo dónde están las demás filas. Los 4 siguientes marcan, <strong>solo dentro de la fila 1</strong>, dónde están el
                    retrato, el <strong>nombre del dios</strong>, el ícono de rol y la tira de items - esa posición se reutiliza en las 10 filas (los items solo se leen de tu propia fila).
                    El paso del nombre es el importante: el dios se detecta leyendo ese texto, no comparando la imagen.
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
              <p className="text-xs text-ss-text">Sin calibrar todavía - necesario una sola vez, después se reusa para cada captura de este mismo formato.</p>
              <button type="button" onClick={startCalibration} className="self-start rounded-md bg-ss-cyan px-3 py-1.5 text-xs font-semibold text-ss-bg hover:brightness-110">
                Calibrar ahora
              </button>
            </div>
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
            <img ref={imgRef} src={imgSrc} alt="Captura del marcador" onLoad={onImgLoad} className="w-full rounded border border-ss-line" draggable={false} />
            {displaySize &&
              calib &&
              !calibrating &&
              Array.from({ length: SCOREBOARD_ROWS }).map((_, i) => {
                const b = rowBoxAt(calib, i);
                return (
                  <div
                    key={i}
                    className="pointer-events-none absolute border border-ss-win/50"
                    style={{ left: b.xPct * displaySize.w, top: b.yPct * displaySize.h, width: b.wPct * displaySize.w, height: b.hPct * displaySize.h }}
                  />
                );
              })}
            {draft && <div className="pointer-events-none absolute border-2 border-ss-cyan bg-ss-cyan/10" style={{ left: draft.x, top: draft.y, width: draft.w, height: draft.h }} />}

            {calibrating && hoverPoint && displaySize && (
              <canvas
                ref={magnifierRef}
                width={MAG_SIZE}
                height={MAG_SIZE}
                className="pointer-events-none absolute rounded-md border-2 border-ss-cyan shadow-xl"
                style={{
                  // Offset from the cursor so the magnifier doesn't cover the
                  // exact spot it's showing; clamped to stay inside the image.
                  left: Math.min(hoverPoint.x + 24, displaySize.w - MAG_SIZE),
                  top: Math.min(hoverPoint.y + 24, displaySize.h - MAG_SIZE),
                  background: '#0a0d15',
                }}
              />
            )}
          </div>

          {!calibrating && calib && !rows && (
            <button
              type="button"
              onClick={runScan}
              disabled={scanning || !selectedGodId}
              className="self-start rounded-md bg-ss-cyan px-3 py-1.5 text-sm font-semibold text-ss-bg hover:brightness-110 disabled:opacity-50"
            >
              {scanning ? 'Escaneando los 10 jugadores...' : 'Escanear tabla'}
            </button>
          )}
          {!selectedGodId && !calibrating && calib && !rows && (
            <p className="text-xs text-ss-orange">Elige tu dios en la sección de arriba antes de escanear.</p>
          )}

          {error && <p className="text-xs text-ss-loss">{error}</p>}

          {rows && (
            <div className="flex flex-col gap-2 rounded-md border border-ss-line bg-ss-bg-raised p-2">
              <div className="flex items-center gap-2">
                <p className="text-xs text-ss-text-muted">Tu equipo está:</p>
                <button type="button" onClick={() => setTeamHalf('top')} className={`rounded-full border px-2 py-0.5 text-xs ${selfHalf === 'top' ? 'border-ss-cyan bg-ss-cyan/10 text-ss-cyan' : 'border-ss-line text-ss-text-muted'}`}>
                  Arriba
                </button>
                <button type="button" onClick={() => setTeamHalf('bottom')} className={`rounded-full border px-2 py-0.5 text-xs ${selfHalf === 'bottom' ? 'border-ss-cyan bg-ss-cyan/10 text-ss-cyan' : 'border-ss-line text-ss-text-muted'}`}>
                  Abajo
                </button>
              </div>

              {selfItemsStripThumb && (
                <div className="flex flex-col gap-1.5 rounded-md border border-ss-line bg-ss-card p-2">
                  <p className="text-xs text-ss-text-secondary">Tu build detectada:</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {selfItems.length === 0 && <span className="text-[11px] text-ss-text-muted">No se detectó ningún item - puedes agregarlos a mano en &quot;Build&quot; más abajo.</span>}
                    {selfItems.map((id, j) => {
                      const it = itemById.current.get(id);
                      return (
                        <button key={j} type="button" onClick={() => removeSelfItem(id)} title={`Quitar ${it?.name ?? id}`} className="group relative">
                          <ItemArt
                            iconUrl={it?.icon_url ?? null}
                            name={it?.name ?? id}
                            size={36}
                            className="border border-ss-line transition group-hover:border-ss-loss group-hover:opacity-50"
                          />
                        </button>
                      );
                    })}
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element -- local canvas thumbnail, diagnostic: raw items-strip crop for comparison against the matched chips above */}
                  <img src={selfItemsStripThumb} alt="" title="Recorte crudo de la tira de items" className="h-[30px] w-[210px] self-start rounded border border-ss-line object-cover" />
                  <p className="text-[10px] text-ss-text-muted">Click en un item para quitarlo si está mal. Para agregar uno que faltó, usa &quot;Build&quot; más abajo después de aplicar.</p>
                </div>
              )}

              <p className="text-xs text-ss-text-muted">Revisa y corrige lo que haga falta antes de aplicar:</p>

              <div className="flex flex-col gap-2">
                {rows.map((r, i) => {
                  const godInfo = r.godId ? godById.current.get(r.godId) : null;
                  const conf = r.godConfidence != null ? confidenceLevel(r.godConfidence) : 'low';
                  const sideColor = r.side === 'self' ? '#16c8d4' : r.side === 'ally' ? '#34d399' : '#fb3b5c';
                  return (
                    <div key={i} className="flex flex-wrap items-center gap-2 rounded-md border border-ss-line bg-ss-card p-2 text-xs" style={{ borderLeft: `3px solid ${sideColor}` }}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- local canvas thumbnail */}
                      <img src={r.thumb} alt="" className="h-9 w-9 shrink-0 rounded border border-ss-line" />
                      <span className="w-14 shrink-0 font-semibold uppercase" style={{ color: sideColor }}>
                        {r.side === 'self' ? 'Tú' : r.side === 'ally' ? 'Aliado' : 'Enemigo'}
                      </span>

                      {/* Ten rows of two selects each: without a name per row
                          a screen reader announces twenty anonymous combo
                          boxes with no way to tell which player is which.
                          The row number is what disambiguates them. */}
                      <select
                        aria-label={`Dios de la fila ${i + 1} (${r.side === 'self' ? 'tú' : r.side === 'ally' ? 'aliado' : 'enemigo'})`}
                        value={r.godId ?? ''}
                        onChange={(e) => updateRow(i, { godId: e.target.value || null })}
                        className={`rounded border bg-ss-bg-raised px-1.5 py-1 ${conf === 'low' ? 'border-ss-orange' : 'border-ss-line'}`}
                        title={
                          r.godSource === 'name'
                            ? `detectado por el nombre leído: "${r.nameText}"`
                            : r.godSource === 'hash'
                              ? `nombre ilegible ("${r.nameText}") - detectado por el retrato, distancia ${r.godConfidence}`
                              : `no se pudo leer el nombre ("${r.nameText}")`
                        }
                      >
                        <option value="">(sin detectar)</option>
                        {gods.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>

                      {/* eslint-disable-next-line @next/next/no-img-element -- local canvas thumbnail, diagnostic: what the matcher actually saw */}
                      <img src={r.roleThumb} alt="" title="Recorte usado para detectar el rol" className="h-6 w-6 shrink-0 rounded border border-ss-line" />
                      <select aria-label={`Rol de la fila ${i + 1}`} value={r.role ?? ''} onChange={(e) => updateRow(i, { role: (e.target.value || null) as Role | null })} className="rounded border border-ss-line bg-ss-bg-raised px-1.5 py-1">
                        <option value="">(rol)</option>
                        {(['solo', 'jungle', 'mid', 'adc', 'support'] as Role[]).map((rl) => (
                          <option key={rl} value={rl}>
                            {ROLE_LABEL[rl]}
                          </option>
                        ))}
                      </select>

                      {/* The raw OCR of the name cell, always visible - when a
                          row is wrong this instantly says whether the crop is
                          off (garbage text) or just an unknown spelling. */}
                      <span
                        className={`ml-auto font-mono text-[10px] ${r.godSource === 'name' ? 'text-ss-win' : 'text-ss-orange'}`}
                        title="Texto leído de la celda del nombre"
                      >
                        {r.nameText ? `"${r.nameText}"` : 'sin texto'}
                      </span>
                      <span className="text-[10px] text-ss-text-muted">{godInfo ? godInfo.name : 'sin coincidencia'}</span>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={apply} className="rounded-md bg-ss-win px-3 py-1.5 text-xs font-semibold text-ss-bg hover:brightness-110">
                  Aplicar al formulario
                </button>
                <button type="button" onClick={runScan} className="rounded-md border border-ss-line px-3 py-1.5 text-xs text-ss-text-muted hover:text-ss-text">
                  Volver a escanear
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRows(null);
                    setSelfItems([]);
                    setSelfItemsStripThumb(null);
                  }}
                  className="rounded-md border border-ss-line px-3 py-1.5 text-xs text-ss-text-muted hover:text-ss-text"
                >
                  Descartar
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setImgSrc(null);
              setRows(null);
              setSelfItems([]);
              setSelfItemsStripThumb(null);
              setCalibrating(false);
              onFileReady?.(null);
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
            clearScoreboardCalibration();
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
