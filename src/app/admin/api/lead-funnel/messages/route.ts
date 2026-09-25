import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { roleFromLead } from '@/lib/leadRole';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// This is an activity feed, not an export tool - capped rather than
// unbounded. Raise if RAD's volume ever outgrows this mattering.
const LIMIT = 2000;

// Reaches past the recent window: a search for a name/number/text also pulls
// that lead's whole history (and any message whose text matches), so a
// contact whose last message is older than the newest LIMIT rows can still be
// found - previously search only filtered what was already loaded, and a
// quiet contact (e.g. the SPAM lead, last message weeks ago) was unfindable.
const MIN_SEARCH_LENGTH = 3;
const SEARCH_LEAD_CAP = 100;
const SEARCH_MESSAGE_CAP = 300;

export async function GET(req: Request) {
  const rawQ = (new URL(req.url).searchParams.get('q') || '').trim();
  // Stripped of characters that would break the PostgREST filter syntax.
  const q = rawQ.replace(/[,()%*\\]/g, ' ').trim();
  const [{ data: recentMessages, error: msgError }, { data: leads, error: leadError }, { data: respondentChecks, error: checksError }] = await Promise.all([
    supabaseAdmin.from('messages').select('*').order('created_at', { ascending: false }).limit(LIMIT),
    supabaseAdmin.from('leads').select('id, phone, name, email, school, tags, bot_paused, is_blocked, blocked_reason, reply_dismissed_at, is_business_number, wa_profile_name, wa_id, opted_out, opt_out_state, is_confirmed_parent, is_potential_student'),
    supabaseAdmin.from('lead_qualification_checks').select('lead_id, passed').eq('stage_key', 'respondent_is_parent'),
  ]);

  if (msgError) return NextResponse.json({ error: msgError.message }, { status: 500 });
  if (leadError) return NextResponse.json({ error: leadError.message }, { status: 500 });
  if (checksError) return NextResponse.json({ error: checksError.message }, { status: 500 });

  let messages: any[] = recentMessages || [];
  if (q.length >= MIN_SEARCH_LENGTH) {
    const digits = q.replace(/\D/g, '');
    const phoneClause = digits.length >= MIN_SEARCH_LENGTH ? `,phone.ilike.%${digits}%` : '';
    const { data: matchedLeads } = await supabaseAdmin
      .from('leads')
      .select('id')
      .or(`name.ilike.%${q}%${phoneClause}`)
      .limit(SEARCH_LEAD_CAP);
    const extra: any[] = [];
    const ids = (matchedLeads || []).map((l: any) => l.id);
    for (let i = 0; i < ids.length; i += 50) {
      const { data } = await supabaseAdmin
        .from('messages')
        .select('*')
        .in('lead_id', ids.slice(i, i + 50))
        .order('created_at', { ascending: false })
        .limit(1000);
      extra.push(...(data || []));
    }
    const { data: byText } = await supabaseAdmin
      .from('messages')
      .select('*')
      .ilike('body', `%${q}%`)
      .order('created_at', { ascending: false })
      .limit(SEARCH_MESSAGE_CAP);
    extra.push(...(byText || []));

    const seen = new Set(messages.map((m: any) => m.id));
    for (const m of extra) if (!seen.has(m.id)) { seen.add(m.id); messages.push(m); }
    messages.sort((a: any, b: any) => (a.created_at < b.created_at ? 1 : -1));
  }

  const leadsById = new Map((leads || []).map((l: any) => [l.id, l]));
  // Same respondent_is_parent qualification check Lead Journey reads/writes -
  // this is just a second, more convenient entry point onto it (parent/child
  // info naturally surfaces while reading a message thread), not a separate
  // tagging concept.
  const respondentByLead = new Map((respondentChecks || []).map((c: any) => [c.lead_id, c.passed]));

  // Inbound media lives in a private bucket (unlike bot-media) since it can
  // be a lead's own photo - media_path is just the bucket path, so a fresh
  // signed URL has to be minted on every fetch rather than stored once.
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

  const rows = (messages || []).map((m: any) => {
    const lead = leadsById.get(m.lead_id);
    return {
      ...m,
      lead_phone: lead?.phone || null,
      lead_name: lead?.name || null,
      lead_email: lead?.email || null,
      lead_school: lead?.school || null,
      lead_tags: lead?.tags || [],
      lead_bot_paused: !!lead?.bot_paused,
      lead_is_blocked: !!lead?.is_blocked,
      lead_blocked_reason: lead?.blocked_reason || null,
      lead_reply_dismissed_at: lead?.reply_dismissed_at || null,
      lead_is_business_number: !!lead?.is_business_number,
      lead_opted_out: !!lead?.opted_out,
      lead_opt_out_state: lead?.opt_out_state || null,
      lead_wa_profile_name: lead?.wa_profile_name || null,
      lead_wa_id: lead?.wa_id || null,
      lead_respondent_is_parent: respondentByLead.has(m.lead_id) ? respondentByLead.get(m.lead_id) : null,
      // One parent/student answer for every screen - see lib/leadRole.ts.
      lead_role: roleFromLead(lead || {}, respondentByLead.has(m.lead_id) ? respondentByLead.get(m.lead_id) : null),
      media_url: m.media_path ? signedUrlByPath.get(m.media_path) || null : null,
    };
  });

  return NextResponse.json({ rows });
}
