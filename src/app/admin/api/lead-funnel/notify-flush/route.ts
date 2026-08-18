import { NextResponse } from 'next/server';
import { getPendingPreview, flushBufferedNotifications } from '@/lib/notificationBuffer';

// GET: what's currently queued in admin_notification_buffer, grouped by
// lead, plus when it'll naturally flush and when the last flush happened -
// lets the admin see the pipeline without waiting for the external cron.
export async function GET() {
  try {
    const preview = await getPendingPreview();
    return NextResponse.json(preview);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: manual "release now". { leadId } scopes to one lead; omitted
// releases everyone currently queued. Always force: true - a human
// consciously choosing to release right now is exactly the case that
// should override both the buffer timer and Do Not Disturb, not just the
// timer - see flushBufferedNotifications.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await flushBufferedNotifications({ force: true, onlyLeadId: body.leadId || undefined });
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
