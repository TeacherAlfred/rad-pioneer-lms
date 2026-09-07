import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Pulls approved message templates straight from Meta instead of the admin
// typing a name/language freehand - avoids typos causing a failed send, and
// lets the UI know how many body variables to ask for. Meta templates use
// either numbered placeholders ({{1}}, {{2}}) or named ones ({{name}}) -
// named ones need `parameter_name` on send (see send-template/route.ts),
// not just positional order, so the actual placeholder name is captured
// here, not just a count.
export async function GET() {
  const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  const token = process.env.WHATSAPP_TOKEN;

  if (!wabaId || !token) {
    return NextResponse.json({ error: 'WHATSAPP_BUSINESS_ACCOUNT_ID is not configured' }, { status: 500 });
  }

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${wabaId}/message_templates?fields=name,language,status,category,components&limit=200`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json({ error: data?.error?.message || 'Failed to fetch templates from Meta' }, { status: 500 });
  }

  const approved = (data.data || []).filter((t: any) => t.status === 'APPROVED');

  // Templates created via the Template Rollout Wizard carry their own
  // friendly placeholder labels (e.g. "name" instead of Meta's raw "1") -
  // looked up here by name+language and merged in below as `variableLabels`,
  // purely for display/auto-fill. `variableNames` stays Meta's own positional
  // tokens unchanged, since that's what actually has to go to send-template
  // for the send to match how the template was registered.
  const { data: rollouts } = await supabaseAdmin
    .from('template_rollouts')
    .select('name, language, placeholder_labels')
    .in('name', approved.map((t: any) => t.name));
  const labelsByKey = new Map((rollouts || []).map((r: any) => [`${r.name}|${r.language}`, r.placeholder_labels]));

  const templates = approved.map((t: any) => {
    const body = (t.components || []).find((c: any) => c.type === 'BODY');
    const variableNames = body?.text
      ? [...(body.text as string).matchAll(/\{\{\s*([\w]+)\s*\}\}/g)].map(m => m[1])
      : [];
    // Only QUICK_REPLY buttons send a payload back on tap - URL/PHONE_NUMBER
    // buttons just open a link/dial, nothing for bot_flows to match on.
    // `index` is this button's position across ALL of the template's
    // buttons (not just quick-replies) - that's what Meta's send-time
    // button-component override keys off, so it has to be preserved here
    // rather than re-derived from a filtered array.
    const buttonsComponent = (t.components || []).find((c: any) => c.type === 'BUTTONS');
    const quickReplyButtons = (buttonsComponent?.buttons || [])
      .map((b: any, index: number) => ({ ...b, index }))
      .filter((b: any) => b.type === 'QUICK_REPLY')
      .map((b: any) => ({ text: b.text, index: b.index }));
    const variableLabels = labelsByKey.get(`${t.name}|${t.language}`) as string[] | undefined;
    return { name: t.name, language: t.language, category: t.category, variableNames, variableLabels, bodyPreview: body?.text || '', quickReplyButtons };
  });

  return NextResponse.json({ templates });
}
