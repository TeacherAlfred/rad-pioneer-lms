import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Edits one message template's wording. Never accepts a new `key` (that's
// the row's identity, fixed by the seed migration) - only the actual
// message text/subject, since {{name}}/{{link}} substitution in the send
// buttons (Responses page, community/page.tsx's share banner) is keyed off
// these exact key values.
export async function PATCH(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const body = await request.json().catch(() => ({}));
  const { whatsapp_body, email_subject, email_body } = body as {
    whatsapp_body?: string;
    email_subject?: string | null;
    email_body?: string | null;
  };

  const update: Record<string, string | null> = { updated_at: new Date().toISOString() };
  if (typeof whatsapp_body === 'string') {
    if (!whatsapp_body.trim()) return NextResponse.json({ error: 'whatsapp_body cannot be empty' }, { status: 400 });
    update.whatsapp_body = whatsapp_body;
  }
  if (email_subject !== undefined) update.email_subject = email_subject;
  if (email_body !== undefined) update.email_body = email_body;

  if (Object.keys(update).length === 1) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('irene_fitness_message_templates')
    .update(update)
    .eq('key', key)
    .select('key, label, whatsapp_body, email_subject, email_body, updated_at')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Unknown template key' }, { status: 404 });
  return NextResponse.json(data);
}
