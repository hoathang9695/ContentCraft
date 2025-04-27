import { Kafka, Consumer, EachMessagePayload } from "kafkajs";
import { db } from "./db";
import { users, supportRequests, contents } from "../shared/schema";
import { eq } from "drizzle-orm";
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

    const kafka = new Kafka({
      clientId: "content-processing-service",
      brokers,
      ssl: false,
      sasl,
      connectionTimeout: KAFKA_CONFIG.CONNECTION_TIMEOUT,
      authenticationTimeout: KAFKA_CONFIG.AUTH_TIMEOUT,
      retry: {
        initialRetryTime: KAFKA_CONFIG.RETRY_INITIAL_TIME,
        retries: KAFKA_CONFIG.MAX_RETRIES,
        maxRetryTime: KAFKA_CONFIG.RETRY_MAX_TIME,
        factor: KAFKA_CONFIG.RETRY_FACTOR,
      },
      logLevel: 4
    });

    consumer = kafka.consumer({
      groupId: process.env.KAFKA_GROUP_ID || "emso-processor",
      maxWaitTimeInMs: 5000,
      sessionTimeout: 30000,
    });

    await consumer.connect();
    log("Connected to Kafka", "kafka");

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
                async (msg: ContentMessage | SupportMessage) => {
                  await db.transaction(async (tx) => {
                    if ("externalId" in msg) {
                      await processContentMessage(msg as ContentMessage, tx);
                    } else if ("full_name" in msg) {
                      await processSupportMessage(msg as SupportMessage, tx);
                    }
                  }, { isolationLevel: 'serializable' });
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
): ContentMessage | SupportMessage | null {
  if (!messageValue) return null;

  try {
    const value = messageValue.toString();
    const message = JSON.parse(value);

    if ("full_name" in message && "email" in message) {
      return message as SupportMessage;
    } else if ("externalId" in message) {
      return message as ContentMessage;
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