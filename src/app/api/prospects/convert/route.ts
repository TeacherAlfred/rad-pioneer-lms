import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use the Service Role Key to interact with the protected Auth system
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
);

export async function POST(req: Request) {
  try {
    const { prospectId, name, email, phone, source } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Prospect must have an email address to create an account." }, { status: 400 });
    }

    // 1. Create the user in Supabase Auth
    // We generate a random temporary password that satisfies basic security requirements
    const tempPassword = Math.random().toString(36).slice(-10) + 'A1!';
    
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: tempPassword,
      email_confirm: true, // Auto-confirm so they can log in immediately
      user_metadata: {
        display_name: name
      }
    });

    if (authError) {
      console.error("Auth Creation Error:", authError);
      throw new Error(authError.message);
    }

    const authUserId = authData.user.id;

    // 2. Handle the Profile Row
    // Check if your database triggers auto-created a profile when the Auth user was made
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('auth_user_id', authUserId)
      .single();

    const profileData = {
      role: 'guardian',
      display_name: name,
      status: 'active',
      funnel_stage: 'Active (Paid Client)',
      metadata: {
        email: email,
        phone: phone || "",
        source: source || "",
        converted_from_prospect_id: prospectId,
        admin_notes: "Automatically converted from CRM Prospect."
      }
    };

    if (existingProfile) {
      // If a trigger made a blank profile, update it with our rich data
      const { error: updateProfileError } = await supabaseAdmin
        .from('profiles')
        .update(profileData)
        .eq('id', existingProfile.id);
      if (updateProfileError) throw updateProfileError;
    } else {
      // Otherwise, insert the profile manually
      const { error: insertProfileError } = await supabaseAdmin
        .from('profiles')
        .insert([{ auth_user_id: authUserId, ...profileData }]);
      if (insertProfileError) throw insertProfileError;
    }

    // 3. Mark the Prospect as Converted
    const { error: prospectError } = await supabaseAdmin
      .from('prospects')
      .update({ status: 'Converted (Won)', updated_at: new Date().toISOString() })
      .eq('id', prospectId);

    if (prospectError) throw prospectError;

    // Return the generated password so the admin can securely pass it on (or trigger an email)
    return NextResponse.json({ success: true, tempPassword });

  } catch (error: any) {
    console.error("Conversion API Error:", error);
    return NextResponse.json({ error: error.message || "Failed to convert prospect." }, { status: 500 });
  }
}