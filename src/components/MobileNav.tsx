'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_LINKS } from '@/lib/nav-links';
import { GodSearch } from '@/components/GodSearch';
import { MotionToggle } from '@/components/motion/MotionToggle';
import { MenuIcon, CloseIcon } from '@/components/icons';

// The header used to put all 7 nav links, the search box and the auth
// buttons in one flex-wrap row. On a phone that wrapped into a ~340px tall
// block - 42% of an 812px viewport, permanently, because the header is
// sticky - with the last link still cut off horizontally. Below `lg` the
// links now live in a drawer behind this button, so the bar itself is one
// compact row (~61px).
//
// `actions` is whatever the signed-in/signed-out CTA is (Nueva partida +
// Salir, or Iniciar sesión). It's passed in from the server Header rather
// than recreated here so the sign-out form action stays a server component.
//
// Deliberately NOT animated with `motion`, on the same rule the login screen
// arrived at the hard way: an entrance animation must never be the thing that
// makes content visible. Below `lg` this drawer is the ONLY route to the nav,
// so if its reveal stalls the site has no navigation at all. `.fade-up-in` is
// a plain CSS animation with `both` fill - the sitewide reduced-motion rule
// collapses its duration, which lands on the final state rather than short of
// it, and it needs no JS to have run.
export function MobileNav({ actions, live }: { actions: ReactNode; live?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Escape closes, and the page behind shouldn't scroll under the drawer.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // The overlay is positioned against the <header>, NOT the viewport: the
  // header sets backdrop-blur, and a filter/backdrop-filter makes an element
  // the containing block for `fixed` descendants too, so a `fixed` drawer
  // silently ignored the offset it was given. `absolute top-full` against the
  // sticky header is exact by construction and needs no measurement.
  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
        className="neu-raised flex h-9 w-9 items-center justify-center rounded-md border border-ss-line bg-ss-bg-raised text-ss-text-secondary transition hover:text-ss-text"
      >
        {open ? <CloseIcon size={18} /> : <MenuIcon size={18} />}
      </button>

      {open && (
        <>
          {/* Tapping outside closes - what a thumb reaches for before it
              finds the X. */}
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setOpen(false)}
            className="absolute inset-x-0 top-full z-40 h-[100dvh] cursor-default bg-black/60"
          />

          <div
            id="mobile-nav"
            className="glass-drawer fade-up-in absolute inset-x-0 top-full z-50 max-h-[calc(100dvh-100%)] overflow-y-auto rounded-b-2xl border-t border-ss-line p-4"
          >
            <GodSearch />

            {/* Two columns: 7 links fit in 4 rows instead of 7, so the CTA
                stays above the fold on a short phone. */}
            <nav aria-label="Principal" className="mt-4 grid grid-cols-2 gap-1.5">
              {NAV_LINKS.map((link) => {
                const active = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className={`rounded-md px-3 py-2.5 text-sm font-medium transition ${
                      active
                        ? 'bg-ss-cyan/12 text-ss-cyan'
                        : 'text-ss-text-secondary hover:bg-ss-bg-raised hover:text-ss-text'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            {live && <div className="mt-4 flex">{live}</div>}

            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ss-line pt-4">
              {actions}
              <MotionToggle />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
