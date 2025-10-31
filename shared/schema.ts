import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const videos = pgTable("videos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  videoPath: text("video_path").notNull(),
  source: text("source").notNull(),
  uploadedAt: timestamp("uploaded_at").notNull().default(sql`now()`),
});

export const insertVideoSchema = createInsertSchema(videos).omit({
  id: true,
  uploadedAt: true,
});

export type InsertVideo = z.infer<typeof insertVideoSchema>;
export type Video = typeof videos.$inferSelect;

export const videoCuts = pgTable("video_cuts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  videoId: varchar("video_id").notNull().references(() => videos.id, { onDelete: 'cascade' }),
  startTime: integer("start_time").notNull(),
  endTime: integer("end_time").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertVideoCutSchema = createInsertSchema(videoCuts).omit({
  id: true,
  createdAt: true,
});

export type InsertVideoCut = z.infer<typeof insertVideoCutSchema>;
export type VideoCut = typeof videoCuts.$inferSelect;

export const processedCuts = pgTable("processed_cuts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cutId: varchar("cut_id").notNull().references(() => videoCuts.id, { onDelete: 'cascade' }),
  format: text("format").notNull(),
  outputPath: text("output_path").notNull(),
  subtitles: text("subtitles"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertProcessedCutSchema = createInsertSchema(processedCuts).omit({
  id: true,
  createdAt: true,
});

export type InsertProcessedCut = z.infer<typeof insertProcessedCutSchema>;
export type ProcessedCut = typeof processedCuts.$inferSelect;
