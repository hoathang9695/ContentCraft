import { users, type User, type InsertUser, contents, type Content, type InsertContent } from "@shared/schema";
import expressSession from "express-session";
import pg from "pg";
import connectPgSimple from "connect-pg-simple";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

// Create a PostgreSQL connection pool
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

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
    const result = await db.select().from(users).where(eq(users.username, username));
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

  async getContent(id: number): Promise<Content | undefined> {
    const result = await db.select().from(contents).where(eq(contents.id, id));
    return result.length > 0 ? result[0] : undefined;
  }

  async getAllContents(): Promise<Content[]> {
    return await db.select().from(contents).orderBy(desc(contents.createdAt));
  }

  async getContentsByAuthor(authorId: number): Promise<Content[]> {
    return await db
      .select()
      .from(contents)
      .where(eq(contents.authorId, authorId))
      .orderBy(desc(contents.createdAt));
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
}

export const storage = new DatabaseStorage();
