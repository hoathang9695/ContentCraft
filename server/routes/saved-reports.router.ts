
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
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { page = '1', pageSize = '10', sortBy = 'created_at', sortOrder = 'desc' } = req.query;

    const pageNum = parseInt(page as string);
    const pageSizeNum = parseInt(pageSize as string);
    const offset = (pageNum - 1) * pageSizeNum;

    const orderByField = savedReports[sortBy as keyof typeof savedReports] || savedReports.createdAt;
    const orderDirection = sortOrder === 'asc' ? asc : desc;

    const reports = await db
      .select({
        id: savedReports.id,
        title: savedReports.title,
        reportType: savedReports.reportType,
        startDate: savedReports.startDate,
        endDate: savedReports.endDate,
        reportData: savedReports.reportData,
        createdAt: savedReports.createdAt,
        updatedAt: savedReports.updatedAt,
      })
      .from(savedReports)
      .where(eq(savedReports.createdBy, userId))
      .orderBy(orderDirection(orderByField))
      .limit(pageSizeNum)
      .offset(offset);

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
      console.error('Unauthorized: No user ID found');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { title, reportType = 'dashboard', startDate, endDate, reportData } = req.body;

    console.log('Received save report request:', {
      userId,
      title,
      reportType,
      startDate,
      endDate,
      hasReportData: !!reportData
    });

    if (!title || !reportData) {
      console.error('Missing required fields:', { title: !!title, reportData: !!reportData });
      return res.status(400).json({ error: 'Title and report data are required' });
    }

    const insertData = {
      title,
      reportType,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      reportData,
      createdBy: userId,
    };

    console.log('Inserting report data:', insertData);

    const newReport = await db
      .insert(savedReports)
      .values(insertData)
      .returning();

    console.log('Report saved successfully:', newReport[0]);

    res.status(201).json({ message: 'Report saved successfully', report: newReport[0] });

  } catch (error) {
    console.error('Error saving report:', error);
    res.status(500).json({ error: 'Failed to save report', details: error.message });
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
