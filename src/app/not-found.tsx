import Link from 'next/link';
import gods from '@/data/gods.json';

// A random-ish but stable pick per build isn't worth the complexity here -
// Thanatos (god of death) fits a 404 page on theme.
const god = gods.find((g) => g.id === 'thanatos') ?? gods[0];

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <Link href="/" className="flex items-center gap-1.5 font-display text-lg font-bold tracking-tight text-ss-text">
        <span className="text-ss-cyan">SMITE&nbsp;2</span>&nbsp;TRACKER
      </Link>

      {/* eslint-disable-next-line @next/next/no-img-element -- external CDN portrait */}
      <img
        src={god.icon_url ?? undefined}
        alt=""
        className="h-32 w-32 rounded-full border-2 border-ss-loss object-cover object-top opacity-90"
      />

      <div>
        <p className="font-display text-7xl font-bold text-ss-loss">404</p>
        <h1 className="mt-2 font-display text-2xl font-bold text-ss-text">Has muerto.</h1>
        <p className="mt-2 max-w-sm text-sm text-ss-text-muted">
          Esta página no existe, se movió, o te teletransportaste a un sitio que ningún dios pisó nunca.
        </p>
      </div>

      <Link
        href="/"
        className="rounded-md bg-ss-cyan px-4 py-2 text-sm font-semibold text-ss-bg transition hover:brightness-110"
      >
        ⛲ Volver al Fountain
      </Link>
    </main>
  );
}
