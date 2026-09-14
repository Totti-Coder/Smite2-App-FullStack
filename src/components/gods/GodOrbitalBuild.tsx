'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useReducedMotion } from 'motion/react';
import { useMotionPref } from '@/components/motion/MotionRoot';
import { CoinIcon, LockIcon, SparkleIcon } from '@/components/icons';
import type { Item } from '@/lib/item-types';
import itemsCatalog from '@/data/items.json';

// Loaded only when the section scrolls into view (see `armed` below), so the
// multi-megabyte .glb and the three.js/r3f bundle are never fetched by
// someone who doesn't reach this part of the page.
const GodModelCanvas = dynamic(() => import('@/components/gods/GodModelCanvas'), { ssr: false });

const itemByName = new Map((itemsCatalog as unknown as Item[]).map((i) => [i.name, i]));

/** Slots shown when there is no recorded build to orbit. */
const EMPTY_SLOTS = 6;

type Node = { key: string; item: Item | null; label: string };

export function GodOrbitalBuild({
  godName,
  accent,
  modelSrc,
  buildItems,
  playedAt,
}: {
  godName: string;
  /** The god's damage-type colour, used for the rim light and node accents. */
  accent: string;
  modelSrc: string;
  /** Item NAMES from the most recent match with this god, or null if none. */
  buildItems: string[] | null;
  playedAt: string | null;
}) {
  const reduced = useReducedMotion();
  const { pref } = useMotionPref();
  const animate = pref === 'on' || !reduced;

  const containerRef = useRef<HTMLDivElement>(null);
  const [armed, setArmed] = useState(false);
  const [angle, setAngle] = useState(0);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [radius, setRadius] = useState(180);

  // The orbit is a CLIENT-ONLY layout: every node's position comes from the
  // measured container width and the running rotation angle, neither of which
  // exists during SSR. Rendering it on the server produced a hydration
  // mismatch (the transforms genuinely differ), so until mount the same nodes
  // are laid out as a plain wrapped row instead. That row is not a loading
  // state - it is a complete, readable fallback, which also means the build is
  // still legible if JS never runs at all.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: defers the measurement-dependent orbit layout until after hydration so SSR and first client render match
    setMounted(true);
  }, []);

  const nodes: Node[] = useMemo(() => {
    const names = (buildItems ?? []).filter(Boolean);
    if (names.length === 0) {
      return Array.from({ length: EMPTY_SLOTS }, (_, i) => ({
        key: `empty-${i}`,
        item: null,
        label: 'Vacío',
      }));
    }
    return names.map((name, i) => ({
      key: `${name}-${i}`,
      item: itemByName.get(name) ?? null,
      label: name,
    }));
  }, [buildItems]);

  const hasBuild = (buildItems ?? []).length > 0;

  // Only mount the 3D canvas once this is actually on screen.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setArmed(true);
          io.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Radius follows the container so the ring doesn't overflow on a phone.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setRadius(Math.max(110, Math.min(200, el.clientWidth / 2 - 72)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The orbit itself. Paused while a node is open (so the card doesn't drift
  // away from under the cursor) and whenever motion is reduced - in that case
  // the nodes simply sit at their starting angles, still laid out and fully
  // readable. The positions never depend on this interval having run.
  useEffect(() => {
    if (!animate || openKey) return;
    const timer = setInterval(() => setAngle((a) => (a + 0.25) % 360), 50);
    return () => clearInterval(timer);
  }, [animate, openKey]);

  function positionOf(index: number, total: number) {
    const deg = ((index / total) * 360 + angle) % 360;
    const rad = (deg * Math.PI) / 180;
    return {
      x: radius * Math.cos(rad),
      y: radius * Math.sin(rad),
      // Nodes on the far side of the orbit sit behind the model and dim,
      // which is what reads as depth rather than a flat ring.
      z: Math.round(20 + 20 * Math.cos(rad)),
      opacity: Math.max(0.45, 0.45 + 0.55 * ((1 + Math.sin(rad)) / 2)),
    };
  }

  const open = openKey ? nodes.find((n) => n.key === openKey) : null;

  return (
    <section
      className="glass-panel relative overflow-hidden rounded-xl p-5"
      aria-labelledby="orbital-heading"
    >
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="orbital-heading"
          className="font-display text-sm font-semibold tracking-wide text-ss-text-secondary uppercase"
        >
          Última build
        </h2>
        <p className="text-xs text-ss-text-muted">
          {hasBuild
            ? playedAt
              ? `Partida del ${new Date(playedAt).toLocaleDateString('es-ES')}`
              : 'Tu partida más reciente'
            : 'Sin partida registrada'}
        </p>
      </div>
      <p className="mb-2 text-xs text-ss-text-muted">
        {hasBuild
          ? 'Pulsa un item para ver sus estadísticas. Arrastra el modelo para girarlo.'
          : `Todavía no has registrado ninguna partida con ${godName}. Arrastra el modelo para girarlo.`}
      </p>

      <div
        ref={containerRef}
        className={
          mounted
            ? 'relative flex h-[420px] w-full items-center justify-center sm:h-[460px]'
            : 'flex w-full flex-wrap items-center justify-center gap-3 py-6'
        }
        onClick={() => setOpenKey(null)}
      >
        {/* Orbit guide rings and the 3D canvas only exist once the orbit
            layout is active - before mount there is nothing to orbit around. */}
        {mounted && (
          <>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute rounded-full border border-white/10"
              style={{ width: radius * 2, height: radius * 2 }}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute rounded-full border border-white/5"
              style={{ width: radius * 2 + 56, height: radius * 2 + 56 }}
            />

            {/* The model sits in the middle of the z-stack: nodes in front of
                it get a higher z-index than this, nodes behind a lower one. */}
            <div className="absolute h-56 w-56 sm:h-64 sm:w-64" style={{ zIndex: 20 }}>
              {armed ? (
                <GodModelCanvas src={modelSrc} accent={accent} autoRotate={animate} />
              ) : (
                <div
                  className="h-full w-full rounded-full border border-dashed border-ss-line/60"
                  aria-hidden="true"
                />
              )}
            </div>
          </>
        )}

        {nodes.map((node, i) => {
          const p = positionOf(i, nodes.length);
          const isOpen = openKey === node.key;
          return (
            <button
              key={node.key}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpenKey(isOpen ? null : node.key);
              }}
              aria-expanded={isOpen}
              aria-label={
                node.item
                  ? `${node.item.name}, ${node.item.tier}, ${node.item.cost} de oro`
                  : 'Hueco de item sin partida registrada'
              }
              className={
                mounted ? 'absolute transition-[transform,opacity] duration-500 ease-out' : 'relative'
              }
              // Positions are applied ONLY after mount - see the `mounted`
              // note above. Pre-mount the nodes sit in normal flow.
              style={
                mounted
                  ? {
                      transform: `translate(${p.x}px, ${p.y}px)`,
                      zIndex: isOpen ? 60 : p.z,
                      opacity: isOpen ? 1 : p.opacity,
                    }
                  : undefined
              }
            >
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-full border-2 bg-ss-card/90 transition-transform duration-300 ${
                  isOpen ? 'scale-125' : ''
                } ${node.item ? '' : 'border-dashed'}`}
                style={{ borderColor: isOpen ? accent : node.item ? `${accent}66` : 'var(--ss-line)' }}
              >
                {node.item ? (
                  // eslint-disable-next-line @next/next/no-img-element -- external CDN icon
                  <img src={node.item.icon_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <span className="text-ss-text-muted">
                    <LockIcon size={16} />
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* The detail lives in a fixed slot under the orbit, not floating off the
          node: a card anchored to a node that is still moving is unreadable,
          and on a phone it would leave the panel entirely. */}
      <div className="min-h-[104px] border-t border-ss-line pt-4">
        {open?.item ? (
          <div className="flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- external CDN icon */}
            <img
              src={open.item.icon_url}
              alt=""
              className="h-12 w-12 shrink-0 rounded border border-ss-line"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/items?q=${encodeURIComponent(open.item.name)}`}
                  className="font-display text-sm font-bold text-ss-text hover:text-ss-cyan hover:underline"
                >
                  {open.item.name}
                </Link>
                <span className="text-[10px] tracking-wide text-ss-text-muted uppercase">{open.item.tier}</span>
                {open.item.cost ? (
                  <span className="flex items-center gap-1 text-[11px] text-ss-text-muted">
                    <CoinIcon size={11} /> {open.item.cost}
                  </span>
                ) : null}
              </div>

              {open.item.stats && Object.keys(open.item.stats).length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {Object.entries(open.item.stats).map(([k, v]) => (
                    <span
                      key={k}
                      className="rounded bg-ss-bg-raised px-1.5 py-0.5 text-[10px] text-ss-text-secondary"
                    >
                      {k.replace(/([a-z])([A-Z])/g, '$1 $2')} <strong style={{ color: accent }}>{v}</strong>
                    </span>
                  ))}
                </div>
              )}

              {(open.item.passive || open.item.active) && (
                <p className="mt-2 text-xs whitespace-pre-line text-ss-text-secondary">
                  {open.item.passive ?? open.item.active}
                </p>
              )}
            </div>
          </div>
        ) : open ? (
          <p className="text-xs text-ss-text-muted">
            Este hueco se rellenará con el item correspondiente cuando registres una partida con {godName}.
          </p>
        ) : (
          <p className="flex items-center gap-1.5 text-xs text-ss-text-muted">
            <SparkleIcon size={12} />
            {hasBuild ? 'Selecciona un item de la órbita.' : `${EMPTY_SLOTS} huecos esperando tu primera partida.`}
          </p>
        )}
      </div>
    </section>
  );
}
