'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Reveal } from '@/components/motion/Reveal';
import { ROLE_LABEL, ROLE_COLOR, roleIconUrl, DAMAGE_TYPE_LABEL, DAMAGE_TYPE_COLOR } from '@/lib/god-assets';
import type { Role } from '@/lib/supabase/database.types';
import { SwordIcon, OrbIcon, SearchIcon } from '@/components/icons';

type DamageType = keyof typeof DAMAGE_TYPE_LABEL;

type God = {
  id: string;
  name: string;
  pantheon: string;
  primary_role: string;
  damage_type: string;
  icon_url: string | null;
};

const ROLES: Role[] = ['solo', 'jungle', 'mid', 'adc', 'support'];
const DAMAGE_TYPES: DamageType[] = ['strength', 'intelligence'];

// Card art wants more pixels than the 40-64px avatar chip does - bump the
// CDN's own resizing param rather than serving the same small crop stretched.
function cardArtUrl(iconUrl: string | null): string | null {
  if (!iconUrl) return null;
  return iconUrl.replace(/width=\d+/, 'width=640');
}

const DAMAGE_ICON: Record<DamageType, (props: { size?: number }) => React.ReactElement> = {
  strength: SwordIcon,
  intelligence: OrbIcon,
};

export function GodsExplorer({ gods, initialRole }: { gods: God[]; initialRole: Role | null }) {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<Role | null>(initialRole);
  const [damage, setDamage] = useState<DamageType | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return gods.filter((g) => {
      if (role && g.primary_role !== role) return false;
      if (damage && g.damage_type !== damage) return false;
      if (q && !g.name.toLowerCase().includes(q) && !g.pantheon.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [gods, query, role, damage]);

  return (
    <div>
      {/* Controls */}
      <div className="mb-6 flex flex-col gap-3">
        <div className="relative w-full sm:max-w-xs">
          <label htmlFor="god-search" className="sr-only">
            Buscar dios por nombre o panteón
          </label>
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
            <SearchIcon />
          </span>
          <input
            id="god-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar dios o panteón..."
            className="w-full rounded-md border border-ss-line bg-ss-card py-2 pl-9 pr-3 text-sm text-ss-text placeholder:text-ss-text-muted focus:border-ss-cyan"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="sr-only" role="status" aria-live="polite">
            {filtered.length} de {gods.length} dioses
          </span>
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

          <span className="mx-1 h-4 w-px bg-ss-line" aria-hidden="true" />

          {DAMAGE_TYPES.map((d) => {
            const Icon = DAMAGE_ICON[d];
            const active = damage === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setDamage(active ? null : d)}
                aria-pressed={active}
                className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition"
                style={{
                  borderColor: active ? DAMAGE_TYPE_COLOR[d] : 'var(--ss-line)',
                  backgroundColor: active ? `${DAMAGE_TYPE_COLOR[d]}1a` : 'transparent',
                  color: active ? DAMAGE_TYPE_COLOR[d] : 'var(--ss-text-muted)',
                }}
              >
                <Icon />
                {DAMAGE_TYPE_LABEL[d]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-ss-text-muted">Ningún dios coincide con esa búsqueda.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
          {filtered.map((g, i) => {
            const roleColor = ROLE_COLOR[g.primary_role as Role] ?? '#8b97a8';
            const dmgColor = DAMAGE_TYPE_COLOR[g.damage_type as DamageType] ?? '#8b97a8';
            const DmgIcon = DAMAGE_ICON[g.damage_type as DamageType];
            const art = cardArtUrl(g.icon_url);

            return (
              <li key={g.id}>
                <Reveal delay={Math.min(i, 16) * 0.02}>
                  <motion.div whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 300, damping: 22 }}>
                    <Link
                      href={`/gods/${g.id}`}
                      aria-label={`${g.name}, ${ROLE_LABEL[g.primary_role as Role] ?? g.primary_role}, panteón ${g.pantheon}`}
                      className="group relative flex aspect-[3/4] flex-col justify-end overflow-hidden rounded-xl border border-ss-line bg-ss-bg-raised transition-shadow duration-200"
                      style={{ boxShadow: '0 0 0 0 transparent' }}
                      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = `0 12px 32px -14px ${roleColor}99`)}
                      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = '0 0 0 0 transparent')}
                    >
                      {art ? (
                        // eslint-disable-next-line @next/next/no-img-element -- external CDN portrait
                        <img
                          src={art}
                          alt=""
                          loading="lazy"
                          className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-300 ease-out group-hover:scale-[1.06]"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-ss-bg-raised text-lg font-semibold text-ss-text-muted">
                          {g.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}

                      {/* Legibility scrim - text always readable regardless of art brightness */}
                      <div
                        className="absolute inset-0"
                        style={{ background: 'linear-gradient(to top, rgba(10,13,21,0.95) 0%, rgba(10,13,21,0.55) 38%, rgba(10,13,21,0) 65%)' }}
                        aria-hidden="true"
                      />

                      {/* Role-colored top accent, doubles as a keyboard-focus/hover indicator beyond the outer ring */}
                      <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: roleColor }} aria-hidden="true" />

                      <span
                        className="absolute right-2 top-2.5 flex h-6 w-6 items-center justify-center rounded-full border"
                        style={{ backgroundColor: 'rgba(10,13,21,0.75)', borderColor: `${dmgColor}66`, color: dmgColor }}
                        title={DAMAGE_TYPE_LABEL[g.damage_type as DamageType]}
                        aria-hidden="true"
                      >
                        {DmgIcon ? <DmgIcon size={13} /> : null}
                      </span>

                      <div className="relative z-10 p-2.5">
                        <p className="truncate font-display text-sm font-bold leading-tight text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
                          {g.name}
                        </p>
                        <div className="mt-1 flex items-center gap-1 text-[11px] font-medium" style={{ color: roleColor }}>
                          {/* eslint-disable-next-line @next/next/no-img-element -- external CDN icon */}
                          <img src={roleIconUrl(g.primary_role as Role)} alt="" className="h-3 w-3" />
                          <span className="truncate">{ROLE_LABEL[g.primary_role as Role] ?? g.primary_role}</span>
                        </div>
                        <p className="truncate text-[10px] text-white/70">{g.pantheon}</p>
                      </div>
                    </Link>
                  </motion.div>
                </Reveal>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
