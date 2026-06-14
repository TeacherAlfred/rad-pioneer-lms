import { pgTable, uuid, varchar, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";

// Define the client portals table using pure TypeScript
export const clientPortals = pgTable("client_portals", {
  id: uuid("id").defaultRandom().primaryKey(),
  accessCode: varchar("access_code", { length: 20 }).notNull().unique(),
  clientName: varchar("client_name", { length: 100 }).notNull(),
  projectName: varchar("project_name", { length: 100 }).notNull(),
  brandColor: varchar("brand_color", { length: 50 }).default("bg-slate-800"),
  textColor: varchar("text_color", { length: 50 }).default("text-slate-800"),
  isLocked: boolean("is_locked").default(false),
  
  // Custom metadata tasks array configuration per executive
  tasksSchema: jsonb("tasks_schema").default([]).notNull(),
  
  // Active client form state content data 
  submittedData: jsonb("submitted_data").default({}).notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});