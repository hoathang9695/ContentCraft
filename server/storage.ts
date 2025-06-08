import { 
  users, type User, type InsertUser, 
  contents, type Content, type InsertContent,
  userActivities, type UserActivity, type InsertUserActivity,
  categories, type Category, type InsertCategory,
  labels, type Label, type InsertLabel,
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
  InsertLabel,
  Label,
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
  }): Promise<{
    data: (Content & { processor?: { username: string, name: string }, approver?: { username: string, name: string } })[];
    total: number;
    totalPages: number;
    currentPage: number;
    itemsPerPage: number;
  }> {
    const { userId, userRole, page, limit, statusFilter, sourceVerification, assignedUserId, startDate, endDate, searchQuery } = params;

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

    // Search query - handle both text and JSON source columns
    if (searchQuery) {
      const searchTerm = searchQuery.trim();
      const searchTermLower = searchTerm.toLowerCase();

      whereConditions.push(
        or(
          // Exact match for external ID
          eq(contents.externalId, searchTerm),
          // Partial match for external ID
          like(contents.externalId, `%${searchTerm}%`),
          // Search in categories and labels
          like(contents.categories, `%${searchTerm}%`),
          like(contents.labels, `%${searchTerm}%`),
          // Basic text search in source field (works for both text and JSON)
          sql`LOWER(${contents.source}::text) LIKE ${`%${searchTermLower}%`}`,
          // Try to extract 'name' from JSON if source is valid JSON
          sql`
            CASE 
              WHEN ${contents.source} ~ '^{.*}$' 
              THEN LOWER((${contents.source}::jsonb)->>'name') 
              ELSE LOWER(${contents.source}::text) 
            END LIKE ${`%${searchTermLower}%`}
          `,
          // Search in JSON source id field
          sql`
            CASE 
              WHEN ${contents.source} ~ '^{.*}$' 
              THEN (${contents.source}::jsonb)->>'id'
              ELSE NULL
            END = ${searchTerm}
          `,
          // Fuzzy search removing spaces
          sql`
            CASE 
              WHEN ${contents.source} ~ '^{.*}$' 
              THEN REPLACE(LOWER((${contents.source}::jsonb)->>'name'), ' ', '') 
              ELSE REPLACE(LOWER(${contents.source}::text), ' ', '') 
            END LIKE ${`%${searchTermLower.replace(/\s+/g, '')}%`}
          `
        )
      );
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

  // Fake User operations
  async getAllFakeUsers(): Promise<FakeUser[]> {
    return await db.select().from(fakeUsers).orderBy(fakeUsers.username);
  }

  async getFakeUser(id: number): Promise<FakeUser | undefined> {
    const result = await db.select().from(fakeUsers).where(eq(fakeUsers.id, id));
    return result.length > 0 ? result[0] : undefined;
  }

  async getFakeUserByToken(token: string): Promise<FakeUser | undefined> {
    const result = await db.select().from(fakeUsers).where(eq(fakeUsers.token, token));
    return result.length > 0 ? result[0] : undefined;
  }

  async getFakeUsersWithPagination(page: number, pageSize: number, search?: string): Promise<{
    users: FakeUser[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const offset = (page - 1) * pageSize;
    
    let whereCondition;
    if (search && search.trim()) {
      whereCondition = or(
        like(fakeUsers.username, `%${search}%`),
        like(fakeUsers.name, `%${search}%`),
        like(fakeUsers.email, `%${search}%`)
      );
    }

    // Get total count
    const totalResult = await db
      .select({ count: count() })
      .from(fakeUsers)
      .where(whereCondition);

    const total = totalResult[0]?.count || 0;

    // Get paginated users
    const users = await db
      .select()
      .from(fakeUsers)
      .where(whereCondition)
      .orderBy(fakeUsers.username)
      .limit(pageSize)
      .offset(offset);

    return {
      users,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  async createFakeUser(fakeUser: InsertFakeUser): Promise<FakeUser> {
    const result = await db.insert(fakeUsers).values(fakeUser).returning();
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
    const result = await db
      .select()
      .from(fakeUsers)
      .orderBy(sql`RANDOM()`)
      .limit(1);

    return result.length > 0 ? result[0] : undefined;
  }

  // Support request operations
  async createSupportRequest(request: InsertSupportRequest): Promise<SupportRequest> {
    const result = await db.insert(supportRequests).values(request).returning();
    return result[0];
  }

  async getSupportRequest(id: number): Promise<SupportRequest | undefined> {
    const result = await db.select().from(supportRequests).where(eq(supportRequests.id, id));
    return result.length > 0 ? result[0] : undefined;
  }

  async getAllSupportRequests(): Promise<SupportRequest[]> {
    return await db.select().from(supportRequests).orderBy(desc(supportRequests.createdAt));
  }

  async updateSupportRequest(id: number, request: Partial<InsertSupportRequest>): Promise<SupportRequest | undefined> {
    const result = await db
      .update(supportRequests)
      .set({
        ...request,
        updatedAt: new Date()
      })
      .where(eq(supportRequests.id, id))
      .returning();

    return result.length > 0 ? result[0] : undefined;
  }

  async deleteSupportRequest(id: number): Promise<boolean> {
    const result = await db
      .delete(supportRequests)
      .where(eq(supportRequests.id, id))
      .returning({ id: supportRequests.id });

    return result.length > 0;
  }

  async assignSupportRequest(id: number, userId: number): Promise<SupportRequest | undefined> {
    const result = await db
      .update(supportRequests)
      .set({
        assignedTo: userId,
        status: 'in_progress',
        updatedAt: new Date()
      })
      .where(eq(supportRequests.id, id))
      .returning();

    return result.length > 0 ? result[0] : undefined;
  }

  async completeSupportRequest(id: number, responseContent: string, responderId: number): Promise<SupportRequest | undefined> {
    const result = await db
      .update(supportRequests)
      .set({
        responseContent,
        responderId,
        status: 'completed',
        completedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(supportRequests.id, id))
      .returning();

    return result.length > 0 ? result[0] : undefined;
  }
}</old_str>