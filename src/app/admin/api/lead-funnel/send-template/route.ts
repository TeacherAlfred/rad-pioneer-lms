import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Sequential sends inside a single request - fine at RAD's current volume,
// but a Vercel function has a hard execution time limit. Cap here matches
// the cap enforced in the UI; raise both together if that ever binds.
const MAX_RECIPIENTS = 50;

// Generic per-lead personalization: {{name}}, {{school}}, {{class}}, etc.
// resolve against that column on the lead's own row if it exists, rather
// than special-casing a fixed list of fields - no schema alignment needed
// beyond a template's placeholder happening to share a column's name. A
// token with no matching column is left untouched (better than guessing).
function resolveVariable(value: string, lead: Record<string, any>): string {
  return value.replace(/\{\{\s*([a-zA-Z_][\w]*)\s*\}\}/g, (match, field) => {
    const key = String(field).toLowerCase();
    const v = lead[key];
    return v !== null && v !== undefined && v !== '' ? String(v) : match;
  });
}

async function sendTemplate(to: string, templateName: string, languageCode: string, bodyValues: string[], variableNames: string[]) {
  const phoneId = process.env.PHONE_NUMBER_ID!;
  const token = process.env.WHATSAPP_TOKEN!;

  // Numbered placeholders ({{1}}, {{2}}) send positionally with no extra
  // field. Named placeholders ({{name}}) need `parameter_name` set to the
  // exact placeholder name, or Meta rejects the send as a parameter-count
  // mismatch even when the right number of values is sent.
  const parameters = bodyValues.map((text, i) => {
    const varName = variableNames[i];
    const isNamed = varName !== undefined && Number.isNaN(Number(varName));
    return isNamed ? { type: 'text', parameter_name: varName, text } : { type: 'text', text };
  });

  const payload: any = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(parameters.length > 0 ? {
        components: [{ type: 'body', parameters }],
      } : {}),
    },
  };

  const response = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    return { ok: false, error: data?.error?.message || JSON.stringify(data) };
  }
  return { ok: true };
}

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

      const sendResult = await sendTemplate(lead.phone, templateName.trim(), languageCode.trim(), bodyValues, variableNames || []);

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
