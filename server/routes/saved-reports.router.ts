
import { Router } from 'express';
import { db } from '../db.js';
import { savedReports, users } from '../../shared/schema.js';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { authenticateUser } from '../middleware/auth.js';

const router = Router();

// Get all saved reports for current user
router.get('/', authenticateUser, async (req, res) => {
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

    const { page = '1', pageSize = '10', sortBy = 'created_at', sortOrder = 'desc' } = req.query;

    const pageNum = parseInt(page as string);
    const pageSizeNum = parseInt(pageSize as string);
    const offset = (pageNum - 1) * pageSizeNum;

    const orderByField = savedReports[sortBy as keyof typeof savedReports] || savedReports.createdAt;
    const orderDirection = sortOrder === 'asc' ? asc : desc;

    const reports = await db
      .select()
      .from(savedReports)
      .where(eq(savedReports.createdBy, userId))
      .orderBy(orderDirection(orderByField))
      .limit(pageSizeNum)
      .offset(offset);

    console.log('Found saved reports:', reports.length);
    console.log('Sample report:', reports[0]);

    // Get total count
    const totalResult = await db
      .select({ count: sql`count(*)` })
      .from(savedReports)
      .where(eq(savedReports.createdBy, userId));
    
    const total = Number(totalResult[0].count);

    res.json({
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
    res.status(500).json({ error: 'Failed to fetch saved reports' });
  }
});

// Save a new report
router.post('/', authenticateUser, async (req, res) => {
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
      bodyKeys: Object.keys(req.body),
      userAgent: req.headers['user-agent'],
      contentType: req.headers['content-type']
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

    // Prepare insert data with proper date handling
    const insertData = {
      title: title.trim(),
      reportType,
      startDate: startDate ? startDate : null,
      endDate: endDate ? endDate : null,
      reportData: parsedReportData,
      createdBy: userId,
    };

    console.log('POST saved-reports: Prepared insert data:', {
      ...insertData,
      reportData: '[REPORT_DATA_OBJECT]' // Don't log the full data object
    });

    // Test database connection before inserting
    await db.select().from(savedReports).limit(1);
    console.log('POST saved-reports: Database connection verified');

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

    // Ensure response is JSON and send success response
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
    
    res.setHeader('Content-Type', 'application/json');
    return res.status(201).json(successResponse);

  } catch (error) {
    console.error('POST saved-reports: Error saving report:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    });
    
    // Ensure response is JSON even on error
    const errorResponse = { 
      success: false,
      error: 'Failed to save report', 
      details: error.message,
      code: error.code || 'UNKNOWN_ERROR'
    };

    console.log('POST saved-reports: Sending error response:', errorResponse);
    
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json(errorResponse);
  }
});

// Get a specific saved report
router.get('/:id', authenticateUser, async (req, res) => {
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

    res.json(report[0]);

  } catch (error) {
    console.error('Error fetching saved report:', error);
    res.status(500).json({ error: 'Failed to fetch saved report' });
  }
});

// Delete a saved report
router.delete('/:id', authenticateUser, async (req, res) => {
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

    res.json({ message: 'Report deleted successfully' });

  } catch (error) {
    console.error('Error deleting saved report:', error);
    res.status(500).json({ error: 'Failed to delete saved report' });
  }
});

export default router;
