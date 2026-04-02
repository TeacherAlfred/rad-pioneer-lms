import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    // 1. Extract the dynamically generated onboardingLink sent from the frontend
    const { email, guardianName, guardianId, customContent, onboardingLink } = await request.json();

    if (!email || !guardianId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const whatsappLink = `https://wa.me/27769065959`;
    
    // Fallback Subject (You can also pass the subject from the frontend if you want it to be dynamic)
    const emailSubject = 'Welcome to the New RAD Academy Portal! 🚀';

    // Parse the single custom content string from the DB (replace the link placeholder)
    // If onboardingLink wasn't passed for some reason, fallback to localhost to prevent a crash
    const safeLink = onboardingLink || `http://localhost:3000/onboarding/guardian?id=${guardianId}`;
    
    const parsedContent = typeof customContent === 'string' 
        ? customContent.replace(/{{onboardingLink}}/g, safeLink) 
        : "";

    const data = await resend.emails.send({
      from: 'RAD Academy <onboarding@updates.radacademy.co.za>', // Ensure this domain is verified in Resend
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

          <div style="font-size: 15px; line-height: 1.6; color: #e2e8f0;">
             ${parsedContent}
          </div>

          <div style="text-align: center; margin: 40px 0;">
            <p style="font-size: 16px; font-weight: bold; color: #ffffff; margin-bottom: 15px;">Please click below to complete your setup and activate your household:</p>
            <a href="${safeLink}" style="background-color: #9333ea; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; display: inline-block;">
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

    // Log the transmission in the communications table
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