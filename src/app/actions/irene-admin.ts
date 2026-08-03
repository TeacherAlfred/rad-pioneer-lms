"use server";

import { db } from "@/db/index";
import { projIreneResponses } from "@/db/schema/irene";
import { eq } from "drizzle-orm";

export async function getIreneAdminRecords() {
  try {
    const data = await db.query.projIreneResponses.findMany({
      orderBy: (responses, { desc }) => [desc(responses.createdAt)],
    });

    // Map the Drizzle schema back to the UI's expectations
    const mapped = data.map(r => ({
      id: r.id,
      parent_first_name: r.parentFirstName,
      cub_initial: r.cubInitial,
      class_name: r.className,
      grade: r.grade,
      q_why_start: r.qWhyStart,
      q_club: r.qClub,
      q_boss_level: r.qBossLevel,
      q_longest_distance: r.qLongestDistance,
      q_funny_fail: r.qFunnyFail,
      q_weird_habit: r.qWeirdHabit,
      q_proudest_moment: r.qProudestMoment,
      q_shoes: r.qShoes,
      media_url: r.mediaUrl,
      is_verified: r.isVerified,
      is_flagged: r.isFlagged,
      needs_name_review: r.needsNameReview,
      is_duplicate: r.is_duplicate, // <--- Fixed to match your schema's snake_case
      goal_tags: r.goalTags || [],
      activity_tags: r.activityTags || [],
      club_tags: r.clubTags || [],
      cubs: r.cubs || [],
      created_at: r.createdAt
    }));
    return { success: true, data: mapped };
  } catch (error: any) {
    console.error("Fetch Error:", error);
    return { success: false, error: error.message };
  }
}

export async function toggleIreneStatus(id: string, field: 'is_verified' | 'is_flagged' | 'needs_name_review'| 'is_duplicate', value: boolean) {
  try {
    const updatePayload: any = {};
    if (field === 'is_verified') updatePayload.isVerified = value;
    if (field === 'is_flagged') updatePayload.isFlagged = value;
    if (field === 'needs_name_review') updatePayload.needsNameReview = value;
    if (field === 'is_duplicate') updatePayload.is_duplicate = value; // <--- Fixed here too

    await db.update(projIreneResponses).set(updatePayload).where(eq(projIreneResponses.id, id));
    return { success: true };
  } catch (error: any) {
    console.error("Toggle Error:", error);
    return { success: false, error: error.message || "Unknown database error" };
  }
}

export async function deleteIreneRecord(id: string) {
  try {
    await db.delete(projIreneResponses).where(eq(projIreneResponses.id, id));
    return { success: true };
  } catch (error: any) {
    console.error("Delete Error:", error);
    return { success: false, error: error.message };
  }
}

export async function saveIreneRecord(id: string | null, payload: any) {
  try {
    // Extract the primary cub's details for the top-level database columns
    const primaryCub = payload.cubs?.[0] || {};
    
    const dbPayload = {
      parentFirstName: payload.parent_first_name,
      cubInitial: primaryCub.cub_initial || payload.cub_initial || '',
      className: primaryCub.class_name || payload.class_name || '',
      grade: primaryCub.grade || payload.grade || '',
      qWhyStart: payload.q_why_start,
      qClub: payload.q_club,
      qBossLevel: payload.q_boss_level,
      qLongestDistance: payload.q_longest_distance,
      qFunnyFail: payload.q_funny_fail,
      qWeirdHabit: payload.q_weird_habit,
      qProudestMoment: payload.q_proudest_moment,
      qShoes: payload.q_shoes,
      goalTags: payload.goal_tags,
      activityTags: payload.activity_tags,
      clubTags: payload.club_tags,
      cubs: payload.cubs,
      isVerified: payload.is_verified ?? false,
      isFlagged: payload.is_flagged ?? false,
      needsNameReview: payload.needs_name_review ?? false,
      is_duplicate: payload.is_duplicate ?? false, // <--- Fixed here as well
    };

    if (id) {
      await db.update(projIreneResponses).set(dbPayload).where(eq(projIreneResponses.id, id));
      return { success: true, data: { ...payload, id } };
    } else {
      const [inserted] = await db.insert(projIreneResponses).values(dbPayload).returning();
      return { success: true, data: { ...payload, id: inserted.id } };
    }
  } catch (error: any) {
    console.error("Save Error:", error);
    return { success: false, error: error.message };
  }
}