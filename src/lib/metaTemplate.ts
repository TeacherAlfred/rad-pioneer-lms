// Shared between the admin Send Template feature and the webhook's
// bot_flows automation - both need to resolve {{column}} tokens against a
// lead's own row and send a Meta template the same way, so this exists
// once rather than drifting into two slightly-different copies.

// Generic per-lead personalization: {{name}}, {{school}}, {{class}}, etc.
// resolve against that column on the lead's own row if it exists, rather
// than special-casing a fixed list of fields - no schema alignment needed
// beyond a template's placeholder happening to share a column's name. A
// token with no matching column is left untouched (better than guessing).
export function resolveVariable(value: string, lead: Record<string, any>): string {
  return value.replace(/\{\{\s*([a-zA-Z_][\w]*)\s*\}\}/g, (match, field) => {
    const key = String(field).toLowerCase();
    const v = lead[key];
    return v !== null && v !== undefined && v !== '' ? String(v) : match;
  });
}

export async function sendMetaTemplate(
  to: string,
  templateName: string,
  languageCode: string,
  bodyValues: string[],
  variableNames: string[] = []
): Promise<{ ok: boolean; error?: string }> {
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
