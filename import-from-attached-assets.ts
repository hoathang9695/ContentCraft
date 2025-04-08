import fs from 'fs';
import { db } from './server/db';
import { users, contents, categories, labels, userActivities } from './shared/schema';

async function importData() {
  try {
    console.log('Connecting to database...');
    
    // Step 1: Clear all existing data
    console.log('Clearing existing data...');
    await db.delete(contents);
    await db.delete(labels);
    await db.delete(categories);
    await db.delete(userActivities); // Xóa user_activities trước
    await db.delete(users);
    
    // Step 2: Read data from attached_assets
    console.log('Reading data from files...');
    const usersData = JSON.parse(fs.readFileSync('./attached_assets/users.json', 'utf8'));
    const categoriesData = JSON.parse(fs.readFileSync('./attached_assets/categories.json', 'utf8'));
    const labelsData = JSON.parse(fs.readFileSync('./attached_assets/labels.json', 'utf8'));
    const contentsData = JSON.parse(fs.readFileSync('./attached_assets/contents.json', 'utf8'));
    
    // Step 3: Insert users data
    console.log('Importing users...');
    for (const user of usersData) {
      await db.insert(users).values({
        id: user.id,
        username: user.username,
        password: user.password,
        name: user.name,
        email: user.email,
        department: user.department,
        position: user.position,
        role: user.role,
        status: user.status,
        avatarUrl: user.avatar_url,
        createdAt: new Date(user.created_at)
      }).onConflictDoUpdate({
        target: users.id,
        set: {
          username: user.username,
          password: user.password,
          name: user.name,
          email: user.email,
          department: user.department,
          position: user.position,
          role: user.role,
          status: user.status,
          avatarUrl: user.avatar_url,
          createdAt: new Date(user.created_at)
        }
      });
    }
    console.log(`Imported ${usersData.length} users`);
    
    // Step 4: Insert categories data
    console.log('Importing categories...');
    for (const category of categoriesData) {
      await db.insert(categories).values({
        id: category.id,
        name: category.name,
        description: category.description,
        createdAt: new Date(category.created_at),
        updatedAt: new Date(category.updated_at)
      }).onConflictDoUpdate({
        target: categories.id,
        set: {
          name: category.name,
          description: category.description,
          createdAt: new Date(category.created_at),
          updatedAt: new Date(category.updated_at)
        }
      });
    }
    console.log(`Imported ${categoriesData.length} categories`);
    
    // Step 5: Insert labels data
    console.log('Importing labels...');
    for (const label of labelsData) {
      await db.insert(labels).values({
        id: label.id,
        name: label.name,
        categoryId: label.category_id,
        description: label.description,
        createdAt: new Date(label.created_at),
        updatedAt: new Date(label.updated_at)
      }).onConflictDoUpdate({
        target: labels.id,
        set: {
          name: label.name,
          categoryId: label.category_id,
          description: label.description,
          createdAt: new Date(label.created_at),
          updatedAt: new Date(label.updated_at)
        }
      });
    }
    console.log(`Imported ${labelsData.length} labels`);
    
    // Step 6: Insert contents data
    console.log('Importing contents...');
    for (const content of contentsData) {
      await db.insert(contents).values({
        id: content.id,
        externalId: content.external_id,
        source: content.source,
        categories: content.categories,
        labels: content.labels,
        status: content.status,
        sourceVerification: content.source_verification,
        assigned_to_id: content.assigned_to_id,
        assignedAt: content.assigned_at ? new Date(content.assigned_at) : null,
        approver_id: content.approver_id,
        approveTime: content.approve_time ? new Date(content.approve_time) : null,
        comments: content.comments,
        reactions: content.reactions,
        processingResult: content.processing_result,
        safe: content.safe,
        createdAt: new Date(content.created_at),
        updatedAt: new Date(content.updated_at)
      }).onConflictDoUpdate({
        target: contents.id,
        set: {
          externalId: content.external_id,
          source: content.source,
          categories: content.categories,
          labels: content.labels,
          status: content.status,
          sourceVerification: content.source_verification,
          assigned_to_id: content.assigned_to_id,
          assignedAt: content.assigned_at ? new Date(content.assigned_at) : null,
          approver_id: content.approver_id,
          approveTime: content.approve_time ? new Date(content.approve_time) : null,
          comments: content.comments,
          reactions: content.reactions,
          processingResult: content.processing_result,
          safe: content.safe,
          createdAt: new Date(content.created_at),
          updatedAt: new Date(content.updated_at)
        }
      });
    }
    console.log(`Imported ${contentsData.length} contents`);
    
    console.log('All data imported successfully!');
  } catch (error) {
    console.error('Error importing data:', error);
  }
}

importData().then(() => process.exit(0));