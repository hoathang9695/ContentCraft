
import { Router } from 'express';
import { db } from '../db.js';
import { eq, and, gte, lte, desc, sql, ilike, or } from 'drizzle-orm';
import { supportRequests, users } from '../../shared/schema.js';

const router = Router();

// Get all feedback requests
router.get('/feedback-requests', async (req, res) => {
  try {
    const { userId, startDate, endDate, page = 1, limit = 20 } = req.query;
    
    // Apply filters
    const conditions = [eq(supportRequests.type, 'feedback')];
    
    if (userId) {
      conditions.push(eq(supportRequests.assigned_to_id, parseInt(userId as string)));
    }
    
    if (startDate) {
      conditions.push(gte(supportRequests.created_at, new Date(startDate as string)));
    }
    
    if (endDate) {
      conditions.push(lte(supportRequests.created_at, new Date(endDate as string)));
    }

    const whereCondition = conditions.length > 1 ? and(...conditions) : conditions[0];

    const result = await db.select({
      id: supportRequests.id,
      full_name: supportRequests.full_name,
      email: supportRequests.email,
      subject: supportRequests.subject,
      content: supportRequests.content,
      status: supportRequests.status,
      assigned_to_id: supportRequests.assigned_to_id,
      assigned_to_name: users.name,
      assigned_at: supportRequests.assigned_at,
      response_content: supportRequests.response_content,
      responder_id: supportRequests.responder_id,
      response_time: supportRequests.response_time,
      created_at: supportRequests.created_at,
      updated_at: supportRequests.updated_at,
      feedback_type: supportRequests.feedback_type,
      feature_type: supportRequests.feature_type,
      detailed_description: supportRequests.detailed_description,
      attachment_url: supportRequests.attachment_url,
    })
    .from(supportRequests)
    .leftJoin(users, eq(supportRequests.assigned_to_id, users.id))
    .where(whereCondition)
    .orderBy(desc(supportRequests.created_at));
    
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
