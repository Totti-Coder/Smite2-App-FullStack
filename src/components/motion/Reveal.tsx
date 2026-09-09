'use client';

import { motion, type Variants } from 'motion/react';
import type { ReactNode } from 'react';

const variants: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0 },
};

/**
 * Fade-up-on-scroll wrapper. Triggers once when the element enters the
 * viewport (margin pulls the trigger up so it fires a bit before it's fully
 * visible, feels snappier). `delay` lets a list stagger itself by passing
 * `index * 0.06` or similar from the caller.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
      variants={variants}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
