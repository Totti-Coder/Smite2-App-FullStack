'use client';

import { useEffect, useRef } from 'react';
import { animate, useMotionValue, useMotionValueEvent, useInView } from 'motion/react';

/**
 * Counts up from 0 to `value` once it scrolls into view. Renders the exact
 * same formatted string that was passed in on the final frame, so it never
 * drifts from the real value (no separate rounding logic to keep in sync).
 */
export function AnimatedNumber({ value, suffix = '', decimals = 0 }: { value: number; suffix?: string; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const mv = useMotionValue(0);
  const displayRef = useRef<HTMLSpanElement>(null);

  useMotionValueEvent(mv, 'change', (latest) => {
    if (displayRef.current) {
      displayRef.current.textContent = `${latest.toFixed(decimals)}${suffix}`;
    }
  });

  useEffect(() => {
    if (!inView) return;
    const controls = animate(mv, value, { duration: 1, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [inView, value, mv]);

  return (
    <span ref={ref}>
      <span ref={displayRef}>0{suffix}</span>
    </span>
  );
}
