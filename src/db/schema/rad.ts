import { pgTable, uuid, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const radGrowthLeads = pgTable("rad_growth_leads", {
  id: uuid("id").defaultRandom().primaryKey(),
  adminId: uuid("admin_id"),
  fullName: text("full_name").notNull(),
  email: text("email"),
  contactNumber: text("contact_number"),
  
  // Pipeline specific fields
  leadSource: text("lead_source").default("Website"),
  stage: text("stage").default("Sourced"), // e.g., 'Sourced', 'Contacted', 'Engaged', 'Won', 'Lost'
  warmth: text("warmth").default("Cold"),  // e.g., 'Hot', 'Warm', 'Cold'
  kidsCount: integer("kids_count").default(0),
  
  // Captures the compiled Irene responses or general CRM notes
  notes: text("notes"), 
  
  // Future-proofing for CRM task management
  nextActionTask: text("next_action_task"),
  nextActionDate: timestamp("next_action_date"),
  
  // Captures rich arrays (like the children list, voucher flags, irene_record_id)
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
  
  createdAt: timestamp("created_at")
    .default(sql`timezone('Africa/Johannesburg', now())`)
    .notNull(),
  updatedAt: timestamp("updated_at")
    .default(sql`timezone('Africa/Johannesburg', now())`)
    .notNull(),
});

export const radEvents = pgTable("rad_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  
  eventDate: timestamp("event_date"),
  startTime: text("start_time"),
  endTime: text("end_time"),
  
  locationType: text("location_type").default('in-person'), // 'online' or 'in-person'
  locationDetails: text("location_details"),
  coverImageUrl: text("cover_image_url"),
  
  status: text("status").default('draft'), // 'draft', 'published', 'completed'
  pricingConfig: jsonb("pricing_config").default(sql`'{}'::jsonb`),
  
  // JSON arrays for dynamic landing page content
  experienceCards: jsonb("experience_cards").default(sql`'[]'::jsonb`),
  checklist: jsonb("checklist").default(sql`'[]'::jsonb`),
  faqs: jsonb("faqs").default(sql`'[]'::jsonb`),
  
  createdAt: timestamp("created_at")
    .default(sql`timezone('Africa/Johannesburg', now())`)
    .notNull(),
  updatedAt: timestamp("updated_at")
    .default(sql`timezone('Africa/Johannesburg', now())`)
    .notNull(),
});