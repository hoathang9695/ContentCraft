
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

  async updateSupportRequest(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const user = req.user as Express.User;
      
      const supportRequest = await db.query.supportRequests.findFirst({
        where: eq(supportRequests.id, parseInt(id))
      });

      if (!supportRequest) {
        return res.status(404).json({ message: 'Support request not found' });
      }

      if (user.role !== 'admin' && supportRequest.assigned_to_id !== user.id) {
        return res.status(403).json({ message: 'Not authorized to update this request' });
      }

      const updateData = {
        ...req.body,
        updated_at: new Date()
      };

      if (updateData.status === 'completed' && !updateData.response_content) {
        return res.status(400).json({ message: 'Response content is required when completing a request' });
      }

      if (updateData.status === 'completed') {
        updateData.responder_id = user.id;
        updateData.response_time = new Date();
      }

      const result = await db.update(supportRequests)
        .set(updateData)
        .where(eq(supportRequests.id, parseInt(id)))
        .returning();

      // Broadcast badge update after status change
      if ((global as any).broadcastBadgeUpdate) {
        // Add small delay to ensure DB transaction is fully committed
        setTimeout(async () => {
          await (global as any).broadcastBadgeUpdate();
        }, 100);
      }

      return res.json(result[0]);
    } catch (err) {
      console.error('Error updating support request:', err);
      return res.status(500).json({
        message: 'Error updating support request',
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }

  async assignSupportRequest(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { assigned_to_id } = req.body;
      const user = req.user as Express.User;

      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Only admins can assign requests' });
      }

      const result = await db.update(supportRequests)
        .set({
          assigned_to_id: parseInt(assigned_to_id),
          assigned_at: new Date(),
          status: 'processing',
          updated_at: new Date()
        })
        .where(eq(supportRequests.id, parseInt(id)))
        .returning();

      // Broadcast badge update after assignment  
      if ((global as any).broadcastBadgeUpdate) {
        // Add small delay to ensure DB transaction is fully committed
        setTimeout(async () => {
          await (global as any).broadcastBadgeUpdate();
        }, 100);
      }

      return res.json(result[0]);
    } catch (err) {
      console.error('Error assigning support request:', err);
      return res.status(500).json({
        message: 'Error assigning support request',
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }
}
