import { NextResponse } from 'next/server';
import { flushBufferedNotifications } from '@/lib/notificationBuffer';

// Consolidates admin_notification_buffer into one WhatsApp message PER LEAD
// (never one message spanning multiple leads) once that lead's oldest
// unflushed event has sat for at least buffer_minutes, and only outside
// the admin's configured Do Not Disturb hours. Meant to be hit on an
// external schedule (the user's cron-job.org account, not Vercel Cron -
// Vercel's Hobby tier only allows daily cron, too coarse for a 5-10 minute
// buffer) - hence a custom bearer secret rather than Vercel's automatic
// CRON_SECRET injection.
//
// See src/app/admin/api/lead-funnel/notify-flush for the admin-facing
// equivalent, which can bypass DND/the timer for a manual "release now".
export async function GET(request: Request) {
  const secret = process.env.WABA_API;
  const authHeader = request.headers.get('authorization');
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  try {
    const result = await flushBufferedNotifications();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('notify-flush error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
