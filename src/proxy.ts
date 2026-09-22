import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

const isDev = process.env.NODE_ENV !== 'production';

export async function proxy(request: NextRequest) {
  // Fresh nonce per request. Next.js auto-applies it to the inline
  // bootstrap/RSC-payload scripts it injects, once it sees the nonce in the
  // response's own CSP header - that's what makes 'unsafe-inline' avoidable.
  const nonce = crypto.randomUUID().replace(/-/g, '');

  const cspHeader = [
    "default-src 'self'",
    // 'wasm-unsafe-eval' is only for instantiating the Tesseract.js OCR
    // WASM module (self-hosted, no CDN) - it does not permit eval()/JS strings.
    `script-src 'self' 'nonce-${nonce}' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    // blob: is needed for the pasted/uploaded screenshot preview - the
    // browser hands the file to <img> as a blob: object URL, not a real request.
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    // blob: is required by three's GLTFLoader: textures embedded in a .glb
    // are extracted into Blobs and then read back with fetch(), so without
    // this the model loads with its geometry intact and NO textures at all -
    // a flat white silhouette, reported only as a CSP violation in the
    // console and a material whose `map` is null. It permits reading blobs
    // this page created itself, not any remote origin.
    `connect-src 'self' blob: https://*.supabase.co${isDev ? ' ws:' : ''}`,
    // Tesseract.js loads its actual recognizer as a nested worker spawned
    // from a blob: URL (a wrapper it builds itself, not our worker.min.js
    // directly) - 'self' alone blocks that inner spawn with a silent
    // "OCR error: undefined" (confirmed via devtools: "Creating a worker
    // from 'blob:...' violates ... worker-src 'self'").
    "worker-src 'self' blob:",
    // No page embeds anything any more (the ambient YouTube trailer was
    // removed - see components/BackgroundGods.tsx), so frames are refused
    // outright rather than left open to an origin nothing uses.
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  return updateSession(request, cspHeader);
}

export const config = {
  matcher: [
    // robots.txt must stay reachable by unauthenticated crawlers - otherwise
    // the auth redirect below sends every crawler to /login instead, which
    // is invalid robots.txt syntax and some crawlers then fall back to
    // "no rules" (crawl everything) instead of respecting the disallow.
    // 3D models are excluded for the same reason as the Tesseract WASM above:
    // they're static binaries fetched by the page itself, and routing them
    // through the auth gate makes a signed-out request answer with the /login
    // HTML instead of the file - which surfaces as the loader choking on
    // "Unexpected token '<'" rather than as anything resembling a redirect.
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|tesseract/|assets/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|wasm|gz|glb|gltf)$).*)',
  ],
};
