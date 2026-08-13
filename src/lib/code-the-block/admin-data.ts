import { getCtbSupabaseClient } from "./supabase-server";

export interface RosterStudent {
  id: string;
  firstName: string;
  lastInitial: string;
  completedStepIds: Set<string>;
  needsHelp: boolean;
  helpModule: string | null;
  helpTrack: string | null;
  helpRequestedAt: string | null;
}

export interface RosterWorkshop {
  id: string;
  code: string;
  title: string;
  students: RosterStudent[];
}

export async function getRoster(): Promise<RosterWorkshop[]> {
  const supabase = getCtbSupabaseClient();

  const [{ data: workshops }, { data: students }, { data: progress }] = await Promise.all([
    supabase.from("ctb_workshops").select("id, code, title").order("created_at"),
    supabase
      .from("ctb_students")
      .select("id, workshop_id, first_name, last_initial, needs_help, help_module, help_track, help_requested_at")
      .order("first_name"),
    supabase.from("ctb_progress").select("student_id, step_id"),
  ]);

  const progressByStudent = new Map<string, Set<string>>();
  for (const row of progress ?? []) {
    if (!progressByStudent.has(row.student_id)) {
      progressByStudent.set(row.student_id, new Set());
    }
    progressByStudent.get(row.student_id)!.add(row.step_id);
  }

  return (workshops ?? []).map((workshop) => ({
    id: workshop.id,
    code: workshop.code,
    title: workshop.title,
    students: (students ?? [])
      .filter((s) => s.workshop_id === workshop.id)
      .map((s) => ({
        id: s.id,
        firstName: s.first_name,
        lastInitial: s.last_initial,
        completedStepIds: progressByStudent.get(s.id) ?? new Set<string>(),
        needsHelp: s.needs_help ?? false,
        helpModule: s.help_module,
        helpTrack: s.help_track,
        helpRequestedAt: s.help_requested_at,
      })),
  }));
}
