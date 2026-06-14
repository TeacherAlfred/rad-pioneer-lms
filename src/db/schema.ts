import { pgTable, uuid, varchar, boolean, jsonb, timestamp, text, integer } from "drizzle-orm/pg-core";
import { sql, relations } from "drizzle-orm";

// -----------------------------------------------------------------------------
// SECURE CLIENT PORTALS
// -----------------------------------------------------------------------------

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
  
  createdAt: timestamp("created_at")
    .default(sql`timezone('Africa/Johannesburg', now())`)
    .notNull(),
  updatedAt: timestamp("updated_at")
    .default(sql`timezone('Africa/Johannesburg', now())`)
    .notNull(),
});

// -----------------------------------------------------------------------------
// PROJECT: IRENE COMRADES
// -----------------------------------------------------------------------------

export const projIreneResponses = pgTable("proj_irene_responses", {
  id: uuid("id").defaultRandom().primaryKey(),
  parentFirstName: text("parent_first_name").notNull(),
  cubInitial: text("cub_initial").notNull(),
  className: text("class_name").notNull(),
  grade: text("grade").notNull(),
  qWhyStart: text("q_why_start"),
  qBossLevel: text("q_boss_level"),
  qFunnyFail: text("q_funny_fail"),
  qWeirdHabit: text("q_weird_habit"),
  qShoes: integer("q_shoes"),
  mediaUrl: text("media_url"),
  isVerified: boolean("is_verified").default(false),
  
  createdAt: timestamp("created_at")
    .default(sql`timezone('Africa/Johannesburg', now())`)
    .notNull(),
});

export const projIreneVoters = pgTable("proj_irene_voters", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email"),
  whatsappNumber: text("whatsapp_number"),
  votesAwarded: integer("votes_awarded").default(1).notNull(),
  deviceId: text("device_id").notNull(), // Client-side tracking replacement for IP
  voterType: text("voter_type").default("anonymous").notNull(),
  
  // Expiration is calculated and passed down from the Server Action via JS Date
  expiresAt: timestamp("expires_at").notNull(),
  
  createdAt: timestamp("created_at")
    .default(sql`timezone('Africa/Johannesburg', now())`)
    .notNull(),
});

export const projIreneVotes = pgTable("proj_irene_votes", {
  id: uuid("id").defaultRandom().primaryKey(),
  voterId: uuid("voter_id").references(() => projIreneVoters.id, { onDelete: "cascade" }).notNull(),
  responseId: uuid("response_id").references(() => projIreneResponses.id, { onDelete: "cascade" }).notNull(),
  
  createdAt: timestamp("created_at")
    .default(sql`timezone('Africa/Johannesburg', now())`)
    .notNull(),
});

// -----------------------------------------------------------------------------
// DATABASE RELATIONS (For efficient querying)
// -----------------------------------------------------------------------------

export const projIreneResponsesRelations = relations(projIreneResponses, ({ many }) => ({
  votes: many(projIreneVotes),
}));

export const projIreneVotersRelations = relations(projIreneVoters, ({ many }) => ({
  votes: many(projIreneVotes),
}));

export const projIreneVotesRelations = relations(projIreneVotes, ({ one }) => ({
  voter: one(projIreneVoters, {
    fields: [projIreneVotes.voterId],
    references: [projIreneVoters.id],
  }),
  response: one(projIreneResponses, {
    fields: [projIreneVotes.responseId],
    references: [projIreneResponses.id],
  }),
}));