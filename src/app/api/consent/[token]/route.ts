import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { CONSENT_WORDING_VERSION } from '@/lib/consent';

// Service role: consent_forms/guardian_consent_tokens carry POPIA special
// personal information (health + children's data). RLS is enabled with
// zero anon policies, so this route - not a browser Supabase client - is
// the only way in, unlike the older /booking/[link_id] page.
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
    .from('consent_token_access_log')
    .select('*', { count: 'exact', head: true })
    .eq('ip_address', ip)
    .eq('success', false)
    .gte('accessed_at', since);
  return (count || 0) >= RATE_LIMIT_MAX_FAILURES;
}

async function logAccess(tokenId: string | null, attemptedToken: string, success: boolean, req: Request) {
  await supabaseAdmin.from('consent_token_access_log').insert([{
    token_id: tokenId,
    attempted_token: attemptedToken,
    success,
    ip_address: clientIp(req),
    user_agent: req.headers.get('user-agent') || null,
  }]);
}

// Resolves + validates the token, logging every attempt (spec 5.1 treats
// token leakage as a breach path - the log is both audit trail and the
// data source for isRateLimited above). Returns the token row or null.
async function resolveToken(token: string, req: Request) {
  const { data: tokenRow } = await supabaseAdmin
    .from('guardian_consent_tokens')
    .select('id, guardian_lead_id, revoked_at, expires_at')
    .eq('token', token)
    .maybeSingle();

  const valid = !!tokenRow && !tokenRow.revoked_at && (!tokenRow.expires_at || new Date(tokenRow.expires_at) > new Date());
  await logAccess(tokenRow?.id || null, token, valid, req);
  if (!valid) return null;

  await supabaseAdmin.from('guardian_consent_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', tokenRow!.id);
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
    return NextResponse.json({ error: 'This link is invalid or has been revoked. Please ask RAD Academy for a new one.' }, { status: 404 });
  }

  const { data: guardian, error: guardianErr } = await supabaseAdmin
    .from('leads')
    .select('id, name, phone, email')
    .eq('id', tokenRow.guardian_lead_id)
    .single();
  if (guardianErr || !guardian) {
    return NextResponse.json({ error: 'Guardian record not found.' }, { status: 404 });
  }

  const { data: links, error: linksErr } = await supabaseAdmin
    .from('kid_guardians')
    .select('kid_id, kids(id, name, date_of_birth, grade)')
    .eq('lead_id', guardian.id);
  if (linksErr) return NextResponse.json({ error: linksErr.message }, { status: 500 });

  const children = await Promise.all((links || []).map(async (l: any) => {
    const kid = l.kids;
    if (!kid) return null;
    const { data: latest } = await supabaseAdmin
      .from('consent_forms')
      .select('id, submitted_at, consent_wording_version, confirmed_unchanged, payload')
      .eq('child_id', kid.id)
      .eq('is_current', true)
      .maybeSingle();

    // Co-guardians linked to this same child (besides whoever holds this
    // token) - surfaced so the form can offer "also contact [name] in an
    // emergency?" instead of a generic prompt.
    const { data: otherLinks } = await supabaseAdmin
      .from('kid_guardians')
      .select('lead_id, leads(id, name, phone)')
      .eq('kid_id', kid.id)
      .neq('lead_id', guardian.id);
    const otherGuardians = (otherLinks || [])
      .map((ol: any) => ol.leads)
      .filter(Boolean)
      .map((g: any) => ({ id: g.id, name: g.name, phone: g.phone }));

    return { id: kid.id, name: kid.name, dateOfBirth: kid.date_of_birth, grade: kid.grade, latestForm: latest || null, otherGuardians };
  }));

  return NextResponse.json({
    guardian: { id: guardian.id, name: guardian.name, phone: guardian.phone, email: guardian.email },
    children: children.filter(Boolean),
    consentWordingVersion: CONSENT_WORDING_VERSION,
  });
}

// Submits a new version for one child - never overwrites (spec 5.4).
// confirmedUnchanged=true is the one-tap "still correct" path: it still
// writes a new version row (same payload, fresh timestamp) so the record
// stays demonstrably current without forcing a full re-review.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const ip = clientIp(req);

    if (await isRateLimited(ip)) {
      return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
    }

    const tokenRow = await resolveToken(token, req);
    if (!tokenRow) {
      return NextResponse.json({ error: 'This link is invalid or has been revoked.' }, { status: 404 });
    }

    const { childId, payload, confirmedUnchanged } = await req.json();
    if (!childId || !payload) {
      return NextResponse.json({ error: 'childId and payload are required' }, { status: 400 });
    }

    // Confirm this child actually belongs to this guardian - the token
    // only ever grants access to your own children.
    const { data: link } = await supabaseAdmin
      .from('kid_guardians')
      .select('kid_id')
      .eq('lead_id', tokenRow.guardian_lead_id)
      .eq('kid_id', childId)
      .maybeSingle();
    if (!link) {
      return NextResponse.json({ error: 'That child is not linked to this guardian.' }, { status: 403 });
    }

    if (!confirmedUnchanged && !payload?.guardian?.authorityConfirmed) {
      return NextResponse.json({ error: 'Please confirm you have parental responsibility for this child.' }, { status: 400 });
    }

    await supabaseAdmin.from('consent_forms').update({ is_current: false }).eq('child_id', childId).eq('is_current', true);

    const { data: saved, error: insertErr } = await supabaseAdmin
      .from('consent_forms')
      .insert([{
        child_id: childId,
        guardian_id: tokenRow.guardian_lead_id,
        submitted_via: 'magic_link',
        ip_address: ip,
        consent_wording_version: CONSENT_WORDING_VERSION,
        confirmed_unchanged: !!confirmedUnchanged,
        is_current: true,
        payload,
      }])
      .select()
      .single();
    if (insertErr) throw insertErr;

    // Backfill date_of_birth on the canonical kid record if it wasn't
    // known yet - never overwrites an existing value.
    if (payload?.child?.dateOfBirth) {
      const { data: kid } = await supabaseAdmin.from('kids').select('date_of_birth').eq('id', childId).single();
      if (kid && !kid.date_of_birth) {
        await supabaseAdmin.from('kids').update({ date_of_birth: payload.child.dateOfBirth }).eq('id', childId);
      }
    }

    return NextResponse.json({ row: saved });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
