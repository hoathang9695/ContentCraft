import { 
  users, type User, type InsertUser, 
  contents, type Content, type InsertContent,
  userActivities, type UserActivity, type InsertUserActivity,
  categories, type Category, type InsertCategory,
  fakeUsers, type FakeUser, type InsertFakeUser,
  infringingContents, type InfringingContent, type InsertInfringingContent,
  commentQueues
} from "@shared/schema";
import expressSession from "express-session";
import connectPgSimple from "connect-pg-simple";
import { db, pool } from "./db"; // Import pool from db.ts
import { eq, and, or, desc, like, ilike, gte, lte, isNull, ne, count, sql, inArray } from "drizzle-orm";
import type {
  User,
  Content,
  InsertContent,
  InsertUser,
  InsertCategory,
  Category,
  InsertFakeUser,
  FakeUser,
  InsertSupportRequest,
  SupportRequest,
  InsertPage,
  Page,
  InsertGroup,
  Group,
  InsertSMTPConfig,
  SMTPConfig,
} from "@shared/schema";

// Create a PostgreSQL session store with proper types for ESM
const PgSession = connectPgSimple(expressSession);

// Interface for storage operations
export interface IStorage {
  // Support request operations
  createSupportRequest(request: InsertSupportRequest): Promise<SupportRequest>;
  getSupportRequest(id: number): Promise<SupportRequest | undefined>;
  getAllSupportRequests(): Promise<SupportRequest[]>;
  updateSupportRequest(id: number, request: Partial<InsertSupportRequest>): Promise<SupportRequest | undefined>;
  deleteSupportRequest(id: number): Promise<boolean>;
  assignSupportRequest(id: number, userId: number): Promise<SupportRequest | undefined>;
  completeSupportRequest(id: number, responseContent: string, responderId: number): Promise<SupportRequest | undefined>;
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
  getAllContents(): Promise<(Content & { processor?: { username: string, name: string }, approver?: { username: string, name: string } })[]>;
  getContentsByAssignee(assigneeId: number): Promise<(Content & { processor?: { username: string, name: string }, approver?: { username: string, name: string } })[]>;
  getPaginatedContents(params: {
    userId: number;
    userRole: string;
    page: number;
    limit: number;
    statusFilter?: string;
    sourceVerification?: 'verified' | 'unverified';
    assignedUserId?: number | null;
    startDate?: Date | null;
    endDate?: Date | null;
    searchQuery?: string;
    sourceClassification?: 'new' | 'potential' | 'non_potential' | 'positive' | 'all';
  }): Promise<{
    data: (Content & { processor?: { username: string, name: string }, approver?: { username: string, name: string } })[];
    total: number;
    totalPages: number;
    currentPage: number;
    itemsPerPage: number;
  }>;
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



  // Fake User operations
  getAllFakeUsers(): Promise<FakeUser[]>;
  getFakeUser(id: number): Promise<FakeUser | undefined>;
  getFakeUserByToken(token: string): Promise<FakeUser | undefined>; // Get fake user by token
  getFakeUsersWithPagination(page: number, pageSize: number, search?: string): Promise<{
    users: FakeUser[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>;
  createFakeUser(fakeUser: InsertFakeUser): Promise<FakeUser>;
  updateFakeUser(id: number, fakeUser: Partial<InsertFakeUser>): Promise<FakeUser | undefined>;
  deleteFakeUser(id: number): Promise<boolean>;
  getRandomFakeUser(): Promise<FakeUser | undefined>; // Get a random fake user for comments
  // Infringing Content methods
  getPaginatedInfringingContents({
    userId,
    userRole,
    page,
    limit,
    startDate,
    endDate,
    searchQuery
  }: {
    userId: number;
    userRole: string;
    page?: number;
    limit?: number;
    startDate?: Date | null;
    endDate?: Date | null;
    searchQuery?: string;
  }): Promise<{
    data: any[];
    total: number;
    totalPages: number;
    currentPage: number;
    itemsPerPage: number;
    dataLength: number;
  }>;
  getInfringingContent(id: number): Promise<any>;
  createInfringingContent(data: any): Promise<any>;
  updateInfringingContent(id: number, data: Partial<any>): Promise<any>;
  deleteInfringingContent(id: number): Promise<boolean>;

  sessionStore: any; // Using 'any' as a workaround for ESM compatibility
}

export class DatabaseStorage implements IStorage {
  // Add db property
  private db: any;

  constructor() {
    this.db = db; // Assign the imported db instance
    this.sessionStore = new PgSession({
      pool,
      tableName: 'session', // Specify table name explicitly
      createTableIfMissing: true, // Automatically create the session table if it doesn't exist
      pruneSessionInterval: 60, // Prune expired sessions every minute
    });

    // Log when session store is initialized
    console.log('PostgreSQL session store initialized');
  }
  // Infringing Content methods
  async getPaginatedInfringingContents({
    userId,
    userRole,
    page = 1,
    limit = 10,
    startDate,
    endDate,
    searchQuery
  }: {
    userId: number;
    userRole: string;
    page?: number;
    limit?: number;
    startDate?: Date | null;
    endDate?: Date | null;
    searchQuery?: string;
  }) {
    try {
      const offset = (page - 1) * limit;

      // Build where conditions
      const conditions = [];

      // Role-based filtering
      if (userRole !== "admin") {
        conditions.push(eq(infringingContents.assigned_to_id, userId));
      }

      // Date range filtering
      if (startDate) {
        conditions.push(gte(infringingContents.created_at, startDate));
      }
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        conditions.push(lte(infringingContents.created_at, endOfDay));
      }

      // Search filtering
      if (searchQuery && searchQuery.trim()) {
        conditions.push(
          or(
            ilike(infringingContents.externalId, `%${searchQuery}%`),
            ilike(infringingContents.violation_description, `%${searchQuery}%`)
          )
        );
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Get total count
      const totalResult = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(infringingContents)
        .where(whereClause);

      const total = Number(totalResult[0]?.count || 0);

      // Get paginated data with processor info
      const data = await this.db
        .select({
          id: infringingContents.id,
          externalId: infringingContents.externalId,
          assigned_to_id: infringingContents.assigned_to_id,
          processing_time: infringingContents.processing_time,
          violation_description: infringingContents.violation_description,
          status: infringingContents.status,
          created_at: infringingContents.created_at,
          updated_at: infringingContents.updated_at,
          processor: {
            username: users.username,
            name: users.name,
          },
        })
        .from(infringingContents)
        .leftJoin(users, eq(infringingContents.assigned_to_id, users.id))
        .where(whereClause)
        .orderBy(desc(infringingContents.created_at))
        .limit(limit)
        .offset(offset);

      const totalPages = Math.ceil(total / limit);

      return {
        data,
        total,
        totalPages,
        currentPage: page,
        itemsPerPage: limit,
        dataLength: data.length,
      };
    } catch (error) {
      console.error("Error in getPaginatedInfringingContents:", error);
      throw error;
    }
  }

  async getInfringingContent(id: number) {
    try {
      const result = await this.db
        .select({
          id: infringingContents.id,
          externalId: infringingContents.externalId,
          assigned_to_id: infringingContents.assigned_to_id,
          processing_time: infringingContents.processing_time,
          violation_description: infringingContents.violation_description,
          status: infringingContents.status,
          created_at: infringingContents.created_at,
          updated_at: infringingContents.updated_at,
          processor: {
            username: users.username,
            name: users.name,
          },
        })
        .from(infringingContents)
        .leftJoin(users, eq(infringingContents.assigned_to_id, users.id))
        .where(eq(infringingContents.id, id))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      console.error("Error getting infringing content:", error);
      return null;
    }
  }

  async createInfringingContent(data: InsertInfringingContent) {
    try {
      const result = await this.db
        .insert(infringingContents)
        .values({
          ...data,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning();

      return result[0];
    } catch (error) {
      console.error("Error creating infringing content:", error);
      throw error;
    }
  }

  async updateInfringingContent(id: number, data: Partial<InsertInfringingContent>) {
    try {
      const result = await this.db
        .update(infringingContents)
        .set({
          ...data,
          updated_at: new Date(),
        })
        .where(eq(infringingContents.id, id))
        .returning();

      return result[0] || null;
    } catch (error) {
      console.error("Error updating infringing content:", error);
      throw error;
    }
  }

  async deleteInfringingContent(id: number): Promise<boolean> {
    try {
      const result = await this.db
        .delete(infringingContents)
        .where(eq(infringingContents.id, id));

      return result.rowCount! > 0;
    } catch (error) {
      console.error("Error deleting infringing content:", error);
      return false;
    }
  }
  sessionStore: any;

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
    console.log("Fetching all contents from database...");
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
    console.log('Storage: Updating content', { id, contentUpdate });

    try {
      const result = await db
        .update(contents)
        .set({
          ...contentUpdate,
          updatedAt: new Date()
        })
        .where(eq(contents.id, id))
        .returning();

      console.log('Storage: Update result', result);
      return result.length > 0 ? result[0] : undefined;
    } catch (error) {
      console.error('Storage: Error updating content:', error);
      throw error;
    }
  }

  async deleteContent(id: number): Promise<boolean> {
    const result = await db
      .delete(contents)
      .where(eq(contents.id, id))
      .returning({ id: contents.id });

    return result.length > 0;
  }

  // Paginated content implementation
  async getPaginatedContents(params: {
    userId: number;
    userRole: string;
    page: number;
    limit: number;
    statusFilter?: string;
    sourceVerification?: 'verified' | 'unverified';
    assignedUserId?: number | null;
    startDate?: Date | null;
    endDate?: Date | null;
    searchQuery?: string;
    sourceClassification?: 'new' | 'potential' | 'non_potential' | 'positive' | 'all';
  }): Promise<{
    data: (Content & { processor?: { username: string, name: string }, approver?: { username: string, name: string } })[];
    total: number;
    totalPages: number;
    currentPage: number;
    itemsPerPage: number;
  }> {
    const {
      userId,
      userRole,
      page,
      limit,
      statusFilter,
      sourceVerification,
      assignedUserId,
      startDate,
      endDate,
      searchQuery,
      sourceClassification = 'all',
    } = params;

    // Build where conditions
    let whereConditions: any[] = [];

    // Role-based filtering
    if (userRole !== 'admin') {
      whereConditions.push(eq(contents.assigned_to_id, userId));
    } else if (assignedUserId) {
      whereConditions.push(eq(contents.assigned_to_id, assignedUserId));
    }

    // Status filter
    if (statusFilter) {
      whereConditions.push(eq(contents.status, statusFilter));
    }

    // Source verification filter
    if (sourceVerification) {
      whereConditions.push(eq(contents.sourceVerification, sourceVerification));
    }

    // Date range filter
    if (startDate) {
      whereConditions.push(gte(contents.createdAt, startDate));
    }
    if (endDate) {
      whereConditions.push(lte(contents.createdAt, endDate));
    }

    // Search query - only search in External ID and Source
    if (searchQuery) {
      const searchTerm = searchQuery.trim();

      whereConditions.push(
        or(
          // Exact match for external ID
          eq(contents.externalId, searchTerm),
          // Partial match for external ID
          like(contents.externalId, `%${searchTerm}%`),
          // Search in source field (text search)
          like(contents.source, `%${searchTerm}%`)
        )
      );
    }

    // Source classification filter
    if (sourceClassification && sourceClassification !== 'all') {
      whereConditions.push(eq(contents.sourceClassification, sourceClassification));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    // Get total count
    const countResult = await db
      .select({ count: count() })
      .from(contents)
      .where(whereClause);

    const total = countResult[0]?.count || 0;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;

    // Get paginated data
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
      .where(whereClause)
      .orderBy(desc(contents.createdAt))
      .limit(limit)
      .offset(offset);

    // Get approver information
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

    // Format results
    const data = results.map(item => ({
      ...item.content,
      processor: item.processor || undefined,
      approver: approverMap.get(item.content.id) || undefined
    }));

    return {
      data,
      total,
      totalPages,
      currentPage: page,
      itemsPerPage: limit
    };
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
    try {
      console.log(`Starting delete category ${id}`);

      // Directly delete category
      const result = await db
        .delete(categories)
        .where(eq(categories.id, id))
        .returning();

      console.log(`Delete category result:`, result);
      return result.length > 0;
    } catch (error) {
      console.error(`Error deleting category ${id}:`, error);
      throw error;
    }
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

    // Comment Queue methods
  async createCommentQueue(data: {
    externalId: string;
    comments: string[];
    selectedGender: string;
    userId: number;
  }): Promise<any> {
    console.log('🚀 Storage.createCommentQueue called with:', data);

    if (!data.externalId || !data.comments || !Array.isArray(data.comments)) {
      throw new Error('externalId and comments array are required');
    }

    // Generate session ID
    const sessionId = `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Use raw SQL to insert
    const query = `
      INSERT INTO comment_queues (
        session_id, external_id, comments, selected_gender, user_id, 
        total_comments, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING *
      `;

    const values = [
      sessionId,
      data.externalId,
      JSON.stringify(data.comments),
      data.selectedGender || 'all',
      data.userId,
      data.comments.length,
      'pending'
    ];

    console.log('✅ Executing query...');
    console.log('Query:', query);
    console.log('Values:', values);

    try {
      const result = await pool.query(query, values);

      if (!result || result.rows.length === 0) {
        throw new Error('Failed to insert comment queue entry - no rows returned');
      }

      console.log('✅ Comment queue created successfully:', result.rows[0]);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error in createCommentQueue:', error);

      if (error && typeof error === 'object') {
        console.error('❌ Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          name: error instanceof Error ? error.name : undefined,
          code: (error as any).code || undefined,
          detail: (error as any).detail || undefined,
          constraint: (error as any).constraint || undefined,
          stack: error instanceof Error ? error.stack : 'No stack trace'
        });
      }

      throw error;
    }
  }

  async getActiveCommentQueueForExternal(externalId: string) {
    const result = await pool.query(`
      SELECT * FROM comment_queues 
      WHERE external_id = $1 AND status IN ('pending', 'processing')
      ORDER BY created_at DESC
      LIMIT 1
    `, [externalId]);

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async getCommentQueue(sessionId: string) {
    const result = await pool.query(
      'SELECT * FROM comment_queues WHERE session_id = $1',
      [sessionId]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async getPendingCommentQueues() {
    const result = await pool.query(`
      SELECT * FROM comment_queues 
      WHERE status = 'pending'
      ORDER BY created_at ASC
    `);

    return result.rows;
  }

  async addCommentsToQueue(sessionId: string, newComments: string[]) {
    console.log('🔧 Adding comments to existing queue:', sessionId);
    console.log('🔧 New comments count:', newComments.length);

    // Get current queue
    const currentQueue = await this.getCommentQueue(sessionId);
    if (!currentQueue) {
      throw new Error('Queue not found');
    }

    console.log('🔧 Current queue status:', currentQueue.status);
    console.log('🔧 Current total comments:', currentQueue.total_comments);

    // Parse existing comments
    const existingComments = Array.isArray(currentQueue.comments) 
      ? currentQueue.comments 
      : JSON.parse(currentQueue.comments);

    console.log('🔧 Existing comments count:', existingComments.length);

    // Merge comments
    const allComments = [...existingComments, ...newComments];

    console.log('🔧 Total comments after merge:', allComments.length);

    // Update queue
    const result = await pool.query(`
      UPDATE comment_queues 
      SET comments = $1, total_comments = $2, updated_at = NOW()
      WHERE session_id = $3
      RETURNING *
    `, [JSON.stringify(allComments), allComments.length, sessionId]);

    if (!result || result.rows.length === 0) {
      throw new Error('Failed to update queue with new comments');
    }

    console.log('✅ Queue updated successfully with new comments');
    return result.rows[0];
  }

  async getQueueCount(): Promise<number> {
    try {
      const result = await pool.query(`
        SELECT COUNT(*) as total,
               SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
               SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
               SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
               SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
        FROM comment_queues
      `);

      const stats = result.rows[0];
      console.log(`📊 Queue stats: Total(${stats.total}) = Pending(${stats.pending}) + Processing(${stats.processing}) + Completed(${stats.completed}) + Failed(${stats.failed})`);

      return parseInt(stats.total);
    } catch (error) {
      console.error('❌ Error getting queue count:', error);
      return 0;
    }
  }

  async cleanupOldQueues(hoursOld: number = 24): Promise<number> {
    const timestamp = new Date().toISOString();
    console.log(`🧹 [${timestamp}] Starting cleanup: queues older than ${hoursOld} hours...`);

    try {
      // First, get total queue statistics
      const totalStats = await pool.query(`
        SELECT 
          COUNT(*) as total_queues,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_queues,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_queues,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_queues,
          COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_queues
        FROM comment_queues
      `);

      console.log(`📊 Current queue stats:`, totalStats.rows[0]);

      // Check what queues exist and which ones should be deleted
      const checkResult = await pool.query(`
        SELECT session_id, status, completed_at, 
               EXTRACT(EPOCH FROM (NOW() - completed_at))/3600 as hours_old,
               (completed_at < NOW() - INTERVAL '${hoursOld} hours') as should_delete
        FROM comment_queues 
        WHERE status IN ('completed', 'failed') 
        AND completed_at IS NOT NULL
        ORDER BY completed_at DESC
        LIMIT 20
      `);

      const shouldDeleteCount = checkResult.rows.filter(row => row.should_delete).length;
      console.log(`🔍 Found ${checkResult.rows.length} completed/failed queues, ${shouldDeleteCount} eligible for deletion`);

      if (checkResult.rows.length > 0) {
        console.log(`📝 Sample queues (showing first 5):`);
        checkResult.rows.slice(0, 5).forEach(row => {
          console.log(`  - ${row.session_id}: ${row.status}, ${Math.round(row.hours_old * 10) / 10}h old, ${row.should_delete ? '🗑️ WILL DELETE' : '✅ KEEP'}`);
        });

        if (checkResult.rows.length > 5) {
          console.log(`  ... and ${checkResult.rows.length - 5} more queues`);
        }
      }

      // Delete queues older than specified hours 
      const result = await pool.query(`
        DELETE FROM comment_queues 
        WHERE status IN ('completed', 'failed') 
        AND completed_at IS NOT NULL
        AND completed_at < NOW() - INTERVAL '${hoursOld} hours'
        RETURNING session_id, status, completed_at
      `);

      const deletedCount = result.rows.length;
      const endTimestamp = new Date().toISOString();

      if (deletedCount > 0) {
        console.log(`🧹✅ [${endTimestamp}] Successfully cleaned up ${deletedCount} old queues`);
        console.log(`🗑️ Deleted queues:`, 
          result.rows.slice(0, 10).map(row => ({
            session_id: row.session_id,
            status: row.status,
            completed_at: row.completed_at
          }))
        );
        if (result.rows.length > 10) {
          console.log(`  ... and ${result.rows.length - 10} more deleted queues`);
        }
      } else {
        console.log(`🧹 [${endTimestamp}] No queues found older than ${hoursOld} hours for cleanup`);
      }

      // Log final stats after cleanup
      const finalStats = await pool.query(`
        SELECT COUNT(*) as remaining_total,
               COUNT(CASE WHEN status IN ('completed', 'failed') THEN 1 END) as remaining_completed_failed
        FROM comment_queues
      `);

      console.log(`📊 After cleanup: ${finalStats.rows[0].remaining_total} total queues, ${finalStats.rows[0].remaining_completed_failed} completed/failed remaining`);

      return deletedCount;
    } catch (error) {
      console.error('❌ Error cleaning up old queues:', error);
      console.error('❌ Full error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      return 0;
    }
  }

  async updateCommentQueueProgress(sessionId: string, updates: {
    status?: string;
    processedCount?: number;
    successCount?: number;
    failureCount?: number;
    currentCommentIndex?: number;
    errorInfo?: string;
  }) {
    console.log(`📝 [${sessionId}] Updating queue progress:`, updates);

    const updateFields = [];
    const values = [];
    let paramCount = 1;

    if (updates.status !== undefined) {
      updateFields.push(`status = $${paramCount}`);
      values.push(updates.status);
      paramCount++;
    }

    if (updates.processedCount !== undefined) {
      updateFields.push(`processed_count = $${paramCount}`);
      values.push(updates.processedCount);
      paramCount++;
    }

    if (updates.successCount !== undefined) {
      updateFields.push(`success_count = $${paramCount}`);
      values.push(updates.successCount);
      paramCount++;
    }

    if (updates.failureCount !== undefined) {
      updateFields.push(`failure_count = $${paramCount}`);
      values.push(updates.failureCount);
      paramCount++;
    }

    if (updates.currentCommentIndex !== undefined) {
      updateFields.push(`current_comment_index = $${paramCount}`);
      values.push(updates.currentCommentIndex);
      paramCount++;
    }

    if (updates.errorInfo !== undefined) {
      updateFields.push(`error_info = $${paramCount}`);
      values.push(updates.errorInfo);
      paramCount++;
    }

    // Always update the updated_at timestamp
    updateFields.push(`updated_at = NOW()`);

    // Set completed_at if status is completed or failed
    if (updates.status === 'completed' || updates.status === 'failed') {
      updateFields.push(`completed_at = NOW()`);
    }

    values.push(sessionId);

    const query = `
      UPDATE comment_queues 
      SET ${updateFields.join(', ')}
      WHERE session_id = $${paramCount}
      RETURNING *
    `;

    try {
      const result = await pool.query(query, values);

      if (result.rows.length === 0) {
        console.error(`❌ [${sessionId}] Queue not found for update`);
        throw new Error(`Queue ${sessionId} not found`);
      }

      const updatedQueue = result.rows[0];

      // Validate data consistency after update
      const actualProcessed = (updatedQueue.success_count || 0) + (updatedQueue.failure_count || 0);
      if (updatedQueue.status === 'completed' && actualProcessed !== updatedQueue.total_comments) {
        console.error(`❌ [${sessionId}] INCONSISTENCY DETECTED: status=completed but actualProcessed(${actualProcessed}) != totalComments(${updatedQueue.total_comments})`);

        // Auto-fix by setting status to failed
        await pool.query(`
          UPDATE comment_queues 
          SET status = 'failed', 
              error_info = CONCAT(COALESCE(error_info, ''), '; Auto-fixed inconsistent completion state at ', NOW()),
              updated_at = NOW()
          WHERE session_id = $1
        `, [sessionId]);

        throw new Error(`Inconsistent queue state detected and auto-fixed for ${sessionId}`);
      }

      console.log(`✅ [${sessionId}] Queue progress updated: status=${updatedQueue.status}, processed=${updatedQueue.processed_count}/${updatedQueue.total_comments}, success=${updatedQueue.success_count}, failed=${updatedQueue.failure_count}`);

      return updatedQueue;
    } catch (error) {
      console.error(`❌ [${sessionId}] Error updating queue progress:`, error);
      throw error;
    }
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
async getFakeUsersWithPagination(page: number, pageSize: number, search: string = ''): Promise<{
    users: FakeUser[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    console.log("Storage: getFakeUsersWithPagination called with:", { page, pageSize, search });

    const offset = (page - 1) * pageSize;

    // Build search conditions
    const searchConditions = [];
    if (search && search.trim()) {
      const searchPattern = `%${search.toLowerCase()}%`;
      searchConditions.push(
        or(
          ilike(fakeUsers.name, searchPattern),
          ilike(fakeUsers.token, searchPattern),
          ilike(fakeUsers.description, searchPattern)
        )
      );
    }

    const whereClause = searchConditions.length > 0 ? and(...searchConditions) : undefined;

    try {
      // Get total count
      const countResult = await db
        .select({ count: count() })
        .from(fakeUsers)
        .where(whereClause);

      const total = Number(countResult[0]?.count || 0);
      const totalPages = Math.ceil(total / pageSize);

      console.log("Storage: Total fake users found:", total);

      // Get paginated data
      const results = await db
        .select()
        .from(fakeUsers)
        .where(whereClause)
        .orderBy(fakeUsers.name)
        .limit(pageSize)
        .offset(offset);

      console.log("Storage: Returning", results.length, "fake users for page", page);

      return {
        users: results,
        total,
        page,
        pageSize,
        totalPages
      };
    } catch (error) {
      console.error("Storage: Error in getFakeUsersWithPagination:", error);
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();