import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens } from '@/lib/fitness/strava';

const STATE_COOKIE = 'fitness_strava_oauth_state';
const SETTINGS_PATH = '/admin/dashboard-v2/projects/fitness/settings';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const deniedOrError = url.searchParams.get('error');
  const expectedState = req.cookies.get(STATE_COOKIE)?.value;

  const redirectWithError = (message: string) => {
    const res = NextResponse.redirect(new URL(`${SETTINGS_PATH}?error=${encodeURIComponent(message)}`, req.url));
    res.cookies.delete(STATE_COOKIE);
    return res;
  };

  if (deniedOrError) {
    return redirectWithError('Strava authorization was cancelled or failed.');
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectWithError('Strava authorization could not be verified. Please try again.');
  }

  try {
    await exchangeCodeForTokens(code);
  } catch (err) {
    return redirectWithError(err instanceof Error ? err.message : 'Failed to connect Strava.');
  }

  const res = NextResponse.redirect(new URL(`${SETTINGS_PATH}?connected=1`, req.url));
  res.cookies.delete(STATE_COOKIE);
  return res;
}
