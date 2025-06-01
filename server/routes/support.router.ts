
import express from "express";
import { SupportController } from "../controllers/support.controller";
import { isAuthenticated } from "../middleware/auth";
import { db } from "../db";
import { supportRequests, users } from "@shared/schema";
import { desc, eq, and, gte, lte, sql, ilike, or } from 'drizzle-orm';

const router = express.Router();
const supportController = new SupportController();

// Override support requests to filter by type = 'support' with server-side pagination
router.get("/", isAuthenticated, async (req, res) => {
  console.log('Fetching support requests (type=support only) with pagination');
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

    // Base condition for support type
    const conditions = [eq(supportRequests.type, 'support')];

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
    })
    .from(supportRequests)
    .leftJoin(users, eq(supportRequests.assigned_to_id, users.id))
    .where(whereCondition)
    .orderBy(desc(supportRequests.created_at))
    .limit(limitNum)
    .offset(offset);

    console.log(`Found ${result.length}/${total} support requests (type=support)`);
    
    res.json({
      data: result,
      total,
      totalPages,
      currentPage: pageNum
    });
  } catch (err) {
    console.error('Error fetching support requests:', err);
    return res.status(500).json({ 
      message: 'Error fetching support requests',
      error: err instanceof Error ? err.message : String(err)
    });
  }
});

router.put("/:id", isAuthenticated, supportController.updateSupportRequest);
router.put("/:id/assign", isAuthenticated, supportController.assignSupportRequest);

export default router;
