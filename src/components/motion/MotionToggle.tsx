'use client';

import { useMotionPref } from './MotionRoot';
import { SparkleIcon } from '@/components/icons';

/**
 * Lets someone turn animations on for this site even when their OS asks for
 * reduced motion. Only worth showing to the people it affects, so it stays
 * hidden unless the OS actually is asking for reduced motion - everyone
 * else already sees the animations and doesn't need a control for it.
 */
export function MotionToggle({ className = '' }: { className?: string }) {
  const { pref, setPref } = useMotionPref();

  return (
    <button
      type="button"
      onClick={() => setPref(pref === 'on' ? 'auto' : 'on')}
      title={
        pref === 'on'
          ? 'Animaciones activadas para esta web. Toca para volver a seguir la preferencia de tu sistema.'
          : 'Tu sistema pide movimiento reducido, así que las animaciones están apagadas. Toca para activarlas solo en esta web.'
      }
      className={`motion-toggle items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition ${
        pref === 'on'
          ? 'border-ss-cyan/50 bg-ss-cyan/10 text-ss-cyan'
          : 'border-ss-line text-ss-text-muted hover:text-ss-text'
      } ${className}`}
    >
      <SparkleIcon size={13} />
      {pref === 'on' ? 'Animaciones on' : 'Activar animaciones'}
    </button>
  );
}
