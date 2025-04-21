
import { db } from './server/db';
import { users, realUsers } from './shared/schema';
import { eq, ne } from 'drizzle-orm';
import pg from 'pg';

async function processRealUsers() {
  // Tạo kết nối trực tiếp đến database
  const client = new pg.Client({
    host: "42.96.40.138",
    user: "postgres", 
    password: "chiakhoathanhcong",
    database: "content",
    port: 5432
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Get active non-admin users for assignment
    const activeUsers = await db
      .select()
      .from(users)
      .where(
        eq(users.status, 'active'),
        ne(users.role, 'admin')
      );

    console.log('Found active users:', activeUsers);

    if (!activeUsers || activeUsers.length === 0) {
      throw new Error('No active non-admin users found');
    }

    const now = new Date();

    // Create first user
    console.log('Inserting first user...');
    const insertQuery1 = `
      INSERT INTO "realUsers" (id, "fullName", email, verified, "lastLogin", "assignedToId", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const result1 = await client.query(insertQuery1, [
      113728049762216423,
      'Hoàng Ngọc Lan',
      'example@gmail.com',
      'verified',
      now,
      activeUsers[0].id,
      now,
      now
    ]);

    console.log('First user inserted:', result1.rows[0]);

    // Create second user
    console.log('Inserting second user...');
    const insertQuery2 = `
      INSERT INTO "realUsers" (id, "fullName", email, verified, "lastLogin", "assignedToId", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const result2 = await client.query(insertQuery2, [
      113728049762216424,
      'Hoàng Ngọc Dương',
      'duong@example.com',
      'verified',
      now,
      activeUsers[1 % activeUsers.length].id,
      now,
      now
    ]);

    console.log('Second user inserted:', result2.rows[0]);

    // Verify final results
    const finalUsers = await client.query('SELECT * FROM "realUsers"');
    console.log('Total real users after insert:', finalUsers.rows.length);
    console.log('All real users:', finalUsers.rows);

  } catch (error) {
    console.error('Error processing real users:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run simulation
processRealUsers()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('Script failed:', err);
    process.exit(1);
  });
