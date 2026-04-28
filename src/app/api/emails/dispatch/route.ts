import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Use your verified sender domain here
const SENDER = 'RAD Academy <onboarding@updates.radacademy.co.za>'; 

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { scenario, name, email, token, quoteId } = body;

    if (!scenario || !email) {
      return NextResponse.json({ error: 'Missing required payload' }, { status: 400 });
    }

    const firstName = name ? name.split(' ')[0] : 'Parent';
    
    // NEW: Dynamically grab the exact live URL (or localhost) from the request itself
    const requestUrl = new URL(req.url);
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `${requestUrl.protocol}//${requestUrl.host}`;

    let emailsToSend = [];

    // ==========================================
    // SCENARIO A: THE PLG FAST-TRACK
    // ==========================================
    if (scenario === 'fast-track' || scenario === 'manual-conversion') {
      emailsToSend.push({
        from: SENDER,
        to: email,
        subject: '(1 of 3) Your RAD Academy Quotation',
        html: `
          <div style="font-family: sans-serif; color: #0f172a; max-w: 600px; margin: 0 auto;">
            <h2>Hi ${firstName}! 🚀</h2>
            <p>Your Fast-Track setup was successful and your platform profiles have been created.</p>
            <p>To lock in your discounted tier and secure your child's spot, please review and settle your generated quotation below.</p>
            <a href="${baseUrl}/quote/${quoteId}" style="display: inline-block; padding: 12px 24px; background-color: #0f172a; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 10px;">View & Pay Quotation</a>
            <p style="margin-top: 30px; font-size: 12px; color: #64748b;">If you have any questions, simply reply to this email.</p>
          </div>
        `
      });

      emailsToSend.push({
        from: SENDER,
        to: email,
        subject: '(2 of 3) Welcome to RAD Academy! (Setup Password)',
        html: `
          <div style="font-family: sans-serif; color: #0f172a; max-w: 600px; margin: 0 auto;">
            <h2>Your VIP Access is Ready.</h2>
            <p>Your child's learning environment has been successfully provisioned.</p>
            <p>Click the secure link below to set your parent password, review our intake agreements, and unlock your family dashboard.</p>
            <a href="${baseUrl}/welcome?t=${token}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 10px;">Setup Parent Profile</a>
          </div>
        `
      });

      emailsToSend.push({
        from: SENDER,
        to: email,
        subject: '(3 of 3) Claim your Free 1-on-1 Teams Session!',
        html: `
          <div style="font-family: sans-serif; color: #0f172a; max-w: 600px; margin: 0 auto;">
            <h2>Claim your Fast-Track Bonus! 🎁</h2>
            <p>Because you chose to upgrade and fast-track your setup, you've unlocked a completely free 1-on-1 Teams session with a RAD Academy coding coach.</p>
            <p>During this session, we will help your child log in, explore the dashboard, and write their very first line of code!</p>
            <a href="https://calendly.com/radacademy" style="display: inline-block; padding: 12px 24px; background-color: #f59e0b; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 10px;">Book Session Now</a>
          </div>
        `
      });
    }

    // ==========================================
    // SCENARIO B: 14-DAY FREE TRIAL
    // ==========================================
    if (scenario === 'trial') {
      emailsToSend.push({
        from: SENDER,
        to: email,
        subject: 'Your 14-Day RAD Trial is Active! 🚀',
        html: `
          <div style="font-family: sans-serif; color: #0f172a; max-w: 600px; margin: 0 auto;">
            <h2>Hi ${firstName}, welcome to the trial!</h2>
            <p>Your child's 14-Day Free Access pass has been generated.</p>
            <p>To begin exploring, click the link below to set up your child's Username and 4-digit PIN.</p>
            <a href="${baseUrl}/lms/onboarding?id=${quoteId}" style="display: inline-block; padding: 12px 24px; background-color: #10b981; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 10px;">Setup Child Access</a>
            <p style="margin-top: 20px;"><em>Note: You can upgrade to a paid tier at any point during your trial from the dashboard to lock in your discounted rate.</em></p>
          </div>
        `
      });
    }

    // Dispatch the emails in a batch
    if (emailsToSend.length > 0) {
      const response = await resend.batch.send(emailsToSend);
      if (response.error) throw new Error(response.error.message);
    }

    return NextResponse.json({ success: true, count: emailsToSend.length });

  } catch (error: any) {
    console.error("Email Dispatch Error:", error);
    return NextResponse.json({ error: error.message || 'Failed to send emails' }, { status: 500 });
  }
}