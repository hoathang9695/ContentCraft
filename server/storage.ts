import { 
  users, type User, type InsertUser, 
  contents, type Content, type InsertContent,
  userActivities, type UserActivity, type InsertUserActivity
} from "@shared/schema";
import expressSession from "express-session";
import connectPgSimple from "connect-pg-simple";
import { db, pool } from "./db"; // Import pool from db.ts
import { eq, desc } from "drizzle-orm";

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
  getContentsByAuthor(authorId: number): Promise<Content[]>;
  updateContent(id: number, content: Partial<InsertContent>): Promise<Content | undefined>;
  deleteContent(id: number): Promise<boolean>;
  
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

  async getContent(id: number): Promise<(Content & { author?: { username: string, name: string } }) | undefined> {
    const results = await db
      .select({
        content: contents,
        author: {
          username: users.username,
          name: users.name
        }
      })
      .from(contents)
      .leftJoin(users, eq(contents.authorId, users.id))
      .where(eq(contents.id, id));
    
    if (results.length === 0) return undefined;
    
    // Format result to include author as a nested object
    return {
      ...results[0].content,
      author: results[0].author || undefined
    };
  }

  async getAllContents(): Promise<(Content & { author?: { username: string, name: string } })[]> {
    const results = await db
      .select({
        content: contents,
        author: {
          username: users.username,
          name: users.name
        }
      })
      .from(contents)
      .leftJoin(users, eq(contents.authorId, users.id))
      .orderBy(desc(contents.createdAt));
    
    // Format results to include author as a nested object
    return results.map(item => ({
      ...item.content,
      author: item.author || undefined
    }));
  }

  async getContentsByAuthor(authorId: number): Promise<(Content & { author?: { username: string, name: string } })[]> {
    const results = await db
      .select({
        content: contents,
        author: {
          username: users.username,
          name: users.name
        }
      })
      .from(contents)
      .leftJoin(users, eq(contents.authorId, users.id))
      .where(eq(contents.authorId, authorId))
      .orderBy(desc(contents.createdAt));
    
    // Format results to include author as a nested object
    return results.map(item => ({
      ...item.content,
      author: item.author || undefined
    }));
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
