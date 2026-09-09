'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_LINKS } from '@/lib/nav-links';

/**
 * Desktop primary nav. Client-side only because `aria-current="page"` needs
 * the active route: screen-reader users otherwise get seven identical links
 * with no indication of where they already are, and sighted users had no
 * active state either.
 */
export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav aria-label="Principal" className="hidden items-center gap-4 text-sm text-ss-text-secondary lg:flex">
      {NAV_LINKS.map((link) => {
        const active = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={active ? 'font-semibold text-ss-cyan' : 'hover:text-ss-text'}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
