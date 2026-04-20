import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);

// We use the Service Role key here so the server can reliably fetch emails 
// from the profiles table without RLS blocking it.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
);

export async function POST(req: Request) {
  try {
    const { student_id, guardian_id, coach_id, sender_id, message } = await req.json();

    // 1. Determine who should receive this email
    const isParentSending = sender_id === guardian_id;
    const recipientId = isParentSending ? coach_id : guardian_id;

    // 2. Fetch the Sender, Recipient, and Student profiles securely
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, display_name, metadata, role')
      .in('id', [sender_id, recipientId, student_id]);

    if (!profiles) return NextResponse.json({ success: true, note: "No profiles found" });

    const sender = profiles.find(p => p.id === sender_id);
    const recipient = profiles.find(p => p.id === recipientId);
    const student = profiles.find(p => p.id === student_id);

    if (!sender || !recipient || !student) return NextResponse.json({ success: true, note: "Missing data" });

    // Extract the recipient's email from their metadata
    const recipientMeta = typeof recipient.metadata === 'string' ? JSON.parse(recipient.metadata) : (recipient.metadata || {});
    const recipientEmail = recipientMeta?.email || recipientMeta?.contact_email; 

    if (!recipientEmail) {
      console.log("Cannot notify: No email found for recipient", recipientId);
      return NextResponse.json({ success: true, note: "No email address on file" });
    }

    // Format the sender's name nicely
    const senderName = sender.role === 'guardian' 
      ? `${sender.display_name} (${student.display_name}'s Guardian)` 
      : sender.display_name;
    
    // 3. Transmit the Email via Resend
    await resend.emails.send({
      from: 'RAD Academy <notifications@radacademy.co.za>', // Change if your Resend domain is different
      to: [recipientEmail],
      subject: `New Message regarding ${student.display_name}`,
      html: `
        <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px;">
          <h2 style="color: #0f172a; margin-top: 0;">New Secure Message</h2>
          <p style="color: #475569; font-size: 14px;">You have received a new message regarding <strong>${student.display_name}</strong>.</p>
          
          <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0;">
            <p style="color: #0f172a; font-weight: bold; margin-top: 0; margin-bottom: 8px;">${senderName} wrote:</p>
            <p style="color: #334155; margin: 0; white-space: pre-wrap;">"${message}"</p>
          </div>

          <a href="${process.env.NEXT_PUBLIC_SITE_URL}" style="display: inline-block; background-color: #3b82f6; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; font-size: 14px;">
            Reply in Portal
          </a>
          
          <p style="color: #94a3b8; font-size: 12px; margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
            This is an automated notification from the RAD Academy Secure Communications Portal. Please do not reply directly to this email.
          </p>
        </div>
      `
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Email notification error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}