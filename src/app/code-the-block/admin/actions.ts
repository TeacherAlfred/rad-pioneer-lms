"use server";

import { isCtbAdmin } from "@/lib/code-the-block/session";
import { getRoster } from "@/lib/code-the-block/admin-data";
import { getCtbSupabaseClient } from "@/lib/code-the-block/supabase-server";

export interface RosterStudentDTO {
  id: string;
  firstName: string;
  lastInitial: string;
  completedStepIds: string[];
  needsHelp: boolean;
  helpModule: string | null;
  helpTrack: string | null;
  helpRequestedAt: string | null;
}

export interface RosterWorkshopDTO {
  id: string;
  code: string;
  title: string;
  students: RosterStudentDTO[];
}

export async function getRosterData(): Promise<RosterWorkshopDTO[]> {
  if (!(await isCtbAdmin())) return [];

  const roster = await getRoster();

  return roster.map((workshop) => ({
    id: workshop.id,
    code: workshop.code,
    title: workshop.title,
    students: workshop.students.map((s) => ({
      id: s.id,
      firstName: s.firstName,
      lastInitial: s.lastInitial,
      completedStepIds: Array.from(s.completedStepIds),
      needsHelp: s.needsHelp,
      helpModule: s.helpModule,
      helpTrack: s.helpTrack,
      helpRequestedAt: s.helpRequestedAt,
    })),
  }));
}

export async function resolveHelp(studentId: string): Promise<void> {
  if (!(await isCtbAdmin())) return;

  const supabase = getCtbSupabaseClient();
  await supabase
    .from("ctb_students")
    .update({ needs_help: false, help_module: null, help_track: null, help_requested_at: null })
    .eq("id", studentId);
}
