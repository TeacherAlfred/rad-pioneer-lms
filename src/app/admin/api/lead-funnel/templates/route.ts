import { NextResponse } from 'next/server';

// Pulls approved message templates straight from Meta instead of the admin
// typing a name/language freehand - avoids typos causing a failed send, and
// lets the UI know how many {{n}} body variables to ask for.
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
      const variableCount = body?.text ? (body.text.match(/\{\{\s*\d+\s*\}\}/g) || []).length : 0;
      return { name: t.name, language: t.language, category: t.category, variableCount, bodyPreview: body?.text || '' };
    });

  return NextResponse.json({ templates });
}
