
import { Router } from 'express';
import { pool } from '../db';
import { isAdmin } from '../middleware/auth';

const router = Router();

router.get('/stats', isAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Get total users and verified/unverified counts
    const statsQuery = `
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN verified = 'verified' THEN 1 END) as verified,
        COUNT(CASE WHEN verified = 'unverified' THEN 1 END) as unverified,
        COUNT(CASE WHEN assigned_to_id IS NOT NULL THEN 1 END) as assigned
      FROM real_users
      WHERE created_at >= $1 AND created_at <= $2
    `;

    const { rows: [stats] } = await pool.query(statsQuery, [startDate, endDate]);

    // Get assignment distribution
    const assignmentQuery = `
      SELECT 
        u.id as "userId",
        u.username,
        u.name,
        COUNT(ru.id) as count
      FROM users u
      LEFT JOIN real_users ru ON ru.assigned_to_id = u.id
      WHERE u.role = 'editor'
      AND ru.created_at >= $1 AND ru.created_at <= $2
      GROUP BY u.id, u.username, u.name
    `;

    const { rows: assignedPerUser } = await pool.query(assignmentQuery, [startDate, endDate]);

    res.json({
      totalUsers: parseInt(stats.total),
      verified: parseInt(stats.verified),
      unverified: parseInt(stats.unverified), 
      assignedUsers: parseInt(stats.assigned),
      assignedPerUser,
      period: {
        start: startDate,
        end: endDate
      }
    });

  } catch (error) {
    console.error('Error fetching real users stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
