import { 
  users, type User, type InsertUser, 
  contents, type Content, type InsertContent,
  userActivities, type UserActivity, type InsertUserActivity
} from "@shared/schema";
import expressSession from "express-session";
import connectPgSimple from "connect-pg-simple";
import { db, pool } from "./db"; // Import pool from db.ts
import { eq, desc, inArray } from "drizzle-orm";

// Create a PostgreSQL session store with proper types for ESM
const PgSession = connectPgSimple(expressSession);

// Interface for storage operations
export interface IStorage {
  // User management operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  updateUserStatus(id: number, status: string): Promise<User | undefined>;
  
  // Content management operations
  createContent(content: InsertContent): Promise<Content>;
  getContent(id: number): Promise<Content | undefined>;
  getAllContents(): Promise<Content[]>;
  getContentsByAssignee(assigneeId: number): Promise<Content[]>;
  assignContentToUser(id: number, userId: number): Promise<Content | undefined>;
  completeProcessing(id: number, result: string, approverId: number): Promise<Content | undefined>;
  updateContent(id: number, content: Partial<InsertContent>): Promise<Content | undefined>;
  deleteContent(id: number): Promise<boolean>;
  updateAllContentStatuses(): Promise<number>; // Adds a method to update all content statuses
  
  // User activity tracking operations
  logUserActivity(activity: InsertUserActivity): Promise<UserActivity>;
  getUserActivities(userId?: number): Promise<UserActivity[]>;
  getRecentActivities(limit?: number): Promise<UserActivity[]>;
  
  sessionStore: any; // Using 'any' as a workaround for ESM compatibility
}

export class DatabaseStorage implements IStorage {
  sessionStore: any;

  constructor() {
    this.sessionStore = new PgSession({
      pool,
      createTableIfMissing: true, // Automatically create the session table if it doesn't exist
    });
  }
  
  // Update all content statuses based on categories
  async updateAllContentStatuses(): Promise<number> {
    // Get all contents
    const allContents = await db.select().from(contents);
    let updatedCount = 0;
    
    // Process each content and update status based on categories
    for (const content of allContents) {
      const hasCategories = content.categories && content.categories.trim() !== '';
      const newStatus = hasCategories ? 'completed' : 'pending';
      
      // Only update if status has changed
      if (content.status !== newStatus) {
        await db
          .update(contents)
          .set({ 
            status: newStatus,
            updatedAt: new Date()
          })
          .where(eq(contents.id, content.id));
        
        updatedCount++;
      }
    }
    
    return updatedCount;
  }

  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result.length > 0 ? result[0] : undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    // First try by username
    let result = await db.select().from(users).where(eq(users.username, username));
    
    // If not found, try by email
    if (result.length === 0) {
      result = await db.select().from(users).where(eq(users.email, username));
    }
    
    return result.length > 0 ? result[0] : undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined> {
    const result = await db
      .update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    
    return result.length > 0 ? result[0] : undefined;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async updateUserStatus(id: number, status: string): Promise<User | undefined> {
    const result = await db
      .update(users)
      .set({ status })
      .where(eq(users.id, id))
      .returning();
    
    return result.length > 0 ? result[0] : undefined;
  }

  // Content management implementations
  async createContent(insertContent: InsertContent): Promise<Content> {
    const result = await db.insert(contents).values(insertContent).returning();
    return result[0];
  }

  async getContent(id: number): Promise<(Content & { processor?: { username: string, name: string } }) | undefined> {
    const results = await db
      .select({
        content: contents,
        processor: {
          username: users.username,
          name: users.name
        }
      })
      .from(contents)
      .leftJoin(users, eq(contents.assigned_to_id, users.id))
      .where(eq(contents.id, id));
    
    if (results.length === 0) return undefined;
    
    // Format result to include processor as a nested object
    return {
      ...results[0].content,
      processor: results[0].processor || undefined
    };
  }

  async getAllContents(): Promise<(Content & { processor?: { username: string, name: string }, approver?: { username: string, name: string } })[]> {
    const results = await db
      .select({
        content: contents,
        processor: {
          username: users.username,
          name: users.name
        }
      })
      .from(contents)
      .leftJoin(users, eq(contents.assigned_to_id, users.id))
      .orderBy(desc(contents.createdAt));
    
    // Get approver information in a separate query to avoid column naming conflicts
    const contentIds = results.map(item => item.content.id);
    
    const approverInfo = contentIds.length > 0 
      ? await db
          .select({
            contentId: contents.id,
            approver: {
              username: users.username,
              name: users.name
            }
          })
          .from(contents)
          .leftJoin(users, eq(contents.approver_id, users.id))
          .where(inArray(contents.id, contentIds))
      : [];
    
    // Create a map of content IDs to approver info
    const approverMap = new Map(
      approverInfo.map(item => [item.contentId, item.approver])
    );
    
    // Format results to include processor and approver as nested objects
    return results.map(item => ({
      ...item.content,
      processor: item.processor || undefined,
      approver: approverMap.get(item.content.id) || undefined
    }));
  }

  async getContentsByAssignee(assigneeId: number): Promise<(Content & { processor?: { username: string, name: string } })[]> {
    const results = await db
      .select({
        content: contents,
        processor: {
          username: users.username,
          name: users.name
        }
      })
      .from(contents)
      .leftJoin(users, eq(contents.assigned_to_id, users.id))
      .where(eq(contents.assigned_to_id, assigneeId))
      .orderBy(desc(contents.createdAt));
    
    // Format results to include processor as a nested object
    return results.map(item => ({
      ...item.content,
      processor: item.processor || undefined
    }));
  }
  
  async assignContentToUser(id: number, userId: number): Promise<Content | undefined> {
    const result = await db
      .update(contents)
      .set({
        assigned_to_id: userId,
        assignedAt: new Date(),
        status: 'processing',
        updatedAt: new Date()
      })
      .where(eq(contents.id, id))
      .returning();
    
    return result.length > 0 ? result[0] : undefined;
  }
  
  async completeProcessing(id: number, result: string, approverId: number): Promise<Content | undefined> {
    const updateResult = await db
      .update(contents)
      .set({
        status: 'completed',
        processingResult: result,
        approver_id: approverId,
        approveTime: new Date(),
        updatedAt: new Date()
      })
      .where(eq(contents.id, id))
      .returning();
    
    return updateResult.length > 0 ? updateResult[0] : undefined;
  }

  async updateContent(id: number, contentUpdate: Partial<InsertContent>): Promise<Content | undefined> {
    const result = await db
      .update(contents)
      .set({
        ...contentUpdate,
        updatedAt: new Date(),
      })
      .where(eq(contents.id, id))
      .returning();
    
    return result.length > 0 ? result[0] : undefined;
  }

  async deleteContent(id: number): Promise<boolean> {
    const result = await db
      .delete(contents)
      .where(eq(contents.id, id))
      .returning({ id: contents.id });
    
    return result.length > 0;
  }

  // User activity tracking implementations
  async logUserActivity(activity: InsertUserActivity): Promise<UserActivity> {
    const result = await db.insert(userActivities).values(activity).returning();
    return result[0];
  }

  async getUserActivities(userId?: number): Promise<UserActivity[]> {
    if (userId) {
      return await db
        .select()
        .from(userActivities)
        .where(eq(userActivities.userId, userId))
        .orderBy(desc(userActivities.timestamp));
    } else {
      return await db
        .select()
        .from(userActivities)
        .orderBy(desc(userActivities.timestamp));
    }
  }

  async getRecentActivities(limit: number = 100): Promise<UserActivity[]> {
    return await db
      .select()
      .from(userActivities)
      .orderBy(desc(userActivities.timestamp))
      .limit(limit);
  }
}

export const storage = new DatabaseStorage();
