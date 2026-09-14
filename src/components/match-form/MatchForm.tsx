'use client';

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { createMatch, type FormState } from '@/app/(app)/matches/new/actions';
import { GodSelectGrid } from './GodSelectGrid';
import { ItemSelectGrid } from './ItemSelectGrid';
import { ScoreboardScanner, type Participant } from './ScoreboardScanner';
import { StatsScanner } from './StatsScanner';
import { ROLE_LABEL } from '@/lib/god-assets';
import type { Role } from '@/lib/supabase/database.types';
import itemsCatalog from '@/data/items.json';
import type { Item as CatalogItem } from '@/lib/item-types';

// The JSON module's inferred type is a union of every distinct object shape
// in the array (stats keys vary per item), not a single Item - the same cast
// the /items page makes, for the same reason.
const itemsForPicker = itemsCatalog as unknown as CatalogItem[];

type God = { id: string; name: string; primary_role: string; icon_url: string | null };
// One shared Item shape, not a narrower local copy: the local one declared
// icon_url as a non-null string, which silently diverged from the catalog
// the moment items without a known icon became representable.
type Item = CatalogItem;

const roles = ['solo', 'jungle', 'mid', 'adc', 'support'] as const;
const gameModes = [
  { value: 'conquest_ranked', label: 'Conquest Ranked' },
  { value: 'conquest_casual', label: 'Conquest Casual' },
  { value: 'arena', label: 'Arena' },
  { value: 'joust', label: 'Joust' },
  { value: 'assault', label: 'Assault' },
  { value: 'duel', label: 'Duel' },
];

const initialState: FormState = { error: null };

// neu-inset gives every field the "pressed into the surface" look at rest;
// the focus ring (border-ss-cyan) reads as it "lifting" to accept input.
const inputClass =
  'neu-inset rounded-md border border-ss-line bg-ss-bg-raised px-3 py-2 text-sm text-ss-text outline-none transition focus:border-ss-cyan';
const labelClass = 'text-sm text-ss-text-muted';

function Section({
  title,
  accent,
  children,
}: {
  title: string;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="glass-panel rounded-xl p-4"
      style={accent ? { borderLeft: `3px solid ${accent}` } : undefined}
    >
      <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-ss-text-secondary">
        {title}
      </h2>
      {children}
    </div>
  );
}

export function MatchForm({ gods }: { gods: God[] }) {
  const [state, formAction, pending] = useActionState(createMatch, initialState);

  const [nowLocal] = useState(() =>
    new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  );

  // Both lifted to controlled state (rather than living only inside
  // GodSelectGrid/ItemSelectGrid) so the scoreboard scanner's "apply" step
  // can actually drive them and have the pickers visually reflect it -
  // DOM-poking a hidden input wouldn't survive React's own next render.
  const [selectedGod, setSelectedGod] = useState<God | null>(null);
  const [selectedItems, setSelectedItems] = useState<Item[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);

  const itemById = useMemo(() => new Map(itemsForPicker.map((i) => [i.id, i])), []);

  // The scanner reports who else played (dioses+roles de aliados/enemigos,
  // para las estadísticas de matchup) AND the player's own detected build.
  // Tus stats numéricas (K/D/A, oro, daño, etc) siguen viniendo aparte, del
  // StatsScanner de más abajo.
  function handleScanApply(result: { participants: Participant[]; itemIds: string[] }) {
    setParticipants(result.participants);
    if (result.itemIds.length > 0) {
      setSelectedItems(result.itemIds.map((id) => itemById.get(id)).filter((i): i is Item => Boolean(i)));
    }
  }

  // The screenshot is picked/pasted well before submit, inside
  // ScoreboardScanner's own flow - this hidden input is how that File
  // actually rides along in the form's multipart submission, since it
  // wasn't chosen through this input directly. Assigning FileList isn't
  // otherwise possible without the DataTransfer trick.
  const screenshotInputRef = useRef<HTMLInputElement>(null);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  useEffect(() => {
    const input = screenshotInputRef.current;
    if (!input) return;
    if (screenshotFile) {
      const dt = new DataTransfer();
      dt.items.add(screenshotFile);
      input.files = dt.files;
    } else {
      input.value = '';
    }
  }, [screenshotFile]);

  return (
    <form action={formAction} className="flex flex-col gap-4 pb-20 sm:pb-4">
      <input type="file" name="screenshot" ref={screenshotInputRef} hidden />
      <input type="hidden" name="participants" value={JSON.stringify(participants)} />

      <Section title="Dios" accent="#16c8d4">
        <GodSelectGrid gods={gods} value={selectedGod} onChange={setSelectedGod} />
      </Section>

      <Section title="Escanear marcador final (opcional)" accent="#a78bfa">
        <p className="mb-2 text-xs text-ss-text-muted">
          Sube el marcador final completo (los 10 jugadores) - detecta qué dios y rol jugó cada uno (para las stats de
          aliados/enemigos) y tu propia build. Tus stats numéricas (K/D/A, daño, etc) van en la sección de abajo.
        </p>
        <ScoreboardScanner
          gods={gods}
          items={itemsCatalog}
          selectedGodId={selectedGod?.id ?? null}
          onApply={handleScanApply}
          onFileReady={setScreenshotFile}
        />
        {(screenshotFile || participants.length > 0) && (
          <p className="mt-2 text-xs text-ss-win">✓ Datos del escaneo aplicados al formulario.</p>
        )}
      </Section>

      <Section title="Tus estadísticas (opcional)" accent="#34d399">
        <p className="mb-2 text-xs text-ss-text-muted">
          Sube la pantalla de comparar stats (los 10 jugadores en columnas: oro, daño, curación, centinelas...),
          haz click en tu columna, y rellena K/D/A, oro y las stats avanzadas de abajo. Es una captura distinta al marcador de arriba.
        </p>
        <StatsScanner />
      </Section>

      <Section title="Dios rival (opcional)" accent="#fb3b5c">
        <p className="mb-2 text-xs text-ss-text-muted">
          El dios que jugó tu oponente directo en tu carril - habilita las stats de matchup (contra quién ganas/pierdes más).
        </p>
        <GodSelectGrid gods={gods} name="enemy_god_id" required={false} placeholder="Buscar dios rival..." />
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Resultado">
          <div className="grid grid-cols-2 gap-3">
            <label className="has-[:checked]:border-ss-win has-[:checked]:bg-ss-win/10 has-[:checked]:text-ss-win flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-ss-line bg-ss-bg-raised py-3 text-sm font-semibold text-ss-text-muted transition">
              <input type="radio" name="result" value="win" required className="sr-only" />
              🏆 Victoria
            </label>
            <label className="has-[:checked]:border-ss-loss has-[:checked]:bg-ss-loss/10 has-[:checked]:text-ss-loss flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-ss-line bg-ss-bg-raised py-3 text-sm font-semibold text-ss-text-muted transition">
              <input type="radio" name="result" value="loss" className="sr-only" />
              💀 Derrota
            </label>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className={labelClass} htmlFor="kills">Kills</label>
              <input id="kills" name="kills" type="number" min={0} max={200} defaultValue={0} required className={`${inputClass} text-center text-lg font-bold`} />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelClass} htmlFor="deaths">Deaths</label>
              <input id="deaths" name="deaths" type="number" min={0} max={200} defaultValue={0} required className={`${inputClass} text-center text-lg font-bold`} />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelClass} htmlFor="assists">Assists</label>
              <input id="assists" name="assists" type="number" min={0} max={200} defaultValue={0} required className={`${inputClass} text-center text-lg font-bold`} />
            </div>
          </div>
        </Section>

        <Section title="Detalles de la partida">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className={labelClass} htmlFor="role_played">Rol jugado</label>
              <select id="role_played" name="role_played" required className={inputClass}>
                {roles.map((r) => (
                  <option key={r} value={r}>{ROLE_LABEL[r as Role]}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelClass} htmlFor="game_mode">Modo</label>
              <select id="game_mode" name="game_mode" required className={inputClass}>
                {gameModes.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelClass} htmlFor="rank_tier">Rank (opcional)</label>
              <input id="rank_tier" name="rank_tier" type="text" maxLength={32} placeholder="Gold III" className={inputClass} />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelClass} htmlFor="duration_minutes_display">Duración (min)</label>
              <input id="duration_minutes_display" name="duration_seconds_min" type="number" min={1} max={180} placeholder="25" className={inputClass}
                onChange={(e) => {
                  const hidden = document.getElementById('duration_seconds') as HTMLInputElement | null;
                  if (hidden) hidden.value = e.target.value ? String(Number(e.target.value) * 60) : '';
                }}
              />
              <input type="hidden" id="duration_seconds" name="duration_seconds" />
            </div>
            <div className="col-span-2 flex flex-col gap-1">
              <label className={labelClass} htmlFor="played_at">Fecha/hora</label>
              <input id="played_at" name="played_at" type="datetime-local" required defaultValue={nowLocal} className={inputClass} />
            </div>
          </div>
        </Section>
      </div>

      <Section title="Build (items, opcional)" accent="#fb923c">
        <ItemSelectGrid items={itemsForPicker} value={selectedItems} onChange={setSelectedItems} />
      </Section>

      <Section title="Notas">
        <textarea id="notes" name="notes" maxLength={500} rows={2} placeholder="Opcional..." className={`${inputClass} w-full`} />
      </Section>

      <details id="advanced-stats-details" className="rounded-xl border border-ss-line bg-ss-card">
        <summary className="cursor-pointer px-4 py-3 font-display text-sm font-semibold uppercase tracking-wide text-ss-text-secondary">
          Stats avanzadas (opcional)
        </summary>
        <div className="grid grid-cols-2 gap-4 border-t border-ss-line p-4 sm:grid-cols-3 lg:grid-cols-4">
          <div className="flex flex-col gap-1">
            <label className={labelClass} htmlFor="gold_per_min">Oro/min</label>
            <input id="gold_per_min" name="gold_per_min" type="number" min={0} className={inputClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass} htmlFor="wards_placed">Centinelas</label>
            <input id="wards_placed" name="wards_placed" type="number" min={0} max={50} className={inputClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass} htmlFor="damage_to_players">Daño a jugador</label>
            <input id="damage_to_players" name="damage_to_players" type="number" min={0} className={inputClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass} htmlFor="damage_to_minions">Daño a súbditos</label>
            <input id="damage_to_minions" name="damage_to_minions" type="number" min={0} className={inputClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass} htmlFor="damage_to_jungle">Daño en jungla</label>
            <input id="damage_to_jungle" name="damage_to_jungle" type="number" min={0} className={inputClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass} htmlFor="damage_to_structures">Daño a estructuras</label>
            <input id="damage_to_structures" name="damage_to_structures" type="number" min={0} className={inputClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass} htmlFor="damage_taken">Daño recibido</label>
            <input id="damage_taken" name="damage_taken" type="number" min={0} className={inputClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass} htmlFor="damage_mitigated">Daño mitigado</label>
            <input id="damage_mitigated" name="damage_mitigated" type="number" min={0} className={inputClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass} htmlFor="self_healing">Autocuración</label>
            <input id="self_healing" name="self_healing" type="number" min={0} className={inputClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass} htmlFor="ally_healing">Curación de aliado</label>
            <input id="ally_healing" name="ally_healing" type="number" min={0} className={inputClass} />
          </div>
        </div>
      </details>

      {state.error && <p className="text-sm text-ss-loss">{state.error}</p>}

      {/* Fixed on mobile so it's always reachable with a thumb; inline in the normal flow on desktop. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-ss-line bg-ss-bg p-3 sm:static sm:border-0 sm:bg-transparent sm:p-0">
        <button
          type="submit"
          disabled={pending}
          className="neu-raised w-full rounded-md bg-ss-cyan px-3 py-3 text-sm font-semibold text-ss-bg transition hover:brightness-110 disabled:opacity-50 sm:py-2"
        >
          {pending ? 'Guardando...' : 'Guardar partida'}
        </button>
      </div>
    </form>
  );
}
