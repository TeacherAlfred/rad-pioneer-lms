import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function buildUrl(token: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL || '';
  return `${base.replace(/\/$/, '')}/consent/${token}`;
}

// Get-or-create an active token for a guardian - reuses an existing
// non-revoked token rather than minting a new one every time an admin
// clicks this, so a parent's bookmarked link keeps working.
export async function POST(req: Request) {
  try {
    const { guardianLeadId } = await req.json();
    if (!guardianLeadId) return NextResponse.json({ error: 'guardianLeadId is required' }, { status: 400 });

    const { data: existing } = await supabaseAdmin
      .from('guardian_consent_tokens')
      .select('id, token')
      .eq('guardian_lead_id', guardianLeadId)
      .is('revoked_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ token: existing.token, url: buildUrl(existing.token) });
    }

    const token = crypto.randomBytes(24).toString('base64url');
    const { data, error } = await supabaseAdmin
      .from('guardian_consent_tokens')
      .insert([{ guardian_lead_id: guardianLeadId, token }])
      .select('token')
      .single();
    if (error) throw error;

    return NextResponse.json({ token: data.token, url: buildUrl(data.token) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Revokes a guardian's active token(s) - "one-click revoke" per the
// spec, since the link exposes a child's medical information. The next
// POST above will mint a fresh one.
export async function DELETE(req: Request) {
  try {
    const { guardianLeadId } = await req.json();
    if (!guardianLeadId) return NextResponse.json({ error: 'guardianLeadId is required' }, { status: 400 });
    const { error } = await supabaseAdmin
      .from('guardian_consent_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('guardian_lead_id', guardianLeadId)
      .is('revoked_at', null);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
