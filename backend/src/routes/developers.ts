import { Router, Request, Response } from 'express';
import { query } from '../config/db';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.get('/', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT d.*,
        (SELECT COUNT(*) FROM tickets t WHERE t.assignee_id = d.id AND t.status NOT IN ('Done', 'Closed')) as active_tickets,
        (SELECT COUNT(*) FROM assignments a WHERE a.developer_id = d.id AND a.created_at > NOW() - INTERVAL '30 days') as recent_assignments
      FROM developers d
      WHERE d.active = true
      ORDER BY d.name
    `);

    res.json({ success: true, developers: result.rows });
  } catch (error) {
    console.error('Get developers error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch developers' });
  }
});

router.get('/:id/analytics', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const devResult = await query('SELECT * FROM developers WHERE id = $1', [id]);
    if (devResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Developer not found' });
    }

    const activeTickets = await query(
      `SELECT COUNT(*) FROM tickets WHERE assignee_id = $1 AND status NOT IN ('Done', 'Closed')`,
      [id]
    );

    const avgResolution = await query(
      `SELECT AVG(resolution_time_hours) as avg_hours FROM tickets WHERE assignee_id = $1 AND resolution_time_hours IS NOT NULL`,
      [id]
    );

    const componentStats = await query(
      `SELECT unnest(components) as component, COUNT(*) as count
       FROM tickets WHERE assignee_id = $1
       GROUP BY component ORDER BY count DESC LIMIT 10`,
      [id]
    );

    const recentAssignments = await query(
      `SELECT a.*, t.jira_key, t.summary
       FROM assignments a
       JOIN tickets t ON a.ticket_id = t.id
       WHERE a.developer_id = $1
       ORDER BY a.created_at DESC LIMIT 10`,
      [id]
    );

    const topSkills = await query(
      `SELECT dimension, value, count FROM developer_profiles
       WHERE developer_id = $1
       ORDER BY count DESC LIMIT 20`,
      [id]
    );

    res.json({
      success: true,
      developer: devResult.rows[0],
      analytics: {
        activeTickets: parseInt(activeTickets.rows[0].count, 10),
        avgResolutionHours: parseFloat(avgResolution.rows[0].avg_hours) || 0,
        componentExpertise: componentStats.rows,
        recentAssignments: recentAssignments.rows,
        topSkills: topSkills.rows,
      },
    });
  } catch (error) {
    console.error('Get developer analytics error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch analytics' });
  }
});

router.patch('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { workloadCapacity, active, expertiseTags } = req.body;

    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (workloadCapacity !== undefined) {
      updates.push(`workload_capacity = $${paramIndex++}`);
      params.push(workloadCapacity);
    }
    if (active !== undefined) {
      updates.push(`active = $${paramIndex++}`);
      params.push(active);
    }
    if (expertiseTags !== undefined) {
      updates.push(`expertise_tags = $${paramIndex++}`);
      params.push(expertiseTags);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No updates provided' });
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);

    await query(
      `UPDATE developers SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      params
    );

    res.json({ success: true, message: 'Developer updated' });
  } catch (error) {
    console.error('Update developer error:', error);
    res.status(500).json({ success: false, error: 'Failed to update developer' });
  }
});

export default router;
