import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request) {
  try {
    const { email, password, profileId, name } = await request.json();

    if (!email || !password || !profileId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Create the user using the Admin API (bypasses email confirmation requirements)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: { display_name: name }
    });

    if (authError) {
      // Handle the case where they might have already registered
      if (authError.message.includes("already registered")) {
        return NextResponse.json({ error: "This email is already registered. Please log in instead." }, { status: 400 });
      }
      throw authError;
    }

    const newAuthUserId = authData.user.id;

    // 2. Link the new Auth ID to the existing profile
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ auth_user_id: newAuthUserId })
      .eq('id', profileId);

    if (profileError) throw profileError;

    return NextResponse.json({ success: true, authUserId: newAuthUserId }, { status: 200 });

  } catch (error) {
    console.error("Registration Error:", error);
    return NextResponse.json({ error: "Failed to create dashboard credentials." }, { status: 500 });
  }
}