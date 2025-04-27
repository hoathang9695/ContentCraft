import { Kafka, Consumer, EachMessagePayload } from "kafkajs";
import { db } from "./db";
import { users, supportRequests, contents } from "../shared/schema";
import { eq } from "drizzle-orm";
import { log } from "./vite";

let consumer: Consumer;

export interface ContentMessage {
  externalId: string;
  source?: string;
  sourceVerification?: "verified" | "unverified";
}

export interface SupportMessage {
  full_name: string;
  email: string;
  subject: string;
  content: string;
}

/**
 * Hàm khởi tạo và thiết lập kết nối với Kafka
 */
export async function setupKafkaConsumer() {
  try {
    if (process.env.KAFKA_ENABLED !== "true") {
      log("Kafka is not enabled", "kafka");
      return;
    }

    const sasl =
      process.env.KAFKA_SASL == "true"
        ? {
            mechanism: process.env.KAFKA_SASL_MECHANISMS as "PLAIN",
            username: process.env.KAFKA_SASL_USERNAME || "",
            password: process.env.KAFKA_SASL_PASSWORD || "",
          }
        : undefined;

    const brokers = process.env.KAFKA_BROKERS?.split(",") || [];
    log(
      `Initializing Kafka connection to brokers: ${brokers.join(", ")}`,
      "kafka",
    );

    const kafkaConfig = {
      clientId: "content-processing-service",
      brokers,
      ssl: false,
      sasl,
      connectionTimeout: 120000, // Tăng timeout
      authenticationTimeout: 60000,
      retry: {
        initialRetryTime: 5000,
        retries: 30,
        maxRetryTime: 300000,
        factor: 1.2, // Giảm hệ số để retry thường xuyên hơn
      },
      logLevel: 4, // DEBUG level để log chi tiết hơn
      requestTimeout: 120000,
      enforceRequestTimeout: true,
    };

    // Add connection error handler
    process.on("unhandledRejection", (error) => {
      log(`Kafka unhandled rejection: ${error}`, "kafka-error");
    });

    log(
      `Kafka configuration: ${JSON.stringify(
        {
          ssl: true,
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
    });

    try {
      await consumer.connect();
      log("Successfully connected to Kafka", "kafka");

      const topics = process.env.KAFKA_TOPICS?.split(",") || [
        "content_management",
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

      // Enhanced health check with reconnection logic
      setInterval(async () => {
        try {
          const health = await kafka.admin().listTopics();
          log(
            `Kafka health check - Connected to topics: ${health.join(", ")}`,
            "kafka",
          );
        } catch (error) {
          log(`Kafka health check failed: ${error}`, "kafka-error");
          try {
            await consumer.disconnect();
            await consumer.connect();
            log("Reconnected to Kafka after health check failure", "kafka");
          } catch (reconnectError) {
            log(
              `Failed to reconnect to Kafka: ${reconnectError}`,
              "kafka-error",
            );
          }
        }
      }, 60000);

      log(
        "Connected to Kafka and subscribed to topics: " + topics.join(", "),
        "kafka",
      );

      await consumer.run({
        eachBatchAutoResolve: true,
        eachBatch: async ({ batch, resolveOffset, heartbeat, isRunning, isStale }) => {
          const messages = batch.messages;
          for (let i = 0; i < messages.length; i++) {
            if (!isRunning() || isStale()) break;

            let retryCount = 0;
            const maxRetries = 3;

            while (retryCount < maxRetries) {
              try {
                const message = messages[i];
                const parsedMessage = parseMessage(message.value);

                if (!parsedMessage) {
                  log(`Invalid message format: ${message.value}`, "kafka-error");
                  resolveOffset(message.offset);
                  break;
                }

                await db.transaction(async (tx) => {
                  if ("externalId" in parsedMessage) {
                    await processContentMessage(parsedMessage as ContentMessage, tx);
                  } else if ("full_name" in parsedMessage) {
                    await processSupportMessage(parsedMessage as SupportMessage, tx);
                  }
                }, {
                  isolationLevel: 'serializable' // Prevent race conditions
                });

                resolveOffset(message.offset);
                await heartbeat();
              } catch (error) {
                retryCount++;
                log(`Processing error (attempt ${retryCount}): ${error}`, "kafka-error");

                if (retryCount === maxRetries) {
                  // Send to Dead Letter Queue
                  await sendToDeadLetterQueue(messages[i]);
                  resolveOffset(message.offset); // Skip message after max retries
                }

                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
              }
            }
          }
        },
      });

// Helper function to handle failed messages
async function sendToDeadLetterQueue(message: any) {
  try {
    // Log failed message for manual review
    log(`Message sent to DLQ: ${JSON.stringify(message)}`, "kafka-error");
    // Here you could implement actual DLQ logic
  } catch (error) {
    log(`Error sending to DLQ: ${error}`, "kafka-error");
  }
}

      return consumer;
    } catch (error) {
      log(`Error setting up Kafka consumer: ${error}`, "kafka-error");
      throw error;
    }
  } finally {
    log("Kafka consumer setup completed", "kafka");
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