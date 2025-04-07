import { 
  users, type User, type InsertUser, 
  contents, type Content, type InsertContent,
  userActivities, type UserActivity, type InsertUserActivity,
  categories, type Category, type InsertCategory,
  labels, type Label, type InsertLabel,
  fakeUsers, type FakeUser, type InsertFakeUser
} from "@shared/schema";
import expressSession from "express-session";
import connectPgSimple from "connect-pg-simple";
import { db, pool } from "./db"; // Import pool from db.ts
import { eq, desc, inArray, and, ne } from "drizzle-orm";

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
  deleteUser(id: number): Promise<boolean>; // Add method to delete a user
  reassignUserContents(userId: number): Promise<number>; // Add method to reassign contents when deleting a user
  
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
  
  // Categories management operations
  getAllCategories(): Promise<Category[]>;
  getCategory(id: number): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: number): Promise<boolean>;
  
  // Labels management operations
  getAllLabels(): Promise<Label[]>;
  getLabelsByCategory(categoryId: number): Promise<Label[]>;
  getLabel(id: number): Promise<Label | undefined>;
  createLabel(label: InsertLabel): Promise<Label>;
  updateLabel(id: number, label: Partial<InsertLabel>): Promise<Label | undefined>;
  deleteLabel(id: number): Promise<boolean>;
  
  // Fake User operations
  getAllFakeUsers(): Promise<FakeUser[]>;
  getFakeUser(id: number): Promise<FakeUser | undefined>;
  getFakeUserByToken(token: string): Promise<FakeUser | undefined>; // Get fake user by token
  createFakeUser(fakeUser: InsertFakeUser): Promise<FakeUser>;
  updateFakeUser(id: number, fakeUser: Partial<InsertFakeUser>): Promise<FakeUser | undefined>;
  deleteFakeUser(id: number): Promise<boolean>;
  getRandomFakeUser(): Promise<FakeUser | undefined>; // Get a random fake user for comments
  
  sessionStore: any; // Using 'any' as a workaround for ESM compatibility
}

export class DatabaseStorage implements IStorage {
  sessionStore: any;

  constructor() {
    this.sessionStore = new PgSession({
      pool,
      tableName: 'session', // Specify table name explicitly
      createTableIfMissing: true, // Automatically create the session table if it doesn't exist
      pruneSessionInterval: 60, // Prune expired sessions every minute
    });
    
    // Log when session store is initialized
    console.log('PostgreSQL session store initialized');
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
  
  async deleteUser(id: number): Promise<boolean> {
    // First, reassign any content assigned to this user
    await this.reassignUserContents(id);
    
    // Delete user activities related to this user
    await db.delete(userActivities).where(eq(userActivities.userId, id));
    
    // Delete the user
    const result = await db
      .delete(users)
      .where(eq(users.id, id))
      .returning({ id: users.id });
    
    return result.length > 0;
  }
  
  async reassignUserContents(userId: number): Promise<number> {
    // Get the user to find their role and department
    const user = await this.getUser(userId);
    if (!user) return 0;
    
    // Get all contents assigned to this user
    const userContents = await db
      .select()
      .from(contents)
      .where(eq(contents.assigned_to_id, userId));
    
    if (userContents.length === 0) return 0;
    
    // Find suitable users to reassign content to - users with the same role and department
    const suitableUsers = await db
      .select()
      .from(users)
      .where(
        and(
          ne(users.id, userId), // Not the user being deleted
          eq(users.role, user.role), // Same role
          eq(users.status, 'active'), // Only active users
          user.department ? eq(users.department, user.department) : undefined // Same department if specified
        )
      );
    
    // If there are no suitable users, find any active users with the same role
    let reassignUsers = suitableUsers;
    if (reassignUsers.length === 0) {
      reassignUsers = await db
        .select()
        .from(users)
        .where(
          and(
            ne(users.id, userId), // Not the user being deleted
            eq(users.role, user.role), // Same role
            eq(users.status, 'active') // Only active users
          )
        );
    }
    
    // If there are still no suitable users, find any active user
    if (reassignUsers.length === 0) {
      reassignUsers = await db
        .select()
        .from(users)
        .where(
          and(
            ne(users.id, userId), // Not the user being deleted
            eq(users.status, 'active') // Only active users
          )
        );
    }
    
    // If there are no users to reassign to, just return 0
    if (reassignUsers.length === 0) return 0;
    
    // Start reassigning contents
    let reassignedCount = 0;
    
    for (const content of userContents) {
      // Round-robin assignment - get user index based on content position in list
      const assigneeIndex = reassignedCount % reassignUsers.length;
      const newAssigneeId = reassignUsers[assigneeIndex].id;
      
      // Update the content assignment
      await db
        .update(contents)
        .set({
          assigned_to_id: newAssigneeId,
          updatedAt: new Date()
        })
        .where(eq(contents.id, content.id));
      
      reassignedCount++;
    }
    
    return reassignedCount;
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

  async getContentsByAssignee(assigneeId: number): Promise<(Content & { processor?: { username: string, name: string }, approver?: { username: string, name: string } })[]> {
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

  // Categories management implementations
  async getAllCategories(): Promise<Category[]> {
    return await db.select().from(categories).orderBy(categories.name);
  }

  async getCategory(id: number): Promise<Category | undefined> {
    const result = await db.select().from(categories).where(eq(categories.id, id));
    return result.length > 0 ? result[0] : undefined;
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const result = await db.insert(categories).values(category).returning();
    return result[0];
  }

  async updateCategory(id: number, categoryUpdate: Partial<InsertCategory>): Promise<Category | undefined> {
    const result = await db
      .update(categories)
      .set({
        ...categoryUpdate,
        updatedAt: new Date(),
      })
      .where(eq(categories.id, id))
      .returning();
    
    return result.length > 0 ? result[0] : undefined;
  }

  async deleteCategory(id: number): Promise<boolean> {
    // Xóa labels trước (vì có khóa ngoại)
    await db.delete(labels).where(eq(labels.categoryId, id));
    
    // Sau đó xóa category
    const result = await db
      .delete(categories)
      .where(eq(categories.id, id))
      .returning({ id: categories.id });
    
    return result.length > 0;
  }

  // Labels management implementations
  async getAllLabels(): Promise<Label[]> {
    return await db.select().from(labels).orderBy(labels.name);
  }

  async getLabelsByCategory(categoryId: number): Promise<Label[]> {
    return await db
      .select()
      .from(labels)
      .where(eq(labels.categoryId, categoryId))
      .orderBy(labels.name);
  }

  async getLabel(id: number): Promise<Label | undefined> {
    const result = await db.select().from(labels).where(eq(labels.id, id));
    return result.length > 0 ? result[0] : undefined;
  }

  async createLabel(label: InsertLabel): Promise<Label> {
    const result = await db.insert(labels).values(label).returning();
    return result[0];
  }

  async updateLabel(id: number, labelUpdate: Partial<InsertLabel>): Promise<Label | undefined> {
    const result = await db
      .update(labels)
      .set({
        ...labelUpdate,
        updatedAt: new Date(),
      })
      .where(eq(labels.id, id))
      .returning();
    
    return result.length > 0 ? result[0] : undefined;
  }

  async deleteLabel(id: number): Promise<boolean> {
    const result = await db
      .delete(labels)
      .where(eq(labels.id, id))
      .returning({ id: labels.id });
    
    return result.length > 0;
  }

  // FakeUser management implementations
  async getAllFakeUsers(): Promise<FakeUser[]> {
    return await db.select().from(fakeUsers).orderBy(fakeUsers.name);
  }

  async getFakeUser(id: number): Promise<FakeUser | undefined> {
    const result = await db.select().from(fakeUsers).where(eq(fakeUsers.id, id));
    return result.length > 0 ? result[0] : undefined;
  }
  
  async getFakeUserByToken(token: string): Promise<FakeUser | undefined> {
    const result = await db.select().from(fakeUsers).where(eq(fakeUsers.token, token));
    return result.length > 0 ? result[0] : undefined;
  }

  async createFakeUser(insertFakeUser: InsertFakeUser): Promise<FakeUser> {
    const result = await db.insert(fakeUsers).values(insertFakeUser).returning();
    return result[0];
  }

  async updateFakeUser(id: number, fakeUserUpdate: Partial<InsertFakeUser>): Promise<FakeUser | undefined> {
    const result = await db
      .update(fakeUsers)
      .set({
        ...fakeUserUpdate,
        updatedAt: new Date(),
      })
      .where(eq(fakeUsers.id, id))
      .returning();
    
    return result.length > 0 ? result[0] : undefined;
  }

  async deleteFakeUser(id: number): Promise<boolean> {
    const result = await db
      .delete(fakeUsers)
      .where(eq(fakeUsers.id, id))
      .returning({ id: fakeUsers.id });
    
    return result.length > 0;
  }

  async getRandomFakeUser(): Promise<FakeUser | undefined> {
    // Lấy danh sách tất cả người dùng ảo đang hoạt động
    const activeFakeUsers = await db
      .select()
      .from(fakeUsers)
      .where(eq(fakeUsers.status, 'active'));
    
    if (activeFakeUsers.length === 0) return undefined;
    
    // Chọn ngẫu nhiên một người dùng ảo
    const randomIndex = Math.floor(Math.random() * activeFakeUsers.length);
    return activeFakeUsers[randomIndex];
  }
}

export const storage = new DatabaseStorage();
