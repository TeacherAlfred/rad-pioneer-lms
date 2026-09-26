import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Backs Message Activity's read-only "History" modal - one lead's entire
// conversation, oldest first. The main feed (../route.ts) only holds the
// newest LIMIT messages across ALL leads, so an expanded thread there can be
// missing whatever came before that window (e.g. the template a lead is now
// tapping a button on). This reads the lead's whole history directly instead.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// A single conversation, not a feed - generous, but still bounded.
const THREAD_LIMIT = 2000;

export async function GET(req: Request) {
  const leadId = new URL(req.url).searchParams.get('leadId');
  if (!leadId) return NextResponse.json({ error: 'leadId is required' }, { status: 400 });

  const [{ data: messages, error: msgError }, { data: lead, error: leadError }] = await Promise.all([
    supabaseAdmin
      .from('messages')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: true })
      .limit(THREAD_LIMIT),
    supabaseAdmin.from('leads').select('id, name, phone, wa_profile_name').eq('id', leadId).maybeSingle(),
  ]);

  if (msgError) return NextResponse.json({ error: msgError.message }, { status: 500 });
  if (leadError) return NextResponse.json({ error: leadError.message }, { status: 500 });

  // Same private-bucket signed-URL minting as the main feed.
  const mediaPaths = (messages || []).map((m: any) => m.media_path).filter(Boolean);
  const signedUrlByPath = new Map<string, string>();
  if (mediaPaths.length > 0) {
    const { data: signedUrls } = await supabaseAdmin.storage
      .from('whatsapp-inbound-media')
      .createSignedUrls(mediaPaths, 3600);
    (signedUrls || []).forEach((s: any, i: number) => {
      if (s?.signedUrl) signedUrlByPath.set(mediaPaths[i], s.signedUrl);
    });
  }

  const rows = (messages || []).map((m: any) => ({
    ...m,
    media_url: m.media_path ? signedUrlByPath.get(m.media_path) || null : null,
  }));

  return NextResponse.json({ lead, rows, truncated: rows.length >= THREAD_LIMIT });
}
