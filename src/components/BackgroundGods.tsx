'use client';

import gods from '@/data/gods.json';

// A visually striking, fixed rotation - not random, so it's the same calm
// set every load instead of picking oddball portraits.
const FEATURED_IDS = ['hades', 'zeus', 'athena', 'thor', 'kali', 'susano'];

/**
 * Ambient background behind every page: slowly cross-fading god portraits
 * under a dark gradient.
 *
 * This used to also autoplay the official reveal trailer in a YouTube iframe.
 * It was removed on purpose:
 *  - It loaded YouTube's player (third-party JS, on the order of a megabyte)
 *    on EVERY page, for something purely decorative.
 *  - It hurt legibility: gameplay HUD text, the "PRE-ALPHA FOOTAGE" caption,
 *    YouTube's play button and huge promo lettering showed straight through
 *    the translucent panels, the orbital build view and the mobile menu.
 *  - On /login - the one page where ambient motion suits the design - it was
 *    never visible anyway: that page paints an opaque background and its own
 *    WebGL nebula on top.
 *
 * The portraits stay, but dimmer (see `bg-god-fade` in globals.css) and under
 * a heavier gradient, so they read as atmosphere rather than content.
 */
export function BackgroundGods() {
  const featured = FEATURED_IDS.map((id) => gods.find((g) => g.id === id)).filter(Boolean) as typeof gods;

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      {featured.map((god, i) => (
        // eslint-disable-next-line @next/next/no-img-element -- external CDN portrait, decorative background
        <img
          key={god.id}
          src={god.icon_url ?? undefined}
          alt=""
          loading="lazy"
          decoding="async"
          className="bg-god-portrait absolute inset-0 h-full w-full object-cover object-top opacity-0 blur-md"
          style={{ animation: 'bg-god-fade 36s infinite', animationDelay: `${i * 6}s` }}
        />
      ))}

      <div className="absolute inset-0 bg-gradient-to-b from-ss-bg/70 via-ss-bg/80 to-ss-bg/95" />
    </div>
  );
}
