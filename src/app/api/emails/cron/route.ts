import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const SENDER = 'RAD Academy <onboarding@updates.radacademy.co.za>';

// This API requires no body payload, it just executes via GET request
export async function GET() {
  try {
    // 1. Fetch all pending emails where send_after is NOW or in the past
    const { data: pendingEmails, error: fetchError } = await supabase
      .from('email_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('send_after', new Date().toISOString());

    if (fetchError) throw new Error(fetchError.message);
    if (!pendingEmails || pendingEmails.length === 0) {
      return NextResponse.json({ success: true, message: 'No emails pending.' });
    }

    // 2. Loop through and send them via Resend
    for (const email of pendingEmails) {
      const { error: resendError } = await resend.emails.send({
        from: SENDER,
        to: email.to_email,
        subject: email.subject,
        html: email.html_body
      });

      if (resendError) {
        console.error(`Failed to send email ID ${email.id}:`, resendError);
        // Mark as failed in DB
        await supabase.from('email_queue').update({ status: 'failed' }).eq('id', email.id);
      } else {
        // Mark as sent in DB
        await supabase.from('email_queue').update({ status: 'sent' }).eq('id', email.id);
      }
    }

    return NextResponse.json({ success: true, processedCount: pendingEmails.length });

  } catch (error: any) {
    console.error("Cron Processor Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}