import { Kafka, Consumer, EachMessagePayload } from "kafkajs";
import { db } from "./db";
import { users, supportRequests, contents, realUsers, pages } from "../shared/schema";
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
  managerId?: string;
  adminName?: string;
  phoneNumber?: string;
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

async function reconnectConsumer(kafka: Kafka, consumer: Consumer) {
  try {
    await consumer.disconnect();
    await new Promise(resolve => setTimeout(resolve, KAFKA_CONFIG.RECONNECT_TIMEOUT));
    await consumer.connect();
    log("Successfully reconnected to Kafka", "kafka");

    // Resubscribe to topics after reconnect
    // Ensure all required topics are explicitly defined
    const requiredTopics = ["content_management", "real_users", "contact-messages", "page_management"];
    const configuredTopics = process.env.KAFKA_TOPICS?.split(",") || [];
    const topics = [...new Set([...requiredTopics, ...configuredTopics])];

    for (const topic of topics) {
      try {
        await consumer.subscribe({ topic, fromBeginning: false }); // Set fromBeginning false on production
        log(`Subscribed to topic: ${topic}`, "kafka");
      } catch (error) {
        log(`Failed to subscribe to topic ${topic}: ${error}`, "kafka-error");
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

    const topics = process.env.KAFKA_TOPICS?.split(",") || ["content_management", "real_users", "contact-messages", "page_management"];
    for (const topic of topics) {
      await consumer.subscribe({ topic, fromBeginning: true });
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
                async (msg: ContentMessage | SupportMessage | ContactMessage | RealUsersMessage | PageMessage) => {
                  const startTime = Date.now();
                  try {
                    await db.transaction(async (tx) => {
                      if ("externalId" in msg) {
                        await processContentMessage(msg as ContentMessage, tx);
                      } else if ("full_name" in msg) {
                        await processSupportMessage(msg as SupportMessage, tx);
                      } else if ("name" in msg && "message" in msg) {
                        await processContactMessage(msg as ContactMessage, tx);
                      } else if ("id" in msg && "fullName" in msg && "email" in msg && "verified" in msg) {
                        // Handle real user message from Kafka
                        const now = new Date();

                        // Get active users for round-robin assignment
                        const activeUsers = await db
                          .select()
                          .from(users)
                          .where(eq(users.status, "active"));

                        if (!activeUsers || activeUsers.length === 0) {
                          throw new Error("No active users found for assignment");
                        }

                        // Get last assigned request for round-robin
                        const lastAssigned = await db.query.realUsers.findFirst({
                          orderBy: (realUsers, { desc }) => [desc(realUsers.createdAt)]
                        });

                        // Calculate next assignee index
                        let nextAssigneeIndex = 0;
                        if (lastAssigned && lastAssigned.assignedToId) {
                          const lastAssigneeIndex = activeUsers.findIndex(
                            user => user.id === lastAssigned.assignedToId
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

                        // Get active users for round-robin assignment (exclude admin)
                        const activeUsers = await db
                          .select()
                          .from(users)
                          .where(and(eq(users.status, "active"), ne(users.role, "admin")));

                        if (!activeUsers || activeUsers.length === 0) {
                          throw new Error("No active non-admin users found for assignment");
                        }

                        // Get last assigned page for round-robin
                        const { pages } = await import("../shared/schema");
                        const lastAssigned = await db.query.pages.findFirst({
                          orderBy: (pages, { desc }) => [desc(pages.createdAt)]
                        });

                        // Calculate next assignee index
                        let nextAssigneeIndex = 0;
                        if (lastAssigned && lastAssigned.assignedToId) {
                          const lastAssigneeIndex = activeUsers.findIndex(
                            user => user.id === lastAssigned.assignedToId
                          );
                          if (lastAssigneeIndex !== -1) {
                            nextAssigneeIndex = (lastAssigneeIndex + 1) % activeUsers.length;
                          }
                        }

                        const assignedToId = activeUsers[nextAssigneeIndex].id;

                        try {
                          // Validate required fields
                          if (!pageMsg.pageId || !pageMsg.pageName || !pageMsg.pageType) {
                            throw new Error(`Invalid page message format: ${JSON.stringify(pageMsg)}`);
                          }

                          // Check if page already exists to avoid duplicates
                          const existingPage = await tx
                            .select()
                            .from(pages)
                            .where(sql`${pages.pageName}->>'id' = ${pageMsg.pageId}`)
                            .limit(1);

                          if (existingPage.length > 0) {
                            log(`Page with ID ${pageMsg.pageId} already exists, skipping...`, "kafka");
                            return existingPage[0];
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

                          // Insert new page with proper format
                          const result = await tx.insert(pages).values({
                            pageName: {
                              id: pageMsg.pageId,
                              page_name: pageMsg.pageName
                            },
                            pageType: pageMsg.pageType,
                            classification: 'new', // Default classification
                            adminData: pageMsg.managerId && pageMsg.adminName ? {
                              id: pageMsg.managerId,
                              admin_name: pageMsg.adminName
                            } : null,
                            phoneNumber: pageMsg.phoneNumber || null,
                            monetizationEnabled: pageMsg.monetizationEnabled || false,
                            assignedToId: assignedToId,
                            createdAt: now,
                            updatedAt: now
                          }).returning();

                          log(`Successfully inserted page: ${JSON.stringify(result[0])}`, "kafka");
                          metrics.processedMessages++;
                          return result[0];
                        } catch (error) {
                          log(`Error processing page: ${error}`, "kafka-error");
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

function parseMessage(
  messageValue: Buffer | null,
): ContentMessage | SupportMessage | ContactMessage | RealUsersMessage | PageMessage {
  if (!messageValue) return null;

  try {
    const value = messageValue.toString();
    const message = JSON.parse(value);

    if ("full_name" in message && "email" in message) {
      return message as SupportMessage;
    } else if ("externalId" in message) {
      return message as ContentMessage;
    // } else if ("name" in message && "message" in message) {
    //   return message as ContactMessage; 
    } else if ("fullName" in message && "id" in message&& "email" in message&& "verified" in message) {
      return message as RealUsersMessage; 
    } else if ("pageId" in message && "pageName" in message && "pageType" in message) {
      return message as PageMessage;
    }

    return null;
  } catch (error) {
    log(`Error parsing message: ${error}`, "kafka-error");
    return null;
  }
}

async function processContentMessage(contentMessage: ContentMessage, tx: any) {
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

    const lastAssignedRequest = await tx.query.supportRequests.findFirst({
      orderBy: (supportRequests, { desc }) => [
        desc(supportRequests.assigned_at),
      ],
    });

    let nextAssigneeIndex = 0;
    if (lastAssignedRequest && lastAssignedRequest.assigned_to_id) {
      const lastAssigneeIndex = activeUsers.findIndex(
        (user) => user.id === lastAssignedRequest.assigned_to_id,
      );
      if (lastAssigneeIndex !== -1) {
        nextAssigneeIndex = (lastAssigneeIndex + 1) % activeUsers.length;
      }
    }

    const assigned_to_id = activeUsers[nextAssigneeIndex].id;
    const now = new Date();

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

    // Find last assigned request
    const lastAssignedRequest = await tx.query.supportRequests.findFirst({
      orderBy: (supportRequests, { desc }) => [
        desc(supportRequests.assigned_at),
      ],
    });
    log(
      `Last assigned request: ${JSON.stringify(lastAssignedRequest)}`,
      "kafka",
    );

    // Calculate next assignee (round-robin)
    let nextAssigneeIndex = 0;
    if (lastAssignedRequest && lastAssignedRequest.assigned_to_id) {
      const lastAssigneeIndex = activeUsers.findIndex(
        (user) => user.id === lastAssignedRequest.assigned_to_id,
      );
      if (lastAssigneeIndex !== -1) {
        nextAssigneeIndex = (lastAssigneeIndex + 1) % activeUsers.length;
      }
    }

    const assigned_to_id = activeUsers[nextAssigneeIndex].id;
    const now = new Date();

    // Prepare insert data
    const insertData = {
      full_name: message.full_name,
      email: message.email,
      subject: message.subject,
      content: message.content,
      status: "pending",
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
      log(`Support request created with ID ${newRequest[0].id}`, "kafka");
      log(`Support request assigned to user ID ${assigned_to_id}`, "kafka");
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

    // Find last assigned request for round-robin
    const lastAssignedRequest = await tx.query.supportRequests.findFirst({
      orderBy: (supportRequests, { desc }) => [
        desc(supportRequests.assigned_at),
      ],
    });

    // Calculate next assignee using round-robin
    let nextAssigneeIndex = 0;
    if (lastAssignedRequest && lastAssignedRequest.assigned_to_id) {
      const lastAssigneeIndex = activeUsers.findIndex(
        (user) => user.id === lastAssignedRequest.assigned_to_id,
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