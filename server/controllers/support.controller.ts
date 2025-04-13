
import { Request, Response } from "express";
import { db } from "../db";
import { supportRequests, users } from "@shared/schema";
import { desc, eq } from 'drizzle-orm';

export class SupportController {
  async getAllSupportRequests(req: Request, res: Response) {
    console.log('Fetching support requests');
    try {
      console.log('User:', req.user);
      const user = req.user as Express.User;
      let result;

      if (user.role === 'admin') {
        result = await db.select({
          ...supportRequests,
          assigned_to_name: users.name
        })
        .from(supportRequests)
        .leftJoin(users, eq(supportRequests.assigned_to_id, users.id))
        .orderBy(desc(supportRequests.created_at));
      } else {
        result = await db.select({
          ...supportRequests,
          assigned_to_name: users.name
        })
        .from(supportRequests)
        .leftJoin(users, eq(supportRequests.assigned_to_id, users.id))
        .where(eq(supportRequests.assigned_to_id, user.id))
        .orderBy(desc(supportRequests.created_at));
      }

      console.log(`Found ${result.length} support requests`);
      return res.json(result || []);
    } catch (err) {
      console.error('Error fetching support requests:', err);
      return res.status(500).json({ 
        message: 'Error fetching support requests',
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }
}
