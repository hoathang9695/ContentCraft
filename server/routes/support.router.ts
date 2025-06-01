
import express from "express";
import { SupportController } from "../controllers/support.controller";
import { isAuthenticated } from "../middleware/auth";
import { db } from "../db";
import { supportRequests, users } from "@shared/schema";
import { desc, eq, and } from 'drizzle-orm';

const router = express.Router();
const supportController = new SupportController();

// Override support requests to filter by type = 'support'
router.get("/", isAuthenticated, async (req, res) => {
  console.log('Fetching support requests (type=support only)');
  try {
    const user = req.user as Express.User;
    let result;

    const typeCondition = eq(supportRequests.type, 'support');

    if (user.role === 'admin') {
      result = await db.select({
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
      .where(typeCondition)
      .orderBy(desc(supportRequests.created_at));
    } else {
      result = await db.select({
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
      .where(and(typeCondition, eq(supportRequests.assigned_to_id, user.id)))
      .orderBy(desc(supportRequests.created_at));
    }

    console.log(`Found ${result.length} support requests (type=support)`);
    return res.json(result || []);
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
