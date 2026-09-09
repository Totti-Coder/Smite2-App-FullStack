// Server-only. TWITCH_CLIENT_SECRET must never reach the client bundle -
// this file is only ever imported from Server Components/Route Handlers.

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAppAccessToken(): Promise<string | null> {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }),
    cache: 'no-store',
  });
  if (!res.ok) return null;

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    // Refresh a minute early so we never use a token right as it expires.
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return cachedToken.token;
}

export type LiveStatus = { isLive: boolean; title?: string; viewerCount?: number };

/** Public stream status for a Twitch login name. Never throws - returns {isLive:false} on any failure. */
export async function getTwitchLiveStatus(login: string): Promise<LiveStatus> {
  try {
    const clientId = process.env.TWITCH_CLIENT_ID;
    const token = await getAppAccessToken();
    if (!clientId || !token) return { isLive: false };

    const res = await fetch(`https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(login)}`, {
      headers: { 'Client-Id': clientId, Authorization: `Bearer ${token}` },
      // Polled from the layout on every navigation; 30s cache keeps it from
      // hammering Twitch's API on rapid page changes.
      next: { revalidate: 30 },
    });
    if (!res.ok) return { isLive: false };

    const data = await res.json();
    const stream = data.data?.[0];
    if (!stream) return { isLive: false };

    return { isLive: true, title: stream.title, viewerCount: stream.viewer_count };
  } catch {
    return { isLive: false };
  }
}
