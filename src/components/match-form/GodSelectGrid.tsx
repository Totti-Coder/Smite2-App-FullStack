'use client';

import { useMemo, useState } from 'react';
import { GodAvatar } from '@/components/GodAvatar';
import { roleIconUrl, ROLE_LABEL } from '@/lib/god-assets';
import type { Role } from '@/lib/supabase/database.types';

type God = { id: string; name: string; primary_role: string; icon_url: string | null };

const ROLES: Role[] = ['solo', 'jungle', 'mid', 'adc', 'support'];

export function GodSelectGrid({
  gods,
  name = 'god_id',
  required = true,
  placeholder = 'Buscar dios...',
  value,
  onChange,
}: {
  gods: God[];
  name?: string;
  required?: boolean;
  placeholder?: string;
  // Optional controlled mode - lets a parent (e.g. auto-fill from a
  // screenshot scan) drive the selection and see it reflected in the UI.
  // Omit both for the normal self-contained/uncontrolled behavior.
  value?: God | null;
  onChange?: (god: God | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<Role | null>(null);
  const [internalSelected, setInternalSelected] = useState<God | null>(null);
  const selected = value !== undefined ? value : internalSelected;
  const setSelected = onChange ?? setInternalSelected;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return gods.filter((g) => {
      if (role && g.primary_role !== role) return false;
      if (q && !g.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [gods, query, role]);

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name={name} value={selected?.id ?? ''} required={required} />

      {selected ? (
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="flex items-center gap-3 rounded-md border border-ss-cyan bg-ss-bg-raised px-3 py-2 text-left"
        >
          <GodAvatar iconUrl={selected.icon_url} name={selected.name} size={36} />
          <span className="flex-1 text-sm font-medium text-ss-text">{selected.name}</span>
          <span className="text-xs text-ss-text-muted">cambiar</span>
        </button>
      ) : (
        <>
          <input
            type="text"
            aria-label="Buscar dios"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="rounded-md border border-ss-line bg-ss-bg-raised px-3 py-2 text-sm text-ss-text outline-none focus:border-ss-cyan"
          />

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setRole(null)}
              aria-pressed={role === null}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                role === null ? 'border-ss-cyan bg-ss-cyan/10 text-ss-cyan' : 'border-ss-line text-ss-text-muted hover:text-ss-text'
              }`}
            >
              Todos
            </button>
            {ROLES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(role === r ? null : r)}
                aria-pressed={role === r}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                  role === r ? 'border-ss-cyan bg-ss-cyan/10 text-ss-cyan' : 'border-ss-line text-ss-text-muted hover:text-ss-text'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- external CDN icon */}
                <img src={roleIconUrl(r)} alt="" className="h-3.5 w-3.5" />
                {ROLE_LABEL[r]}
              </button>
            ))}
          </div>

          <div className="grid max-h-80 grid-cols-4 gap-2 overflow-y-auto rounded-md border border-ss-line bg-ss-bg-raised p-2 sm:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
            {filtered.map((g) => (
              <button
                type="button"
                key={g.id}
                onClick={() => setSelected(g)}
                className="flex flex-col items-center gap-1 rounded-md p-1.5 text-center hover:bg-ss-card"
              >
                <GodAvatar iconUrl={g.icon_url} name={g.name} size={44} />
                <span className="line-clamp-1 text-[11px] text-ss-text-secondary">{g.name}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="col-span-full py-4 text-center text-xs text-ss-text-muted">Sin resultados.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
