'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { deleteMatch } from '@/app/(app)/partidas/actions';
import { GodAvatar } from '@/components/GodAvatar';
import { roleIconUrl, ROLE_LABEL } from '@/lib/god-assets';
import { relativeTime } from '@/lib/relative-time';
import { TrashIcon, CheckIcon, CloseIcon } from '@/components/icons';
import type { Role } from '@/lib/supabase/database.types';
import type { MatchWithGod } from '@/lib/stats';

type MatchRow = MatchWithGod & { screenshotUrl: string | null };

type DeleteState = 'idle' | 'confirming' | 'deleting' | 'error';

function DeleteControl({ matchId, onDeleted }: { matchId: string; onDeleted: () => void }) {
  const [state, setState] = useState<DeleteState>('idle');

  async function confirmDelete() {
    setState('deleting');
    const res = await deleteMatch(matchId);
    if (res.error) {
      setState('error');
      return;
    }
    onDeleted();
  }

  return (
    <div className="absolute right-3 top-3 z-10">
      <AnimatePresence mode="wait" initial={false}>
        {state === 'idle' && (
          <motion.button
            key="idle"
            type="button"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.15 }}
            onClick={() => setState('confirming')}
            title="Eliminar partida"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-ss-line bg-ss-bg/80 text-ss-text-muted backdrop-blur transition hover:border-ss-loss hover:text-ss-loss"
          >
            <TrashIcon size={14} />
          </motion.button>
        )}

        {state === 'confirming' && (
          <motion.div
            key="confirming"
            initial={{ opacity: 0, scale: 0.9, x: 12 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.9, x: 12 }}
            transition={{ duration: 0.18 }}
            className="flex items-center gap-1.5 rounded-full border border-ss-loss/40 bg-ss-bg/95 py-1 pl-3 pr-1.5 shadow-lg backdrop-blur"
          >
            <span className="text-[11px] font-medium whitespace-nowrap text-ss-loss">¿Eliminar?</span>
            <button
              type="button"
              onClick={confirmDelete}
              title="Sí, eliminar"
              className="flex h-6 w-6 items-center justify-center rounded-full bg-ss-loss text-white transition hover:brightness-110"
            >
              <CheckIcon size={12} />
            </button>
            <button
              type="button"
              onClick={() => setState('idle')}
              title="Cancelar"
              className="flex h-6 w-6 items-center justify-center rounded-full border border-ss-line text-ss-text-muted transition hover:text-ss-text"
            >
              <CloseIcon size={12} />
            </button>
          </motion.div>
        )}

        {state === 'deleting' && (
          <motion.div
            key="deleting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-ss-line bg-ss-bg/80"
          >
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
              className="block h-3.5 w-3.5 rounded-full border-2 border-ss-loss border-t-transparent"
            />
          </motion.div>
        )}

        {state === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex items-center gap-1.5 rounded-full border border-ss-loss/40 bg-ss-bg/95 py-1 pl-3 pr-1.5"
          >
            <span className="text-[11px] text-ss-loss">Falló, reinténtalo</span>
            <button
              type="button"
              onClick={() => setState('idle')}
              className="flex h-6 w-6 items-center justify-center rounded-full border border-ss-line text-ss-text-muted transition hover:text-ss-text"
            >
              <CloseIcon size={12} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function MatchesList({ matches }: { matches: MatchRow[] }) {
  const [items, setItems] = useState(matches);

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-ss-line bg-ss-card p-8 text-center">
        <p className="text-sm text-ss-text-muted">Todavía no cargaste ninguna partida.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <AnimatePresence initial={false}>
        {items.map((m) => {
          const godName = m.gods?.name ?? m.god_id;
          const kda = m.deaths === 0 ? m.kills + m.assists : (m.kills + m.assists) / m.deaths;

          return (
            <motion.div
              key={m.id}
              layout
              initial={false}
              exit={{ opacity: 0, scale: 0.97, height: 0, marginBottom: 0, transition: { duration: 0.25 } }}
              transition={{ layout: { duration: 0.25 } }}
              className="relative flex flex-col gap-4 overflow-hidden rounded-xl border border-ss-line bg-ss-card p-4 sm:flex-row"
              style={{ borderLeft: `3px solid ${m.result === 'win' ? '#34d399' : '#fb3b5c'}` }}
            >
              <DeleteControl matchId={m.id} onDeleted={() => setItems((prev) => prev.filter((x) => x.id !== m.id))} />

              {m.screenshotUrl && (
                <a
                  href={m.screenshotUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full shrink-0 overflow-hidden rounded-lg border border-ss-line sm:w-40"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URL, not a static/optimizable asset */}
                  <img src={m.screenshotUrl} alt={`Captura de la partida con ${godName}`} className="h-24 w-full object-cover sm:h-full" />
                </a>
              )}

              <div className="min-w-0 flex-1 pr-8">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/gods/${m.god_id}`} className="flex items-center gap-2.5 transition hover:opacity-80">
                    <GodAvatar iconUrl={m.gods?.icon_url ?? null} name={godName} size={40} />
                    <div>
                      <p className="font-display text-sm font-bold text-ss-text">{godName}</p>
                      <div className="flex items-center gap-1 text-xs text-ss-text-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element -- external CDN icon */}
                        <img src={roleIconUrl(m.role_played as Role)} alt="" className="h-3 w-3" />
                        {ROLE_LABEL[m.role_played as Role]}
                        {m.enemy_god && (
                          <span>
                            {' '}
                            · vs {m.enemy_god.name}
                            {m.enemy_god.primary_role && ` (${ROLE_LABEL[m.enemy_god.primary_role as Role] ?? m.enemy_god.primary_role})`}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                  <div className="text-right">
                    <p className={`font-display text-sm font-bold ${m.result === 'win' ? 'text-ss-win' : 'text-ss-loss'}`}>
                      {m.result === 'win' ? 'Victoria' : 'Derrota'}
                    </p>
                    <p className="text-xs text-ss-text-muted">
                      {m.kills}/{m.deaths}/{m.assists} · {kda.toFixed(1)} KDA
                    </p>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ss-text-muted">
                  <span>{relativeTime(m.played_at)}</span>
                  {m.rank_tier && <span className="rounded bg-ss-bg-raised px-1.5 py-0.5 text-ss-cyan">{m.rank_tier}</span>}
                  {m.gold_per_min != null && <span className="text-ss-orange">🪙 {m.gold_per_min}/min</span>}
                </div>

                {m.items && m.items.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.items.map((item, i) => (
                      <Link
                        key={i}
                        href={`/items?q=${encodeURIComponent(item)}`}
                        className="rounded border border-ss-line bg-ss-bg-raised px-2 py-0.5 text-[11px] text-ss-text-secondary transition hover:border-ss-cyan hover:text-ss-text"
                      >
                        {item}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
