import fs from 'fs';
import path from 'path';
import { db } from './server/db.ts';
import * as schema from './shared/schema.ts';

const { users, categories, labels, contents } = schema;

// Function to import users
async function importUsers() {
  try {
    console.log('Importing users...');
    const userData = JSON.parse(fs.readFileSync('./attached_assets/users.json', 'utf8'));
    
    // Transform the data to match the schema
    const transformedUserData = userData.map(user => ({
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
      createdAt: user.created_at ? new Date(user.created_at) : new Date()
    }));
    
    // Insert users
    const insertResult = await db.insert(users).values(transformedUserData).onConflictDoUpdate({
      target: users.id,
      set: {
        username: users.username,
        password: users.password,
        name: users.name,
        email: users.email,
        department: users.department,
        position: users.position,
        role: users.role,
        status: users.status,
        avatarUrl: users.avatarUrl,
        createdAt: users.createdAt
      }
    }).returning();
    
    console.log(`Successfully imported ${insertResult.length} users.`);
    return insertResult;
  } catch (error) {
    console.error('Error importing users:', error);
    throw error;
  }
}

// Function to import categories
async function importCategories() {
  try {
    console.log('Importing categories...');
    const categoryData = JSON.parse(fs.readFileSync('./attached_assets/categories.json', 'utf8'));
    
    // Transform the data to match the schema
    const transformedCategoryData = categoryData.map(category => ({
      id: category.id,
      name: category.name,
      description: category.description,
      createdAt: category.created_at ? new Date(category.created_at) : new Date(),
      updatedAt: category.updated_at ? new Date(category.updated_at) : new Date()
    }));
    
    // Insert categories
    const insertResult = await db.insert(categories).values(transformedCategoryData).onConflictDoUpdate({
      target: categories.id,
      set: {
        name: categories.name,
        description: categories.description,
        createdAt: categories.createdAt,
        updatedAt: categories.updatedAt
      }
    }).returning();
    
    console.log(`Successfully imported ${insertResult.length} categories.`);
    return insertResult;
  } catch (error) {
    console.error('Error importing categories:', error);
    throw error;
  }
}

// Function to import labels
async function importLabels() {
  try {
    console.log('Importing labels...');
    const labelData = JSON.parse(fs.readFileSync('./attached_assets/labels.json', 'utf8'));
    
    // Transform the data to match the schema
    const transformedLabelData = labelData.map(label => ({
      id: label.id,
      name: label.name,
      categoryId: label.category_id, // Map category_id to categoryId
      description: label.description,
      createdAt: label.created_at ? new Date(label.created_at) : new Date(),
      updatedAt: label.updated_at ? new Date(label.updated_at) : new Date()
    }));
    
    // Insert labels
    const insertResult = await db.insert(labels).values(transformedLabelData).onConflictDoUpdate({
      target: labels.id,
      set: {
        name: labels.name,
        categoryId: labels.categoryId,
        description: labels.description,
        createdAt: labels.createdAt,
        updatedAt: labels.updatedAt
      }
    }).returning();
    
    console.log(`Successfully imported ${insertResult.length} labels.`);
    return insertResult;
  } catch (error) {
    console.error('Error importing labels:', error);
    throw error;
  }
}

// Function to import contents
async function importContents() {
  try {
    console.log('Importing contents...');
    const contentData = JSON.parse(fs.readFileSync('./attached_assets/contents.json', 'utf8'));
    
    // Transform the data to match the schema
    const transformedContentData = contentData.map(content => ({
      id: content.id,
      externalId: content.external_id,
      source: content.source,
      categories: content.categories,
      labels: content.labels,
      status: content.status,
      sourceVerification: content.source_verification,
      assignedToId: content.assigned_to_id,
      assignedAt: content.assigned_at ? new Date(content.assigned_at) : null,
      approverId: content.approver_id,
      approveTime: content.approve_time ? new Date(content.approve_time) : null,
      comments: content.comments,
      reactions: content.reactions,
      processingResult: content.processing_result,
      safe: content.safe,
      createdAt: content.created_at ? new Date(content.created_at) : new Date(),
      updatedAt: content.updated_at ? new Date(content.updated_at) : new Date()
    }));
    
    // Insert contents
    const insertResult = await db.insert(contents).values(transformedContentData).onConflictDoUpdate({
      target: contents.id,
      set: {
        externalId: contents.externalId,
        source: contents.source,
        categories: contents.categories,
        labels: contents.labels,
        status: contents.status,
        sourceVerification: contents.sourceVerification,
        assignedToId: contents.assignedToId,
        assignedAt: contents.assignedAt,
        approverId: contents.approverId,
        approveTime: contents.approveTime,
        comments: contents.comments,
        reactions: contents.reactions,
        processingResult: contents.processingResult,
        safe: contents.safe,
        createdAt: contents.createdAt,
        updatedAt: contents.updatedAt
      }
    }).returning();
    
    console.log(`Successfully imported ${insertResult.length} contents.`);
    return insertResult;
  } catch (error) {
    console.error('Error importing contents:', error);
    throw error;
  }
}

// Main function to import all data
async function importAllData() {
  try {
    // Import in proper order to respect foreign key constraints
    await importUsers();
    await importCategories();
    await importLabels();
    await importContents();
    
    console.log('All data imported successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error importing data:', error);
    process.exit(1);
  }
}

// Run the import
importAllData();