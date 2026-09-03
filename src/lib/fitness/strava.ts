import { supabaseAdmin } from '@/lib/supabaseAdmin';

// First OAuth2 integration in this codebase - a plain confidential-client
// authorization-code flow. No PKCE needed: the server holds the client
// secret (unlike a public SPA/mobile client), so the CSRF `state` param
// round-tripped through a short-lived cookie is the correct, complete
// defense for a single browser-driven admin connecting their own account.

const STRAVA_API_BASE = 'https://www.strava.com/api/v3';
const STRAVA_OAUTH_BASE = 'https://www.strava.com/oauth';

function clientId() {
  const id = process.env.STRAVA_CLIENT_ID;
  if (!id) throw new Error('STRAVA_CLIENT_ID is not set');
  return id;
}

function clientSecret() {
  const secret = process.env.STRAVA_CLIENT_SECRET;
  if (!secret) throw new Error('STRAVA_CLIENT_SECRET is not set');
  return secret;
}

function redirectUri() {
  return `${process.env.NEXT_PUBLIC_APP_URL}/admin/api/dashboard-v2/projects/fitness/strava/callback`;
}

export function buildStravaAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri(),
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'activity:read_all',
    state,
  });
  return `${STRAVA_OAUTH_BASE}/authorize?${params.toString()}`;
}

type StravaTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix seconds
  athlete?: { id: number };
};

export class StravaNotConnectedError extends Error {
  constructor() {
    super('Strava is not connected');
    this.name = 'StravaNotConnectedError';
  }
}

export class StravaApiError extends Error {
  status: number;
  constructor(status: number, body: string) {
    super(`Strava API error ${status}: ${body}`);
    this.name = 'StravaApiError';
    this.status = status;
  }
}

export async function exchangeCodeForTokens(code: string): Promise<void> {
  const res = await fetch(`${STRAVA_OAUTH_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId(),
      client_secret: clientSecret(),
      code,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) {
    throw new StravaApiError(res.status, await res.text());
  }
  const data = (await res.json()) as StravaTokenResponse;

  const sb = supabaseAdmin();
  const { error } = await sb.from('fitness_oauth_tokens').upsert(
    {
      provider: 'strava',
      athlete_id: String(data.athlete?.id ?? ''),
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: new Date(data.expires_at * 1000).toISOString(),
      scope: 'activity:read_all',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'provider' }
  );
  if (error) throw new Error(`Failed to store Strava tokens: ${error.message}`);
}

/**
 * Returns a valid access token, refreshing it first if it's within 5
 * minutes of expiring. Strava rotates the refresh_token on every refresh,
 * so the new one is persisted too, not just the new access_token - every
 * caller must go through this function rather than reading the DB row
 * directly, or a stale refresh_token will eventually strand the connection.
 */
export async function getValidAccessToken(): Promise<string> {
  const sb = supabaseAdmin();
  const { data: row, error } = await sb
    .from('fitness_oauth_tokens')
    .select('*')
    .eq('provider', 'strava')
    .maybeSingle();

  if (error) throw new Error(`Failed to read Strava token: ${error.message}`);
  if (!row) throw new StravaNotConnectedError();

  const expiresAt = new Date(row.expires_at).getTime();
  const fiveMinutesFromNow = Date.now() + 5 * 60 * 1000;

  if (expiresAt > fiveMinutesFromNow) {
    return row.access_token as string;
  }

  const res = await fetch(`${STRAVA_OAUTH_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId(),
      client_secret: clientSecret(),
      refresh_token: row.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    throw new StravaApiError(res.status, await res.text());
  }
  const refreshed = (await res.json()) as StravaTokenResponse;

  const { error: updateError } = await sb
    .from('fitness_oauth_tokens')
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      expires_at: new Date(refreshed.expires_at * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('provider', 'strava');
  if (updateError) throw new Error(`Failed to persist refreshed Strava token: ${updateError.message}`);

  return refreshed.access_token;
}

export async function disconnectStrava(): Promise<void> {
  const sb = supabaseAdmin();
  const { error } = await sb.from('fitness_oauth_tokens').delete().eq('provider', 'strava');
  if (error) throw new Error(`Failed to disconnect Strava: ${error.message}`);
}

/**
 * Thin GET wrapper against the Strava API. Throws StravaApiError (with
 * status) on any non-2xx response, including 429, so callers can
 * distinguish "rate limited, safe to retry" from a real failure.
 */
export async function stravaFetch<T>(
  path: string,
  accessToken: string,
  params?: Record<string, string | number>
): Promise<T> {
  const url = new URL(`${STRAVA_API_BASE}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new StravaApiError(res.status, await res.text());
  }
  return (await res.json()) as T;
}
