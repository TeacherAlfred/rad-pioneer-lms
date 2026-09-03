import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { buildStravaAuthorizeUrl } from '@/lib/fitness/strava';

const STATE_COOKIE = 'fitness_strava_oauth_state';

export async function GET() {
  const state = randomBytes(16).toString('hex');
  const res = NextResponse.redirect(buildStravaAuthorizeUrl(state));
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 5 * 60,
    path: '/',
  });
  return res;
}
