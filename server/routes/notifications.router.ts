
import { Router } from 'express';
import { db } from '../db';
import { notifications } from '@shared/schema';
import { desc, eq, and, gte, lte, sql } from 'drizzle-orm';
import { isAuthenticated } from '../middleware/auth';

const router = Router();

// Get all notifications with pagination
router.get('/notifications', isAuthenticated, async (req, res) => {
  try {
    const user = req.user as Express.User;
    const { 
      page = 1, 
      limit = 20,
      status,
      targetAudience
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];

    if (status) {
      conditions.push(eq(notifications.status, status as string));
    }

    if (targetAudience) {
      conditions.push(eq(notifications.targetAudience, targetAudience as string));
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const totalResult = await db.select({ 
      count: sql<number>`count(*)` 
    })
    .from(notifications)
    .where(whereCondition);

    const total = totalResult[0]?.count || 0;
    const totalPages = Math.ceil(total / limitNum);

    // Get paginated data
    const result = await db.select()
      .from(notifications)
      .where(whereCondition)
      .orderBy(desc(notifications.createdAt))
      .limit(limitNum)
      .offset(offset);

    res.json({
      data: result,
      total,
      totalPages,
      currentPage: pageNum
    });
  } catch (err) {
    console.error('Error fetching notifications:', err);
    return res.status(500).json({ 
      message: 'Error fetching notifications',
      error: err instanceof Error ? err.message : String(err)
    });
  }
});

// Create new notification
router.post('/notifications', isAuthenticated, async (req, res) => {
  try {
    const user = req.user as Express.User;
    const { title, message, targetAudience, urgency } = req.body;

    if (!title || !message) {
      return res.status(400).json({ message: 'Title and message are required' });
    }

    const newNotification = {
      title,
      content: message,
      targetAudience: targetAudience || 'all',
      status: urgency || 'draft', // Map urgency to status
      createdBy: user.id,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db
      .insert(notifications)
      .values(newNotification)
      .returning();

    console.log('✅ New notification created:', result[0]);

    res.json({
      message: 'Notification created successfully',
      data: result[0]
    });
  } catch (err) {
    console.error('Error creating notification:', err);
    return res.status(500).json({
      message: 'Error creating notification',
      error: err instanceof Error ? err.message : String(err)
    });
  }
});

// Update notification
router.put('/notifications/:id', isAuthenticated, async (req, res) => {
  try {
    const user = req.user as Express.User;
    const { id } = req.params;
    const { title, content, targetAudience, status } = req.body;

    const updateData: any = {
      updatedAt: new Date()
    };

    // Update basic fields if provided
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (targetAudience !== undefined) updateData.targetAudience = targetAudience;
    if (status !== undefined) updateData.status = status;

    // Handle status-specific logic
    if (status === 'approved' && user.role === 'admin') {
      updateData.approvedBy = user.id;
      updateData.approvedAt = new Date();
    }

    if (status === 'sent' && user.role === 'admin') {
      updateData.sentBy = user.id;
      updateData.sentAt = new Date();
    }

    const result = await db
      .update(notifications)
      .set(updateData)
      .where(eq(notifications.id, parseInt(id)))
      .returning();

    if (result.length === 0) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    console.log('✅ Notification updated successfully:', result[0]);

    res.json({
      message: 'Notification updated successfully',
      data: result[0]
    });
  } catch (err) {
    console.error('Error updating notification:', err);
    return res.status(500).json({
      message: 'Error updating notification',
      error: err instanceof Error ? err.message : String(err)
    });
  }
});

// Delete notification
router.delete('/notifications/:id', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db
      .delete(notifications)
      .where(eq(notifications.id, parseInt(id)))
      .returning();

    if (result.length === 0) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({
      message: 'Notification deleted successfully'
    });
  } catch (err) {
    console.error('Error deleting notification:', err);
    return res.status(500).json({
      message: 'Error deleting notification',
      error: err instanceof Error ? err.message : String(err)
    });
  }
});

export { router as notificationsRouter };
