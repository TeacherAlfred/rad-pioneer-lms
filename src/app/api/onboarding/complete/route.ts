import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { token, password, guardians, learners, billing, agreements } = body;

    if (!token || !password) {
      return NextResponse.json({ error: 'Missing required security token or password' }, { status: 400 });
    }

    // 1. Validate the Token & Find the Primary Parent
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, metadata, auth_user_id') 
      .eq('onboarding_token', token)
      .single();

    if (profileErr || !profile) {
      console.error("Token validation failed:", profileErr);
      return NextResponse.json({ error: 'Invalid or expired onboarding link.' }, { status: 403 });
    }

    const parentId = profile.id;
    const primaryGuardian = guardians.find((g: any) => g.isPrimary) || guardians[0];
    let authUserId = profile.auth_user_id;

    // 2. Handle Auth User (Create or Update)
    if (authUserId) {
      const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        password: password,
        user_metadata: { onboarded: true }
      });
      if (authErr) throw authErr;
    } else {
      const { data: newAuthData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: primaryGuardian.email,
        password: password,
        email_confirm: true, 
        user_metadata: { onboarded: true }
      });
      
      if (createErr) {
        console.error("Auth Creation Error:", createErr);
        throw new Error(`Auth Error: ${createErr.message}`);
      }
      authUserId = newAuthData.user.id;
    }

    // 3. Process Guardians (Primary vs Additional)
    const coGuardians = guardians.filter((g: any) => !g.isPrimary);

    // 4. Update Primary Parent Profile & Destroy Token
    const currentMeta = typeof profile.metadata === 'string' ? JSON.parse(profile.metadata) : (profile.metadata || {});
    
    const { error: updateErr } = await supabaseAdmin
      .from('profiles')
      .update({
        auth_user_id: authUserId, 
        display_name: primaryGuardian.name,
        updated_at: new Date().toISOString(), 
        metadata: {
          ...currentMeta,
          email: primaryGuardian.email,
          phone: primaryGuardian.phone, 
          is_primary_contact: true,
          billing_schedule: {
            frequency: billing.frequency,
            preferred_date: billing.date
          },
          agreements,
          onboarded_at: new Date().toISOString()
        },
        onboarding_token: null // DESTROY THE TOKEN
      })
      .eq('id', parentId);

    if (updateErr) throw updateErr;

    // 5. Update or Create Co-Guardians (Second Parents)
    if (coGuardians && coGuardians.length > 0) {
      for (const cg of coGuardians) {
        const cgData = {
          role: 'guardian',
          display_name: cg.name,
          linked_parent_id: parentId,
          status: 'active',
          // FIXED: Phone removed from root, placed securely in metadata
          metadata: {
            email: cg.email,
            phone: cg.phone,
            is_primary_contact: false,
            relationship: 'Co-Guardian',
            ...(cg.removalRequested ? { removal_requested: true, removal_requested_at: new Date().toISOString() } : {})
          }
        };

        if (cg.id && typeof cg.id === 'string' && cg.id.length > 20) {
          const { error: cgUpdateErr } = await supabaseAdmin.from('profiles').update(cgData).eq('id', cg.id);
          if (cgUpdateErr) console.error(`Failed to update co-guardian ${cg.id}:`, cgUpdateErr);
        } else if (!cg.removalRequested) {
          const { error: cgInsertErr } = await supabaseAdmin.from('profiles').insert([cgData]);
          if (cgInsertErr) console.error("Failed to insert new co-guardian:", cgInsertErr);
        }
      }
    }

    // 6. Update or Create the Learner Profiles (Students)
    if (learners && learners.length > 0) {
      for (const l of learners) {
        const studentData = {
          role: 'student',
          display_name: l.name,
          linked_parent_id: parentId,
          status: 'active',
          metadata: {
            dob: l.dob,
            grade: l.grade,
            school_coding: l.schoolCoding,
            ...(l.removalRequested ? { removal_requested: true, removal_requested_at: new Date().toISOString() } : {})
          }
        };

        if (l.id && typeof l.id === 'string' && l.id.length > 20) {
          const { error: studentUpdateErr } = await supabaseAdmin.from('profiles').update(studentData).eq('id', l.id);
          if (studentUpdateErr) console.error(`Failed to update student ${l.id}:`, studentUpdateErr);
        } else if (!l.removalRequested) {
          const { error: studentInsertErr } = await supabaseAdmin.from('profiles').insert([studentData]);
          if (studentInsertErr) console.error("Failed to insert new student:", studentInsertErr);
        }
      }
    }

    return NextResponse.json({ success: true, message: "Onboarding complete." }, { status: 200 });

  } catch (error: any) {
    console.error('Critical Onboarding API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}