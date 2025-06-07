import { Router } from 'express';
import { db } from '../db';
import { supportRequests, users } from '@shared/schema';
import { desc, eq, and, gte, lte, sql, ilike, or } from 'drizzle-orm';
import { isAuthenticated } from '../middleware/auth';

const router = Router();

// Get all tick requests with server-side pagination
router.get('/tick-requests', isAuthenticated, async (req, res) => {
  try {
    const user = req.user as Express.User;
    const { 
      userId, 
      startDate, 
      endDate, 
      page = 1, 
      limit = 20,
      search = '',
      status = ''
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Base condition for tick type
    const conditions = [eq(supportRequests.type, 'tick')];

    console.log('Tick requests API called with params:', {
      userId, startDate, endDate, page, limit, search, status,
      userRole: user.role, userUsername: user.username
    });
    console.log('Base conditions length:', conditions.length);

    // Only add role-based filtering for non-admin users AND when userId is not specified
    if (user.role !== 'admin' && !userId) {
      conditions.push(eq(supportRequests.assigned_to_id, user.id));
    }

    // Add userId filter if specified (for admin users or when filtering by specific user)
    if (userId && userId !== 'all') {
      conditions.push(eq(supportRequests.assigned_to_id, parseInt(userId as string)));
    }

    // Add status filter
    if (status && status !== 'all') {
      if (status === 'pending') {
        conditions.push(eq(supportRequests.status, 'pending'));
      } else if (status === 'completed') {
        conditions.push(eq(supportRequests.status, 'completed'));
      }
    }

    if (startDate) {
      conditions.push(gte(supportRequests.created_at, new Date(startDate as string)));
    }

    if (endDate) {
      conditions.push(lte(supportRequests.created_at, new Date(endDate as string)));
    }

    // Add search conditions (exclude full_name as it's JSONB)
    if (search) {
      const searchTerm = `%${search}%`;
      conditions.push(
        or(
          ilike(supportRequests.email, searchTerm),
          ilike(supportRequests.subject, searchTerm),
          ilike(supportRequests.content, searchTerm),
          ilike(supportRequests.phone_number, searchTerm)
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
      phone_number: supportRequests.phone_number,
    })
    .from(supportRequests)
    .leftJoin(users, eq(supportRequests.assigned_to_id, users.id))
    .where(whereCondition)
    .orderBy(desc(supportRequests.created_at))
    .limit(limitNum)
    .offset(offset);

    console.log(`Found ${result.length}/${total} tick requests (type=tick) for user ${user.username} (role: ${user.role})`);
    console.log('Query conditions:', { userId, startDate, endDate, search, status, userRole: user.role });
    console.log('Where condition:', whereCondition);
    console.log('First few results:', result.slice(0, 3).map(r => ({ id: r.id, email: r.email, status: r.status, type: r.type })));
    console.log('Sending response:', {
      dataLength: result.length,
      total,
      totalPages,
      currentPage: pageNum,
      sampleData: result.slice(0, 2)
    });

    const response = {
      data: result,
      total,
      totalPages,
      currentPage: pageNum
    };

    // Debug logs
    console.log('🔍 Tick API Debug:');
    console.log('- Total tick requests found:', total);
    console.log('- Result count:', result.length);
    console.log('- Sample result:', result.length > 0 ? result[0] : 'No results');
    console.log('- Query filters:', { userId, startDate, endDate, search, status });

    console.log('Final API response structure:', Object.keys(response));
    console.log('🔍 FULL RESPONSE BEING SENT:');
    console.log('- Response object:', JSON.stringify(response, null, 2));
    console.log('- Headers about to be sent:', res.getHeaders());
    
    res.setHeader('Content-Type', 'application/json');
    res.json(response);
  } catch (err) {
    console.error('Error fetching tick requests:', err);
    return res.status(500).json({ 
      message: 'Error fetching tick requests',
      error: err instanceof Error ? err.message : String(err)
    });
  }
});

// Update tick request status
router.put('/tick-requests/:id', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, response_content } = req.body;
    const user = req.user as Express.User;

    const tickRequest = await db.query.supportRequests.findFirst({
      where: eq(supportRequests.id, parseInt(id))
    });

    if (!tickRequest) {
      return res.status(404).json({ message: 'Tick request not found' });
    }

    if (user.role !== 'admin' && tickRequest.assigned_to_id !== user.id) {
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
      return res.status(404).json({ message: 'Tick request not found' });
    }

    // Broadcast badge update to all clients when tick status changes
    if ((global as any).broadcastFeedbackBadgeUpdate) {
      // Add small delay to ensure DB transaction is fully committed
      setTimeout(async () => {
        await (global as any).broadcastFeedbackBadgeUpdate();
      }, 100);
    }

    res.json({
      message: 'Tick request updated successfully',
      data: result[0]
    });
  } catch (err) {
    console.error('Error updating tick request:', err);
    return res.status(500).json({
      message: 'Error updating tick request',
      error: err instanceof Error ? err.message : String(err)
    });
  }
});

export { router as tickRouter };