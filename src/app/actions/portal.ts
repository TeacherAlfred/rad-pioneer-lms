"use server";

import { db } from "../../db/index";
import { clientPortals } from "../../db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// 1. Fetch the portal data
export async function getClientPortal(accessCode: string) {
  try {
    const portal = await db.query.clientPortals.findFirst({
      where: eq(clientPortals.accessCode, accessCode.toUpperCase()),
    });
    return { success: true, data: portal };
  } catch (error) {
    console.error("Database fetch error:", error);
    return { success: false, error: "Failed to fetch portal." };
  }
}

// 2. Save the client's progress
export async function updatePortalProgress(accessCode: string, submittedData: any) {
  console.log("--- SAVE ACTION TRIGGERED ---");
  console.log("Target Profile:", accessCode);
  console.log("Data Payload:", JSON.stringify(submittedData, null, 2));

  try {
    // We add .returning() so Neon sends back the exact row it just updated
    const result = await db.update(clientPortals)
      .set({ submittedData })
      .where(eq(clientPortals.accessCode, accessCode.toUpperCase()))
      .returning(); 
      
    console.log("Neon DB Result:", result);

    // Tell Next.js to refresh the page cache so the user sees the latest data
    revalidatePath("/projects/portal");
    return { success: true };
  } catch (error) {
    console.error("--- DATABASE SAVE ERROR ---");
    console.error(error);
    return { success: false, error: "Failed to save progress." };
  }
}