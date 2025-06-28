import { Kafka, Consumer, EachMessagePayload } from "kafkajs";
import { db } from "./db";
import { users, supportRequests, contents, realUsers, pages, groups, reportManagement } from "../shared/schema";
import { eq, ne, and, sql } from "drizzle-orm";
import { log } from "./vite";

let consumer: Consumer;
let isShuttingDown = false;

const KAFKA_CONFIG = {
  RETRY_INITIAL_TIME: 5000,
  RETRY_MAX_TIME: 300000,
  RETRY_FACTOR: 1.2,
  MAX_RETRIES: 30,
  CONNECTION_TIMEOUT: 120000,
  AUTH_TIMEOUT: 60000,
  HEALTH_CHECK_INTERVAL: 30000,
  BATCH_SIZE: 5,
  RECONNECT_TIMEOUT: 5000,
  MONITOR_INTERVAL: 60000, // Monitor metrics mỗi phút
  MESSAGE_TIMEOUT: 30000 // Timeout xử lý message
};

// Monitoring metrics
let metrics = {
  processedMessages: 0,
  failedMessages: 0,
  lastProcessingTime: 0,
  avgProcessingTime: 0
};

interface ContactMessage {
  full_name: string;
  email: string;
  subject: string;
  content: string;
  created_at?: string;
}

interface RealUsersMessage {
  fullName: string;
  email: string;
  id: string;
  verified: string;
}

interface PageMessage {
  pageId: string;
  pageName: string;
  pageType: 'business' | 'community' | 'personal';
  managerId?: string | number;
  adminName?: string;
  phoneNumber?: string | null;
  monetizationEnabled?: boolean;
}

export interface ContentMessage {
  externalId: string;
  source?: string;
  sourceVerification?: "verified" | "unverified";
  categories?: string[];
  labels?: string[];
}

export interface SupportMessage {
  full_name: string;
  email: string;
  subject: string;
  content: string;
}

export interface GroupMessage {
  groupId: string;
  groupName: string;
  groupType: "public" | "private";
  categories?: string;
  adminId?: string;
  adminName?: string;
  phoneNumber?: string | null;
  monetizationEnabled?: boolean;
}

export interface VerificationMessage {
  id: string;
  full_name: string;
  email: string;
  subject?: string;
  type: 'verify';
  verification_name?: string;
  phone_number?: string;
  detailed_description?: string;
  attachment_url?: string | string[];
  identity_verification_id?: number;
}

export interface TickMessage {
  id: string;
  full_name: string;
  email: string;
  subject?: string;
  type: 'tick';
  phone_number?: string;
  detailed_description?: string;
  attachment_url?: string | string[];
}

export interface ReportMessage {
  reportId: string;
  reportType: 'user' | 'content' | 'page' | 'group' | 'comment' | 'course' | 'project' | 'video' | 'song' | 'event';
  reporterName: {
    id: string;
    name: string;
  } | string;
  reporterEmail: string;
  reason: string;
  detailedReason?: string;
}

async function reconnectConsumer(kafka: Kafka, consumer: Consumer) {
  try {
    await consumer.disconnect();
    await new Promise(resolve => setTimeout(resolve, KAFKA_CONFIG.RECONNECT_TIMEOUT));
    await consumer.connect();
    logger.kafkaEvent("reconnected", undefined, undefined, undefined, { 
      reconnect_timeout: KAFKA_CONFIG.RECONNECT_TIMEOUT 
    });

    // Resubscribe to topics after reconnect
    // Ensure all required topics are explicitly defined
    const requiredTopics = ["content_management", "real_users", "contact-messages", "page_management", "groups_management", "report_management"];
    const configuredTopics = process.env.KAFKA_TOPICS?.split(",") || [];
    const topics = [...new Set([...requiredTopics, ...configuredTopics])];

    for (const topic of topics) {
      try {
        await consumer.subscribe({ topic, fromBeginning: false }); // Set fromBeginning false to avoid processing old messages
        logger.kafkaEvent("resubscribed", topic);
      } catch (error) {
        log(`Failed to resubscribe to topic ${topic}: ${error}`, "kafka-error");
      }
    }
  } catch (error) {
    log(`Failed to reconnect: ${error}`, "kafka-error");
    throw error;
  }
}

async function initializeHealthCheck(kafka: Kafka, consumer: Consumer) {
  setInterval(async () => {
    if (isShuttingDown) return;

    try {
      const health = await kafka.admin().listTopics();
      log(`Health check - Connected to topics: ${health.join(", ")}`, "kafka");
    } catch (error) {
      log(`Health check failed: ${error}`, "kafka-error");
      await reconnectConsumer(kafka, consumer);
    }
  }, KAFKA_CONFIG.HEALTH_CHECK_INTERVAL);
}

async function processMessageWithRetry(message: any, process: Function, maxRetries = 3) {
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      await process(message);
      return true;
    } catch (error) {
      retryCount++;
      log(`Processing error (attempt ${retryCount}/${maxRetries}): ${error}`, "kafka-error");

      if (retryCount === maxRetries) {
        await sendToDeadLetterQueue(message);
        return false;
      }

      const delay = Math.min(
        KAFKA_CONFIG.RETRY_INITIAL_TIME * Math.pow(KAFKA_CONFIG.RETRY_FACTOR, retryCount - 1),
        KAFKA_CONFIG.RETRY_MAX_TIME
      );
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  return false;
}

export async function setupKafkaConsumer() {
  if (process.env.KAFKA_ENABLED !== "true") {
    log("Kafka is not enabled", "kafka");
    return;
  }

  try {
    const sasl = process.env.KAFKA_SASL === "true" ? {
      mechanism: process.env.KAFKA_SASL_MECHANISMS as "PLAIN",
      username: process.env.KAFKA_SASL_USERNAME || "",
      password: process.env.KAFKA_SASL_PASSWORD || "",
    } : undefined;

    // Ensure broker list is not empty and valid
    const brokers = process.env.KAFKA_BROKERS?.split(",").filter(broker => broker.trim()) || [];
    if (!brokers.length) {
      throw new Error("No Kafka brokers configured");
    }
    log(`Initializing Kafka connection to brokers: ${brokers.join(", ")}`, "kafka");

    const kafka = new Kafka({
      clientId: "content-processing-service",
      brokers,
      ssl: false,
      sasl,
      connectionTimeout: 30000, // Reduce timeout
      authenticationTimeout: 20000,
      retry: {
        initialRetryTime: 1000,
        retries: 5, // Reduce retries to fail fast
        maxRetryTime: 30000,
        factor: 1.5,
      },
      logLevel: 4,
      allowAutoTopicCreation: true // Enable auto topic creation
    });

    consumer = kafka.consumer({
      groupId: process.env.KAFKA_GROUP_ID || "emso-processor",
      maxWaitTimeInMs: 5000,
      sessionTimeout: 30000,
    });

    await consumer.connect();
    log("Connected to Kafka", "kafka");

    // Ensure all required topics are explicitly defined
    const requiredTopics = ["content_management", "real_users", "contact-messages", "page_management", "groups_management", "report_management"];
    const configuredTopics = process.env.KAFKA_TOPICS?.split(",") || [];
    const topics = [...new Set([...requiredTopics, ...configuredTopics])];

    for (const topic of topics) {
      await consumer.subscribe({ topic, fromBeginning: false });
      log(`Subscribed to topic: ${topic}`, "kafka");
    }

    await initializeHealthCheck(kafka, consumer);

    await consumer.run({
      autoCommit: false,
      eachBatchAutoResolve: true,
      eachBatch: async ({ batch, resolveOffset, heartbeat, isRunning, isStale }) => {
        const messages = batch.messages;
        const messageChunks = [];

        for (let i = 0; i < messages.length; i += KAFKA_CONFIG.BATCH_SIZE) {
          messageChunks.push(messages.slice(i, i + KAFKA_CONFIG.BATCH_SIZE));
        }

        for (const chunk of messageChunks) {
          if (!isRunning() || isStale() || isShuttingDown) break;

          await Promise.all(chunk.map(async (message) => {
            try {
              const parsedMessage = parseMessage(message.value);
              if (!parsedMessage) {
                log(`Invalid message format: ${message.value}`, "kafka-error");
                resolveOffset(message.offset);
                return;
              }

              const success = await processMessageWithRetry(
                parsedMessage,
                async (msg: ContentMessage | SupportMessage | ContactMessage | RealUsersMessage | PageMessage | GroupMessage | VerificationMessage) => {
                  const startTime = Date.now();
                  try {
                    await db.transaction(async (tx) => {
                      if ("externalId" in msg) {
                        log(`🔄 Processing content message: ${JSON.stringify(msg)}`, "kafka");
                        await processContentMessage(msg as ContentMessage, tx);
                      } else if ("id" in msg && "full_name" in msg && "email" in msg && "type" in msg && (msg as any).type === 'tick') {
                        log(`🔄 Processing tick message: ${JSON.stringify(msg)}`, "kafka");
                        await processTickMessage(msg as TickMessage, tx);
                      } else if ("id" in msg && "full_name" in msg && "email" in msg && "type" in msg && (msg as any).type === 'verify') {
                        log(`🔄 Processing verification message: ${JSON.stringify(msg)}`, "kafka");
                        await processVerificationMessage(msg as VerificationMessage, tx);
                      } else if ("id" in msg && "full_name" in msg && "email" in msg && "type" in msg && (msg as any).type === 'feedback') {
                        log(`🔄 Processing feedback message: ${JSON.stringify(msg)}`, "kafka");
                        await processFeedbackMessage(msg as FeedbackMessage, tx);
                      } else if ("full_name" in msg && "email" in msg && "subject" in msg && "content" in msg) {
                        log(`🔄 Processing contact/support message: ${JSON.stringify(msg)}`, "kafka");
                        await processSupportMessage(msg as SupportMessage, tx);
                      } else if ("name" in msg && "message" in msg) {
                        await processContactMessage(msg as ContactMessage, tx);
                      } else if ("id" in msg && "fullName" in msg && "email" in msg && "verified" in msg) {
                        // Handle real user message from Kafka
                        const now = new Date();

                        // Get active users for round-robin assignment
                        const activeUsers = await tx
                          .select()
                          .from(users)
                          .where(eq(users.status, "active"));

                        if (!activeUsers || activeUsers.length === 0) {
                          throw new Error("No active users found for assignment");
                        }

                        // Get last assigned REAL USER for round-robin (specific to realUsers table)
                        const lastAssignedRealUser = await tx.query.realUsers.findFirst({
                          orderBy: (realUsers, { desc }) => [desc(realUsers.createdAt)]
                        });

                        // Calculate next assignee index based on realUsers table
                        let nextAssigneeIndex = 0;
                        if (lastAssignedRealUser && lastAssignedRealUser.assignedToId) {
                          const lastAssigneeIndex = activeUsers.findIndex(
                            user => user.id === lastAssignedRealUser.assignedToId
                          );
                          if (lastAssigneeIndex !== -1) {
                            nextAssigneeIndex = (lastAssigneeIndex + 1) % activeUsers.length;
                          }
                        }

                        const assignedToId = activeUsers[nextAssigneeIndex].id;

                        try {
                          // Validate required fields
                          if (!msg.id || !msg.fullName || !msg.email || !msg.verified) {
                            throw new Error(`Invalid message format: ${JSON.stringify(msg)}`);
                          }

                          // Check if user already exists to avoid duplicates
                          const existingUser = await tx
                            .select()
                            .from(realUsers)
                            .where(eq(realUsers.email, msg.email))
                            .limit(1);

                          if (existingUser.length > 0) {
                            log(`User with email ${msg.email} already exists, skipping...`, "kafka");
                            return existingUser[0];
                          }

                          // Validate assigned user is still active
                          const assignedUser = await tx
                            .select()
                            .from(users)
                            .where(eq(users.id, assignedToId))
                            .limit(1);

                          if (!assignedUser.length || assignedUser[0].status !== 'active') {
                            throw new Error(`Assigned user ${assignedToId} is not active`);
                          }

                          // Insert new real user with proper format
                          const result = await tx.insert(realUsers).values({
                            fullName: {
                              id: msg.id.toString(), // Ensure ID is handled as string without number conversion
                              name: msg.fullName
                            },
                            email: msg.email,
                            verified: msg.verified,
                            classification: 'new', // Default classification
                            lastLogin: now,
                            createdAt: now,
                            updatedAt: now,
                            assignedToId: assignedToId
                          }).returning();

                          log(`Successfully inserted real user: ${JSON.stringify(result[0])}`, "kafka");
                          metrics.processedMessages++;
                          return result[0];
                        } catch (error) {
                          log(`Error processing real user: ${error}`, "kafka-error");
                          metrics.failedMessages++;
                          throw error; // Re-throw to trigger transaction rollback
                        }
                      } else if ("pageId" in msg && "pageName" in msg && "pageType" in msg) {
                        // Handle page message from Kafka
                        const pageMsg = msg as PageMessage;
                        const now = new Date();

                        log(`🔄 Processing page message: ${JSON.stringify(pageMsg)}`, "kafka");

                        try {
                          // Validate required fields first
                          if (!pageMsg.pageId || !pageMsg.pageName || !pageMsg.pageType) {
                            const error = `❌ Invalid page message format - missing required fields: ${JSON.stringify(pageMsg)}`;
                            log(error, "kafka-error");
                            throw new Error(error);
                          }

                          // Validate pageType enum
                          if (!['business', 'community', 'personal'].includes(pageMsg.pageType)) {
                            const error = `❌ Invalid pageType: ${pageMsg.pageType}`;
                            log(error, "kafka-error");
                            throw new Error(error);
                          }

                          // Check if page already exists to avoid duplicates
                          log(`🔍 Checking for existing page with ID: ${pageMsg.pageId}`, "kafka");
                          const existingPage = await tx
                            .select()
                            .from(pages)
                            .where(eq(sql`${pages.pageName}::jsonb->>'id'`, pageMsg.pageId))
                            .limit(1);

                          if (existingPage.length > 0) {
                            log(`⚠️ Page with ID ${pageMsg.pageId} already exists (DB ID: ${existingPage[0].id}), skipping...`, "kafka");
                            return existingPage[0];
                          }

                          // Get active users for round-robin assignment (exclude admin)
                          const activeUsers = await tx
                            .select()
                            .from(users)
                            .where(and(eq(users.status, "active"), ne(users.role, "admin")));

                          if (!activeUsers || activeUsers.length === 0) {
                            const error = "❌ No active non-admin users found for assignment";
                            log(error, "kafka-error");
                            throw new Error(error);
                          }

                          log(`👥 Found ${activeUsers.length} active non-admin users`, "kafka");

                          // Get last assigned PAGE for round-robin (specific to pages table)
                          const lastAssignedPage = await tx.query.pages.findFirst({
                            orderBy: (pages, { desc }) => [desc(pages.createdAt)]
                          });

                          // Calculate next assignee index based on pages table
                          let nextAssigneeIndex = 0;
                          if (lastAssignedPage && lastAssignedPage.assignedToId) {
                            const lastAssigneeIndex = activeUsers.findIndex(
                              user => user.id === lastAssignedPage.assignedToId
                            );
                            if (lastAssigneeIndex !== -1) {
                              nextAssigneeIndex = (lastAssigneeIndex + 1) % activeUsers.length;
                            }
                          }

                          const assignedToId = activeUsers[nextAssigneeIndex].id;
                          const assignedUser = activeUsers[nextAssigneeIndex];

                          log(`👤 Assigning to user: ${assignedUser.name} (ID: ${assignedToId})`, "kafka");

                          // Double-check assigned user is still active
                          const userCheck = await tx
                            .select()
                            .from(users)
                            .where(eq(users.id, assignedToId))
                            .limit(1);

                          if (!userCheck.length || userCheck[0].status !== 'active') {
                            const error = `❌ Assigned user ${assignedToId} is not active or not found`;
                            log(error, "kafka-error");
                            throw new Error(error);
                          }

                          // Safely handle managerId conversion
                          let managerIdStr = null;
                          if (pageMsg.managerId !== null && pageMsg.managerId !== undefined) {
                            managerIdStr = String(pageMsg.managerId);
                            log(`🔧 Converted managerId to string: ${managerIdStr}`, "kafka");
                          }

                          // Prepare insert data
                          const insertData = {
                            pageName: {
                              id: pageMsg.pageId,
                              page_name: pageMsg.pageName
                            },
                            pageType: pageMsg.pageType,
                            classification: 'new',
                            adminData: managerIdStr && pageMsg.adminName ? {
                              id: managerIdStr,
                              admin_name: pageMsg.adminName
                            } : null,
                            phoneNumber: pageMsg.phoneNumber || null,
                            monetizationEnabled: pageMsg.monetizationEnabled || false,
                            assignedToId: assignedToId,
                            createdAt: now,
                            updatedAt: now
                          };

                          log(`📝 Inserting page data: ${JSON.stringify(insertData, null, 2)}`, "kafka");

                          // Insert new page with proper error handling
                          const result = await tx.insert(pages).values(insertData).returning();

                          if (!result || result.length === 0) {
                            const error = "❌ Failed to insert page - no result returned";
                            log(error, "kafka-error");
                            throw new Error(error);
                          }

                          log(`✅ Successfully inserted page: ID ${result[0].id}, PageID: ${pageMsg.pageId}, AssignedTo: ${assignedUser.name}`, "kafka");
                          metrics.processedMessages++;
                          return result[0];

                        } catch (error) {
                          const errorMsg = error instanceof Error ? error.message : String(error);
                          const errorStack = error instanceof Error ? error.stack : '';
                          log(`❌ Error processing page ${pageMsg.pageId}: ${errorMsg}`, "kafka-error");
                          log(`📍 Error stack: ${errorStack}`, "kafka-error");

                          // Log additional context for debugging
                          log(`🔍 Page data that failed: ${JSON.stringify(pageMsg, null, 2)}`, "kafka-error");

                          metrics.failedMessages++;
                          throw error; // Re-throw to trigger transaction rollback
                        }
                      } else if ("groupId" in msg && "groupName" in msg && "groupType" in msg) {
                        // Handle group message from Kafka
                        const groupMsg = msg as GroupMessage;
                        const now = new Date();

                        log(`🔄 Processing group message: ${JSON.stringify(groupMsg)}`, "kafka");

                        try {
                          // Validate required fields first
                          if (!groupMsg.groupId || !groupMsg.groupName || !groupMsg.groupType) {
                            const error = `❌ Invalid group message format - missing required fields: ${JSON.stringify(groupMsg)}`;
                            log(error, "kafka-error");
                            throw new Error(error);
                          }

                          // Validate groupType enum
                          if (!['public', 'private'].includes(groupMsg.groupType)) {
                            const error = `❌ Invalid groupType: ${groupMsg.groupType}`;
                            log(error, "kafka-error");
                            throw new Error(error);
                          }

                          // Check if group already exists to avoid duplicates
                          log(`🔍 Checking for existing group with ID: ${groupMsg.groupId}`, "kafka");
                          const existingGroup = await tx
                            .select()
                            .from(groups)
                            .where(eq(sql`${groups.groupName}::jsonb->>'id'`, groupMsg.groupId))
                            .limit(1);

                          if (existingGroup.length > 0) {
                            log(`⚠️ Group with ID ${groupMsg.groupId} already exists (DB ID: ${existingGroup[0].id}), skipping...`, "kafka");
                            return existingGroup[0];
                          }

                          // Get active users for round-robin assignment (exclude admin)
                          const activeUsers = await tx
                            .select()
                            .from(users)
                            .where(and(eq(users.status, "active"), ne(users.role, "admin")));

                          if (!activeUsers || activeUsers.length === 0) {
                            const error = "❌ No active non-admin users found for assignment";
                            log(error, "kafka-error");
                            throw new Error(error);
                          }

                          log(`👥 Found ${activeUsers.length} active non-admin users`, "kafka");

                          // Get last assigned GROUP for round-robin (specific to groups table)
                          const lastAssignedGroup = await tx.query.groups.findFirst({
                            orderBy: (groups, { desc }) => [desc(groups.createdAt)]
                          });

                          // Calculate next assignee index based on groups table
                          let nextAssigneeIndex = 0;
                          if (lastAssignedGroup && lastAssignedGroup.assignedToId) {
                            const lastAssigneeIndex = activeUsers.findIndex(
                              user => user.id === lastAssignedGroup.assignedToId
                            );
                            if (lastAssigneeIndex !== -1) {
                              nextAssigneeIndex = (lastAssigneeIndex + 1) % activeUsers.length;
                            }
                          }

                          const assignedToId = activeUsers[nextAssigneeIndex].id;
                          const assignedUser = activeUsers[nextAssigneeIndex];

                          log(`👤 Assigning to user: ${assignedUser.name} (ID: ${assignedToId})`, "kafka");

                          // Double-check assigned user is still active
                          const userCheck = await tx
                            .select()
                            .from(users)
                            .where(eq(users.id, assignedToId))
                            .limit(1);

                          if (!userCheck.length || userCheck[0].status !== 'active') {
                            const error = `❌ Assigned user ${assignedToId} is not active or not found`;
                            log(error, "kafka-error");
                            throw new Error(error);
                          }

                          // Prepare insert data
                          const insertData = {
                            groupName: {
                              id: groupMsg.groupId,
                              group_name: groupMsg.groupName
                            },
                            groupType: groupMsg.groupType,
                            categories: groupMsg.categories || null,
                            classification: 'new',
                            adminData: groupMsg.adminId && groupMsg.adminName ? {
                              id: groupMsg.adminId,
                              admin_name: groupMsg.adminName
                            } : null,
                            phoneNumber: groupMsg.phoneNumber || null,
                            monetizationEnabled: groupMsg.monetizationEnabled || false,
                            assignedToId: assignedToId,
                            createdAt: now,
                            updatedAt: now
                          };

                          log(`📝 Inserting group data: ${JSON.stringify(insertData, null, 2)}`, "kafka");

                          // Insert new group with proper error handling
                          const result = await tx.insert(groups).values(insertData).returning();

                          if (!result || result.length === 0) {
                            const error = "❌ Failed to insert group - no result returned";
                            log(error, "kafka-error");
                            throw new Error(error);
                          }

                          log(`✅ Successfully inserted group: ID ${result[0].id}, GroupID: ${groupMsg.groupId}, AssignedTo: ${assignedUser.name}`, "kafka");
                          metrics.processedMessages++;
                          return result[0];

                        } catch (error) {
                          const errorMsg = error instanceof Error ? error.message : String(error);
                          const errorStack = error instanceof Error ? error.stack : '';
                          log(`❌ Error processing group ${groupMsg.groupId}: ${errorMsg}`, "kafka-error");
                          log(`📍 Error stack: ${errorStack}`, "kafka-error");

                          // Log additional context for debugging
                          log(`🔍 Group data that failed: ${JSON.stringify(groupMsg, null, 2)}`, "kafka-error");

                          metrics.failedMessages++;
                          throw error; // Re-throw to trigger transaction rollback
                        }
                      } else if ("reportId" in msg && "reportType" in msg && "reporterName" in msg && "reporterEmail" in msg) {
                        // Handle report message from Kafka
                        const reportMsg = msg as ReportMessage;
                        const now = new Date();

                        log(`🔄 Processing report message: ${JSON.stringify(reportMsg)}`, "kafka");

                        try {
                          // Validate required fields
                          if (!reportMsg.reportId || !reportMsg.reportType || !reportMsg.reporterName || !reportMsg.reporterEmail || !reportMsg.reason) {
                            const error = `❌ Invalid report message format - missing required fields: ${JSON.stringify(reportMsg)}`;
                            log(error, "kafka-error");
                            throw new Error(error);
                          }

                          // Validate report type (expanded list)
                          const validReportTypes = ['user', 'content', 'page', 'group', 'comment', 'course', 'project', 'video', 'song', 'event'];
                          if (!validReportTypes.includes(reportMsg.reportType)) {
                            const error = `❌ Invalid reportType: ${reportMsg.reportType}`;
                            log(error, "kafka-error");
                            throw new Error(error);
                          }

                          // Get active users for round-robin assignment (exclude admin)
                          const activeUsers = await tx
                            .select()
                            .from(users)
                            .where(and(eq(users.status, "active"), ne(users.role, "admin")));

                          if (!activeUsers || activeUsers.length === 0) {
                            const error = "❌ No active non-admin users found for assignment";
                            log(error, "kafka-error");
                            throw new Error(error);
                          }

                          log(`👥 Found ${activeUsers.length} active non-admin users`, "kafka");

                          // Get last assigned REPORT for round-robin (specific to reportManagement table)
                          const lastAssignedReport = await tx.query.reportManagement.findFirst({
                            orderBy: (reportManagement, { desc }) => [desc(reportManagement.createdAt)]
                          });

                          // Calculate next assignee index based on reports table
                          let nextAssigneeIndex = 0;
                          if (lastAssignedReport && lastAssignedReport.assignedToId) {
                            const lastAssigneeIndex = activeUsers.findIndex(
                              user => user.id === lastAssignedReport.assignedToId
                            );
                            if (lastAssigneeIndex !== -1) {
                              nextAssigneeIndex = (lastAssigneeIndex + 1) % activeUsers.length;
                            }
                          }

                          const assignedToId = activeUsers[nextAssigneeIndex].id;
                          const assignedUser = activeUsers[nextAssigneeIndex];

                          log(`👤 Assigned to user: ${assignedUser.name} (ID: ${assignedToId})`, "kafka");

                          // Use reporterName as provided from Kafka message
                          const reporterNameObj = reportMsg.reporterName;

                          // Prepare insert data
                          const insertData = {
                            reportedId: {
                              id: reportMsg.reportId
                            },
                            reportType: reportMsg.reportType,
                            reporterName: reporterNameObj,
                            reporterEmail: reportMsg.reporterEmail,
                            reason: reportMsg.reason,
                            detailedReason: reportMsg.detailedReason || null,
                            status: 'pending',
                            assignedToId: assignedToId,
                            assignedToName: assignedUser.name,
                            assignedAt: now,
                            createdAt: now,
                            updatedAt: now
                          };

                          log(`📝 Inserting report data: ${JSON.stringify(insertData, null, 2)}`, "kafka");

                          // Insert new report
                          const result = await tx.insert(reportManagement).values(insertData).returning();

                          if (!result || result.length === 0) {
                            const error = "❌ Failed to insert report - no result returned";
                            log(error, "kafka-error");
                            throw new Error(error);
                          }

                          log(`✅ Successfully inserted report: ID ${result[0].id}, ReportID: ${reportMsg.reportId}, AssignedTo: ${assignedUser.name}`, "kafka");
                          metrics.processedMessages++;
                          return result[0];

                        } catch (error) {
                          const errorMsg = error instanceof Error ? error.message : String(error);
                          const errorStack = error instanceof Error ? error.stack : '';
                          log(`❌ Error processing report ${reportMsg.reportId}: ${errorMsg}`, "kafka-error");
                          log(`📍 Error stack: ${errorStack}`, "kafka-error");

                          // Log additional context for debugging
                          log(`🔍 Report data that failed: ${JSON.stringify(reportMsg, null, 2)}`, "kafka-error");

                          metrics.failedMessages++;
                          throw error; // Re-throw to trigger transaction rollback
                        }
                      }
                    }, { isolationLevel: 'serializable' });
                    metrics.processedMessages++;
                  } catch (e) {
                    metrics.failedMessages++;
                    throw e;
                  } finally {
                    const processingTime = Date.now() - startTime;
                    metrics.lastProcessingTime = processingTime;
                    metrics.avgProcessingTime = (metrics.avgProcessingTime * (metrics.processedMessages + metrics.failedMessages -1) + processingTime) / (metrics.processedMessages + metrics.failedMessages);
                  }
                }
              );

              if (success) {
                resolveOffset(message.offset);
                await heartbeat();
              }
            } catch (error) {
              log(`Fatal error processing message: ${error}`, "kafka-error");
              await sendToDeadLetterQueue(message);
              resolveOffset(message.offset);
            }
          }));
        }
      },
    });

    // Setup monitoring interval
    setInterval(() => {
      log(`Metrics: ${JSON.stringify(metrics)}`, "kafka-monitor");
    }, KAFKA_CONFIG.MONITOR_INTERVAL);

    return consumer;
  } catch (error) {
    log(`Error setting up Kafka consumer: ${error}`, "kafka-error");
    throw error;
  }
}

async function sendToDeadLetterQueue(message: any) {
  try {
    // Log failed message for manual review
    log(`Message sent to DLQ: ${JSON.stringify(message)}`, "kafka-error");
    // Here you could implement actual DLQ logic
  } catch (error) {
    log(`Error sending to DLQ: ${error}`, "kafka-error");
  }
}

export interface FeedbackMessage {
  id: string;
  full_name: string;
  email: string;
  subject: string;
  type: 'feedback';
  feedback_type?: 'bug_report' | 'feature_request' | 'complaint' | 'suggestion' | 'other';
  feature_type?: string;
  detailed_description?: string;
  attachment_url?: string | string[];
  content?: string;
}

function parseMessage(
  messageValue: Buffer | null,
): ContentMessage | SupportMessage | FeedbackMessage | ContactMessage | RealUsersMessage | PageMessage | GroupMessage | VerificationMessage | TickMessage | ReportMessage {
  if (!messageValue) return null;

  try {
    const value = messageValue.toString();
    const message = JSON.parse(value);

    // Check for report message (has reportId, reportType, reporterName, reporterEmail, reason)
    if ("reportId" in message && "reportType" in message && "reporterName" in message && "reporterEmail" in message && "reason" in message) {
      return message as ReportMessage;
    }
    // Check for tick message first (has type: 'tick' and id)
    else if ("id" in message && "full_name" in message && "email" in message && "type" in message && message.type === 'tick') {
      return message as TickMessage;
    }
    // Check for feedback message (has type: 'feedback' and id)
    else if ("id" in message && "full_name" in message && "email" in message && "type" in message && message.type === 'feedback') {
      return message as FeedbackMessage;
    }
    // Check for support/contact message (has full_name, email, subject, content)
    else if ("full_name" in message && "email" in message && "subject" in message && "content" in message) {
      return message as SupportMessage;
    } else if ("externalId" in message){
      return message as ContentMessage;
    } else if ("fullName" in message && "id" in message&& "email" in message&& "verified" in message) {
      return message as RealUsersMessage; 
    } else if ("pageId" in message && "pageName" in message && "pageType" in message) {
      return message as PageMessage;
    } else if ("groupId" in message && "groupName" in message && "groupType" in message) {
      return message as GroupMessage;
    } else if ("id" in message && "full_name" in message && "email" in message && "type" in message && message.type === 'verify') {
      return message as VerificationMessage;
    }

    return null;
  } catch (error) {
    log(`Error parsing message: ${error}`, "kafka-error");
    return null;
  }
}

export async function processContentMessage(contentMessage: ContentMessage, tx: any) {
  try {
    log(
      `Processing content message: ${JSON.stringify(contentMessage)}`,
      "kafka",
    );

    // Check if content with this external_id already exists
    try {
      const existingContent = await tx
        .select()
        .from(contents)
        .where(eq(contents.externalId, contentMessage.externalId))
        .limit(1);

      if (existingContent.length > 0) {
        log(`Content with external_id ${contentMessage.externalId} already exists, skipping...`, "kafka");
        return existingContent[0];
      }
    } catch (error) {
      log(`Error checking existing content: ${error}`, "kafka-error");
      throw error;
    }

    const activeUsers = await tx
      .select()
      .from(users)
      .where(eq(users.status, "active"));
    log(`Found ${activeUsers.length} active users`, "kafka");

    if (!activeUsers || activeUsers.length === 0) {
      log("No active users found to assign request.", "kafka");
      return;
    }

    // Use round-robin based on CONTENT table specifically
    const lastAssignedContent = await tx.query.contents.findFirst({
      orderBy: (contents, { desc }) => [desc(contents.assignedAt)],
    });

    let nextAssigneeIndex = 0;
    if (lastAssignedContent && lastAssignedContent.assigned_to_id) {
      const lastAssigneeIndex = activeUsers.findIndex(
        (user) => user.id === lastAssignedContent.assigned_to_id,
      );
      if (lastAssigneeIndex !== -1) {
        nextAssigneeIndex = (lastAssigneeIndex + 1) % activeUsers.length;
      }
    }

    const assigned_to_id = activeUsers[nextAssigneeIndex].id;
    const now = new Date();

    // Auto-assign source classification based on source type and ID
      let sourceClassification = "new"; // default value

      try {
        if (contentMessage.source?.type && contentMessage.source?.id) {
          if (contentMessage.source.type.toLowerCase() === 'account') {
            // Check real_users table
            const userResult = await tx
              .select({ classification: realUsers.classification })
              .from(realUsers)
              .where(sql`full_name::json->>'id' = ${contentMessage.source.id.toString()}`)
              .limit(1);

            if (userResult.length > 0 && userResult[0].classification) {
              sourceClassification = userResult[0].classification;
            }
          } else if (contentMessage.source.type.toLowerCase() === 'page') {
            // Check pages table
            const pageResult = await tx
              .select({ classification: pages.classification })
              .from(pages)
              .where(sql`page_name::json->>'id' = ${contentMessage.source.id.toString()}`)
              .limit(1);

            if (pageResult.length > 0 && pageResult[0].classification) {
              sourceClassification = pageResult[0].classification;
            }
          } else if (contentMessage.source.type.toLowerCase() === 'group') {
            // Check groups table
            const groupResult = await tx
              .select({ classification: groups.classification })
              .from(groups)
              .where(sql`group_name::json->>'id' = ${contentMessage.source.id.toString()}`)
              .limit(1);

            if (groupResult.length > 0 && groupResult[0].classification) {
              sourceClassification = groupResult[0].classification;
            }
          }
        }
      } catch (error) {
        console.error("Error getting source classification:", error);
        // Keep default "new" value
      }

      console.log(`📝 Creating content with source_classification: ${sourceClassification} for source: ${contentMessage.source?.type} - ${contentMessage.source?.id}`);

    const insertData = {
      externalId: contentMessage.externalId,
      source: contentMessage.source || null,
      categories: contentMessage.categories || null,
      labels: contentMessage.labels || null,
      status: "pending",
      sourceVerification: contentMessage.sourceVerification || "unverified",
      assigned_to_id: assigned_to_id,
      assignedAt: now,
      createdAt: now,
      updatedAt: now,
      sourceClassification: sourceClassification,
    };

    const newContent = await tx.insert(contents).values(insertData).returning();
    log(`New content created with ID ${newContent[0].id}`, "kafka");
    log(
      `Content request created and assigned to user ID ${assigned_to_id}`,
      "kafka",
    );

    return newContent[0];
  } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : '';
      log(`Error processing content message: ${errorMessage}`, "kafka-error");
      log(`Error stack: ${errorStack}`, "kafka-error");
      metrics.failedMessages++;
      throw error;
    }
}

async function processSupportMessage(message: SupportMessage, tx: any) {
  try {
    // Validate required fields
    if (
      !message.full_name ||
      !message.email ||
      !message.subject ||
      !message.content
    ) {
      log(`Invalid support message: ${JSON.stringify(message)}`, "kafka-error");
      return;
    }

    // Check for duplicate support request based on content only
    const existingRequest = await tx
      .select()
      .from(supportRequests)
      .where(eq(supportRequests.content, message.content))
      .limit(1);

    if (existingRequest.length > 0) {
      log(`Support request with same content already exists, skipping...`, "kafka");
      return existingRequest[0];
    }

    log(`Processing support message: ${JSON.stringify(message)}`, "kafka");

    // Get active users
    const activeUsers = await tx
      .select()
      .from(users)
      .where(eq(users.status, "active"));

    if (!activeUsers || activeUsers.length === 0) {
      log("No active users found to assign request.", "kafka");
      return;
    }
    log(`Found ${activeUsers.length} active users for assignment`, "kafka");

    // Find last assigned SUPPORT REQUEST for round-robin (specific to type='support')
    const lastAssignedSupportRequest = await tx.query.supportRequests.findFirst({
      where: eq(supportRequests.type, 'support'),
      orderBy: (supportRequests, { desc }) => [
        desc(supportRequests.assigned_at),
      ],
    });
    log(
      `Last assigned support request: ${JSON.stringify(lastAssignedSupportRequest)}`,
      "kafka",
    );

    // Calculate next assignee (round-robin) based on support requests only
    let nextAssigneeIndex = 0;
    if (lastAssignedSupportRequest && lastAssignedSupportRequest.assigned_to_id) {
      const lastAssigneeIndex = activeUsers.findIndex(
        (user) => user.id === lastAssignedSupportRequest.assigned_to_id,
      );
      if (lastAssigneeIndex !== -1) {
        nextAssigneeIndex = (lastAssigneeIndex + 1) % activeUsers.length;
      }
    }

    const assigned_to_id = activeUsers[nextAssigneeIndex].id;
    const now = new Date();

    // Prepare insert data with type='support'
    const insertData = {
      full_name: message.full_name,
      email: message.email,
      subject: message.subject,
      content: message.content,
      status: "pending",
      type: "support", // Explicitly set type
      assigned_to_id,
      assigned_at: now,
      created_at: now,
      updated_at: now,
    };

    try {
      // Insert into DB
      const newRequest = await tx
        .insert(supportRequests)
        .values(insertData)
        .returning();
      log(`✅ Support request created with ID ${newRequest[0].id}`, "kafka");
      log(`👤 Support request assigned to user ID ${assigned_to_id} (${activeUsers.find(u => u.id === assigned_to_id)?.name})`, "kafka");
      log(`📧 Email: ${message.email}, Subject: ${message.subject}`, "kafka");

      // Broadcast support badge update
      if ((global as any).broadcastSupportBadgeUpdate) {
        await (global as any).broadcastSupportBadgeUpdate();
      }

      return newRequest[0];
    } catch (dbError) {
      log(
        `Database error while inserting support request: ${dbError}`,
        "kafka-error",
      );
      throw dbError;
    }
  } catch (error) {
    log(`Error processing support message: ${error}`, "kafka-error");
    throw error;
  }
}

async function processFeedbackMessage(message: FeedbackMessage, tx: any) {
  try {
    // Validate required fields
    if (
      !message.id ||
      !message.full_name ||
      !message.email ||
      !message.subject
    ) {
      log(`Invalid feedback message: ${JSON.stringify(message)}`, "kafka-error");
      return;
    }

    // Check for duplicate feedback request based on content only
    const existingRequest = await tx
      .select()
      .from(supportRequests)
      .where(
        and(
          eq(supportRequests.content, message.content),
          eq(supportRequests.type, "feedback")
        )
      )
      .limit(1);

    if (existingRequest.length > 0) {
      log(`Feedback request with same content already exists, skipping...`, "kafka");
      return existingRequest[0];
    }

    log(`Processing feedback message: ${JSON.stringify(message)}`, "kafka");

    // Get active users
    const activeUsers = await tx
      .select()
      .from(users)
      .where(eq(users.status, "active"));

    if (!activeUsers || activeUsers.length === 0) {
      log("No active users found to assign feedback.", "kafka");
      return;
    }
    log(`Found ${activeUsers.length} active users for feedback assignment`, "kafka");

    // Find last assigned FEEDBACK REQUEST for round-robin (specific to type='feedback')
    const lastAssignedFeedbackRequest = await tx.query.supportRequests.findFirst({
      where: eq(supportRequests.type, 'feedback'),
      orderBy: (supportRequests, { desc }) => [
        desc(supportRequests.assigned_at),
      ],
    });
    log(
      `Last assigned feedback request: ${JSON.stringify(lastAssignedFeedbackRequest)}`,
      "kafka",
    );

    // Calculate next assignee (round-robin) based on feedback requests only
    let nextAssigneeIndex = 0;
    if (lastAssignedFeedbackRequest && lastAssignedFeedbackRequest.assigned_to_id) {
      const lastAssigneeIndex = activeUsers.findIndex(
        (user) => user.id === lastAssignedFeedbackRequest.assigned_to_id,
      );
      if (lastAssigneeIndex !== -1) {
        nextAssigneeIndex = (lastAssigneeIndex + 1) % activeUsers.length;
      }
    }

    const assigned_to_id = activeUsers[nextAssigneeIndex].id;
    const now = new Date();

    // Prepare full_name as JSON object format like real_users table
    const fullNameObj = {
      id: message.id,
      name: message.full_name
    };

    // Handle attachment_url - convert array to JSON string if it's an array
    let attachmentUrl = message.attachment_url;
    if (Array.isArray(attachmentUrl)) {
      attachmentUrl = JSON.stringify(attachmentUrl);
    }

    // Prepare insert data with type='feedback' and feedback-specific fields
    const insertData = {
      full_name: fullNameObj,
      email: message.email,
      subject: message.subject,
      content: message.detailed_description || message.subject, // Use detailed_description as content, fallback to subject
      status: "pending",
      type: "feedback", // Explicitly set type
      feedback_type: message.feedback_type || null,
      feature_type: message.feature_type || null,
      detailed_description: message.detailed_description || null,
      attachment_url: attachmentUrl || null,
      assigned_to_id,
      assigned_at: now,
      created_at: now,
      updated_at: now,
    };

    try {
      // Insert into DB
      const newRequest = await tx
        .insert(supportRequests)
        .values(insertData)
        .returning();
      log(`✅ Feedback request created with ID ${newRequest[0].id}`, "kafka");
      log(`👤 Feedback request assigned to user ID ${assigned_to_id} (${activeUsers.find(u => u.id === assigned_to_id)?.name})`, "kafka");
      log(`📧 Email: ${message.email}, Name: ${message.full_name}, Subject: ${message.subject}, Type: ${message.feedback_type}`, "kafka");

      // Send confirmation email to user - AFTER transaction completes successfully
      setTimeout(async () => {
        try {
          log(`📧 Starting email confirmation process for feedback #${newRequest[0].id}`, "kafka");

          // Import EmailService class instead of singleton instance
          const { EmailService } = await import('./email.js');

          // Create a fresh instance with proper initialization
          const emailService = new EmailService();

          // Force reload SMTP config and wait for it to complete
          log('🔄 Loading SMTP config from database...', "kafka");
          await emailService.loadConfigFromDB();

          // Initialize transporter with loaded config
          log('🔧 Initializing SMTP transporter...', "kafka");
          emailService.initializeTransporter();

          // Wait longer for transporter to be fully ready
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Test if transporter is ready before sending
          const testResult = await emailService.testConnection();
          if (!testResult) {
            log(`❌ SMTP connection test failed for feedback #${newRequest[0].id}`, "kafka-error");
            return;
          }

          log(`✅ SMTP ready, sending confirmation email for feedback #${newRequest[0].id}`, "kafka");

          const emailSent = await emailService.sendFeedbackConfirmation({
            to: message.email,
            fullName: message.full_name, // This is the name string from the message
            subject: message.subject,
            feedbackType: message.feedback_type,
            requestId: newRequest[0].id
          });

          if (emailSent) {
            log(`📨 Confirmation email sent successfully to ${message.email} for feedback #${newRequest[0].id}`, "kafka");
          } else {
            log(`⚠️ Failed to send confirmation email to ${message.email} for feedback #${newRequest[0].id}`, "kafka-error");
          }
        } catch (emailError) {
          log(`❌ Error sending confirmation email: ${emailError}`, "kafka-error");
        }
      }, 3000); // Increase delay to 3 seconds

      // Broadcast feedback badge update
      if ((global as any).broadcastFeedbackBadgeUpdate) {
        await (global as any).broadcastFeedbackBadgeUpdate();
      }

      return newRequest[0];
    } catch (dbError) {
      log(
        `Database error while inserting feedback request: ${dbError}`,
        "kafka-error",
      );
      throw dbError;
    }
  } catch (error) {
    log(`Error processing feedback message: ${error}`, "kafka-error");
    throw error;
  }
}

async function processTickMessage(message: TickMessage, tx: any) {
  try {
    // Validate required fields
    if (
      !message.id ||
      !message.full_name ||
      !message.email ||
      !message.type
    ) {
      log(`Invalid tick message: ${JSON.stringify(message)}`, "kafka-error");
      return;
    }

    // Check for duplicate tick request based on email and type
    const existingRequest = await tx
      .select()
      .from(supportRequests)
      .where(
        and(
          eq(supportRequests.email, message.email),
          eq(supportRequests.type, "tick")
        )
      )
      .limit(1);

    if (existingRequest.length > 0) {
      log(`Tick request for ${message.email} already exists, skipping...`, "kafka");
      return existingRequest[0];
    }

    log(`Processing tick message: ${JSON.stringify(message)}`, "kafka");

    // Get active users (exclude admin for tick assignment)
    const activeUsers = await tx
      .select()
      .from(users)
      .where(and(eq(users.status, "active"), ne(users.role, "admin")));

    if (!activeUsers || activeUsers.length === 0) {
      log("No active non-admin users found to assign tick.", "kafka");
      return;
    }
    log(`Found ${activeUsers.length} active users for tick assignment`, "kafka");

    // Find last assigned TICK REQUEST for round-robin (specific to type='tick')
    const lastAssignedTickRequest = await tx.query.supportRequests.findFirst({
      where: eq(supportRequests.type, 'tick'),
      orderBy: (supportRequests, { desc }) => [
        desc(supportRequests.assigned_at),
      ],
    });
    log(
      `Last assigned tick request: ${JSON.stringify(lastAssignedTickRequest)}`,
      "kafka",
    );

    // Calculate next assignee (round-robin) based on tick requests only
    let nextAssigneeIndex = 0;
    if (lastAssignedTickRequest && lastAssignedTickRequest.assigned_to_id) {
      const lastAssigneeIndex = activeUsers.findIndex(
        (user) => user.id === lastAssignedTickRequest.assigned_to_id,
      );
      if (lastAssigneeIndex !== -1) {
        nextAssigneeIndex = (lastAssigneeIndex + 1) % activeUsers.length;
      }
    }

    const assigned_to_id = activeUsers[nextAssigneeIndex].id;
    const now = new Date();

    // Prepare full_name as JSON object format
    const fullNameObj = {
      id: message.id,
      name: message.full_name
    };

    // Prepare insert data with type='tick' and tick-specific fields
    const insertData = {
      full_name: fullNameObj,
      email: message.email,
      subject: message.subject || "Yêu cầu tick xanh",
      content: message.detailed_description || "Yêu cầu tick xanh từ người dùng",
      status: "pending",
      type: "tick", // Explicitly set type
      phone_number: message.phone_number || null,
      attachment_url: message.attachment_url ? JSON.stringify(message.attachment_url) : null,
      assigned_to_id,
      assigned_at: now,
      created_at: now,
      updated_at: now,
    };

    try {
      // Insert into DB
      const newRequest = await tx
        .insert(supportRequests)
        .values(insertData)
        .returning();
      log(`✅ Tick request created with ID ${newRequest[0].id}`, "kafka");
      log(`👤 Tick request assigned to user ID ${assigned_to_id} (${activeUsers.find(u => u.id === assigned_to_id)?.name})`, "kafka");
      log(`📧 Email: ${message.email}, Name: ${message.full_name}, Subject: ${insertData.subject}`, "kafka");

      // Broadcast tick badge update
      if ((global as any).broadcastFeedbackBadgeUpdate) {
        await (global as any).broadcastFeedbackBadgeUpdate();
      }

      return newRequest[0];
    } catch (dbError) {
      log(
        `Database error while inserting tick request: ${dbError}`,
        "kafka-error",
      );
      throw dbError;
    }
  } catch (error) {
    log(`Error processing tick message: ${error}`, "kafka-error");
    throw error;
  }
}

async function processVerificationMessage(message: VerificationMessage, tx: any) {
  try {
    // Validate required fields
    if (
      !message.id ||
      !message.full_name ||
      !message.email ||
      !message.type
    ) {
      log(`Invalid verification message: ${JSON.stringify(message)}`, "kafka-error");
      return;
    }

    // Check for duplicate verification request based on email and id
    const existingRequest = await tx
      .select()
      .from(supportRequests)
      .where(
        and(
          eq(supportRequests.email, message.email),
          eq(supportRequests.type, "verify")
        )
      )
      .limit(1);

    if (existingRequest.length > 0) {
      log(`Verification request for ${message.email} already exists, skipping...`, "kafka");
      return existingRequest[0];
    }

    log(`Processing verification message: ${JSON.stringify(message)}`, "kafka");

    // Get active users (exclude admin for verification assignment)
    const activeUsers = await tx
      .select()
      .from(users)
      .where(and(eq(users.status, "active"), ne(users.role, "admin")));

    if (!activeUsers || activeUsers.length === 0) {
      log("No active non-admin users found to assign verification.", "kafka");
      return;
    }
    log(`Found ${activeUsers.length} active users for verification assignment`, "kafka");

    // Find last assigned VERIFICATION REQUEST for round-robin (specific to type='verify')
    const lastAssignedVerificationRequest = await tx.query.supportRequests.findFirst({
      where: eq(supportRequests.type, 'verify'),
      orderBy: (supportRequests, { desc }) => [
        desc(supportRequests.assigned_at),
      ],
    });
    log(
      `Last assigned verification request: ${JSON.stringify(lastAssignedVerificationRequest)}`,
      "kafka",
    );

    // Calculate next assignee (round-robin) based on verification requests only
    let nextAssigneeIndex = 0;
    if (lastAssignedVerificationRequest && lastAssignedVerificationRequest.assigned_to_id) {
      const lastAssigneeIndex = activeUsers.findIndex(
        (user) => user.id === lastAssignedVerificationRequest.assigned_to_id,
      );
      if (lastAssigneeIndex !== -1) {
        nextAssigneeIndex = (lastAssigneeIndex + 1) % activeUsers.length;
      }
    }

    const assigned_to_id = activeUsers[nextAssigneeIndex].id;
    const now = new Date();

    // Prepare full_name as JSON object format
    const fullNameObj = {
      id: message.id,
      name: message.full_name
    };

    // Prepare insert data with type='verify' and verification-specific fields
    const insertData = {
      full_name: fullNameObj,
      email: message.email,
      subject: message.subject || "Yêu cầu xác minh danh tính",
      content: message.detailed_description || "Yêu cầu xác minh danh tính từ người dùng",
      status: "pending",
      type: "verify", // Explicitly set type
      verification_name: message.verification_name || message.full_name,
      phone_number: message.phone_number || null,
      attachment_url: message.attachment_url ? JSON.stringify(message.attachment_url) : null,
      identity_verification_id: message.identity_verification_id || null,
      assigned_to_id,
      assigned_at: now,
      created_at: now,
      updated_at: now,
    };

    try {
      // Insert into DB
      const newRequest = await tx
        .insert(supportRequests)
        .values(insertData)
        .returning();
      log(`✅ Verification request created with ID ${newRequest[0].id}`, "kafka");
      log(`👤 Verification request assigned to user ID ${assigned_to_id} (${activeUsers.find(u => u.id === assigned_to_id)?.name})`, "kafka");
      log(`📧 Email: ${message.email}, Name: ${message.full_name}, Subject: ${insertData.subject}`, "kafka");

      // Broadcast verification badge update
      if ((global as any).broadcastFeedbackBadgeUpdate) {
        await (global as any).broadcastFeedbackBadgeUpdate();
      }

      return newRequest[0];
    } catch (dbError) {
      log(
        `Database error while inserting verification request: ${dbError}`,
        "kafka-error",
      );
      throw dbError;
    }
  } catch (error) {
    log(`Error processing verification message: ${error}`, "kafka-error");
    throw error;
  }
}

export async function disconnectKafkaConsumer() {
  if (consumer) {
    await consumer.disconnect();
    log("Disconnected from Kafka", "kafka");
  }
}

process.on('SIGTERM', async () => {
  isShuttingDown = true;
  if (consumer) {
    await consumer.disconnect();
    log("Kafka consumer disconnected gracefully", "kafka");
  }
  process.exit(0);
});

async function processContactMessage(message: ContactMessage, tx: any) {
  try {
    log(`Processing contact message from: ${message.name}`, "kafka");

    // Get active users for assignment
    const activeUsers = await tx
      .select()
      .from(users)
      .where(eq(users.status, "active"));

    if (!activeUsers || activeUsers.length === 0) {
      log("No active users found to assign contact.", "kafka");
      return;
    }

    // Find last assigned CONTACT/SUPPORT REQUEST for round-robin (specific to supportRequests table)
    const lastAssignedContactRequest = await tx.query.supportRequests.findFirst({
      orderBy: (supportRequests, { desc }) => [
        desc(supportRequests.assigned_at),
      ],
    });

    // Calculate next assignee using round-robin based on supportRequests table
    let nextAssigneeIndex = 0;
    if (lastAssignedContactRequest&& lastAssignedContactRequest.assigned_to_id) {
      const lastAssigneeIndex = activeUsers.findIndex(
        (user) => user.id === lastAssignedContactRequest.assigned_to_id,
      );
      if (lastAssigneeIndex !== -1) {
        nextAssigneeIndex = (lastAssigneeIndex + 1) % activeUsers.length;
      }
    }

    const assigned_to_id = activeUsers[nextAssigneeIndex].id;
    const now = new Date();

    // Insert into support_requests table
    const insertData = {
      full_name: message.full_name,
      email: message.email,
      subject: message.subject,
      content: message.content,
      status: "pending",
      assigned_to_id,
      assigned_at: now,
      created_at: message.created_at ? new Date(message.created_at) : now,
      updated_at: now,
    };

    const newRequest = await tx
      .insert(supportRequests)
      .values(insertData)
      .returning();

    log(`Contact request created with ID ${newRequest[0].id}`, "kafka");
    log(`Contact assigned to user ID ${assigned_to_id}`, "kafka");

    return newRequest[0];
  } catch (error) {
    log(`Error processing contact message: ${error}`, "kafka-error");
    throw error;
  }
}