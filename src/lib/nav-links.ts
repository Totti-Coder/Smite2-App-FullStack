// Single source for the primary nav so the desktop bar and the mobile drawer
// can't drift apart - adding a section here puts it in both.
export const NAV_LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/partidas', label: 'Partidas' },
  { href: '/builds', label: 'Builds' },
  { href: '/tierlist', label: 'Tier lists' },
  { href: '/gods', label: 'Dioses' },
  { href: '/items', label: 'Items' },
  { href: '/faq', label: 'FAQ' },
] as const;
