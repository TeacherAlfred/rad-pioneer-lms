"use server";

import { db } from "@/db"; // Adjust this path to wherever your Drizzle db instance is exported
import { radGrowthLeads } from "@/db/schema"; // Adjust this path to your schema index
import { eq, desc } from "drizzle-orm";

export async function injectGrowthLead(payload: any) {
  try {
    const [newLead] = await db.insert(radGrowthLeads).values({
      adminId: payload.admin_id,
      fullName: payload.full_name,
      email: payload.email,
      contactNumber: payload.contact_number,
      leadSource: payload.lead_source,
      stage: payload.stage,
      warmth: payload.warmth,
      kidsCount: payload.kids_count,
      notes: payload.notes,
      metadata: payload.metadata
    }).returning();

    return { success: true, data: newLead };
  } catch (error: any) {
    console.error("Injection error:", error);
    return { success: false, error: error.message };
  }
}

export async function getRadGrowthLeads(adminId: string) {
  try {
    const leads = await db.query.radGrowthLeads.findMany({
      where: eq(radGrowthLeads.adminId, adminId),
      orderBy: [desc(radGrowthLeads.createdAt)],
    });
    return { success: true, data: leads };
  } catch (error: any) {
    console.error("Failed to fetch rad leads:", error);
    return { success: false, error: error.message };
  }
}

export async function updateRadGrowthLead(leadId: string, payload: any) {
  try {
    const [updatedLead] = await db
      .update(radGrowthLeads)
      .set({ ...payload, updatedAt: new Date() })
      .where(eq(radGrowthLeads.id, leadId))
      .returning();
      
    return { success: true, data: updatedLead };
  } catch (error: any) {
    console.error("Failed to update rad lead:", error);
    return { success: false, error: error.message };
  }
}