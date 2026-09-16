import { NextResponse } from 'next/server';
import { getPendingPreview, flushBufferedNotifications } from '@/lib/notificationBuffer';

// GET: what's currently queued in admin_notification_buffer (as category
// counts, same shape the actual digest uses), plus when it'll naturally
// flush and when the last one went out - lets the admin see the pipeline
// without waiting for the external cron.
export async function GET() {
  try {
    const preview = await getPendingPreview();
    return NextResponse.json(preview);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: manual "release now" - sends the digest immediately with whatever's
// currently queued. Always force: true - a human consciously choosing to
// release right now is exactly the case that should override both the
// digest timer and Do Not Disturb, not just the timer - see
// flushBufferedNotifications.
export async function POST() {
  try {
    const result = await flushBufferedNotifications({ force: true });
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
