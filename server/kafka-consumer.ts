import { Kafka, Consumer, EachMessagePayload } from "kafkajs";
import { db } from "./db";
import { users, supportRequests, contents, realUsers } from "../shared/schema";
import { eq, and, ne } from "drizzle-orm";
import { log } from "./vite";

let consumer: Consumer;
let isShuttingDown = false;

// Constants for configuration
const KAFKA_CONFIG = {
  RETRY_INITIAL_TIME: 5000,
  RETRY_MAX_TIME: 300000,
  RETRY_FACTOR: 1.2,
  MAX_RETRIES: 30,
  CONNECTION_TIMEOUT: 120000,
  AUTH_TIMEOUT: 60000,
  HEALTH_CHECK_INTERVAL: 60000,
  BATCH_SIZE: 10
};

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
    await consumer.connect();
    log("Successfully reconnected to Kafka", "kafka");
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

    const brokers = process.env.KAFKA_BROKERS?.split(",") || [];
    log(`Initializing Kafka connection to brokers: ${brokers.join(", ")}`, "kafka");

    const kafkaConfig = {
      clientId: "content-processing-service", 
      brokers,
      ssl: false,
      sasl,
      connectionTimeout: 30000, // Giảm timeout
      authenticationTimeout: 30000,
      retry: {
        initialRetryTime: 1000, // Giảm thời gian retry đầu tiên
        retries: 10, // Giảm số lần retry
        maxRetryTime: 30000, // Giảm max retry time
        factor: 2,
      },
      logLevel: 4,
      requestTimeout: 30000,
      enforceRequestTimeout: true,
    };

    // Add connection error handler
    process.on("unhandledRejection", (error) => {
      log(`Kafka unhandled rejection: ${error}`, "kafka-error");
    });

    log(
      `Kafka configuration: ${JSON.stringify(
        {
          ssl: false,
          sasl: !!sasl,
          brokers,
          connectionTimeout: kafkaConfig.connectionTimeout,
          authenticationTimeout: kafkaConfig.authenticationTimeout,
          retry: kafkaConfig.retry,
        },
        null,
        2,
      )}`,
      "kafka",
    );

    const kafka = new Kafka(kafkaConfig);

    consumer = kafka.consumer({
      groupId: process.env.KAFKA_GROUP_ID || "emso-processor",
      maxWaitTimeInMs: 5000,
      sessionTimeout: 30000,
    });

    try {
      await consumer.connect();
      log("Successfully connected to Kafka", "kafka");

      const topics = process.env.KAFKA_TOPICS?.split(",") || [
        "content_management",
        "real_users",
      ];

      // Retry topic subscription
      let retries = 0;
      const maxRetries = 5;

      while (retries < maxRetries) {
        try {
          for (const topic of topics) {
            await consumer.subscribe({ topic, fromBeginning: true });
            log(`Subscribed to topic: ${topic}`, "kafka");
          }
          break;
        } catch (error) {
          retries++;
          log(
            `Failed to subscribe to topics (attempt ${retries}/${maxRetries}): ${error}`,
            "kafka-error",
          );
          if (retries === maxRetries) {
            throw new Error(
              `Failed to subscribe to topics after ${maxRetries} attempts`,
            );
          }
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }

    const topics = process.env.KAFKA_TOPICS?.split(",") || ["content_management"];
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

          if ("externalId" in parsedMessage) {
            await processContentMessage(parsedMessage as ContentMessage);
          } else if ("full_name" in parsedMessage) {
            await processSupportMessage(parsedMessage as SupportMessage);
          } else if ("id" in parsedMessage && "email" in parsedMessage) {
            // Xử lý message từ topic real_users
            await processRealUserMessage(parsedMessage as RealUserMessage);
            log(`Processed real user message for ${parsedMessage.email}`, "kafka");
          }
        },
      });

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
): ContentMessage | SupportMessage | RealUserMessage | null {
  if (!messageValue) return null;

  try {
    const value = messageValue.toString();
    const message = JSON.parse(value);

    if ("full_name" in message && "email" in message) {
      return message as SupportMessage;
    } else if ("externalId" in message) {
      return message as ContentMessage;
    } else if ("id" in message && "email" in message && "fullName" in message) {
      return message as RealUserMessage;
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
    log(`Error processing content message: ${error}`, "kafka-error");
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

export interface RealUserMessage {
  id: string;
  fullName: string;
  email: string;
  verified: "verified" | "unverified";
}

async function processRealUserMessage(message: RealUserMessage) {
  try {
    log(`Processing real user message: ${JSON.stringify(message)}`, "kafka");

    // Get active non-admin users
    const activeUsers = await db
      .select()
      .from(users)
      .where(and(eq(users.status, "active"), ne(users.role, "admin")));

    if (!activeUsers || activeUsers.length === 0) {
      throw new Error("No active non-admin users found");
    }

    // Get last assigned user to implement round-robin
    const lastAssignedUser = await db.query.realUsers.findFirst({
      orderBy: (realUsers, { desc }) => [desc(realUsers.createdAt)],
    });

    // Calculate next assignee index
    let nextAssigneeIndex = 0;
    if (lastAssignedUser) {
      const lastAssigneeIndex = activeUsers.findIndex(
        (user) => user.id === lastAssignedUser.assignedToId,
      );
      if (lastAssigneeIndex !== -1) {
        nextAssigneeIndex = (lastAssigneeIndex + 1) % activeUsers.length;
      }
    }

    const assignedToId = activeUsers[nextAssigneeIndex].id;
    const now = new Date();

    // Insert new real user
    const newRealUser = await db
      .insert(realUsers)
      .values({
        fullName: JSON.stringify({
          id: message.id,
          name: message.fullName,
        }),
        email: message.email,
        verified: message.verified,
        lastLogin: now,
        assignedToId: assignedToId,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    log(
      `Created real user with ID ${newRealUser[0].id}, assigned to user ID ${assignedToId}`,
      "kafka",
    );
    return newRealUser[0];
  } catch (error) {
    log(`Error processing real user message: ${error}`, "kafka-error");
    throw error;
  }
}

export async function disconnectKafkaConsumer() {
  if (consumer) {
    await consumer.disconnect();
    log("Disconnected from Kafka", "kafka");
  }
}
