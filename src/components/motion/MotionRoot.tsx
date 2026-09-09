'use client';

import { MotionConfig } from 'motion/react';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

// Motion policy for the whole app.
//
// Default is "auto": the OS's prefers-reduced-motion wins, which is the
// correct default now that parts of this site are public. But an OS-level
// "no animations" setting is often about the desktop, not about a site the
// person deliberately came to look at - so there's an explicit opt-in that
// overrides it for this site only, remembered per browser.
//
// 'auto' -> follow the OS.  'on' -> animate regardless.
export type MotionPref = 'auto' | 'on';

const STORAGE_KEY = 'smite2-motion-pref';

const MotionPrefContext = createContext<{ pref: MotionPref; setPref: (p: MotionPref) => void }>({
  pref: 'auto',
  setPref: () => {},
});

export function useMotionPref() {
  return useContext(MotionPrefContext);
}

export function MotionRoot({ children }: { children: ReactNode }) {
  // Starts at 'auto' so the server and the first client render agree; the
  // stored preference is applied after mount (same hydration-safe pattern
  // used for every other localStorage read in this app).
  const [pref, setPrefState] = useState<MotionPref>('auto');

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate hydration-safe read of an external store
    if (saved === 'on' || saved === 'auto') setPrefState(saved);
  }, []);

  // The CSS catch-all in globals.css keys off this attribute, so plain
  // Tailwind transitions honour the override too - not just Motion.
  useEffect(() => {
    document.documentElement.dataset.motion = pref === 'on' ? 'on' : 'auto';
  }, [pref]);

  function setPref(next: MotionPref) {
    setPrefState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }

  return (
    <MotionPrefContext.Provider value={{ pref, setPref }}>
      <MotionConfig reducedMotion={pref === 'on' ? 'never' : 'user'}>{children}</MotionConfig>
    </MotionPrefContext.Provider>
  );
}
