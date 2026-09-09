'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';

// Fires off the redirect('/?saved=1') in matches/new/actions.ts - without
// this, saving a match was a silent teleport back to the dashboard with
// zero confirmation that anything actually happened.
export function SavedToast() {
  const params = useSearchParams();
  const router = useRouter();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (params.get('saved') !== '1') return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to an external system (the URL query string), not derivable from props/state - same pattern as the hydration-safe localStorage reads elsewhere in this app.
    setShow(true);
    router.replace('/', { scroll: false }); // strip ?saved=1 so a refresh/share doesn't re-trigger it
    const timer = setTimeout(() => setShow(false), 4000);
    return () => clearTimeout(timer);
  }, [params, router]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: -16, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          className="fixed left-1/2 top-4 z-50 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-ss-win/40 bg-ss-card px-4 py-2 text-sm font-medium text-ss-win shadow-lg"
        >
          ✓ Partida guardada
        </motion.div>
      )}
    </AnimatePresence>
  );
}
