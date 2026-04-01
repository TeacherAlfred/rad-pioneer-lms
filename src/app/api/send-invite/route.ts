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
    const { email, guardianName, guardianId, customContent } = await request.json();

    if (!email || !guardianId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const onboardingLink = `${baseUrl}/onboarding/guardian?id=${guardianId}`;
    const whatsappLink = `https://wa.me/27769065959?text=${encodeURIComponent("Hi RAD Academy, I need some help with the new portal onboarding.")}`;
    const emailSubject = 'Welcome to the New RAD Academy Portal! 🚀 (Action Required)';

    const content = customContent || {
      intro: "We are thrilled to invite you to the brand-new RAD Academy Learning Management System (LMS)! Our objective with this custom-built platform is to create a seamless, highly engaging digital hub for all our digital skills lessons.",
      pioneerHeading: "🎮 What your child gets",
      pioneerText: "Your child will have their own dedicated Learning Hub (Command Center). Here, they can access interactive course materials, track their progress, and fully immerse themselves in the world of digital skills.",
      parentHeading: "👨‍👩‍👧 What you can expect",
      parentText: "Over time, this portal will become your primary tool for managing your child's RAD Academy experience. You'll be able to easily view lesson schedules, manage payment options, update your contact details, and see the incredible skills your child is building week by week."
    };

    // 1. Send the email via Resend
    const data = await resend.emails.send({
      from: 'RAD Academy <onboarding@updates.radacademy.co.za>',
      to: [email],
      subject: emailSubject,
      html: `
        <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; background-color: #0f172a; color: #f8fafc; padding: 40px; border-radius: 16px; border: 1px solid #1e293b;">

          <h2 style="color: #a855f7; text-transform: uppercase; font-style: italic; letter-spacing: 1px; margin-bottom: 24px;">
            Welcome to the New RAD Portal
          </h2>

          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px; color: #e2e8f0;">
            Hi ${guardianName || 'Guardian'},
          </p>

          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px; color: #e2e8f0; white-space: pre-wrap;">${content.intro}</p>

          <div style="text-align: center; margin: 30px 0;">
            <p style="font-size: 16px; font-weight: bold; color: #ffffff; margin-bottom: 15px;">Please click below to complete your setup:</p>
            <a href="${onboardingLink}" style="background-color: #9333ea; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; display: inline-block;">
              Complete Onboarding
            </a>
          </div>

          <h3 style="color: #38bdf8; font-size: 18px; margin-top: 30px; margin-bottom: 10px;">${content.pioneerHeading}</h3>
          <p style="font-size: 15px; line-height: 1.6; color: #94a3b8; margin-bottom: 20px; white-space: pre-wrap;">${content.pioneerText}</p>

          <h3 style="color: #38bdf8; font-size: 18px; margin-top: 30px; margin-bottom: 10px;">${content.parentHeading}</h3>
          <p style="font-size: 15px; line-height: 1.6; color: #94a3b8; margin-bottom: 30px; white-space: pre-wrap;">${content.parentText}</p>

          <div style="text-align: center; margin: 40px 0;">
            <a href="${onboardingLink}" style="background-color: #9333ea; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; display: inline-block;">
              Complete Onboarding
            </a>
          </div>

          <div style="margin-top: 40px; padding-top: 30px; border-top: 1px solid #1e293b; text-align: center;">
            <p style="color: #94a3b8; font-size: 14px; margin-bottom: 15px;">Need help or have questions? Our support team is just a tap away.</p>
            <a href="${whatsappLink}" style="background-color: #25D366; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              💬 Chat with us on WhatsApp
            </a>
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
      recipient_name: guardianName || 'Guardian',
      subject: emailSubject,
      status: 'Sent'
    }]);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Resend Error:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}