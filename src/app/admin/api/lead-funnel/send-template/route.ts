import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolveVariable, sendMetaTemplate } from '@/lib/metaTemplate';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Sequential sends inside a single request - fine at RAD's current volume,
// but a Vercel function has a hard execution time limit. Cap here matches
// the cap enforced in the UI; raise both together if that ever binds.
const MAX_RECIPIENTS = 50;

export async function POST(req: Request) {
  try {
    const { leadIds, templateName, languageCode, variables, variableNames } = await req.json();

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({ error: 'leadIds[] is required' }, { status: 400 });
    }
    if (leadIds.length > MAX_RECIPIENTS) {
      return NextResponse.json({ error: `Max ${MAX_RECIPIENTS} recipients per send - select fewer and send again.` }, { status: 400 });
    }
    if (!templateName?.trim()) {
      return NextResponse.json({ error: 'templateName is required - must exactly match a Meta-approved template name' }, { status: 400 });
    }
    if (!languageCode?.trim()) {
      return NextResponse.json({ error: 'languageCode is required (e.g. en_US)' }, { status: 400 });
    }

    const { data: leads, error: fetchError } = await supabaseAdmin
      .from('leads')
      .select('*')
      .in('id', leadIds);
    if (fetchError) throw fetchError;

    const results: { leadId: string; phone: string; ok: boolean; skipped?: boolean; error?: string }[] = [];

    for (const lead of leads || []) {
      // Hard compliance gate: never send a proactive/template message to a
      // lead that has opted out, regardless of what the caller selected.
      if (lead.opted_out) {
        results.push({ leadId: lead.id, phone: lead.phone, ok: false, skipped: true, error: 'Opted out' });
        continue;
      }

      const bodyValues = (variables || []).map((v: string) => resolveVariable(String(v), lead));

      const sendResult = await sendMetaTemplate(lead.phone, templateName.trim(), languageCode.trim(), bodyValues, variableNames || []);

      await supabaseAdmin.from('messages').insert([{
        lead_id: lead.id,
        direction: 'outbound',
        body: sendResult.ok
          ? `[Delivered template: ${templateName}]`
          : `[FAILED to deliver template ${templateName}: ${sendResult.error}]`,
      }]);

      results.push({ leadId: lead.id, phone: lead.phone, ok: sendResult.ok, error: sendResult.error });
    }

    return NextResponse.json({ results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
