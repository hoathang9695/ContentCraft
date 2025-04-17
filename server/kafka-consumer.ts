import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { db } from './db';
import { users, supportRequests } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { log } from './vite';

let consumer: Consumer;

export interface ContentMessage {
  externalId: string;
  source?: string;
  sourceVerification?: 'verified' | 'unverified';
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
    if (process.env.KAFKA_ENABLED !== 'true') {
      log('Kafka is not enabled', 'kafka');
      return;
    }

    const sasl = process.env.KAFKA_SASL == 'true' ? {
      mechanism: process.env.KAFKA_SASL_MECHANISMS as 'PLAIN',
      username: process.env.KAFKA_SASL_USERNAME || '',
      password: process.env.KAFKA_SASL_PASSWORD || ''
    } : undefined;

    const brokers = process.env.KAFKA_BROKERS?.split(',') || [];
    log(`Initializing Kafka connection to brokers: ${brokers.join(', ')}`, 'kafka');

    const kafkaConfig = {
      clientId: 'content-processing-service',
      brokers,
      ssl: true,
      sasl,
      connectionTimeout: 30000,
      authenticationTimeout: 15000,
      retry: {
        initialRetryTime: 5000,
        retries: 15,
        maxRetryTime: 60000,
        factor: 2,
      },
      logLevel: 2 // INFO level
    };

    log(`Kafka configuration: ${JSON.stringify({
      ssl: true,
      sasl: !!sasl,
      brokers,
      connectionTimeout: kafkaConfig.connectionTimeout,
      authenticationTimeout: kafkaConfig.authenticationTimeout,
      retry: kafkaConfig.retry
    }, null, 2)}`, 'kafka');

    const kafka = new Kafka(kafkaConfig);

    consumer = kafka.consumer({
      groupId: process.env.KAFKA_GROUP_ID || 'emso-processor'
    });

    await consumer.connect();

    const topics = process.env.KAFKA_TOPICS?.split(',') || ['content_management'];
    for (const topic of topics) {
      await consumer.subscribe({ topic, fromBeginning: true });
    }

    log('Connected to Kafka and subscribed to topics: ' + topics.join(', '), 'kafka');

    await consumer.run({
      eachMessage: async (payload: EachMessagePayload) => {
        const { message } = payload;
        const parsedMessage = parseMessage(message.value);

        if (!parsedMessage) return;

        if ('externalId' in parsedMessage) {
          await processContentMessage(parsedMessage as ContentMessage);
        } else if ('full_name' in parsedMessage) {
          await processSupportMessage(parsedMessage as SupportMessage);
        }
      },
    });

    return consumer;
  } catch (error) {
    log(`Error setting up Kafka consumer: ${error}`, 'kafka-error');
    throw error;
  }
}

function parseMessage(messageValue: Buffer | null): ContentMessage | SupportMessage | null {
  if (!messageValue) return null;

  try {
    const value = messageValue.toString();
    const message = JSON.parse(value);

    if ('full_name' in message && 'email' in message) {
      return message as SupportMessage;
    } else if ('externalId' in message) {
      return message as ContentMessage;
    }

    return null;
  } catch (error) {
    log(`Error parsing message: ${error}`, 'kafka-error');
    return null;
  }
}

async function processContentMessage(contentMessage: ContentMessage) {
  try {
    const activeUsers = await db.select().from(users).where(eq(users.status, 'active'));

    if (!activeUsers || activeUsers.length === 0) {
      log('No active users found to assign request.', 'kafka');
      return;
    }

    const lastAssignedRequest = await db.query.supportRequests.findFirst({
      orderBy: (supportRequests, { desc }) => [desc(supportRequests.assigned_at)],
    });

    let nextAssigneeIndex = 0;
    if (lastAssignedRequest && lastAssignedRequest.assigned_to_id) {
      const lastAssigneeIndex = activeUsers.findIndex(
        user => user.id === lastAssignedRequest.assigned_to_id
      );
      if (lastAssigneeIndex !== -1) {
        nextAssigneeIndex = (lastAssigneeIndex + 1) % activeUsers.length;
      }
    }

    const assigned_to_id = activeUsers[nextAssigneeIndex].id;
    const now = new Date();

    const insertData = {
      full_name: "System Generated",
      email: "system@example.com",
      subject: `Auto Request content:${contentMessage.externalId}`,
      content: `Auto-generated request from Kafka message: ${JSON.stringify(contentMessage)}`,
      status: 'pending',
      assigned_to_id,
      assigned_at: now,
      created_at: now,
      updated_at: now
    };

    const newRequest = await db.insert(supportRequests).values(insertData).returning();
    log(`Content request created and assigned to user ID ${assigned_to_id}`, 'kafka');

    return newRequest[0];
  } catch (error) {
    log(`Error processing content message: ${error}`, 'kafka-error');
    throw error;
  }
}

async function processSupportMessage(message: SupportMessage) {
  try {
    const activeUsers = await db.select().from(users).where(eq(users.status, 'active'));

    if (!activeUsers || activeUsers.length === 0) {
      log('No active users found to assign request.', 'kafka');
      return;
    }

    const lastAssignedRequest = await db.query.supportRequests.findFirst({
      orderBy: (supportRequests, { desc }) => [desc(supportRequests.assigned_at)],
    });

    let nextAssigneeIndex = 0;
    if (lastAssignedRequest && lastAssignedRequest.assigned_to_id) {
      const lastAssigneeIndex = activeUsers.findIndex(
        user => user.id === lastAssignedRequest.assigned_to_id
      );
      if (lastAssigneeIndex !== -1) {
        nextAssigneeIndex = (lastAssigneeIndex + 1) % activeUsers.length;
      }
    }

    const assigned_to_id = activeUsers[nextAssigneeIndex].id;
    const now = new Date();

    const insertData = {
      ...message,
      status: 'pending',
      assigned_to_id,
      assigned_at: now,
      created_at: now,
      updated_at: now
    };

    const newRequest = await db.insert(supportRequests).values(insertData).returning();
    log(`Support request created and assigned to user ID ${assigned_to_id}`, 'kafka');

    return newRequest[0];
  } catch (error) {
    log(`Error processing support message: ${error}`, 'kafka-error');
    throw error;
  }
}

export async function disconnectKafkaConsumer() {
  if (consumer) {
    await consumer.disconnect();
    log('Disconnected from Kafka', 'kafka');
  }
}