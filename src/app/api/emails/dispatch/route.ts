import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase'; // Using your existing supabase client

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { scenario, name, email, token, quoteId } = body;

    if (!scenario || !email) return NextResponse.json({ error: 'Missing payload' }, { status: 400 });

    const firstName = name ? name.split(' ')[0] : 'Parent';
    const requestUrl = new URL(req.url);
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `${requestUrl.protocol}//${requestUrl.host}`;

    let queuePayload: any[] = [];
    const now = new Date();

    // ==========================================
    // SCENARIO A: THE PLG FAST-TRACK
    // ==========================================
    if (scenario === 'fast-track' || scenario === 'manual-conversion') {
      
      // 1. WELCOME (Send Immediately)
      queuePayload.push({
        to_email: email,
        subject: '(1 of 3) Welcome to RAD Academy! (Setup Password)',
        send_after: now.toISOString(),
        html_body: `
          <div style="font-family: sans-serif; color: #0f172a; max-w: 600px; margin: 0 auto;">
            <h2>Your VIP Access is Ready! 🚀</h2>
            <p>Hi ${firstName}, welcome to the RAD Academy family!</p>
            <p>Your child's learning environment has been successfully provisioned. To get started, click the secure link below to set your parent password, review our intake agreements, and unlock your family dashboard.</p>
            <a href="${baseUrl}/welcome?t=${token}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 10px;">Setup Parent Profile</a>
            <p style="margin-top: 30px; font-size: 12px; color: #64748b;">Keep an eye on your inbox, your quotation and onboarding details are on the way.</p>
          </div>
        `
      });

      // 2. QUOTATION (Send After 2 Minutes)
      queuePayload.push({
        to_email: email,
        subject: '(2 of 3) Your RAD Academy Quotation',
        send_after: new Date(now.getTime() + 2 * 60000).toISOString(),
        html_body: `
          <div style="font-family: sans-serif; color: #0f172a; max-w: 600px; margin: 0 auto;">
            <h2>Your Quotation is Ready.</h2>
            <p>Hi ${firstName},</p>
            <p>As requested during your Fast-Track setup, we have locked in your discounted tier and generated your official quotation.</p>
            <p>To secure your child's spot, please review and settle your quotation using the secure link below.</p>
            <a href="${baseUrl}/quote/${quoteId}" style="display: inline-block; padding: 12px 24px; background-color: #0f172a; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 10px;">View & Pay Quotation</a>
            <p style="margin-top: 30px; font-size: 12px; color: #64748b;">If you have any questions regarding your billing, simply reply to this email.</p>
          </div>
        `
      });

      // 3. BOOKING (Send After 4 Minutes)
      queuePayload.push({
        to_email: email,
        subject: '(3 of 3) Claim your Free 1-on-1 Teams Session!',
        send_after: new Date(now.getTime() + 4 * 60000).toISOString(),
        html_body: `
          <div style="font-family: sans-serif; color: #0f172a; max-w: 600px; margin: 0 auto;">
            <h2>Claim your Fast-Track Bonus! 🎁</h2>
            <p>Because you chose to upgrade and fast-track your setup, you've officially unlocked a completely free 1-on-1 Teams session with a RAD Academy coding coach!</p>
            <p>During this session, we will help your child log in, explore the dashboard, and write their very first line of code.</p>
            <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0;">
              <p style="margin: 0; font-size: 14px; color: #92400e;">
                <strong>⚠️ Important Condition:</strong><br/>
                Your quotation payment must be received and cleared at least 24 hours prior to your scheduled lesson time.
              </p>
            </div>
            <p>Click below to log into your Parent Dashboard and use your complimentary Coaching Credit to book your timeslot.</p>
            <a href="${baseUrl}/login?coach_id=edcc886a-1585-4ccc-9440-da8131073fb7" style="display: inline-block; padding: 12px 24px; background-color: #10b981; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 10px;">Book Session Now</a>
          </div>
        `
      });
    }

    // ==========================================
    // SCENARIO B: TRIAL
    // ==========================================
    if (scenario === 'trial') {
      queuePayload.push({
        to_email: email,
        subject: 'Your 14-Day RAD Trial is Active! 🚀',
        send_after: now.toISOString(),
        html_body: `
          <div style="font-family: sans-serif; color: #0f172a; max-w: 600px; margin: 0 auto;">
            <h2>Hi ${firstName}, welcome to the trial!</h2>
            <p>Your child's 14-Day Free Access pass has been successfully generated.</p>
            <p>To begin exploring, click the link below to securely set up your child's Username and 4-digit PIN.</p>
            <a href="${baseUrl}/lms/onboarding?id=${quoteId}" style="display: inline-block; padding: 12px 24px; background-color: #10b981; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 10px;">Setup Child Access</a>
            <p style="margin-top: 20px;"><em>Note: You can upgrade to a paid tier at any point during your trial from the dashboard to lock in your discounted rate.</em></p>
          </div>
        `
      });
    }

    // Write all emails to the database outbox
    const { error } = await supabase.from('email_queue').insert(queuePayload);
    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, queued: queuePayload.length });

  } catch (error: any) {
    console.error("Queue Insert Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}