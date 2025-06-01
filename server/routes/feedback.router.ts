
import { Router } from 'express';
import { db } from '../db.js';
import { eq, and, gte, lte, desc, sql, ilike, or } from 'drizzle-orm';
import { supportRequests, users } from '../../shared/schema.js';

const router = Router();

// Get all feedback requests
router.get('/feedback-requests', async (req, res) => {
  try {
    const { userId, startDate, endDate, page = 1, limit = 20 } = req.query;
    
    let query = db.select({
      id: supportRequests.id,
      full_name: supportRequests.fullName,
      email: supportRequests.email,
      subject: supportRequests.subject,
      content: supportRequests.content,
      status: supportRequests.status,
      assigned_to_id: supportRequests.assignedToId,
      assigned_to_name: users.name,
      assigned_at: supportRequests.assignedAt,
      response_content: supportRequests.responseContent,
      responder_id: supportRequests.responderId,
      response_time: supportRequests.responseTime,
      created_at: supportRequests.createdAt,
      updated_at: supportRequests.updatedAt,
    })
    .from(supportRequests)
    .leftJoin(users, eq(supportRequests.assignedToId, users.id))
    .where(eq(supportRequests.type, 'feedback'));

    // Apply filters
    const conditions = [eq(supportRequests.type, 'feedback')];
    
    if (userId) {
      conditions.push(eq(supportRequests.assignedToId, parseInt(userId as string)));
    }
    
    if (startDate) {
      conditions.push(gte(supportRequests.createdAt, new Date(startDate as string)));
    }
    
    if (endDate) {
      conditions.push(lte(supportRequests.createdAt, new Date(endDate as string)));
    }

    if (conditions.length > 1) {
      query = query.where(and(...conditions));
    }

    const result = await query.orderBy(desc(supportRequests.createdAt));
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching feedback requests:', error);
    res.status(500).json({ error: 'Failed to fetch feedback requests' });
  }
});

// Update feedback request status
router.put('/feedback-requests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, response_content } = req.body;
    const userId = req.user?.id;

    const updates: any = { status };
    
    if (response_content) {
      updates.responseContent = response_content;
      updates.responderId = userId;
      updates.responseTime = new Date();
    }

    await db.update(supportRequests)
      .set(updates)
      .where(eq(supportRequests.id, parseInt(id)));

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating feedback request:', error);
    res.status(500).json({ error: 'Failed to update feedback request' });
  }
});

export { router as feedbackRouter };
