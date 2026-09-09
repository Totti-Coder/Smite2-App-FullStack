import type { NextConfig } from "next";

// Content-Security-Policy is NOT set here - it needs a fresh nonce per
// request (see middleware.ts / src/lib/supabase/middleware.ts), which
// next.config.ts's static headers() can't generate. Everything else that
// doesn't need per-request values lives here.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Whether a route is public depends on the device (middleware gates
  // everything on phones - see lib/device.ts), so the device signals are part
  // of the cache key. Without this a shared cache could hand a phone the
  // desktop variant of /gods, or hand a desktop visitor a redirect to /login.
  //
  // Measured behaviour, so nobody re-derives it later: this reaches the
  // middleware's redirect responses, but on a rendered page Next replaces
  // Vary with its own (rsc, next-router-*, Accept-Encoding). That gap is
  // currently harmless because those pages come back `no-cache,
  // must-revalidate` - a shared cache has to revalidate against the origin,
  // and the origin re-evaluates the device every time. Worth rechecking if
  // any of these routes ever becomes genuinely cacheable.
  { key: "Vary", value: "User-Agent, Sec-CH-UA-Mobile" },
];

const nextConfig: NextConfig = {
  // Only for local dev: lets you open the dashboard from another device on
  // your own LAN (phone, etc). Has zero effect on production builds/deploys.
  // DHCP can reassign this machine's LAN IP - if this ever blocks you again,
  // just add whatever IP the "Blocked cross-origin request" warning shows.
  allowedDevOrigins: ["192.168.1.129", "192.168.1.133"],
  experimental: {
    serverActions: {
      // Next's default Server Action body cap is 1MB - fine for plain form
      // fields, but createMatch's multipart submission also carries the
      // match screenshot (capped at 5MB server-side in actions.ts) plus the
      // JSON-stringified participants array, so the real request routinely
      // exceeds 1MB and was hard-failing with "Body exceeded 1 MB limit."
      // 8mb covers the 5MB image with headroom for everything else.
      bodySizeLimit: "8mb",
    },
  },
  images: {
    // Lets next/image optimize/serve (resize, lazy-load, modern formats)
    // god portraits and item icons pulled from SmiteSource's CDN - it
    // already does its own resizing (the width=N param), Next.js layers
    // format negotiation + lazy loading + LCP priority hints on top.
    remotePatterns: [{ protocol: "https", hostname: "cdn.smitesource.com" }],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
