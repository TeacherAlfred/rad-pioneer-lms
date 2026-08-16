import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Service role: session_photos/photo_gallery_tokens are locked down the
// same way as the consent form's and kiosk's tables - RLS enabled, zero
// anon policies, this route is the only way in.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const RATE_LIMIT_WINDOW_MINUTES = 15;
const RATE_LIMIT_MAX_FAILURES = 20;

function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  return (fwd ? fwd.split(',')[0].trim() : null) || req.headers.get('x-real-ip') || 'unknown';
}

async function isRateLimited(ip: string): Promise<boolean> {
  if (ip === 'unknown') return false;
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();
  const { count } = await supabaseAdmin
    .from('photo_gallery_token_access_log')
    .select('*', { count: 'exact', head: true })
    .eq('ip_address', ip)
    .eq('success', false)
    .gte('accessed_at', since);
  return (count || 0) >= RATE_LIMIT_MAX_FAILURES;
}

async function logAccess(tokenId: string | null, attemptedToken: string, success: boolean, req: Request) {
  await supabaseAdmin.from('photo_gallery_token_access_log').insert([{
    token_id: tokenId,
    attempted_token: attemptedToken,
    success,
    ip_address: clientIp(req),
    user_agent: req.headers.get('user-agent') || null,
  }]);
}

async function resolveToken(token: string, req: Request) {
  const { data: tokenRow } = await supabaseAdmin
    .from('photo_gallery_tokens')
    .select('id, session_id, guardian_lead_id, revoked_at, expires_at')
    .eq('token', token)
    .maybeSingle();

  const valid = !!tokenRow && !tokenRow.revoked_at && (!tokenRow.expires_at || new Date(tokenRow.expires_at) > new Date());
  await logAccess(tokenRow?.id || null, token, valid, req);
  if (!valid) return null;

  await supabaseAdmin.from('photo_gallery_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', tokenRow!.id);
  return tokenRow;
}

// Returns this guardian's kids' gift photos (selected_for_parent=true)
// for this session, plus each kid's session_reviews quote for the
// delivery message. No consent gating - spec S1.2: sending a parent
// their own child's photo is service delivery, not a "use".
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ip = clientIp(req);

  if (await isRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  const tokenRow = await resolveToken(token, req);
  if (!tokenRow) {
    return NextResponse.json({ error: 'This link is invalid, expired, or has been revoked.' }, { status: 404 });
  }

  const { data: session } = await supabaseAdmin
    .from('sessions')
    .select('id, starts_at, programs(name)')
    .eq('id', tokenRow.session_id)
    .single();

  const { data: links } = await supabaseAdmin
    .from('kid_guardians')
    .select('kid_id, kids(id, name)')
    .eq('lead_id', tokenRow.guardian_lead_id);
  const kidIds = (links || []).map((l: any) => l.kids?.id).filter(Boolean);

  const { data: subjects } = await supabaseAdmin
    .from('session_photo_subjects')
    .select('kid_id, selected_for_parent, session_photos!inner(id, r2_key, session_id)')
    .in('kid_id', kidIds.length ? kidIds : ['00000000-0000-0000-0000-000000000000'])
    .eq('selected_for_parent', true)
    .eq('session_photos.session_id', tokenRow.session_id);

  const { data: reviews } = await supabaseAdmin
    .from('session_reviews')
    .select('student_id, built_text, wants_more')
    .eq('session_id', tokenRow.session_id)
    .in('student_id', kidIds.length ? kidIds : ['00000000-0000-0000-0000-000000000000']);
  const reviewByKid = new Map((reviews || []).map((r) => [r.student_id, r]));

  const kidsById = new Map<string, any>((links || []).map((l: any) => [l.kids?.id, l.kids] as [string, any]).filter(([id]) => id));
  const r2Url = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

  const byKid = new Map<string, { kid: any; photos: any[]; review: any }>();
  for (const s of subjects || []) {
    const kid = kidsById.get(s.kid_id);
    if (!kid) continue;
    const entry = byKid.get(s.kid_id) || { kid, photos: [], review: reviewByKid.get(s.kid_id) || null };
    entry.photos.push({ url: `${r2Url}/${(s as any).session_photos.r2_key}` });
    byKid.set(s.kid_id, entry);
  }

  return NextResponse.json({ session, children: Array.from(byKid.values()) });
}
