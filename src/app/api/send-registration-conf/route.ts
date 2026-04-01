import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);

// Initialize Supabase for the backend
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const { email, parentName, studentName } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Missing email' }, { status: 400 });
    }

    const whatsappLink = `https://wa.me/27769065959?text=${encodeURIComponent("Hi RAD Academy, I have a question about my recent registration.")}`;
    const supportEmail = "info@radacademy.co.za";
    const emailSubject = 'Application Received: RAD Academy 🚀';

    // 1. Send the email via Resend
    const data = await resend.emails.send({
      from: 'RAD Academy <onboarding@updates.radacademy.co.za>',
      to: [email],
      subject: emailSubject,
      html: `
        <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; background-color: #0f172a; color: #f8fafc; padding: 40px; border-radius: 16px; border: 1px solid #1e293b;">
          
          <h2 style="color: #a855f7; text-transform: uppercase; font-style: italic; letter-spacing: 1px; margin-bottom: 24px;">
            Transmission Received
          </h2>

          <div style="font-size: 15px; line-height: 1.6; color: #e2e8f0; white-space: pre-wrap;">Hi ${parentName},

Thank you for submitting your application for <strong>${studentName}</strong>.

<h3 style="color: #38bdf8; font-size: 18px; margin-top: 30px; margin-bottom: 10px;">🕒 What happens next?</h3>
Our admissions team will review your application and be in touch within 24 hours with the next steps.

<h3 style="color: #38bdf8; font-size: 18px; margin-top: 30px; margin-bottom: 10px;">⚖️ Enrollment & Access Policies:</h3>
To ensure clarity as we process your application, please note our standard access protocols:
<ul style="padding-left: 20px; margin-top: 10px; color: #94a3b8;">
  <li style="margin-bottom: 8px;"><strong>Trial LMS Access:</strong> Includes full access for 30 days. Afterward, we will review the value you are receiving so you can decide whether to upgrade to paid access or revert to the Free Tier (limited to one active course at a time).</li>
  <li style="margin-bottom: 8px;"><strong>Paid Programs:</strong> Once approved, your space is reserved for <strong>7 days</strong>. You must accept the provided quote within this window. Failure to do so will forfeit the reserved space, though you will retain LMS access under the standard Trial conditions.</li>
</ul>

<h3 style="color: #38bdf8; font-size: 18px; margin-top: 30px; margin-bottom: 10px;">📋 What we expect from you:</h3>
Please keep an eye on your inbox (and spam folder). If approved, you will receive an activation link to set up your parent/guardian profile and that of your child.

We look forward to welcoming you to the Academy!</div>

          <div style="margin-top: 40px; padding-top: 30px; border-top: 1px solid #1e293b; text-align: center;">
            <p style="color: #94a3b8; font-size: 14px; margin-bottom: 15px;">Need help or have questions? Our support team is just a tap away.</p>
            <div style="display: flex; justify-content: center; gap: 16px; flex-wrap: wrap;">
              <a href="${whatsappLink}" style="background-color: #25D366; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                💬 WhatsApp Us
              </a>
              <a href="mailto:${supportEmail}" style="background-color: #38bdf8; color: #0f172a; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                ✉️ Email Support
              </a>
            </div>
          </div>

          <p style="color: #475569; font-size: 12px; margin-top: 40px; text-align: center;">
            RAD Academy HQ | Empowering the next generation of innovators.<br/>
            <span style="font-style: italic;">Please do not reply directly to this automated transmission.</span>
          </p>
        </div>
      `,
    });

    // 2. Log it to your Supabase Comms History table
    await supabase.from('communication_logs').insert([{
      recipient_email: email,
      recipient_name: parentName || 'Guardian',
      subject: emailSubject,
      status: 'Sent'
    }]);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Resend Error:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}