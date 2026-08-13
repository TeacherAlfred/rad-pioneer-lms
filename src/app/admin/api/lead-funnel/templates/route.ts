import { NextResponse } from 'next/server';

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

  const templates = (data.data || [])
    .filter((t: any) => t.status === 'APPROVED')
    .map((t: any) => {
      const body = (t.components || []).find((c: any) => c.type === 'BODY');
      const variableNames = body?.text
        ? [...(body.text as string).matchAll(/\{\{\s*([\w]+)\s*\}\}/g)].map(m => m[1])
        : [];
      return { name: t.name, language: t.language, category: t.category, variableNames, bodyPreview: body?.text || '' };
    });

  return NextResponse.json({ templates });
}
