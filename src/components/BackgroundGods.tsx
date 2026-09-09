'use client';

import gods from '@/data/gods.json';

// A visually striking, fixed rotation - not random, so it's the same calm
// set every load instead of picking oddball portraits. Rendered underneath
// the video as a graceful fallback (ad-blockers, offline, embed disabled).
const FEATURED_IDS = ['hades', 'zeus', 'athena', 'thor', 'kali', 'susano'];

// "SMITE 2 - Official Reveal Trailer" - youtube-nocookie.com embed, nothing
// downloaded or re-hosted. autoplay+mute+loop(via playlist=self)+no controls
// so it just reads as ambient motion behind the dashboard.
const YT_VIDEO_ID = 'o1PHxmPq5o4';
const YT_EMBED_SRC = `https://www.youtube-nocookie.com/embed/${YT_VIDEO_ID}?autoplay=1&mute=1&loop=1&playlist=${YT_VIDEO_ID}&controls=0&showinfo=0&modestbranding=1&rel=0&iv_load_policy=3&disablekb=1&playsinline=1`;

export function BackgroundGods() {
  const featured = FEATURED_IDS.map((id) => gods.find((g) => g.id === id)).filter(Boolean) as typeof gods;

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {featured.map((god, i) => (
        // eslint-disable-next-line @next/next/no-img-element -- external CDN portrait, decorative background
        <img
          key={god.id}
          src={god.icon_url ?? undefined}
          alt=""
          className="bg-god-portrait absolute inset-0 h-full w-full object-cover object-top opacity-0 blur-sm"
          style={{ animation: 'bg-god-fade 36s infinite', animationDelay: `${i * 6}s` }}
        />
      ))}

      <iframe
        src={YT_EMBED_SRC}
        title=""
        allow="autoplay; encrypted-media"
        className="absolute top-1/2 left-1/2 min-h-full min-w-full -translate-x-1/2 -translate-y-1/2"
        style={{ width: '100vw', height: '56.25vw', minHeight: '100vh', minWidth: '177.78vh' }}
      />

      <div className="absolute inset-0 bg-gradient-to-b from-ss-bg/40 via-ss-bg/55 to-ss-bg/85" />
    </div>
  );
}
