import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Service role: tutorial_progress_tokens/tutorial_progress carry a phone-
// linked identity and have zero anon RLS policies, same posture as
// guardian_consent_tokens/consent_forms.
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
    .from('tutorial_progress_token_access_log')
    .select('*', { count: 'exact', head: true })
    .eq('ip_address', ip)
    .eq('success', false)
    .gte('accessed_at', since);
  return (count || 0) >= RATE_LIMIT_MAX_FAILURES;
}

async function logAccess(tokenId: string | null, attemptedToken: string, success: boolean, req: Request) {
  await supabaseAdmin.from('tutorial_progress_token_access_log').insert([{
    token_id: tokenId,
    attempted_token: attemptedToken,
    success,
    ip_address: clientIp(req),
    user_agent: req.headers.get('user-agent') || null,
  }]);
}

// Same resolve-and-log shape as src/app/api/consent/[token]/route.ts's
// resolveToken - every attempt logged (both the audit trail and the data
// source for isRateLimited above).
async function resolveToken(token: string, req: Request) {
  const { data: tokenRow } = await supabaseAdmin
    .from('tutorial_progress_tokens')
    .select('id, tutorial_visitor_id, revoked_at, expires_at')
    .eq('token', token)
    .maybeSingle();

  const valid = !!tokenRow && !tokenRow.revoked_at && (!tokenRow.expires_at || new Date(tokenRow.expires_at) > new Date());
  await logAccess(tokenRow?.id || null, token, valid, req);
  if (!valid) return null;

  await supabaseAdmin.from('tutorial_progress_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', tokenRow!.id);
  return tokenRow;
}

// Resolves a progress token to every tutorial's saved position - powers
// the resume page (src/app/tutorials/resume/[token]/page.tsx) hydrating
// localStorage on a new device.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'token is required' }, { status: 400 });

  const ip = clientIp(req);
  if (await isRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  const tokenRow = await resolveToken(token, req);
  if (!tokenRow) {
    return NextResponse.json({ error: 'This link is invalid or has expired.' }, { status: 404 });
  }

  const { data: rows, error } = await supabaseAdmin
    .from('tutorial_progress')
    .select('tutorial_id, current_step_order_index, completed_at')
    .eq('tutorial_visitor_id', tokenRow.tutorial_visitor_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ progress: rows || [] });
}

// Upserts one tutorial's current step for a linked visitor. Local-first
// progress (localStorage) covers every visitor by default; this is only
// reached once a visitor has opted into phone-linked sync (spec S5/S9 -
// identification is optional and requested only when needed).
export async function POST(req: Request) {
  try {
    const { token, tutorialId, currentStepOrderIndex, completed } = await req.json();
    if (!token || !tutorialId) {
      return NextResponse.json({ error: 'token and tutorialId are required' }, { status: 400 });
    }

    const ip = clientIp(req);
    if (await isRateLimited(ip)) {
      return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
    }

    const tokenRow = await resolveToken(token, req);
    if (!tokenRow) {
      return NextResponse.json({ error: 'This link is invalid or has expired.' }, { status: 404 });
    }

    const { error } = await supabaseAdmin.from('tutorial_progress').upsert([{
      tutorial_visitor_id: tokenRow.tutorial_visitor_id,
      tutorial_id: tutorialId,
      current_step_order_index: currentStepOrderIndex || 0,
      completed_at: completed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }], { onConflict: 'tutorial_visitor_id,tutorial_id' });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
