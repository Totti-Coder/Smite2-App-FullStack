import type { NextRequest } from 'next/server';

/**
 * Best-effort phone detection for the request-level access rule in
 * lib/supabase/middleware.ts.
 *
 * IMPORTANT: this is a PRODUCT rule, not a security boundary. Both signals it
 * reads are sent by the client and can be changed freely - desktop Chrome can
 * emulate a phone from devtools, and any HTTP client can send whatever it
 * likes. Nothing here protects data; that is RLS plus the verified session,
 * which are unchanged and apply on every device.
 *
 * Two signals, in order of reliability:
 *  1. `Sec-CH-UA-Mobile` - a client hint Chromium sends by default on secure
 *     origins, as `?1` (mobile) or `?0`. It is a purpose-built boolean rather
 *     than a string to pattern-match, so it is preferred when present.
 *  2. The User-Agent string, for Firefox and Safari, which don't send that
 *     hint.
 *
 * Tablets deliberately do NOT count: iPadOS reports itself as "Macintosh" in
 * its default desktop-class mode, so an iPad is treated as a computer. That
 * matches the intent ("en el móvil") rather than fighting a signal that
 * doesn't exist.
 */

// `Mobile` is the token Android Chrome and Firefox use to distinguish phones
// from tablets; the named devices cover the browsers that omit it.
const MOBILE_UA = /iPhone|iPod|Android.*Mobile|Windows Phone|BlackBerry|IEMobile|Opera Mini/i;

export function isMobileRequest(request: NextRequest): boolean {
  const hint = request.headers.get('sec-ch-ua-mobile');
  if (hint === '?1') return true;
  if (hint === '?0') return false;

  return MOBILE_UA.test(request.headers.get('user-agent') ?? '');
}

/**
 * The same test, in the browser. Used only for cosmetic decisions (hiding a
 * control that the mobile rule would make a dead end), never for access -
 * access is decided in proxy.ts, on the server.
 *
 * `navigator.userAgentData.mobile` is the client-side twin of the
 * Sec-CH-UA-Mobile hint, so Chromium agrees with the server by construction;
 * everything else falls back to the same regex the server uses.
 */
export function isMobileClient(): boolean {
  if (typeof navigator === 'undefined') return false;
  const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData;
  if (typeof uaData?.mobile === 'boolean') return uaData.mobile;
  return MOBILE_UA.test(navigator.userAgent);
}

/**
 * Which request headers change the response. Without this a shared cache (a
 * CDN, a corporate proxy) could hand a phone the desktop variant of /gods -
 * a fully rendered public page the mobile rule is meant to gate - or hand a
 * desktop visitor a redirect to /login.
 */
export const DEVICE_VARY = 'User-Agent, Sec-CH-UA-Mobile';
