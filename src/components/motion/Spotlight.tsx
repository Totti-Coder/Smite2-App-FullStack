'use client';

import { useRef, type ReactNode } from 'react';

/**
 * Wraps content in a soft radial glow that drifts toward the cursor -
 * "soft lighting" atmosphere, purely decorative. Updates a CSS custom
 * property directly via the DOM ref (no React re-render per pointer move),
 * and just skips the listener entirely under reduced-motion so it renders
 * a static centered glow instead of tracking anything.
 */
export function Spotlight({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--spot-x', `${((e.clientX - rect.left) / rect.width) * 100}%`);
    el.style.setProperty('--spot-y', `${((e.clientY - rect.top) / rect.height) * 100}%`);
  }

  return (
    <div ref={ref} onPointerMove={onPointerMove} className={`relative overflow-hidden ${className ?? ''}`} style={style}>
      <div
        className="pointer-events-none absolute inset-0 opacity-70 transition-[background] duration-700 ease-out"
        style={{
          background:
            'radial-gradient(480px circle at var(--spot-x, 30%) var(--spot-y, 20%), rgba(22,200,212,0.10), transparent 65%)',
        }}
        aria-hidden="true"
      />
      {children}
    </div>
  );
}
