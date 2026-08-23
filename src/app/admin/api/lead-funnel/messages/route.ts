import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// This is an activity feed, not an export tool - capped rather than
// unbounded. Raise if RAD's volume ever outgrows this mattering.
const LIMIT = 2000;

export async function GET() {
  const [{ data: messages, error: msgError }, { data: leads, error: leadError }, { data: respondentChecks, error: checksError }] = await Promise.all([
    supabaseAdmin.from('messages').select('*').order('created_at', { ascending: false }).limit(LIMIT),
    supabaseAdmin.from('leads').select('id, phone, name, email, school, tags, bot_paused'),
    supabaseAdmin.from('lead_qualification_checks').select('lead_id, passed').eq('stage_key', 'respondent_is_parent'),
  ]);

  if (msgError) return NextResponse.json({ error: msgError.message }, { status: 500 });
  if (leadError) return NextResponse.json({ error: leadError.message }, { status: 500 });
  if (checksError) return NextResponse.json({ error: checksError.message }, { status: 500 });

  const leadsById = new Map((leads || []).map((l: any) => [l.id, l]));
  // Same respondent_is_parent qualification check Lead Journey reads/writes -
  // this is just a second, more convenient entry point onto it (parent/child
  // info naturally surfaces while reading a message thread), not a separate
  // tagging concept.
  const respondentByLead = new Map((respondentChecks || []).map((c: any) => [c.lead_id, c.passed]));
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
      lead_respondent_is_parent: respondentByLead.has(m.lead_id) ? respondentByLead.get(m.lead_id) : null,
    };
  });

  return NextResponse.json({ rows });
}
