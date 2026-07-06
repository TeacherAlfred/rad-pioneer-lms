"use server";

import { db } from "@/db"; // Adjust path to your db instance
import { radEvents, radGrowthLeads } from "@/db/schema"; // Adjust path to your schemas
import { eq, desc, and } from "drizzle-orm";

// Fetch all published events for the main directory
export async function getPublishedEvents() {
  try {
    const events = await db.query.radEvents.findMany({
      where: eq(radEvents.status, 'published'),
      orderBy: [desc(radEvents.eventDate)],
    });
    return { success: true, data: events };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Fetch a single event by ID for the landing page
export async function getEventById(id: string) {
  try {
    const event = await db.query.radEvents.findFirst({
      where: eq(radEvents.id, id),
    });
    if (!event) return { success: false, error: "Event not found" };
    return { success: true, data: event };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Capture a lead directly from the Event Landing Page
export async function captureEventSignup(payload: any) {
  try {
    const [newLead] = await db.insert(radGrowthLeads).values({
      fullName: payload.parentName,
      email: payload.email,
      contactNumber: payload.whatsapp,
      leadSource: `Event Page: ${payload.eventTitle}`,
      stage: 'Sourced',
      warmth: 'Hot', // Immediate high intent
      kidsCount: 1,
      metadata: {
        childName: payload.childName,
        childGrade: payload.childGrade,
        eventId: payload.eventId
      },
      notes: `Captured from Event Page: ${payload.eventTitle}\nChild: ${payload.childName} (Gr ${payload.childGrade})`
    }).returning();

    return { success: true, data: newLead };
  } catch (error: any) {
    console.error("Signup error:", error);
    return { success: false, error: error.message };
  }
}

export async function getEventBySlug(slug: string) {
  try {
    const event = await db.query.radEvents.findFirst({
      where: eq(radEvents.slug, slug),
    });
    if (!event) return { success: false, error: "Event not found" };
    return { success: true, data: event };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}