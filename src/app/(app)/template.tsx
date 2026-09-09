'use client';

import { motion } from 'motion/react';

// Unlike layout.tsx, a template.tsx remounts on every navigation - that's
// exactly the hook needed for a per-page enter transition. Deliberately
// subtle (short fade + tiny rise, no slide/scale) so it reads as polish,
// not a loading-screen gimmick; reduced-motion users get it instantly via
// Motion's own MotionConfig in MotionRoot (see src/components/motion).
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
