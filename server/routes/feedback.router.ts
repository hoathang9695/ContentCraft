import { Router } from 'express';
import { db } from '../db.js';
import { eq, and, gte, lte, desc, sql, ilike, or } from 'drizzle-orm';
import { supportRequests, users } from '../../shared/schema.js';

const router = Router();

// Get all feedback requests with server-side pagination
router.get('/feedback-requests', async (req, res) => {
  try {
    const { 
      userId, 
      startDate, 
      endDate, 
      page = 1, 
      limit = 20,
      search = ''
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

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

    // Add search conditions
    if (search) {
      const searchTerm = `%${search}%`;
      conditions.push(
        or(
          ilike(supportRequests.full_name, searchTerm),
          ilike(supportRequests.email, searchTerm),
          ilike(supportRequests.subject, searchTerm),
          ilike(supportRequests.content, searchTerm)
        )
      );
    }

    const whereCondition = conditions.length > 1 ? and(...conditions) : conditions[0];

    // Get total count
    const totalResult = await db.select({ 
      count: sql<number>`count(*)` 
    })
    .from(supportRequests)
    .where(whereCondition);

    const total = totalResult[0]?.count || 0;
    const totalPages = Math.ceil(total / limitNum);

    // Get paginated data
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
    .orderBy(desc(supportRequests.created_at))
    .limit(limitNum)
    .offset(offset);

    res.json({
      data: result,
      total,
      totalPages,
      currentPage: pageNum
    });
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

    // Broadcast feedback badge update after status change
    if ((global as any).broadcastFeedbackBadgeUpdate) {
      await (global as any).broadcastFeedbackBadgeUpdate();
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating feedback request:', error);
    res.status(500).json({ error: 'Failed to update feedback request' });
  }
});

export { router as feedbackRouter };
```

```
</replit_final_file>
import { Router } from 'express';
import { db } from '../db.js';
import { eq, and, gte, lte, desc, sql, ilike, or } from 'drizzle-orm';
import { supportRequests, users } from '../../shared/schema.js';

const router = Router();

// Get all feedback requests with server-side pagination
router.get('/feedback-requests', async (req, res) => {
  try {
    const { 
      userId, 
      startDate, 
      endDate, 
      page = 1, 
      limit = 20,
      search = ''
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

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

    // Add search conditions
    if (search) {
      const searchTerm = `%${search}%`;
      conditions.push(
        or(
          ilike(supportRequests.full_name, searchTerm),
          ilike(supportRequests.email, searchTerm),
          ilike(supportRequests.subject, searchTerm),
          ilike(supportRequests.content, searchTerm)
        )
      );
    }

    const whereCondition = conditions.length > 1 ? and(...conditions) : conditions[0];

    // Get total count
    const totalResult = await db.select({ 
      count: sql<number>`count(*)` 
    })
    .from(supportRequests)
    .where(whereCondition);

    const total = totalResult[0]?.count || 0;
    const totalPages = Math.ceil(total / limitNum);

    // Get paginated data
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
    .orderBy(desc(supportRequests.created_at))
    .limit(limitNum)
    .offset(offset);

    res.json({
      data: result,
      total,
      totalPages,
      currentPage: pageNum
    });
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

    // Broadcast feedback badge update after status change
    if ((global as any).broadcastFeedbackBadgeUpdate) {
      await (global as any).broadcastFeedbackBadgeUpdate();
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating feedback request:', error);
    res.status(500).json({ error: 'Failed to update feedback request' });
  }
});

export { router as feedbackRouter };
</replit_final_file>