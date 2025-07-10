import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth';
import { db } from '../db';
import { complainManagement } from '../../shared/schema';
import { eq, and, or, ilike, gte, lte, desc, asc } from 'drizzle-orm';

const router = Router();

// Get all complaint requests with filtering and pagination
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const { 
      page = '1', 
      pageSize = '10', 
      status, 
      complainType, 
      assignedTo, 
      search, 
      startDate, 
      endDate,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.query;

    const pageNum = parseInt(page as string);
    const size = parseInt(pageSize as string);
    const offset = (pageNum - 1) * size;

    // Build where conditions
    const conditions = [];

    if (status && status !== 'all') {
      conditions.push(eq(complainManagement.status, status as string));
    }

    if (complainType && complainType !== 'all') {
      conditions.push(eq(complainManagement.complainType, complainType as string));
    }

    if (assignedTo) {
      conditions.push(eq(complainManagement.assignedToId, parseInt(assignedTo as string)));
    }

    if (search) {
      const searchConditions = [
        ilike(complainManagement.reason, `%${search}%`),
        ilike(complainManagement.descriptions, `%${search}%`)
      ];
      conditions.push(or(...searchConditions));
    }

    if (startDate) {
      conditions.push(gte(complainManagement.createdAt, new Date(startDate as string)));
    }

    if (endDate) {
      conditions.push(lte(complainManagement.createdAt, new Date(endDate as string)));
    }

    // Build sort order
    const sortField = complainManagement[sortBy as keyof typeof complainManagement] || complainManagement.createdAt;
    const orderBy = sortOrder === 'asc' ? asc(sortField) : desc(sortField);

    // Get total count for pagination
    const totalResult = await db
      .select()
      .from(complainManagement)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = totalResult.length;
    const totalPages = Math.ceil(total / size);

    // Get paginated results
    const complaints = await db
      .select()
      .from(complainManagement)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(orderBy)
      .limit(size)
      .offset(offset);

    // Transform data for complaints
    const transformedComplaints = complaints.map(complaint => ({
      id: complaint.id,
      complainedId: complaint.activityId,
      complaintType: complaint.complainType,
      complainantName: complaint.complainerInfo,
      complainantEmail: (complaint.complainerInfo as any)?.email || '',
      reason: complaint.reason,
      detailedReason: complaint.descriptions,
      status: complaint.status,
      assignedToId: complaint.assignedToId,
      assignedToName: complaint.assignedToName,
      assignedAt: complaint.assignedAt,
      responseContent: complaint.responseContent,
      responderId: complaint.responderId,
      responseTime: complaint.responseTime,
      createdAt: complaint.createdAt,
      updatedAt: complaint.updatedAt,
      mediaAttachment: complaint.mediaAttachment
    }));

    res.json({
      complaints: transformedComplaints,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount: total,
        pageSize: size
      }
    });
  } catch (error) {
    console.error('Error fetching complaints:', error);
    res.status(500).json({ error: 'Failed to fetch complaints' });
  }
});

// Assign complaint to user
router.patch('/:id/assign', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedToId } = req.body;

    const result = await db
      .update(complainManagement)
      .set({
        assignedToId: assignedToId,
        assignedAt: new Date(),
        status: 'processing',
        updatedAt: new Date()
      })
      .where(eq(complainManagement.id, parseInt(id)))
      .returning();

    if (result.length === 0) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    // Broadcast badge update
    if ((global as any).broadcastComplaintBadgeUpdate) {
      (global as any).broadcastComplaintBadgeUpdate();
    }

    res.json({ message: 'Complaint assigned successfully', complaint: result[0] });
  } catch (error) {
    console.error('Error assigning complaint:', error);
    res.status(500).json({ error: 'Failed to assign complaint' });
  }
});

// Update complaint status
router.patch('/:id/status', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const result = await db
      .update(complainManagement)
      .set({
        status: status,
        updatedAt: new Date()
      })
      .where(eq(complainManagement.id, parseInt(id)))
      .returning();

    if (result.length === 0) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    // Broadcast badge update
    if ((global as any).broadcastComplaintBadgeUpdate) {
      (global as any).broadcastComplaintBadgeUpdate();
    }

    res.json({ message: 'Complaint status updated successfully', complaint: result[0] });
  } catch (error) {
    console.error('Error updating complaint status:', error);
    res.status(500).json({ error: 'Failed to update complaint status' });
  }
});

// Add response to complaint
router.patch('/:id/respond', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const { responseContent } = req.body;
    const userId = req.user?.id;

    const result = await db
      .update(complainManagement)
      .set({
        responseContent: responseContent,
        responderId: userId,
        responseTime: new Date(),
        status: 'completed',
        updatedAt: new Date()
      })
      .where(eq(complainManagement.id, parseInt(id)))
      .returning();

    if (result.length === 0) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    // Broadcast badge update
    if ((global as any).broadcastComplaintBadgeUpdate) {
      (global as any).broadcastComplaintBadgeUpdate();
    }

    res.json({ message: 'Response added successfully', complaint: result[0] });
  } catch (error) {
    console.error('Error adding response to complaint:', error);
    res.status(500).json({ error: 'Failed to add response' });
  }
});

export default router;