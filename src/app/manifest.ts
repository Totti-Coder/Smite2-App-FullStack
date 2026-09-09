import type { MetadataRoute } from 'next';

// Lets mobile browsers offer "Add to Home Screen" - opens standalone (no
// browser chrome) like a real app, which matters here specifically because
// the OCR flow (see match-form/ScoreboardScanner.tsx) is meant to be used
// right on your phone straight after a match. Reuses the existing icon.svg
// (src/app/icon.svg) - no new asset.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Smite 2 Tracker',
    short_name: 'Smite 2 Tracker',
    description: 'Dashboard personal de estadísticas de Smite 2: winrate, KDA, builds, matchups.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0d15',
    theme_color: '#0a0d15',
    icons: [{ src: '/icon.svg', type: 'image/svg+xml', sizes: 'any' }],
  };
}
