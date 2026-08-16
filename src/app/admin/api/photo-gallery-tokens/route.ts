import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function buildUrl(token: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL || '';
  return `${base.replace(/\/$/, '')}/photos/${token}`;
}

// Get-or-create a token scoped to one guardian's view of one session's
// photos - same pattern as /admin/api/kiosk-tokens, but guardian+session
// scoped rather than session-wide (this link shows one family's kids'
// selected photos, not the whole roster). 7-day expiry mirrors the old
// pipeline's proven media_shares/vault precedent
// (src/components/admin/MediaDispatchCart.tsx).
export async function POST(req: Request) {
  try {
    const { sessionId, guardianLeadId } = await req.json();
    if (!sessionId || !guardianLeadId) {
      return NextResponse.json({ error: 'sessionId and guardianLeadId are required' }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const { data: existing } = await supabaseAdmin
      .from('photo_gallery_tokens')
      .select('id, token, expires_at')
      .eq('session_id', sessionId)
      .eq('guardian_lead_id', guardianLeadId)
      .is('revoked_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing && (!existing.expires_at || existing.expires_at > nowIso)) {
      return NextResponse.json({ token: existing.token, url: buildUrl(existing.token), expiresAt: existing.expires_at });
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    const token = crypto.randomBytes(24).toString('base64url');
    const { data, error } = await supabaseAdmin
      .from('photo_gallery_tokens')
      .insert([{ session_id: sessionId, guardian_lead_id: guardianLeadId, token, expires_at: expiresAt }])
      .select('token, expires_at')
      .single();
    if (error) throw error;

    return NextResponse.json({ token: data.token, url: buildUrl(data.token), expiresAt: data.expires_at });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
