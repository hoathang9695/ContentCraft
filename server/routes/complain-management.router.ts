
import { Router } from 'express';
import { authenticateUser } from '../middleware/auth';
import { db } from '../db';
import { reportManagement } from '../../shared/schema';
import { eq, and, or, ilike, gte, lte, desc, asc } from 'drizzle-orm';

const router = Router();

// Get all complaint requests with filtering and pagination
router.get('/', authenticateUser, async (req, res) => {
  try {
    const { 
      page = '1', 
      pageSize = '10', 
      status, 
      complaintType, 
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
    
    // Note: Using reportManagement table but treating as complaints
    // This is intentional to reuse the same data structure
    
    if (status && status !== 'all') {
      conditions.push(eq(reportManagement.status, status as string));
    }
    
    if (complaintType && complaintType !== 'all') {
      conditions.push(eq(reportManagement.reportType, complaintType as string));
    }
    
    if (assignedTo) {
      conditions.push(eq(reportManagement.assignedToId, parseInt(assignedTo as string)));
    }
    
    if (search) {
      const searchConditions = [
        ilike(reportManagement.reason, `%${search}%`),
        ilike(reportManagement.detailedReason, `%${search}%`)
      ];
      conditions.push(or(...searchConditions));
    }
    
    if (startDate) {
      conditions.push(gte(reportManagement.createdAt, new Date(startDate as string)));
    }
    
    if (endDate) {
      conditions.push(lte(reportManagement.createdAt, new Date(endDate as string)));
    }

    // Build sort order
    const sortField = reportManagement[sortBy as keyof typeof reportManagement] || reportManagement.createdAt;
    const orderBy = sortOrder === 'asc' ? asc(sortField) : desc(sortField);

    // Get total count for pagination
    const totalResult = await db
      .select()
      .from(reportManagement)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    
    const total = totalResult.length;
    const totalPages = Math.ceil(total / size);

    // Get paginated results
    const complaints = await db
      .select()
      .from(reportManagement)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(orderBy)
      .limit(size)
      .offset(offset);

    // Transform data for complaints (rename fields)
    const transformedComplaints = complaints.map(complaint => ({
      id: complaint.id,
      complainedId: complaint.reportedId,
      complaintType: complaint.reportType,
      complainantName: complaint.reporterName,
      complainantEmail: complaint.reporterEmail,
      reason: complaint.reason,
      detailedReason: complaint.detailedReason,
      status: complaint.status,
      assignedToId: complaint.assignedToId,
      assignedToName: complaint.assignedToName,
      assignedAt: complaint.assignedAt,
      responseContent: complaint.responseContent,
      responderId: complaint.responderId,
      responseTime: complaint.responseTime,
      createdAt: complaint.createdAt,
      updatedAt: complaint.updatedAt
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
router.patch('/:id/assign', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedToId } = req.body;

    // Get user name for assignment
    const users = await db.select().from(db.select().from(reportManagement).limit(1)); // Get schema reference
    // For now, we'll just store the ID and update the name separately
    
    const result = await db
      .update(reportManagement)
      .set({
        assignedToId: assignedToId,
        assignedAt: new Date(),
        status: 'processing',
        updatedAt: new Date()
      })
      .where(eq(reportManagement.id, parseInt(id)))
      .returning();

    if (result.length === 0) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    res.json({ message: 'Complaint assigned successfully', complaint: result[0] });
  } catch (error) {
    console.error('Error assigning complaint:', error);
    res.status(500).json({ error: 'Failed to assign complaint' });
  }
});

// Update complaint status
router.patch('/:id/status', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const result = await db
      .update(reportManagement)
      .set({
        status: status,
        updatedAt: new Date()
      })
      .where(eq(reportManagement.id, parseInt(id)))
      .returning();

    if (result.length === 0) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    res.json({ message: 'Complaint status updated successfully', complaint: result[0] });
  } catch (error) {
    console.error('Error updating complaint status:', error);
    res.status(500).json({ error: 'Failed to update complaint status' });
  }
});

// Add response to complaint
router.patch('/:id/respond', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { responseContent } = req.body;
    const userId = req.user?.id;

    const result = await db
      .update(reportManagement)
      .set({
        responseContent: responseContent,
        responderId: userId,
        responseTime: new Date(),
        status: 'completed',
        updatedAt: new Date()
      })
      .where(eq(reportManagement.id, parseInt(id)))
      .returning();

    if (result.length === 0) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    res.json({ message: 'Response added successfully', complaint: result[0] });
  } catch (error) {
    console.error('Error adding response to complaint:', error);
    res.status(500).json({ error: 'Failed to add response' });
  }
});

export default router;
