import { Router } from 'express';
import { db } from '../db';
import { notifications, realUsers } from '@shared/schema';
import { desc, eq, and, gte, lte, sql, isNotNull } from 'drizzle-orm';
import { isAuthenticated } from '../middleware/auth';
import { firebaseService } from '../firebase-service';

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

// Test push notification endpoint
router.post('/notifications/test-push', isAuthenticated, async (req, res) => {
  try {
    const user = req.user as Express.User;
    const { deviceToken, title, message, clickAction, type, url } = req.body;

    // Validate required fields
    if (!deviceToken || !title || !message) {
      return res.status(400).json({ 
        message: 'Device token, title, and message are required' 
      });
    }

    console.log('📱 Test push notification request:', {
      deviceToken: deviceToken.substring(0, 20) + '...',
      title,
      message,
      sentBy: user.username
    });

    try {
      // Send actual push notification via Firebase FCM
      const response = await firebaseService.sendPushNotification(deviceToken, title, message, {
        clickAction,
        type,
        url
      });

      console.log('✅ Firebase FCM response:', response);

      res.json({
        message: 'Test push notification sent successfully via Firebase FCM',
        data: {
          deviceToken: deviceToken.substring(0, 20) + '...',
          title,
          message,
          sentAt: new Date().toISOString(),
          sentBy: user.username,
          fcmResponse: response
        }
      });

    } catch (fcmError) {
      console.error('❌ Firebase FCM Error:', fcmError);

      // Check if it's a token validation error
      if (fcmError instanceof Error) {
        if (fcmError.message.includes('registration-token-not-registered') || 
            fcmError.message.includes('invalid-registration-token')) {
          return res.status(400).json({
            message: 'Invalid device token. Please check the token and try again.',
            error: 'Invalid registration token'
          });
        }
      }

      return res.status(500).json({
        message: 'Failed to send push notification via Firebase FCM',
        error: fcmError instanceof Error ? fcmError.message : 'Unknown FCM error'
      });
    }

  } catch (error) {
    console.error('❌ Error sending test push notification:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Send notification to target audience
router.post("/notifications/:id/send", isAuthenticated, async (req, res) => {
  try {
    const user = req.user as Express.User;
    const notificationId = parseInt(req.params.id);

    console.log(`📤 Starting to send notification ID: ${notificationId} by user: ${user.username}`);

    // Get notification details
    const notification = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, notificationId))
      .limit(1);

    if (notification.length === 0) {
      return res.status(404).json({ message: "Notification not found" });
    }

    const notif = notification[0];

    // Allow both 'approved' and 'draft' status to be sent for testing
    if (notif.status !== "approved" && notif.status !== "draft") {
      return res.status(400).json({ 
        message: "Only approved or draft notifications can be sent" 
      });
    }

    console.log(`📋 Notification details:`, {
      id: notif.id,
      title: notif.title,
      targetAudience: notif.targetAudience,
      status: notif.status
    });

    // Get target users based on audience
    let targetUsersQuery = db
      .select({
        id: realUsers.id,
        deviceToken: realUsers.deviceToken,
        fullName: realUsers.fullName,
        email: realUsers.email,
        classification: realUsers.classification
      })
      .from(realUsers)
      .where(isNotNull(realUsers.deviceToken));

    // Filter by target audience
    if (notif.targetAudience !== "all") {
      targetUsersQuery = targetUsersQuery.where(
        eq(realUsers.classification, notif.targetAudience)
      );
    }

    const targetUsers = await targetUsersQuery;

    console.log(`👥 Found ${targetUsers.length} users with device tokens for audience: ${notif.targetAudience}`);

    if (targetUsers.length === 0) {
      return res.status(400).json({ 
        message: `No users found with device tokens for target audience: ${notif.targetAudience}` 
      });
    }

    // Show first few users for debugging
    console.log('👤 Target users sample:', targetUsers.slice(0, 3).map(u => ({
      id: u.id,
      name: typeof u.fullName === 'object' ? u.fullName.name : u.fullName,
      email: u.email,
      classification: u.classification,
      hasToken: !!u.deviceToken
    })));

    // Send notifications to all target users
    let successCount = 0;
    let failureCount = 0;
    const results = [];

    for (const targetUser of targetUsers) {
      try {
        console.log(`📱 Sending to user: ${typeof targetUser.fullName === 'object' ? targetUser.fullName.name : targetUser.fullName}`);
        
        const result = await firebaseService.sendPushNotification(
          targetUser.deviceToken!,
          notif.title,
          notif.content,
          {
            clickAction: 'OPEN_MARKETING',
            type: 'notification',
            url: 'https://portal.emso.vn'
          }
        );

        results.push({
          userId: targetUser.id,
          email: targetUser.email,
          name: typeof targetUser.fullName === 'object' ? targetUser.fullName.name : targetUser.fullName,
          status: "success",
          fcmResponse: result
        });
        successCount++;
        console.log(`✅ Success for user ${targetUser.id}: ${result}`);
      } catch (error) {
        console.log(`❌ Failed for user ${targetUser.id}:`, error);
        results.push({
          userId: targetUser.id,
          email: targetUser.email,
          name: typeof targetUser.fullName === 'object' ? targetUser.fullName.name : targetUser.fullName,
          status: "failed",
          error: error instanceof Error ? error.message : String(error)
        });
        failureCount++;
      }
    }

    // Update notification status
    await db
      .update(notifications)
      .set({
        status: "sent",
        sentBy: user.id,
        sentAt: new Date(),
        recipientCount: targetUsers.length,
        successCount,
        failureCount,
        updatedAt: new Date()
      })
      .where(eq(notifications.id, notificationId));

    console.log(`📊 Notification sent results: ${successCount}/${targetUsers.length} successful`);

    res.json({
      message: "Notification sent successfully",
      data: {
        notificationId,
        title: notif.title,
        targetAudience: notif.targetAudience,
        totalRecipients: targetUsers.length,
        successCount,
        failureCount,
        sentAt: new Date().toISOString(),
        sentBy: user.username || "unknown",
        results: results // Return all results for debugging
      }
    });

  } catch (error) {
    console.error("❌ Error sending notification:", error);
    res.status(500).json({
      message: "Failed to send notification",
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

export { router as notificationsRouter };