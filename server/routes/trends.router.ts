import { Router } from 'express';
import pg from 'pg';
const { Pool } = pg;

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
    console.log('📄 Fetching trends with params:', req.query);

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
    console.log('🔍 Count query:', countQuery, 'params:', queryParams);

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

    console.log('🔍 Data query:', dataQuery, 'params:', queryParams);

    const dataResult = await pool.query(dataQuery, queryParams);

    console.log(`✅ Found ${dataResult.rows.length} trends out of ${total} total`);

    res.json({
      data: dataResult.rows,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page
    });
  } catch (error) {
    console.error('❌ Error fetching trends:', error);
    console.error('Stack trace:', error.stack);
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Helper function to get target user IDs based on audience
async function getTargetUserIds(targetAudience: string): Promise<string[]> {
  try {
    let whereClause = 'WHERE full_name IS NOT NULL AND full_name::jsonb->\'id\' IS NOT NULL';
    const params: any[] = [];

    console.log('🎯 Getting target users for audience:', targetAudience);

    // Map target_audience to classification values
    switch (targetAudience) {
      case 'all':
        // Get all users - only basic filters
        console.log('📊 Selecting ALL users');
        break;
      case 'new':
        whereClause += ' AND classification = $1';
        params.push('new');
        console.log('📊 Selecting NEW users');
        break;
      case 'potential':
        whereClause += ' AND classification = $1';
        params.push('potential');
        console.log('📊 Selecting POTENTIAL users');
        break;
      case 'positive':
        whereClause += ' AND classification = $1';
        params.push('positive');
        console.log('📊 Selecting POSITIVE users');
        break;
      case 'non_potential':
        whereClause += ' AND classification = $1';
        params.push('non_potential'); // Use exact value instead of mapping to negative
        console.log('📊 Selecting NON_POTENTIAL users');
        break;
      default:
        console.log('⚠️ Unknown target audience:', targetAudience);
        return [];
    }

    const query = `
      SELECT (full_name::jsonb->>'id') as user_id, classification 
      FROM real_users 
      ${whereClause}
    `;

    console.log('🔍 Getting target users query:', query, 'params:', params);

    const result = await pool.query(query, params);
    const userIds = result.rows.map(row => row.user_id).filter(Boolean);

    console.log(`👥 Found ${userIds.length} target users for audience: ${targetAudience}`);
    
    // Show classification breakdown
    const classificationBreakdown = result.rows.reduce((acc, row) => {
      acc[row.classification] = (acc[row.classification] || 0) + 1;
      return acc;
    }, {});
    console.log('📈 Classification breakdown:', classificationBreakdown);
    console.log('📋 Sample user IDs:', userIds.slice(0, 5));

    return userIds;
  } catch (error) {
    console.error('❌ Error getting target user IDs:', error);
    return [];
  }
}

// Create new trend
router.post('/', async (req, res) => {
  try {
    console.log('📝 Creating new trend with data:', req.body);

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

    // Validate required fields
    if (!title || !content) {
      return res.status(400).json({ 
        error: 'Title and content are required',
        received: { title, content }
      });
    }

    const created_by = (req as any).user?.id || 1; // Get from auth middleware

    // Get target user IDs based on audience selection
    const targetUserIds = await getTargetUserIds(target_audience || 'all');

    const query = `
      INSERT INTO list_trends (
        title, content, target_audience, status, created_by,
        redis_id, redis_s, redis_a, redis_g, redis_k, redis_l, redis_r,
        recipient_count
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;

    const values = [
      title, content, target_audience || 'all', status || 'draft', created_by,
      redis_id || null, redis_s || null, redis_a || null, 
      redis_g || null, redis_k || null, redis_l || null, redis_r || null,
      targetUserIds.length // Set recipient count
    ];

    console.log('🔍 Executing query with values:', values);

    const result = await pool.query(query, values);

    console.log('✅ Trend created successfully:', result.rows[0]);

    // Prepare data for Redis
    const redisData = {
      trend_id: result.rows[0].id,
      redis_id: redis_id,
      s: redis_s,
      a: redis_a,
      g: redis_g,
      k: redis_k,
      l: redis_l,
      r: redis_r,
      target_users: targetUserIds,
      target_audience: target_audience,
      title: title,
      content: content
    };

    console.log('📤 Prepared data for Redis:', {
      ...redisData,
      target_users: `${targetUserIds.length} users: [${targetUserIds.slice(0, 3).join(', ')}...]`
    });

    // TODO: Send to Redis here
    // await sendToRedis(redisData);

    res.status(201).json({
      ...result.rows[0],
      target_user_count: targetUserIds.length,
      target_users_preview: targetUserIds.slice(0, 5)
    });
  } catch (error) {
    console.error('❌ Error creating trend:', error);
    console.error('Stack trace:', error.stack);
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      timestamp: new Date().toISOString()
    });
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
    res.setHeader('Content-Type', 'application/json');
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
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send/activate trend
router.post('/:id/send', async (req, res) => {
  try {
    const { id } = req.params;

    // Get trend details first
    const getTrendQuery = 'SELECT * FROM list_trends WHERE id = $1';
    const trendResult = await pool.query(getTrendQuery, [id]);

    if (trendResult.rows.length === 0) {
      return res.status(404).json({ error: 'Trend not found' });
    }

    const trend = trendResult.rows[0];

    if (!['approved', 'draft'].includes(trend.status)) {
      return res.status(400).json({ error: 'Trend cannot be sent in current status' });
    }

    // Get target user IDs based on audience
    const targetUserIds = await getTargetUserIds(trend.target_audience);

    // Update trend status to active and set sent_at
    const updateQuery = `
      UPDATE list_trends 
      SET status = 'active', sent_at = CURRENT_TIMESTAMP, recipient_count = $1
      WHERE id = $2
      RETURNING *
    `;

    const result = await pool.query(updateQuery, [targetUserIds.length, id]);

    // Prepare data for Redis
    const redisData = {
      trend_id: parseInt(id),
      redis_id: trend.redis_id,
      s: trend.redis_s,
      a: trend.redis_a,
      g: trend.redis_g,
      k: trend.redis_k,
      l: trend.redis_l,
      r: trend.redis_r,
      target_users: targetUserIds,
      target_audience: trend.target_audience,
      title: trend.title,
      content: trend.content,
      sent_at: new Date().toISOString()
    };

    console.log('📤 Sending trend to Redis:', {
      ...redisData,
      target_users: `${targetUserIds.length} users: [${targetUserIds.slice(0, 3).join(', ')}...]`
    });

    // TODO: Actually push to Redis here
    // await sendToRedis(redisData);

    console.log('✅ Trend sent successfully to', targetUserIds.length, 'users');

    res.json({
      ...result.rows[0],
      target_user_count: targetUserIds.length,
      target_users_preview: targetUserIds.slice(0, 5)
    });
  } catch (error) {
    console.error('Error sending trend:', error);
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;