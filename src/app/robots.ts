import type { MetadataRoute } from 'next';

// This app is 100% authenticated - every route sits behind the login gate
// in src/middleware.ts, and layout.tsx already sends `robots: noindex` on
// every response. This file is the OTHER half of that: the crawler-facing
// /robots.txt itself.
//
// Deliberately a single blanket "Disallow: /" per rule and nothing else -
// no per-path Disallow list, no sitemap entry, no Host directive.
// robots.txt is a PUBLIC, unauthenticated file any crawler or attacker can
// fetch with zero effort; enumerating specific paths in it (/admin,
// /internal-api, /matches/new, etc.) is itself an information-disclosure
// bug - it hands out a map of the app's structure to anyone who asks,
// which is exactly the kind of unnecessary metadata exposure OWASP's
// information-disclosure guidance (OWASP ASVS 8.x / OWASP Top 10 –
// A01/A05) and the "least information" principle in both ENS (Esquema
// Nacional de Seguridad, op.exp.2 minimización de superficie de exposición)
// and NIS2's risk-management/attack-surface-reduction requirements call
// out. ISO 27001 Annex A (A.5.7 threat intelligence, A.8.9 configuration
// management) points the same way: don't publish anything about internal
// structure that isn't required for the file to do its one job.
//
// The wildcard rule below already blocks every crawler that respects
// robots.txt at all - these named AI-bot entries are redundant in terms of
// coverage, added only for an explicit, auditable "no" on the record
// (same pattern seen on smitesource.com's own robots.txt) rather than
// relying on '*' to implicitly cover them. Same "/" target for every one -
// no extra path info leaked by naming them.
const AI_BOTS = [
  'Amazonbot',
  'Applebot-Extended',
  'Bytespider',
  'CCBot',
  'ClaudeBot',
  'CloudflareBrowserRenderingCrawler',
  'Google-Extended',
  'GPTBot',
  'meta-externalagent',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', disallow: '/' },
      ...AI_BOTS.map((userAgent) => ({ userAgent, disallow: '/' })),
    ],
  };
}
