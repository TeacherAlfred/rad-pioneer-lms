import { cookies } from "next/headers";
import { getCtbSupabaseClient } from "./supabase-server";
import { CTB_ADMIN_COOKIE, CTB_STUDENT_COOKIE } from "./cookies";

export interface CurrentStudent {
  id: string;
  firstName: string;
  lastInitial: string;
  workshopId: string;
  needsHelp: boolean;
}

export async function getCurrentStudent(): Promise<CurrentStudent | null> {
  const cookieStore = await cookies();
  const studentId = cookieStore.get(CTB_STUDENT_COOKIE)?.value;
  if (!studentId) return null;

  const supabase = getCtbSupabaseClient();
  const { data } = await supabase
    .from("ctb_students")
    .select("id, first_name, last_initial, workshop_id, needs_help")
    .eq("id", studentId)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id,
    firstName: data.first_name,
    lastInitial: data.last_initial,
    workshopId: data.workshop_id,
    needsHelp: data.needs_help ?? false,
  };
}

export async function getCompletedStepIds(studentId: string): Promise<Set<string>> {
  const supabase = getCtbSupabaseClient();
  const { data } = await supabase
    .from("ctb_progress")
    .select("step_id")
    .eq("student_id", studentId);

  return new Set((data ?? []).map((row) => row.step_id as string));
}

export async function isCtbAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(CTB_ADMIN_COOKIE)?.value === "1";
}
