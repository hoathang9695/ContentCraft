
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
      return res.status(401).json({ error: 'Unauthorized' });
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
      return res.status(400).json({ error: 'Title is required and cannot be empty' });
    }

    if (!reportData) {
      console.error('POST saved-reports: Missing report data');
      return res.status(400).json({ error: 'Report data is required' });
    }

    // Prepare insert data with proper date handling
    const insertData = {
      title: title.trim(),
      reportType,
      startDate: startDate ? startDate : null, // Keep as string, drizzle will handle conversion
      endDate: endDate ? endDate : null, // Keep as string, drizzle will handle conversion
      reportData: typeof reportData === 'string' ? JSON.parse(reportData) : reportData,
      createdBy: userId,
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

    console.log('POST saved-reports: Successfully inserted report:', {
      id: newReport[0]?.id,
      title: newReport[0]?.title,
      reportType: newReport[0]?.reportType,
      createdBy: newReport[0]?.createdBy,
      createdAt: newReport[0]?.createdAt
    });

    res.status(201).json({ 
      success: true,
      message: 'Report saved successfully', 
      report: newReport[0] 
    });

  } catch (error) {
    console.error('POST saved-reports: Error saving report:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to save report', 
      details: error.message 
    });
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
