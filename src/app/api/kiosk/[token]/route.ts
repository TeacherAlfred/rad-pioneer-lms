import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { computeHoldStatus } from '@/lib/sessionReview';

// Service role: session_kiosk_tokens/session_reviews are locked down the
// same way as the consent form's tables - RLS enabled, zero anon
// policies, this route is the only way in.
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
    .from('kiosk_token_access_log')
    .select('*', { count: 'exact', head: true })
    .eq('ip_address', ip)
    .eq('success', false)
    .gte('accessed_at', since);
  return (count || 0) >= RATE_LIMIT_MAX_FAILURES;
}

async function logAccess(tokenId: string | null, attemptedToken: string, success: boolean, req: Request) {
  await supabaseAdmin.from('kiosk_token_access_log').insert([{
    token_id: tokenId,
    attempted_token: attemptedToken,
    success,
    ip_address: clientIp(req),
    user_agent: req.headers.get('user-agent') || null,
  }]);
}

// Resolves + validates the token: exists, not revoked, not expired
// (spec: "must expire when the session closes"). Logs every attempt.
async function resolveToken(token: string, req: Request) {
  const { data: tokenRow } = await supabaseAdmin
    .from('session_kiosk_tokens')
    .select('id, session_id, revoked_at, expires_at')
    .eq('token', token)
    .maybeSingle();

  const valid = !!tokenRow && !tokenRow.revoked_at && (!tokenRow.expires_at || new Date(tokenRow.expires_at) > new Date());
  await logAccess(tokenRow?.id || null, token, valid, req);
  if (!valid) return null;

  await supabaseAdmin.from('session_kiosk_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', tokenRow!.id);
  return tokenRow;
}

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ip = clientIp(req);

  if (await isRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  const tokenRow = await resolveToken(token, req);
  if (!tokenRow) {
    return NextResponse.json({ error: 'This session link is invalid, expired, or has been revoked.' }, { status: 404 });
  }

  const { data: session, error: sessionErr } = await supabaseAdmin
    .from('sessions')
    .select('id, starts_at, programme_id, programs(id, code, name)')
    .eq('id', tokenRow.session_id)
    .single();
  if (sessionErr || !session) return NextResponse.json({ error: 'Session not found.' }, { status: 404 });

  const { data: enrolments, error: enrolErr } = await supabaseAdmin
    .from('enrolments')
    .select('id, status, kids(id, name)')
    .eq('session_id', tokenRow.session_id)
    .neq('status', 'withdrawn');
  if (enrolErr) return NextResponse.json({ error: enrolErr.message }, { status: 500 });

  const studentIds = (enrolments || []).map((e: any) => e.kids?.id).filter(Boolean);
  const { data: reviews } = await supabaseAdmin
    .from('session_reviews')
    .select('student_id, completed_at')
    .eq('session_id', tokenRow.session_id)
    .in('student_id', studentIds.length ? studentIds : ['00000000-0000-0000-0000-000000000000']);

  const completedIds = new Set((reviews || []).filter(r => r.completed_at).map(r => r.student_id));

  const roster = (enrolments || [])
    .map((e: any) => e.kids)
    .filter(Boolean)
    .map((k: any) => ({ id: k.id, name: k.name, completed: completedIds.has(k.id) }));

  return NextResponse.json({ session, roster });
}

// Incremental autosave - one row per (session, student), upserted as
// each question is answered so an abandoned form still keeps whatever
// was answered (spec: "Partial submissions save"). hold_status is
// recomputed from the full row on every save, not just the changed field.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const ip = clientIp(req);

    if (await isRateLimited(ip)) {
      return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
    }

    const tokenRow = await resolveToken(token, req);
    if (!tokenRow) {
      return NextResponse.json({ error: 'This session link is invalid, expired, or has been revoked.' }, { status: 404 });
    }

    const { studentId, patch, complete } = await req.json();
    if (!studentId || !patch) {
      return NextResponse.json({ error: 'studentId and patch are required' }, { status: 400 });
    }

    // Confirm this child is actually on this session's roster.
    const { data: enrolment } = await supabaseAdmin
      .from('enrolments')
      .select('id')
      .eq('session_id', tokenRow.session_id)
      .eq('student_id', studentId)
      .maybeSingle();
    if (!enrolment) {
      return NextResponse.json({ error: 'That child is not on this session\'s roster.' }, { status: 403 });
    }

    const { data: existing } = await supabaseAdmin
      .from('session_reviews')
      .select('*')
      .eq('session_id', tokenRow.session_id)
      .eq('student_id', studentId)
      .maybeSingle();

    const merged = { ...(existing || {}), ...patch };
    const holdStatus = computeHoldStatus(merged);

    const update: Record<string, any> = {
      ...patch,
      hold_status: holdStatus,
      device_context: patch.device_context || existing?.device_context || 'kiosk',
      submitted_at: new Date().toISOString(),
    };
    if (complete) update.completed_at = new Date().toISOString();

    let row;
    if (existing) {
      const { data, error } = await supabaseAdmin.from('session_reviews').update(update).eq('id', existing.id).select().single();
      if (error) throw error;
      row = data;
    } else {
      const { data, error } = await supabaseAdmin
        .from('session_reviews')
        .insert([{ session_id: tokenRow.session_id, student_id: studentId, ...update }])
        .select()
        .single();
      if (error) throw error;
      row = data;
    }

    return NextResponse.json({ row: { id: row.id, completed_at: row.completed_at } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
