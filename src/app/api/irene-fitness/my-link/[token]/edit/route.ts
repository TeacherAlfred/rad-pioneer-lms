import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const FAMILY_COOKIE = 'irene_fitness_family';
const FAMILY_COOKIE_MAX_AGE = 60 * 60 * 24 * 180; // 180 days, matches submit/route.ts

// "Edit our response" from the my-link chooser page. FAMILY_COOKIE is
// httpOnly (set the same way in api/irene-fitness/submit), so it can only be
// set from a server response - this is a plain <a href> target, not a
// fetch(), specifically so the browser follows the redirect and keeps the
// Set-Cookie header. Once primed, the submission page's existing
// returning-visitor flow (api/irene-fitness/family) just works, unchanged.
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = supabaseAdmin();

  const { data: family, error } = await supabase
    .from('irene_fitness_families')
    .select('id')
    .eq('access_token', token)
    .maybeSingle();

  // An invalid/expired token still lands on the real submission page, just
  // without a cookie primed - same experience as a brand-new visitor rather
  // than a dead end.
  const url = new URL('/projects/irene-fitness', request.url);
  if (error || !family) return NextResponse.redirect(url);

  const res = NextResponse.redirect(url);
  res.cookies.set(FAMILY_COOKIE, family.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: FAMILY_COOKIE_MAX_AGE,
    path: '/',
  });
  return res;
}
