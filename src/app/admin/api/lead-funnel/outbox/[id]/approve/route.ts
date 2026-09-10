import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendMetaTemplate, sendWhatsAppMessage } from '@/lib/metaTemplate';

// Sends a queued message for real, exactly as sendToLead() would have if
// the lead weren't flagged is_business_number - see src/lib/leadSend.ts.
// The logged messages row here uses a generic "(approved)" bracket format
// rather than the original call site's own success/fail text (e.g.
// "[Delivered welcome menu]") since that exact wording isn't preserved
// through the queue, only the row's `label` is - an accepted, minor loss of
// fidelity rather than a bug.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = supabaseAdmin();

  const { data: row, error: fetchError } = await supabase
    .from('outbound_message_queue')
    .select('*')
    .eq('id', id)
    .single();
  if (fetchError || !row) return NextResponse.json({ error: 'Queued message not found' }, { status: 404 });
  if (row.status !== 'pending') return NextResponse.json({ error: `Already ${row.status}` }, { status: 400 });

  const send = row.send_payload;
  const result = send.kind === 'template'
    ? await sendMetaTemplate(row.phone, send.templateName, send.templateLanguage, send.bodyValues, send.variableNames || [], send.buttonPayloads || [])
    : await sendWhatsAppMessage(row.phone, send.payload);

  await supabase.from('messages').insert([{
    lead_id: row.lead_id,
    direction: 'outbound',
    body: result.ok ? `[Delivered (approved): ${row.label}]` : `[FAILED (approved) to deliver ${row.label}: ${result.error}]`,
    wamid: result.wamid || null,
    meta_message_status: result.messageStatus || null,
    ...(result.ok ? {} : { status: 'failed', error_code: result.errorCode || null, error_detail: result.error || null }),
  }]);

  await supabase.from('outbound_message_queue').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', id);

  return NextResponse.json({ ok: result.ok, error: result.error });
}
