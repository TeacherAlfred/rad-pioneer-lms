// Shared between the admin Send Template feature and the webhook's
// bot_flows automation - both need to resolve {{column}} tokens against a
// lead's own row and send a Meta template the same way, so this exists
// once rather than drifting into two slightly-different copies.
// sendWhatsAppMessage lives here too (not just template sends) because the
// buffered-notification flush endpoint (src/app/api/lead-funnel/notify-flush)
// needs to send freeform/interactive messages the same way the webhook does,
// without importing from a route file.

// Sends a freeform/interactive WhatsApp message (as opposed to a template -
// see sendMetaTemplate below). Returns whether Meta actually accepted the
// send, plus its error detail if not - callers that log "[Delivered ...]"
// or notify the admin need this, otherwise a rejected send still gets
// recorded as if it succeeded. Also returns the wamid (Meta's own message
// id) so callers can store it on the messages row - that's what lets a
// later status webhook (sent/delivered/read) get matched back to this
// specific send, see whatsapp-webhook/route.ts's applyMessageStatus.
export async function sendWhatsAppMessage(to: string, messagePayload: any): Promise<{ ok: boolean; error?: string; wamid?: string }> {
  const phoneId = process.env.PHONE_NUMBER_ID!;
  const token = process.env.WHATSAPP_TOKEN!;

  const response = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      ...messagePayload
    })
  });

  const data = await response.json();
  if (!response.ok) {
    const errorDetail = data?.error?.message || JSON.stringify(data);
    console.error(`❌ Meta API Error sending to ${to}:`, JSON.stringify(data, null, 2));
    return { ok: false, error: errorDetail };
  }
  console.log(`✅ Message successfully sent to ${to}`);
  return { ok: true, wamid: data?.messages?.[0]?.id };
}

// Generic per-lead personalization: {{name}}, {{school}}, {{class}}, etc.
// resolve against that column on the lead's own row if it exists, rather
// than special-casing a fixed list of fields - no schema alignment needed
// beyond a template's placeholder happening to share a column's name. A
// token with no matching column is left untouched (better than guessing).
export function resolveVariable(value: string, lead: Record<string, any>): string {
  return value.replace(/\{\{\s*([a-zA-Z_][\w]*)\s*\}\}/g, (match, field) => {
    const key = String(field).toLowerCase();
    let v = lead[key];
    // {{name}} reads first name only - "Hi Jane" not "Hi Jane van der Merwe".
    // leads.name has no separate first/last columns, so this just takes the
    // first whitespace-separated token.
    if (key === 'name' && v) v = String(v).trim().split(/\s+/)[0];
    return v !== null && v !== undefined && v !== '' ? String(v) : match;
  });
}

// Turns a featured_programs.date_options array into one readable phrase
// ("Saturday, 3 October" / "Sat 29 Aug or Sun 6 Sep" / "A, B, or C"). Reuses
// each entry's own admin-authored `label` verbatim rather than reformatting
// starts_at - that label is already the exact text shown on the website's
// card, so this is the one place both channels' wording comes from.
export function formatProgramDates(dateOptions: { label?: string }[] | null | undefined): string {
  const labels = (dateOptions || []).map(d => d?.label).filter((l): l is string => !!l);
  if (labels.length === 0) return 'dates to be confirmed';
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} or ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, or ${labels[labels.length - 1]}`;
}

// bot_flows.message_body can reference {{dates}}/{{location}}/{{title}} for
// a linked featured_programs row (bot_flows.featured_program_id) - this is
// the fix for the website and WhatsApp independently typing the same
// event's dates and drifting apart (see 20260822120000_bot_flow_program_sync.sql).
// A flow with no linked program is returned unchanged.
export function resolveProgramTokens(
  text: string,
  program: { title?: string | null; location?: string | null; date_options?: any[] | null } | null | undefined
): string {
  if (!program) return text;
  return text
    .replace(/\{\{\s*dates\s*\}\}/gi, formatProgramDates(program.date_options))
    .replace(/\{\{\s*location\s*\}\}/gi, program.location || '')
    .replace(/\{\{\s*title\s*\}\}/gi, program.title || '');
}

export async function sendMetaTemplate(
  to: string,
  templateName: string,
  languageCode: string,
  bodyValues: string[],
  variableNames: string[] = [],
  // Index-ordered, one per QUICK_REPLY button on the template (skip/empty
  // string for a button you don't want to override). This is the ONLY place
  // a quick-reply button's payload can be set - Meta doesn't expose it at
  // template-creation time, only at send time, per-message. Without this,
  // Meta assigns its own default payload and a tap won't match anything in
  // bot_flows even if the trigger_button_id looks right.
  buttonPayloads: string[] = []
): Promise<{ ok: boolean; error?: string; wamid?: string }> {
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

  const components: any[] = [];
  if (parameters.length > 0) {
    components.push({ type: 'body', parameters });
  }
  buttonPayloads.forEach((buttonPayload, index) => {
    if (buttonPayload && buttonPayload.trim()) {
      components.push({
        type: 'button',
        sub_type: 'quick_reply',
        index: String(index),
        parameters: [{ type: 'payload', payload: buttonPayload.trim() }],
      });
    }
  });

  const payload: any = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(components.length > 0 ? { components } : {}),
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
  return { ok: true, wamid: data?.messages?.[0]?.id };
}
