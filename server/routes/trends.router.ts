
import { Router } from 'express';
import { Pool } from 'pg';

const router = Router();

const pool = new Pool({
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'chiakhoathanhcong',
  host: process.env.PGHOST || '42.96.40.138',
  database: process.env.PGDATABASE || 'content',
  port: parseInt(process.env.PGPORT || '5432'),
});

// Get all trends with pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string || '';
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const queryParams: any[] = [];

    if (search) {
      whereClause += ` AND (title ILIKE $${queryParams.length + 1} OR content ILIKE $${queryParams.length + 2})`;
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM list_trends ${whereClause}`;
    const countResult = await pool.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].count);

    // Get trends data
    const dataQuery = `
      SELECT 
        id, title, content, target_audience, status, created_by,
        sent_at, recipient_count, created_at, updated_at,
        redis_id, redis_s, redis_a, redis_g, redis_k, redis_l, redis_r
      FROM list_trends 
      ${whereClause}
      ORDER BY created_at DESC 
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `;
    queryParams.push(limit, offset);

    const dataResult = await pool.query(dataQuery, queryParams);

    res.json({
      data: dataResult.rows,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page
    });
  } catch (error) {
    console.error('Error fetching trends:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new trend
router.post('/', async (req, res) => {
  try {
    const {
      title,
      content,
      target_audience,
      status,
      redis_id,
      redis_s,
      redis_a,
      redis_g,
      redis_k,
      redis_l,
      redis_r
    } = req.body;

    const created_by = (req as any).user?.id || 1; // Get from auth middleware

    const query = `
      INSERT INTO list_trends (
        title, content, target_audience, status, created_by,
        redis_id, redis_s, redis_a, redis_g, redis_k, redis_l, redis_r
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const values = [
      title, content, target_audience, status, created_by,
      redis_id, redis_s, redis_a, redis_g, redis_k, redis_l, redis_r
    ];

    const result = await pool.query(query, values);
    
    // TODO: Push data to Redis here
    console.log('📤 TODO: Push trend data to Redis:', {
      id: redis_id,
      s: redis_s,
      a: redis_a,
      g: redis_g,
      k: redis_k,
      l: redis_l,
      r: redis_r
    });

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating trend:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update trend
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      content,
      target_audience,
      status,
      redis_id,
      redis_s,
      redis_a,
      redis_g,
      redis_k,
      redis_l,
      redis_r
    } = req.body;

    const query = `
      UPDATE list_trends 
      SET title = $1, content = $2, target_audience = $3, status = $4,
          redis_id = $5, redis_s = $6, redis_a = $7, redis_g = $8,
          redis_k = $9, redis_l = $10, redis_r = $11
      WHERE id = $12
      RETURNING *
    `;

    const values = [
      title, content, target_audience, status,
      redis_id, redis_s, redis_a, redis_g, redis_k, redis_l, redis_r,
      id
    ];

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Trend not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating trend:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete trend
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const query = 'DELETE FROM list_trends WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Trend not found' });
    }

    res.json({ message: 'Trend deleted successfully' });
  } catch (error) {
    console.error('Error deleting trend:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send/activate trend
router.post('/:id/send', async (req, res) => {
  try {
    const { id } = req.params;

    // Update trend status to active and set sent_at
    const query = `
      UPDATE list_trends 
      SET status = 'active', sent_at = CURRENT_TIMESTAMP, recipient_count = $1
      WHERE id = $2 AND status IN ('approved', 'draft')
      RETURNING *
    `;

    // TODO: Calculate actual recipient count based on target_audience
    const recipientCount = 100; // Placeholder

    const result = await pool.query(query, [recipientCount, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Trend not found or cannot be sent' });
    }

    // TODO: Actually push to Redis and send notifications here
    console.log('📤 TODO: Send trend to users via Redis/notifications');

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error sending trend:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
