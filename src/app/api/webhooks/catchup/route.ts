import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Initialize a Server-Side Supabase Client with the Service Role Key
// This allows us to bypass Row Level Security to fetch the Teacher's email securely
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    // 1. Parse the Webhook Payload from Supabase
    const body = await request.json();
    const newBooking = body.record; // The newly inserted row in catchup_bookings

    // Handle the "Moved to Next Month" edge case (no session ID)
    if (!newBooking.session_id) {
      // Here you could send an email to the Admin notifying them of a next-month request
      return NextResponse.json({ message: 'Next month request logged. No teacher alert needed.' }, { status: 200 });
    }

    // 2. Fetch the Session Details to get the Teacher ID and Date
    const { data: sessionData, error: sessionError } = await supabase
      .from('catchup_sessions')
      .select('session_date, teacher_id, status')
      .eq('id', newBooking.session_id)
      .single();

    if (sessionError || !sessionData) {
      throw new Error('Could not fetch session details');
    }

    // 3. Update the Session Status to 'Pending Teacher' 
    // (Only if it's currently a Draft - this prevents overwriting if already confirmed)
    if (sessionData.status === 'Draft') {
      await supabase
        .from('catchup_sessions')
        .update({ status: 'Pending Teacher' })
        .eq('id', newBooking.session_id);
    }

    // 4. Fetch the Teacher's Profile and Email
    const { data: teacherProfile, error: profileError } = await supabase
      .from('profiles')
      .select('auth_user_id, display_name')
      .eq('id', sessionData.teacher_id)
      .single();

    if (profileError || !teacherProfile?.auth_user_id) {
      throw new Error('Could not fetch teacher profile or auth_user_id');
    }

    // Use the Service Role Key to bypass RLS and fetch the user's email from the auth table
    const { data: authData, error: authError } = await supabase.auth.admin.getUserById(teacherProfile.auth_user_id);
    
    if (authError || !authData.user?.email) {
      throw new Error('Could not fetch teacher email from auth system');
    }

    const teacherEmail = authData.user.email;
    const teacherName = teacherProfile.display_name || 'Educator';

    // 5. Format the Date for the Email
    const formattedDate = new Date(sessionData.session_date).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit'
    });

    // 6. Send the Email via Resend
    await resend.emails.send({
      from: 'LMS Notifications <notifications@yourdomain.com>', // Update with your verified Resend domain
      to: teacherEmail,
      subject: `Action Required: Catch-Up Booking for ${formattedDate}`,
      html: `
        <h2>New Catch-Up Request</h2>
        <p>Hi ${teacherName} || 'Educator'},</p>
        <p>A parent has requested a catch-up session for <strong>${newBooking.student_name}</strong> on:</p>
        <p><strong>${formattedDate}</strong></p>
        <p>Please log in to your dashboard to confirm your availability or decline the request so we can reassign it.</p>
        <br/>
        <a href="https://yourdomain.com/teacher/dashboard" style="padding: 10px 15px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px;">Go to Dashboard</a>
      `,
    });

    return NextResponse.json({ message: 'Webhook processed and email sent successfully' }, { status: 200 });

  } catch (error) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}