
import { Router } from 'express';
import { db } from '../db.js';
import { reportManagement, users } from '../../shared/schema.js';
import { eq, and, desc, asc, sql, ilike, or } from 'drizzle-orm';
import { authenticateUser } from '../middleware/auth.js';

const router = Router();

// Get all reports with filters and pagination
router.get('/', async (req, res) => {
  console.log('GET /api/report-management - Request received');
  
  // Ensure JSON response
  res.setHeader('Content-Type', 'application/json');
  
  try {
    const { 
      page = '1', 
      pageSize = '10', 
      status, 
      reportType, 
      assignedTo,
      search,
      startDate,
      endDate,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.query;

    const pageNum = parseInt(page as string);
    const pageSizeNum = parseInt(pageSize as string);
    const offset = (pageNum - 1) * pageSizeNum;

    // Build where conditions
    let whereConditions: any[] = [];
    
    if (status && status !== 'all') {
      whereConditions.push(eq(reportManagement.status, status as string));
    }
    
    if (reportType && reportType !== 'all') {
      whereConditions.push(eq(reportManagement.reportType, reportType as string));
    }
    
    if (assignedTo && assignedTo !== 'all') {
      if (assignedTo === 'unassigned') {
        whereConditions.push(sql`${reportManagement.assignedToId} IS NULL`);
      } else {
        whereConditions.push(eq(reportManagement.assignedToId, parseInt(assignedTo as string)));
      }
    }
    
    if (search) {
      whereConditions.push(
        or(
          sql`${reportManagement.reporterName}->>'name' ILIKE ${`%${search}%`}`,
          ilike(reportManagement.reporterEmail, `%${search}%`),
          ilike(reportManagement.reason, `%${search}%`),
          sql`${reportManagement.reportedId}->>'id' ILIKE ${`%${search}%`}`
        )
      );
    }

    // Add date range filtering
    if (startDate) {
      whereConditions.push(sql`${reportManagement.createdAt} >= ${new Date(startDate as string)}`);
    }
    
    if (endDate) {
      whereConditions.push(sql`${reportManagement.createdAt} <= ${new Date(endDate as string)}`);
    }

    // Build order by
    const orderByField = reportManagement[sortBy as keyof typeof reportManagement] || reportManagement.createdAt;
    const orderDirection = sortOrder === 'asc' ? asc : desc;

    // Get reports with user info
    const reports = await db
      .select({
        id: reportManagement.id,
        reportedId: reportManagement.reportedId,
        reportType: reportManagement.reportType,
        reporterName: reportManagement.reporterName,
        reporterEmail: reportManagement.reporterEmail,
        reason: reportManagement.reason,
        detailedReason: reportManagement.detailedReason,
        status: reportManagement.status,
        assignedToId: reportManagement.assignedToId,
        assignedToName: reportManagement.assignedToName,
        assignedAt: reportManagement.assignedAt,
        responseContent: reportManagement.responseContent,
        responderId: reportManagement.responderId,
        responseTime: reportManagement.responseTime,
        createdAt: reportManagement.createdAt,
        updatedAt: reportManagement.updatedAt,
        processor: {
          id: users.id,
          name: users.name,
          username: users.username
        }
      })
      .from(reportManagement)
      .leftJoin(users, eq(reportManagement.assignedToId, users.id))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(orderDirection(orderByField))
      .limit(pageSizeNum)
      .offset(offset);

    // Get total count for pagination
    const totalResult = await db
      .select({ count: sql`count(*)` })
      .from(reportManagement)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);
    
    const total = Number(totalResult[0].count);

    const responseData = {
      reports,
      pagination: {
        page: pageNum,
        pageSize: pageSizeNum,
        total,
        totalPages: Math.ceil(total / pageSizeNum)
      }
    };

    console.log('Sending response with:', {
      reportsCount: reports.length,
      pagination: responseData.pagination,
      firstReport: reports.length > 0 ? reports[0] : null
    });

    console.log('Full response structure:', JSON.stringify(responseData, null, 2));

    res.json(responseData);

  } catch (error) {
    console.error('Error fetching reports:', error);
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ 
      error: 'Failed to fetch reports',
      message: error.message,
      success: false 
    });
  }
});

// Assign report to user
router.patch('/:id/assign', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const { id } = req.params;
    const { assignedToId } = req.body;

    // Get user info
    const user = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, assignedToId))
      .limit(1);

    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updatedReport = await db
      .update(reportManagement)
      .set({
        assignedToId,
        assignedToName: user[0].name,
        assignedAt: new Date(),
        status: 'processing',
        updatedAt: new Date()
      })
      .where(eq(reportManagement.id, parseInt(id)))
      .returning();

    if (updatedReport.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json({ message: 'Report assigned successfully', report: updatedReport[0] });
  } catch (error) {
    console.error('Error assigning report:', error);
    res.status(500).json({ error: 'Failed to assign report' });
  }
});

// Update report status
router.patch('/:id/status', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const { id } = req.params;
    const { status } = req.body;

    const updatedReport = await db
      .update(reportManagement)
      .set({
        status,
        updatedAt: new Date()
      })
      .where(eq(reportManagement.id, parseInt(id)))
      .returning();

    if (updatedReport.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json({ message: 'Report status updated successfully', report: updatedReport[0] });
  } catch (error) {
    console.error('Error updating report status:', error);
    res.status(500).json({ error: 'Failed to update report status' });
  }
});

// Add response to report
router.patch('/:id/respond', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const { id } = req.params;
    const { responseContent } = req.body;
    const userId = req.user?.id;

    const updatedReport = await db
      .update(reportManagement)
      .set({
        responseContent,
        responderId: userId,
        responseTime: new Date(),
        status: 'completed',
        updatedAt: new Date()
      })
      .where(eq(reportManagement.id, parseInt(id)))
      .returning();

    if (updatedReport.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json({ message: 'Response added successfully', report: updatedReport[0] });
  } catch (error) {
    console.error('Error adding response:', error);
    res.status(500).json({ error: 'Failed to add response' });
  }
});

// Get report details
router.get('/:id', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const { id } = req.params;

    const report = await db
      .select({
        id: reportManagement.id,
        reportedId: reportManagement.reportedId,
        reportType: reportManagement.reportType,
        reporterName: reportManagement.reporterName,
        reporterEmail: reportManagement.reporterEmail,
        reason: reportManagement.reason,
        detailedReason: reportManagement.detailedReason,
        status: reportManagement.status,
        assignedToId: reportManagement.assignedToId,
        assignedToName: reportManagement.assignedToName,
        assignedAt: reportManagement.assignedAt,
        responseContent: reportManagement.responseContent,
        responderId: reportManagement.responderId,
        responseTime: reportManagement.responseTime,
        createdAt: reportManagement.createdAt,
        updatedAt: reportManagement.updatedAt,
        processor: {
          id: users.id,
          name: users.name,
          username: users.username
        }
      })
      .from(reportManagement)
      .leftJoin(users, eq(reportManagement.assignedToId, users.id))
      .where(eq(reportManagement.id, parseInt(id)))
      .limit(1);

    if (report.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json(report[0]);
  } catch (error) {
    console.error('Error fetching report details:', error);
    res.status(500).json({ error: 'Failed to fetch report details' });
  }
});

export default router;
