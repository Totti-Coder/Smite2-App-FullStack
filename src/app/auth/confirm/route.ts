import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

const PASSWORD_PAGE = '/cuenta/contrasena';

/**
 * Landing point for every link Supabase emails (password recovery, and email
 * confirmation on signup). It turns the one-time token in the URL into a real
 * session cookie and then sends the person where they need to go.
 *
 * BOTH token shapes are handled on purpose, because which one arrives depends
 * on a setting in the Supabase dashboard that this repo does not control:
 *
 *  - `token_hash` + `type`  -> the modern template ({{ .TokenHash }}).
 *  - `code`                 -> the PKCE flow ({{ .ConfirmationURL }}).
 *
 * `token_hash` is the one to prefer, and the README should say so: PKCE stores
 * a code verifier in a cookie on the device that STARTED the request, so if
 * someone asks for a reset on their laptop and then opens the email on their
 * phone, the exchange fails. verifyOtp has no such constraint, which matters
 * here because email is very often read on a different device.
 *
 * `next` is validated as a same-site path before being used - taking a
 * redirect target from a URL without checking it is an open redirect, and this
 * one arrives attached to an email that people are primed to click.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const code = searchParams.get('code');
  const next = safeNext(searchParams.get('next'));

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      // A recovery link must always land on the change-password screen,
      // whatever `next` says - that is the entire point of the email.
      return NextResponse.redirect(`${origin}${type === 'recovery' ? PASSWORD_PAGE : next}`);
    }
    return NextResponse.redirect(`${origin}/login?error=link_invalido`);
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    return NextResponse.redirect(`${origin}/login?error=link_invalido`);
  }

  return NextResponse.redirect(`${origin}/login?error=link_invalido`);
}

/**
 * Only same-site absolute paths. Anything else - a full URL, a
 * protocol-relative `//evil.com`, a backslash variant that some parsers treat
 * as a slash - falls back to the password page.
 */
export function safeNext(value: string | null): string {
  if (!value) return PASSWORD_PAGE;
  if (!value.startsWith('/')) return PASSWORD_PAGE;
  if (value.startsWith('//') || value.startsWith('/\\')) return PASSWORD_PAGE;
  return value;
}
