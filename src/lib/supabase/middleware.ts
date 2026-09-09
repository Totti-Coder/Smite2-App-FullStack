import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { DEVICE_VARY, isMobileRequest } from '@/lib/device';

export async function updateSession(request: NextRequest, cspHeader: string) {
  // Next reads the nonce for its own injected scripts off the *request*
  // headers it renders with, not just the response the browser gets - so
  // the CSP (with nonce) has to be forwarded both ways on every response.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('Content-Security-Policy', cspHeader);

  // Whether a page is public now depends on the device (see below), so every
  // response must declare that - otherwise a shared cache could serve one
  // device's variant to the other.
  const nextResponse = () => {
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.headers.set('Content-Security-Policy', cspHeader);
    res.headers.set('Vary', DEVICE_VARY);
    return res;
  };

  const redirectResponse = (url: URL) => {
    const res = NextResponse.redirect(url);
    res.headers.set('Content-Security-Policy', cspHeader);
    res.headers.set('Vary', DEVICE_VARY);
    return res;
  };

  let response = nextResponse();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = nextResponse();
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Must call getUser() (not getSession()) - validates the token against
  // Supabase Auth server instead of trusting an unverified local cookie.
  // getUser() rejects (AuthSessionMissingError) rather than returning null
  // when there's no session cookie at all - that's expected, not a failure.
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

  const pathname = request.nextUrl.pathname;
  const isLoginPage = pathname === '/login';

  // The password-recovery flow has to work with no session at all, and on a
  // phone too - locking it behind the mobile rule would mean the one screen
  // someone locked out of their account needs is the one they can't reach.
  //
  // /auth/confirm is where the emailed token is exchanged for a session, so by
  // definition it is visited signed out. /cuenta/contrasena is left open on
  // purpose as well: it holds no data, and `updateUser` is enforced by
  // Supabase against a real session regardless of who loads the page - so
  // gating the ROUTE would buy nothing and would replace a clear "este enlace
  // ya no es válido" with a silent bounce to /login.
  const isRecoveryRoute = pathname === '/auth/confirm' || pathname === '/cuenta/contrasena';
  // Browsable without an account - the reference content (god pages, item
  // catalog, FAQ), same spirit as SmiteSource. Everything else (dashboard,
  // partidas, cargar partida) is personal data and stays gated. RLS already
  // scopes every table by user_id, so opening this up to multiple accounts
  // doesn't change the data-isolation story at all - it was already there.
  // Creating a tier list needs an account even though browsing them doesn't,
  // so /tierlist/nueva is carved back out of the public prefix below.
  const isTierListPublic =
    (pathname === '/tierlist' || pathname.startsWith('/tierlist/')) && pathname !== '/tierlist/nueva';

  // On a phone NOTHING is browsable without an account - not even the
  // reference pages - so /login is the only public route there. On a computer
  // the reference content stays open, exactly as before.
  //
  // This is a product rule, not a security control: the signal it reads comes
  // from the client and can be spoofed (see lib/device.ts). Data isolation is
  // unaffected either way - RLS scopes every table by user_id on every device.
  const isPublicRoute = isMobileRequest(request)
    ? isLoginPage || isRecoveryRoute
    : isLoginPage ||
      isRecoveryRoute ||
      isTierListPublic ||
      pathname === '/gods' || pathname.startsWith('/gods/') ||
      pathname === '/items' || pathname.startsWith('/items/') ||
      pathname === '/faq' || pathname.startsWith('/faq/');

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return redirectResponse(url);
  }

  if (user && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return redirectResponse(url);
  }

  return response;
}
