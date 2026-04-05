import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request) {
  // 1. Initialize admin client INSIDE the request
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("🚨 CRITICAL: Supabase ENV variables are missing in the API route.");
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    const { email, password, profileId, name } = await request.json();

    if (!email || !password || !profileId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 2. Create the user in Supabase Auth (Admin API bypasses confirmation)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: { display_name: name, profile_id: profileId }
    });

    if (authError) {
      console.error("❌ Auth Creation Error:", authError.message);
      if (authError.message.includes("already registered") || authError.status === 422) {
        return NextResponse.json({ error: "This email is already registered. Try logging in." }, { status: 400 });
      }
      throw authError;
    }

    const newAuthUserId = authData.user.id;

    // 3. Link the new Auth ID to the existing profile record
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ 
        auth_user_id: newAuthUserId,
        status: 'active' 
      })
      .eq('id', profileId);

    if (profileError) {
      console.error("❌ Profile Link Error:", profileError.message);
      throw profileError;
    }

    return NextResponse.json({ 
      success: true, 
      authUserId: newAuthUserId 
    }, { status: 200 });

  } catch (error) {
    console.error("🚨 REGISTRATION CRASH:", error.message || error);
    return NextResponse.json({ 
      error: error.message || "Failed to create dashboard credentials." 
    }, { status: 500 });
  }
}