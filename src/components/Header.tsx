import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getTwitchLiveStatus } from '@/lib/twitch';
import { NavLinks } from '@/components/NavLinks';
import { GodSearch } from '@/components/GodSearch';
import { MobileNav } from '@/components/MobileNav';
import { MotionToggle } from '@/components/motion/MotionToggle';
import { SignOutButton } from '@/components/dashboard/SignOutButton';

const TWITCH_LOGIN = 'totti_gr';

export async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const live = await getTwitchLiveStatus(TWITCH_LOGIN);

  // Built once and rendered into both the desktop bar and the mobile drawer,
  // so the two can't say different things about the session.
  const liveBadge = live.isLive ? (
    <a
      href={`https://twitch.tv/${TWITCH_LOGIN}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 rounded-full bg-ss-loss/15 px-2.5 py-1 text-xs font-semibold text-ss-loss"
      title={live.title}
    >
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ss-loss" />
      EN VIVO{live.viewerCount != null ? ` · ${live.viewerCount}` : ''}
    </a>
  ) : null;

  const actions = user ? (
    <>
      <Link
        href="/matches/new"
        className="neu-raised whitespace-nowrap rounded-md bg-ss-cyan px-3 py-1.5 text-sm font-semibold text-ss-bg transition duration-200 hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_8px_24px_-10px_var(--ss-cyan)]"
      >
        + Nueva partida
      </Link>
      <SignOutButton />
    </>
  ) : (
    <Link
      href="/login"
      className="whitespace-nowrap rounded-md border border-ss-cyan/50 px-3 py-1.5 text-sm font-semibold text-ss-cyan transition hover:bg-ss-cyan/10"
    >
      Iniciar sesión
    </Link>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-ss-line bg-ss-card/80 backdrop-blur-md">
      {/* One row on phones (logo + menu button), the full bar from lg up.
          flex-wrap is kept so the ~lg widths where everything only just fits
          wrap gracefully instead of overflowing. */}
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3">
        <Link
          href="/"
          className="flex items-center gap-1.5 font-display text-base font-bold tracking-tight text-ss-text sm:text-lg"
        >
          <span className="text-ss-cyan">SMITE&nbsp;2</span>&nbsp;TRACKER
        </Link>

        <NavLinks />

        <div className="hidden lg:block">{liveBadge}</div>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden items-center gap-3 lg:flex">
            <MotionToggle />
            <GodSearch />
            {actions}
          </div>

          {/* Everything above, collapsed behind one button below lg. */}
          <MobileNav actions={actions} live={liveBadge} />
        </div>
      </div>
    </header>
  );
}
