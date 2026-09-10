import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Discards a queued message - never sent, just marked so it stops showing
// as pending. The row stays (audit trail), same "soft-mark, never delete"
// convention as admin_notification_buffer's flushed_at.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = supabaseAdmin();

  const { data: row, error: fetchError } = await supabase
    .from('outbound_message_queue')
    .select('id, status')
    .eq('id', id)
    .single();
  if (fetchError || !row) return NextResponse.json({ error: 'Queued message not found' }, { status: 404 });
  if (row.status !== 'pending') return NextResponse.json({ error: `Already ${row.status}` }, { status: 400 });

  const { error } = await supabase
    .from('outbound_message_queue')
    .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
