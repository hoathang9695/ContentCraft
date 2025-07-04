import { Router } from 'express';
import { db } from '../db.js';
import { savedReports, users } from '../../shared/schema.js';
import { eq, and, desc, asc, sql, ilike } from 'drizzle-orm';
import { isAuthenticated } from '../middleware/auth';

const router = Router();

// Get all saved reports for current user
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      console.error('GET saved-reports: No user ID found');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('GET saved-reports request:', {
      userId,
      query: req.query
    });

    const { page = '1', pageSize = '10', sortBy = 'created_at', sortOrder = 'desc', search = '' } = req.query;

    const pageNum = parseInt(page as string);
    const pageSizeNum = parseInt(pageSize as string);
    const offset = (pageNum - 1) * pageSizeNum;

    const orderByField = savedReports[sortBy as keyof typeof savedReports] || savedReports.createdAt;
    const orderDirection = sortOrder === 'asc' ? asc : desc;

    // Build where conditions
    let whereConditions = [eq(savedReports.createdBy, userId)];

    // Add search if provided
    if (search) {
      whereConditions.push(ilike(savedReports.title, `%${search}%`));
    }

    const reports = await db
      .select({
        id: savedReports.id,
        title: savedReports.title,
        reportType: savedReports.reportType,
        startDate: savedReports.startDate,
        endDate: savedReports.endDate,
        reportData: savedReports.reportData,
        createdBy: savedReports.createdBy,
        createdAt: savedReports.createdAt,
        updatedAt: savedReports.updatedAt,
        creatorName: users.name,
        creatorUsername: users.username
      })
      .from(savedReports)
      .leftJoin(users, eq(savedReports.createdBy, users.id))
      .where(and(...whereConditions))
      .orderBy(orderDirection(orderByField))
      .limit(pageSizeNum)
      .offset(offset);

    console.log('Found saved reports:', reports.length);

    // Get total count
    const totalResult = await db
      .select({ count: sql`count(*)` })
      .from(savedReports)
      .where(and(...whereConditions));

    const total = Number(totalResult[0].count);

    return res.json({
      reports,
      pagination: {
        page: pageNum,
        pageSize: pageSizeNum,
        total,
        totalPages: Math.ceil(total / pageSizeNum)
      }
    });

  } catch (error) {
    console.error('Error fetching saved reports:', error);
    return res.status(500).json({ error: 'Failed to fetch saved reports' });
  }
});

// Save a new report
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      console.error('POST saved-reports: Unauthorized - No user ID found');
      return res.status(401).json({ 
        success: false,
        error: 'Unauthorized',
        details: 'User not authenticated'
      });
    }

    const { title, reportType = 'dashboard', startDate, endDate, reportData } = req.body;

    console.log('POST saved-reports: Received save report request:', {
      userId,
      title,
      reportType,
      startDate,
      endDate,
      hasReportData: !!reportData,
      reportDataType: typeof reportData,
      bodyKeys: Object.keys(req.body)
    });

    // Validate required fields
    if (!title || !title.trim()) {
      console.error('POST saved-reports: Missing or empty title');
      return res.status(400).json({ 
        success: false,
        error: 'Title is required and cannot be empty',
        details: 'Please provide a valid title for the report'
      });
    }

    if (!reportData) {
      console.error('POST saved-reports: Missing report data');
      return res.status(400).json({ 
        success: false,
        error: 'Report data is required',
        details: 'Report data cannot be empty'
      });
    }

    // Validate reportData structure
    let parsedReportData;
    try {
      parsedReportData = typeof reportData === 'string' ? JSON.parse(reportData) : reportData;
      if (!parsedReportData || typeof parsedReportData !== 'object') {
        throw new Error('Report data must be a valid object');
      }
    } catch (parseError) {
      console.error('POST saved-reports: Invalid report data format:', parseError);
      return res.status(400).json({ 
        success: false,
        error: 'Invalid report data format',
        details: parseError.message
      });
    }

    // Prepare insert data - let database handle timezone automatically
    const insertData = {
      title: title.trim(),
      reportType,
      startDate: startDate ? startDate : null,
      endDate: endDate ? endDate : null,
      reportData: parsedReportData,
      createdBy: userId,
      createdAt: new Date(), // Use current UTC time, will be converted on display
      updatedAt: new Date(),
    };

    console.log('POST saved-reports: Prepared insert data:', {
      ...insertData,
      reportData: '[REPORT_DATA_OBJECT]' // Don't log the full data object
    });

    // Insert into database
    const newReport = await db
      .insert(savedReports)
      .values(insertData)
      .returning();

    if (!newReport || newReport.length === 0) {
      throw new Error('Failed to insert report - no data returned');
    }

    console.log('POST saved-reports: Successfully inserted report:', {
      id: newReport[0]?.id,
      title: newReport[0]?.title,
      reportType: newReport[0]?.reportType,
      createdBy: newReport[0]?.createdBy,
      createdAt: newReport[0]?.createdAt
    });

    // Send success response
    const successResponse = { 
      success: true,
      message: 'Report saved successfully', 
      report: {
        id: newReport[0].id,
        title: newReport[0].title,
        reportType: newReport[0].reportType,
        createdAt: newReport[0].createdAt
      }
    };

    console.log('POST saved-reports: Sending success response:', successResponse);

    return res.status(201).json(successResponse);

  } catch (error) {
    console.error('POST saved-reports: Error saving report:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });

    const errorResponse = { 
      success: false,
      error: 'Failed to save report', 
      details: error.message
    };

    console.log('POST saved-reports: Sending error response:', errorResponse);

    return res.status(500).json(errorResponse);
  }
});

// Get a specific saved report
router.get('/:id', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id;
    const reportId = parseInt(req.params.id);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const report = await db
      .select()
      .from(savedReports)
      .where(and(eq(savedReports.id, reportId), eq(savedReports.createdBy, userId)))
      .limit(1);

    if (report.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    return res.json(report[0]);

  } catch (error) {
    console.error('Error fetching saved report:', error);
    return res.status(500).json({ error: 'Failed to fetch saved report' });
  }
});

// Delete a saved report
router.delete('/:id', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id;
    const reportId = parseInt(req.params.id);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const deletedReport = await db
      .delete(savedReports)
      .where(and(eq(savedReports.id, reportId), eq(savedReports.createdBy, userId)))
      .returning();

    if (deletedReport.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    return res.json({ message: 'Report deleted successfully' });

  } catch (error) {
    console.error('Error deleting saved report:', error);
    return res.status(500).json({ error: 'Failed to delete saved report' });
  }
});

export default router;