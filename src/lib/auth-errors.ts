import { isAuthApiError, isAuthRetryableFetchError, isAuthWeakPasswordError } from '@supabase/supabase-js';

export type AuthFailure = {
  /** What to show the user. Always Spanish, always actionable. */
  message: string;
  /** Secondary line with what to do about it, when there is something to do. */
  hint?: string;
  /** Render a shortcut to the sign-in tab (the account already exists). */
  offerLogin?: boolean;
  /** Worth retrying as-is (network blip, rate limit) rather than editing the form. */
  retryable?: boolean;
};

/**
 * Turns whatever `supabase.auth.*` produced into something a person can act
 * on. The raw values are unusable in the UI: a DNS failure surfaced as the
 * bare English string "Failed to fetch" next to a password field, which reads
 * as "your password is wrong" and sends people off editing correct
 * credentials.
 *
 * ON ACCOUNT ENUMERATION - deliberate, not an oversight: for SIGN-IN this
 * never distinguishes "no account with that email" from "wrong password".
 * Supabase itself returns the same `invalid_credentials` for both precisely so
 * that it can't be told apart, and surfacing the difference would turn the
 * login form into a tool for checking which email addresses have accounts
 * here (OWASP ASVS 2.2). For SIGN-UP the distinction is unavoidable - the
 * server has to refuse a duplicate - so there it is reported clearly and with
 * a way forward.
 */
export function describeAuthError(error: unknown, mode: 'login' | 'signup'): AuthFailure {
  // 1. Never reached the server at all. This is the case that was showing as
  //    "Failed to fetch": DNS failure, no connectivity, the request blocked by
  //    an extension or by CSP connect-src. Nothing about the form is wrong.
  if (isAuthRetryableFetchError(error) || isNetworkError(error)) {
    return {
      message: 'No se pudo conectar con el servidor.',
      hint: 'No es un problema de tu correo ni de tu contraseña. Revisa tu conexión e inténtalo otra vez.',
      retryable: true,
    };
  }

  if (isAuthWeakPasswordError(error)) {
    return {
      message: 'La contraseña es demasiado débil.',
      hint: 'Usa al menos 8 caracteres y combina letras y números.',
    };
  }

  if (isAuthApiError(error)) {
    switch (error.code) {
      case 'invalid_credentials':
        // Intentionally ambiguous - see the note above.
        return {
          message: 'El correo o la contraseña no son correctos.',
          hint: 'Revisa ambos campos. Si no recuerdas la contraseña, crea una cuenta nueva o restablécela.',
        };

      case 'email_not_confirmed':
        return {
          message: 'Todavía no has confirmado tu correo.',
          hint: 'Busca el mensaje de confirmación en tu bandeja de entrada (mira también el spam).',
        };

      case 'email_exists':
      case 'user_already_exists':
        return {
          message: 'Ya existe una cuenta con ese correo.',
          hint: 'Entra con tu contraseña en vez de crear una cuenta nueva.',
          offerLogin: true,
        };

      case 'email_address_invalid':
        return { message: 'Ese correo no es válido.', hint: 'Comprueba que esté bien escrito.' };

      case 'validation_failed':
        return { message: 'Faltan datos o alguno no es válido.', hint: 'Revisa el formulario.' };

      case 'weak_password':
        return {
          message: 'La contraseña es demasiado débil.',
          hint: 'Usa al menos 8 caracteres y combina letras y números.',
        };

      case 'over_request_rate_limit':
      case 'over_email_send_rate_limit':
        return {
          message: 'Demasiados intentos seguidos.',
          hint: 'Espera un minuto antes de volver a probar.',
          retryable: true,
        };

      case 'user_banned':
        return { message: 'Esta cuenta está suspendida.' };

      case 'signup_disabled':
        return { message: 'El registro está desactivado ahora mismo.' };
    }

    // A 5xx is the server's problem, not the person's - say so rather than
    // letting them retype a correct password.
    if (error.status && error.status >= 500) {
      return {
        message: 'El servidor de autenticación está fallando.',
        hint: 'No es culpa de tus datos. Prueba de nuevo en unos minutos.',
        retryable: true,
      };
    }
  }

  // Unmapped. Give the generic line rather than a raw English string, but keep
  // the original in the console so it can actually be diagnosed.
  if (error) console.error('[auth] error sin mapear:', error);
  return {
    message: mode === 'login' ? 'No se pudo iniciar sesión.' : 'No se pudo crear la cuenta.',
    hint: 'Inténtalo de nuevo. Si sigue fallando, revisa tu conexión.',
    retryable: true,
  };
}

/**
 * `fetch` rejects with a plain TypeError whose message varies by browser
 * ("Failed to fetch" in Chrome, "NetworkError when attempting to fetch
 * resource." in Firefox, "Load failed" in Safari) and carries no code, so
 * there is nothing to match on but the shape.
 */
/**
 * True when the request never reached Supabase. Callers use this to decide
 * whether a failure is worth showing at all - the password-reset form reports
 * connectivity problems but stays silent about everything else, so it can't be
 * used to probe which addresses have accounts.
 */
export function isTransportFailure(error: unknown): boolean {
  return isAuthRetryableFetchError(error) || isNetworkError(error);
}

function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.name === 'TypeError' &&
    /failed to fetch|networkerror|load failed|network request failed/i.test(error.message)
  );
}
