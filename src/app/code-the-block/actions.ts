"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCtbSupabaseClient } from "@/lib/code-the-block/supabase-server";
import {
  CTB_ADMIN_COOKIE,
  CTB_ADMIN_COOKIE_MAX_AGE,
  CTB_STUDENT_COOKIE,
  CTB_STUDENT_COOKIE_MAX_AGE,
} from "@/lib/code-the-block/cookies";

export type FormState = { error?: string } | undefined;

export async function loginStudent(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastInitial = String(formData.get("lastInitial") ?? "")
    .trim()
    .slice(0, 1)
    .toUpperCase();
  const workshopCode = String(formData.get("workshopCode") ?? "")
    .trim()
    .toUpperCase();

  if (!firstName || !lastInitial || !workshopCode) {
    return { error: "Please fill in your first name, last initial, and workshop code." };
  }

  const supabase = getCtbSupabaseClient();

  const { data: workshop } = await supabase
    .from("ctb_workshops")
    .select("id, is_active")
    .eq("code", workshopCode)
    .maybeSingle();

  if (!workshop || !workshop.is_active) {
    return { error: "We couldn't find that workshop code. Double-check with your facilitator." };
  }

  const { data: existing } = await supabase
    .from("ctb_students")
    .select("id")
    .eq("workshop_id", workshop.id)
    .eq("first_name", firstName)
    .eq("last_initial", lastInitial)
    .maybeSingle();

  let studentId = existing?.id as string | undefined;

  if (!studentId) {
    const { data: created, error: createError } = await supabase
      .from("ctb_students")
      .insert({ workshop_id: workshop.id, first_name: firstName, last_initial: lastInitial })
      .select("id")
      .single();

    if (createError || !created) {
      return { error: "Something went wrong creating your profile. Please try again." };
    }
    studentId = created.id;
  }

  if (!studentId) {
    return { error: "Something went wrong creating your profile. Please try again." };
  }

  const cookieStore = await cookies();
  cookieStore.set(CTB_STUDENT_COOKIE, studentId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/code-the-block",
    maxAge: CTB_STUDENT_COOKIE_MAX_AGE,
  });

  redirect("/code-the-block/workbook");
}

export async function logoutStudent(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(CTB_STUDENT_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/code-the-block",
    maxAge: 0,
  });
  redirect("/code-the-block");
}

export async function markStepComplete(stepId: string, completed: boolean): Promise<void> {
  const cookieStore = await cookies();
  const studentId = cookieStore.get(CTB_STUDENT_COOKIE)?.value;
  if (!studentId) {
    throw new Error("Not logged in.");
  }

  const supabase = getCtbSupabaseClient();

  if (completed) {
    await supabase
      .from("ctb_progress")
      .upsert({ student_id: studentId, step_id: stepId }, { onConflict: "student_id,step_id" });
  } else {
    await supabase
      .from("ctb_progress")
      .delete()
      .eq("student_id", studentId)
      .eq("step_id", stepId);
  }
}

export async function requestHelp(moduleTitle: string, trackLabel: string): Promise<void> {
  const cookieStore = await cookies();
  const studentId = cookieStore.get(CTB_STUDENT_COOKIE)?.value;
  if (!studentId) {
    throw new Error("Not logged in.");
  }

  const supabase = getCtbSupabaseClient();
  await supabase
    .from("ctb_students")
    .update({
      needs_help: true,
      help_module: moduleTitle,
      help_track: trackLabel,
      help_requested_at: new Date().toISOString(),
    })
    .eq("id", studentId);
}

export async function cancelHelp(): Promise<void> {
  const cookieStore = await cookies();
  const studentId = cookieStore.get(CTB_STUDENT_COOKIE)?.value;
  if (!studentId) {
    throw new Error("Not logged in.");
  }

  const supabase = getCtbSupabaseClient();
  await supabase
    .from("ctb_students")
    .update({ needs_help: false, help_module: null, help_track: null, help_requested_at: null })
    .eq("id", studentId);
}

export async function adminLogin(_prevState: FormState, formData: FormData): Promise<FormState> {
  const password = String(formData.get("password") ?? "");
  const expected = process.env.CTB_ADMIN_PASSWORD;

  if (!expected || password !== expected) {
    return { error: "Incorrect password." };
  }

  const cookieStore = await cookies();
  cookieStore.set(CTB_ADMIN_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/code-the-block/admin",
    maxAge: CTB_ADMIN_COOKIE_MAX_AGE,
  });

  redirect("/code-the-block/admin");
}
