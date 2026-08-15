import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function buildUrl(token: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL || '';
  return `${base.replace(/\/$/, '')}/kiosk/${token}`;
}

// Get-or-create an active (non-revoked, non-expired) token for a
// session. Expiry defaults to session end + 4h buffer (or start + 6h if
// no end time set) - the spec requires the link to expire when the
// session closes, not be left open indefinitely.
export async function POST(req: Request) {
  try {
    const { sessionId } = await req.json();
    if (!sessionId) return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });

    const nowIso = new Date().toISOString();
    const { data: existing } = await supabaseAdmin
      .from('session_kiosk_tokens')
      .select('id, token, expires_at')
      .eq('session_id', sessionId)
      .is('revoked_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing && (!existing.expires_at || existing.expires_at > nowIso)) {
      return NextResponse.json({ token: existing.token, url: buildUrl(existing.token), expiresAt: existing.expires_at });
    }

    const { data: session } = await supabaseAdmin.from('sessions').select('starts_at, ends_at').eq('id', sessionId).single();
    let expiresAt: string | null = null;
    if (session?.ends_at) {
      expiresAt = new Date(new Date(session.ends_at).getTime() + 4 * 3600 * 1000).toISOString();
    } else if (session?.starts_at) {
      expiresAt = new Date(new Date(session.starts_at).getTime() + 6 * 3600 * 1000).toISOString();
    }

    const token = crypto.randomBytes(24).toString('base64url');
    const { data, error } = await supabaseAdmin
      .from('session_kiosk_tokens')
      .insert([{ session_id: sessionId, token, expires_at: expiresAt }])
      .select('token, expires_at')
      .single();
    if (error) throw error;

    return NextResponse.json({ token: data.token, url: buildUrl(data.token), expiresAt: data.expires_at });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// One-click revoke - the spec treats this link as restricted (exposes a
// roster of children's names), not a public URL.
export async function DELETE(req: Request) {
  try {
    const { sessionId } = await req.json();
    if (!sessionId) return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    const { error } = await supabaseAdmin
      .from('session_kiosk_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('session_id', sessionId)
      .is('revoked_at', null);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
