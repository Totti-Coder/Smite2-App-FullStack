'use client';

import { useActionState, useMemo, useState } from 'react';
import { createTierList, type TierListFormState } from '@/app/(app)/tierlist/actions';
import { GodAvatar } from '@/components/GodAvatar';
import { ROLE_LABEL } from '@/lib/god-assets';
import { emptyTiers, rankedCount, unrankedGodIds, MAX_AUTHOR, MAX_TITLE, type Tier } from '@/lib/tier-list';
import type { Role } from '@/lib/supabase/database.types';

type God = { id: string; name: string; primary_role: string; icon_url: string | null };

const ROLES: Role[] = ['solo', 'jungle', 'mid', 'adc', 'support'];
const initialState: TierListFormState = { error: null };

export function TierListEditor({ gods }: { gods: God[] }) {
  const [state, formAction, pending] = useActionState(createTierList, initialState);

  const [tiers, setTiers] = useState<Tier[]>(emptyTiers);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | null>(null);
  // Tap-to-place: native HTML5 drag doesn't fire on touch devices at all, so
  // without this the whole feature would be desktop-only. Tap a god, then tap
  // a tier. Desktop users can still just drag.
  const [picked, setPicked] = useState<string | null>(null);

  const godById = useMemo(() => new Map(gods.map((g) => [g.id, g])), [gods]);
  const allIds = useMemo(() => gods.map((g) => g.id), [gods]);
  const unranked = useMemo(() => unrankedGodIds(tiers, allIds), [tiers, allIds]);

  const visibleUnranked = useMemo(() => {
    const q = query.trim().toLowerCase();
    return unranked
      .map((id) => godById.get(id))
      .filter((g): g is God => Boolean(g))
      .filter((g) => (roleFilter ? g.primary_role === roleFilter : true))
      .filter((g) => (q ? g.name.toLowerCase().includes(q) : true));
  }, [unranked, godById, roleFilter, query]);

  /** Moves a god into a tier, removing it from wherever it currently sits. */
  function placeInTier(godId: string, tierId: string) {
    setTiers((prev) =>
      prev.map((t) => {
        const without = t.godIds.filter((id) => id !== godId);
        return t.id === tierId ? { ...t, godIds: [...without, godId] } : { ...t, godIds: without };
      })
    );
    setPicked(null);
  }

  /** Sends a god back to the unranked pool. */
  function unrank(godId: string) {
    setTiers((prev) => prev.map((t) => ({ ...t, godIds: t.godIds.filter((id) => id !== godId) })));
    setPicked(null);
  }

  function onDropInTier(e: React.DragEvent, tierId: string) {
    e.preventDefault();
    const godId = e.dataTransfer.getData('text/plain');
    if (godId) placeInTier(godId, tierId);
  }

  const placed = rankedCount(tiers);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="tiers" value={JSON.stringify(tiers)} />

      <div className="glass-panel grid gap-3 rounded-xl p-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-sm text-ss-text-muted" htmlFor="title">
            Título
          </label>
          <input
            id="title"
            name="title"
            required
            maxLength={MAX_TITLE}
            defaultValue="Mi tier list de Smite 2"
            className="neu-inset rounded-md border border-ss-line bg-ss-bg-raised px-3 py-2 text-sm text-ss-text outline-none transition focus:border-ss-cyan"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm text-ss-text-muted" htmlFor="author_name">
            Tu nombre o alias
          </label>
          <input
            id="author_name"
            name="author_name"
            required
            maxLength={MAX_AUTHOR}
            placeholder="Cómo quieres aparecer"
            className="neu-inset rounded-md border border-ss-line bg-ss-bg-raised px-3 py-2 text-sm text-ss-text outline-none transition focus:border-ss-cyan"
          />
          <p className="text-[11px] text-ss-text-muted">
            Se muestra en público junto a tu tier list. Tu correo nunca se publica.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        {tiers.map((tier) => (
          <div
            key={tier.id}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onDropInTier(e, tier.id)}
            onClick={() => picked && placeInTier(picked, tier.id)}
            className={`flex overflow-hidden rounded-lg border bg-ss-bg-raised/50 transition ${
              picked ? 'cursor-pointer border-ss-cyan/60' : 'border-ss-line'
            }`}
          >
            <div
              className="flex w-16 shrink-0 items-center justify-center font-display text-xl font-bold text-ss-bg"
              style={{ background: tier.color }}
            >
              {tier.label}
            </div>
            <div className="flex min-h-[60px] flex-1 flex-wrap items-center gap-1 p-1.5">
              {tier.godIds.length === 0 && (
                <span className="px-2 text-xs text-ss-text-muted">
                  {picked ? 'Toca aquí para colocarlo' : 'Arrastra dioses aquí'}
                </span>
              )}
              {tier.godIds.map((id) => {
                const god = godById.get(id);
                if (!god) return null;
                return (
                  <button
                    key={id}
                    type="button"
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', id)}
                    onClick={(e) => {
                      e.stopPropagation();
                      unrank(id);
                    }}
                    title={`${god.name} - quitar del tier`}
                    className="transition hover:opacity-60"
                  >
                    <GodAvatar iconUrl={god.icon_url} name={god.name} size={44} />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="glass-panel rounded-xl p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="font-display text-sm font-semibold uppercase tracking-wide text-ss-text-secondary">
            Sin clasificar ({unranked.length}) · {placed} colocados
          </p>
          <input
            type="text"
            aria-label="Filtrar dioses sin clasificar"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar dios..."
            className="neu-inset rounded-md border border-ss-line bg-ss-bg-raised px-3 py-1.5 text-sm text-ss-text outline-none transition focus:border-ss-cyan"
          />
        </div>

        <div className="mb-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setRoleFilter(null)}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              roleFilter === null ? 'border-ss-cyan bg-ss-cyan/10 text-ss-cyan' : 'border-ss-line text-ss-text-muted hover:text-ss-text'
            }`}
          >
            Todos
          </button>
          {ROLES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRoleFilter(r)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                roleFilter === r ? 'border-ss-cyan bg-ss-cyan/10 text-ss-cyan' : 'border-ss-line text-ss-text-muted hover:text-ss-text'
              }`}
            >
              {ROLE_LABEL[r]}
            </button>
          ))}
        </div>

        {picked && (
          <p className="mb-2 rounded-md border border-ss-cyan/40 bg-ss-cyan/10 px-2.5 py-1.5 text-xs text-ss-cyan">
            <strong>{godById.get(picked)?.name}</strong> seleccionado - toca un tier de arriba para colocarlo, o toca el dios otra vez para soltarlo.
          </p>
        )}

        <div className="flex flex-wrap gap-1.5">
          {visibleUnranked.length === 0 && (
            <p className="text-xs text-ss-text-muted">
              {unranked.length === 0 ? 'Ya colocaste todos los dioses.' : 'Ningún dios coincide con el filtro.'}
            </p>
          )}
          {visibleUnranked.map((god) => (
            <button
              key={god.id}
              type="button"
              draggable
              onDragStart={(e) => e.dataTransfer.setData('text/plain', god.id)}
              onClick={() => setPicked(picked === god.id ? null : god.id)}
              title={god.name}
              className={`rounded-full transition ${picked === god.id ? 'ring-2 ring-ss-cyan' : 'hover:opacity-75'}`}
            >
              <GodAvatar iconUrl={god.icon_url} name={god.name} size={44} />
            </button>
          ))}
        </div>
      </div>

      {state.error && <p className="text-sm text-ss-loss">{state.error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending || placed === 0}
          className="neu-raised rounded-md bg-ss-cyan px-5 py-2.5 text-sm font-semibold text-ss-bg transition hover:brightness-110 disabled:opacity-50"
        >
          {pending ? 'Publicando...' : 'Publicar tier list'}
        </button>
        <button
          type="button"
          onClick={() => {
            setTiers(emptyTiers());
            setPicked(null);
          }}
          className="rounded-md border border-ss-line px-4 py-2.5 text-sm text-ss-text-muted transition hover:text-ss-text"
        >
          Reiniciar
        </button>
        {placed === 0 && <span className="text-xs text-ss-text-muted">Coloca al menos un dios para publicar.</span>}
      </div>
    </form>
  );
}
