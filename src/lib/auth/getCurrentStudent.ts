import { createSupabaseServerComponentClient } from "@/lib/supabase/server";

export type CurrentStudent = {
  id: string;
  auth_user_id: string | null;
  role: string;
  display_name: string | null;
  student_identifier: string | null;
};

export async function getCurrentStudent(): Promise<CurrentStudent | null> {
  const supabase = await createSupabaseServerComponentClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  console.log("GET CURRENT STUDENT - AUTH USER:", user, userError);

  if (userError || !user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, auth_user_id, role, display_name, student_identifier")
    .eq("auth_user_id", user.id)
    .eq("role", "student")
    .single();

  console.log("GET CURRENT STUDENT - PROFILE:", profile, profileError);

  if (profileError || !profile) {
    return null;
  }

  return profile;
}