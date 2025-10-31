import { 
  videos, 
  videoCuts, 
  processedCuts,
  type Video, 
  type InsertVideo, 
  type VideoCut,
  type InsertVideoCut,
  type ProcessedCut,
  type InsertProcessedCut
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  createVideo(video: InsertVideo): Promise<Video>;
  getVideo(id: string): Promise<Video | undefined>;
  getAllVideos(): Promise<Video[]>;
  
  createVideoCut(cut: InsertVideoCut): Promise<VideoCut>;
  getVideoCut(id: string): Promise<VideoCut | undefined>;
  getVideoCutsByVideoId(videoId: string): Promise<VideoCut[]>;
  updateVideoCut(id: string, updates: Partial<InsertVideoCut>): Promise<VideoCut>;
  
  createProcessedCut(cut: InsertProcessedCut): Promise<ProcessedCut>;
  getProcessedCut(id: string): Promise<ProcessedCut | undefined>;
  getProcessedCutsByCutId(cutId: string): Promise<ProcessedCut[]>;
}

export class DatabaseStorage implements IStorage {
  async createVideo(insertVideo: InsertVideo): Promise<Video> {
    const [video] = await db
      .insert(videos)
      .values(insertVideo)
      .returning();
    return video;
  }

  async getVideo(id: string): Promise<Video | undefined> {
    const [video] = await db.select().from(videos).where(eq(videos.id, id));
    return video || undefined;
  }

  async getAllVideos(): Promise<Video[]> {
    return await db.select().from(videos).orderBy(desc(videos.uploadedAt));
  }

  async createVideoCut(insertCut: InsertVideoCut): Promise<VideoCut> {
    const [cut] = await db
      .insert(videoCuts)
      .values(insertCut)
      .returning();
    return cut;
  }

  async getVideoCut(id: string): Promise<VideoCut | undefined> {
    const [cut] = await db.select().from(videoCuts).where(eq(videoCuts.id, id));
    return cut || undefined;
  }

  async getVideoCutsByVideoId(videoId: string): Promise<VideoCut[]> {
    return await db
      .select()
      .from(videoCuts)
      .where(eq(videoCuts.videoId, videoId))
      .orderBy(videoCuts.startTime);
  }

  async updateVideoCut(id: string, updates: Partial<InsertVideoCut>): Promise<VideoCut> {
    const [updatedCut] = await db
      .update(videoCuts)
      .set(updates)
      .where(eq(videoCuts.id, id))
      .returning();
    return updatedCut;
  }

  async createProcessedCut(insertProcessedCut: InsertProcessedCut): Promise<ProcessedCut> {
    const [processed] = await db
      .insert(processedCuts)
      .values(insertProcessedCut)
      .returning();
    return processed;
  }

  async getProcessedCut(id: string): Promise<ProcessedCut | undefined> {
    const [processed] = await db.select().from(processedCuts).where(eq(processedCuts.id, id));
    return processed || undefined;
  }

  async getProcessedCutsByCutId(cutId: string): Promise<ProcessedCut[]> {
    return await db
      .select()
      .from(processedCuts)
      .where(eq(processedCuts.cutId, cutId))
      .orderBy(desc(processedCuts.createdAt));
  }
}

export const storage = new DatabaseStorage();
