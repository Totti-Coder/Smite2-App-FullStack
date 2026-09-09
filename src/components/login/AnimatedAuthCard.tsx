'use client';

import { useEffect, useState } from 'react';
import { useReducedMotion, motion, useMotionValue, useTransform } from 'motion/react';
import { useMotionPref } from '@/components/motion/MotionRoot';
import type { ReactNode } from 'react';

// The card chrome from the reference design - 3D tilt on pointer, light
// beams travelling the four edges, pulsing corner dots - rebuilt on this
// app's own palette (--ss-cyan / --ss-purple) and its existing .glass-panel
// surface, so nothing about the colours or the shape changes; only motion
// is added. Ported to `motion/react` (already a dependency) rather than
// pulling in framer-motion, which is the same API under a newer name.

const BEAM_DURATION = 2.6;
const BEAM_GAP = 1;

/** One edge beam. `axis` decides whether it runs horizontally or vertically. */
function Beam({
  axis,
  side,
  delay,
  color,
}: {
  axis: 'x' | 'y';
  side: 'top' | 'bottom' | 'left' | 'right';
  delay: number;
  color: string;
}) {
  const horizontal = axis === 'x';
  const gradient = `linear-gradient(${horizontal ? '90deg' : '180deg'}, transparent, ${color}, transparent)`;

  // The travel transition is identical on both axes; only which property it
  // drives differs. Spelled out per-axis rather than via a computed key so
  // the object keeps a concrete type (a computed key widens it to a string
  // index signature, which Transition won't accept).
  const travel = {
    duration: BEAM_DURATION,
    ease: 'easeInOut' as const,
    repeat: Infinity,
    repeatDelay: BEAM_GAP,
    delay,
  };
  const fade = { duration: 1.3, repeat: Infinity, repeatType: 'mirror' as const, delay };

  return (
    <motion.div
      aria-hidden="true"
      className="absolute"
      style={{
        background: gradient,
        filter: 'blur(1.5px)',
        ...(horizontal ? { height: 2, width: '50%' } : { width: 2, height: '50%' }),
        ...(side === 'top' && { top: 0 }),
        ...(side === 'bottom' && { bottom: 0 }),
        ...(side === 'left' && { left: 0 }),
        ...(side === 'right' && { right: 0 }),
      }}
      initial={horizontal ? { left: '-50%' } : { top: '-50%' }}
      animate={
        horizontal
          ? { left: ['-50%', '100%'], opacity: [0.25, 0.8, 0.25] }
          : { top: ['-50%', '100%'], opacity: [0.25, 0.8, 0.25] }
      }
      transition={horizontal ? { left: travel, opacity: fade } : { top: travel, opacity: fade }}
    />
  );
}

export function AnimatedAuthCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  // useReducedMotion reads the media query directly and knows nothing about
  // MotionConfig, so the site-level opt-in has to be applied explicitly here
  // (see components/motion/MotionRoot.tsx) - otherwise turning animations on
  // would light up everything except this card.
  const reduced = useReducedMotion();
  const { pref } = useMotionPref();

  // Branching the RENDERED TREE on a media query is a hydration mismatch (it
  // resolves differently on the server). Gate on mount instead: server and
  // first client render both produce the plain card, then the decoration is
  // added in an effect. Same hydration-safe pattern as the localStorage
  // reads elsewhere in this app.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: defers motion-only decoration until after hydration so SSR and first client render match
    setMounted(true);
  }, []);
  const animate = mounted && (pref === 'on' || !reduced);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useTransform(mouseY, [-300, 300], [8, -8]);
  const rotateY = useTransform(mouseX, [-300, 300], [-8, 8]);

  function handleMouseMove(e: React.MouseEvent) {
    if (!animate) return;
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left - rect.width / 2);
    mouseY.set(e.clientY - rect.top - rect.height / 2);
  }

  function handleMouseLeave() {
    mouseX.set(0);
    mouseY.set(0);
  }

  return (
    <div style={{ perspective: 1400 }} className={className}>
      <motion.div
        className="relative"
        // Tilt is pointer-driven, so it simply never engages for anyone with
        // reduced motion on - no spring to fight, nothing to disable.
        style={animate ? { rotateX, rotateY } : undefined}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {animate && (
          <div className="pointer-events-none absolute -inset-px overflow-hidden rounded-2xl">
            <Beam axis="x" side="top" delay={0} color="var(--ss-cyan)" />
            <Beam axis="y" side="right" delay={0.65} color="var(--ss-cyan)" />
            <Beam axis="x" side="bottom" delay={1.3} color="var(--ss-purple)" />
            <Beam axis="y" side="left" delay={1.95} color="var(--ss-purple)" />

            {(
              [
                { pos: 'top-0 left-0', delay: 0 },
                { pos: 'top-0 right-0', delay: 0.5 },
                { pos: 'bottom-0 right-0', delay: 1 },
                { pos: 'bottom-0 left-0', delay: 1.5 },
              ] as const
            ).map((dot) => (
              <motion.div
                key={dot.pos}
                aria-hidden="true"
                className={`absolute ${dot.pos} h-1.5 w-1.5 rounded-full bg-ss-cyan blur-[2px]`}
                animate={{ opacity: [0.2, 0.55, 0.2] }}
                transition={{ duration: 2.2, repeat: Infinity, repeatType: 'mirror', delay: dot.delay }}
              />
            ))}
          </div>
        )}

        <div className="glass-panel relative overflow-hidden rounded-2xl p-6">{children}</div>
      </motion.div>
    </div>
  );
}
