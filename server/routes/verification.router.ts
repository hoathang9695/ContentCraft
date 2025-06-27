import { Router } from 'express';
import { db } from '../db';
import { supportRequests, users } from '@shared/schema';
import { desc, eq, and, gte, lte, sql, ilike, or } from 'drizzle-orm';
import { isAuthenticated } from '../middleware/auth';

const router = Router();

// Get all verification requests with server-side pagination
router.get('/verification-requests', isAuthenticated, async (req, res) => {
  try {
    const user = req.user as Express.User;
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

    // Base condition for verification type
    const conditions = [eq(supportRequests.type, 'verify')];

    // Add role-based filtering
    if (user.role !== 'admin') {
      conditions.push(eq(supportRequests.assigned_to_id, user.id));
    }

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
      type: supportRequests.type,
      attachment_url: supportRequests.attachment_url,
      verification_name: supportRequests.verification_name,
      phone_number: supportRequests.phone_number,
      identity_verification_id: supportRequests.identity_verification_id,
    })
    .from(supportRequests)
    .leftJoin(users, eq(supportRequests.assigned_to_id, users.id))
    .where(whereCondition)
    .orderBy(desc(supportRequests.created_at))
    .limit(limitNum)
    .offset(offset);

    console.log(`Found ${result.length}/${total} verification requests (type=verify)`);

    res.json({
      data: result,
      total,
      totalPages,
      currentPage: pageNum
    });
  } catch (err) {
    console.error('Error fetching verification requests:', err);
    return res.status(500).json({ 
      message: 'Error fetching verification requests',
      error: err instanceof Error ? err.message : String(err)
    });
  }
});

// Update verification request status
router.put('/verification-requests/:id', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, response_content } = req.body;
    const user = req.user as Express.User;

    const verificationRequest = await db.query.supportRequests.findFirst({
      where: eq(supportRequests.id, parseInt(id))
    });

    if (!verificationRequest) {
      return res.status(404).json({ message: 'Verification request not found' });
    }

    if (user.role !== 'admin' && verificationRequest.assigned_to_id !== user.id) {
      return res.status(403).json({ message: 'Not authorized to update this request' });
    }

    const updateData = {
      status,
      updated_at: new Date()
    };

    if (response_content) {
      updateData.response_content = response_content;
      updateData.responder_id = user.id;
      updateData.response_time = new Date();
    }

    if (status === 'completed') {
      updateData.responder_id = user.id;
      updateData.response_time = new Date();
    }

    const result = await db
      .update(supportRequests)
      .set(updateData)
      .where(eq(supportRequests.id, parseInt(id)))
      .returning();

    if (result.length === 0) {
      return res.status(404).json({ message: 'Verification request not found' });
    }

    // Broadcast badge update to all clients when verification status changes
    if ((global as any).broadcastFeedbackBadgeUpdate) {
      // Add small delay to ensure DB transaction is fully committed
      setTimeout(async () => {
        await (global as any).broadcastFeedbackBadgeUpdate();
      }, 100);
    }

    res.json({
      message: 'Verification request updated successfully',
      data: result[0]
    });
  } catch (err) {
    console.error('Error updating verification request:', err);
    return res.status(500).json({
      message: 'Error updating verification request',
      error: err instanceof Error ? err.message : String(err)
    });
  }
});

export { router as verificationRouter };