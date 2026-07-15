import { Router, Request, Response } from 'express';
import { query } from '../config/db';
import { authMiddleware } from '../middleware/auth';
import { ScoringService } from '../services/scoring';

const router = Router();

router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { status, priority, component, assignee, search, page = 1, limit = 20 } = req.query;
    const pageNum = Number(page);
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const offset = (pageNum - 1) * limitNum;

    const conditions: string[] = ['1=1'];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (status) { conditions.push(`t.status = $${paramIndex++}`); params.push(status); }
    if (priority) { conditions.push(`t.priority = $${paramIndex++}`); params.push(priority); }
    if (component) { conditions.push(`$${paramIndex++} = ANY(t.components)`); params.push(component); }
    if (assignee) { conditions.push(`t.assignee_id = $${paramIndex++}`); params.push(assignee); }
    if (search) {
      conditions.push(`(t.summary ILIKE $${paramIndex} OR t.jira_key ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const where = conditions.join(' AND ');
    const base = `FROM tickets t LEFT JOIN developers d ON t.assignee_id = d.id WHERE ${where}`;

    const countResult = await query(`SELECT COUNT(*) ${base}`, params);
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
      `SELECT t.*, d.name as assignee_name ${base} ORDER BY t.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, limitNum, offset]
    );

    res.json({
      success: true,
      tickets: result.rows,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.floor(total / limitNum) },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch tickets' });
  }
});

router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT t.*, d.name as assignee_name 
       FROM tickets t 
       LEFT JOIN developers d ON t.assignee_id = d.id 
       WHERE t.id = $1 OR t.jira_key = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ticket not found' });
    }

    res.json({ success: true, ticket: result.rows[0] });
  } catch (error) {
    console.error('Get ticket error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch ticket' });
  }
});

router.post('/:id/auto-assign', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const ticketResult = await query(
      "SELECT jira_key FROM tickets WHERE id = $1::uuid OR jira_key = $1 LIMIT 1",
      [id]
    ).catch(() => query('SELECT jira_key FROM tickets WHERE jira_key = $1 LIMIT 1', [id]));
    if (ticketResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ticket not found' });
    }

    const scoringService = new ScoringService();
    const assignment = await scoringService.autoAssignTicket(ticketResult.rows[0].jira_key, 'button');

    res.json({ success: true, assignment });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Auto-assign error:', msg);
    res.status(500).json({ success: false, error: msg });
  }
});

router.patch('/:id/assign', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { developerId, reason } = req.body;

    if (!developerId) {
      return res.status(400).json({ success: false, error: 'Developer ID required' });
    }

    const ticketResult = await query('SELECT id, jira_key FROM tickets WHERE id = $1 OR jira_key = $1', [id]);
    if (ticketResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ticket not found' });
    }

    const devResult = await query('SELECT id, jira_user_id FROM developers WHERE id = $1', [developerId]);
    if (devResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Developer not found' });
    }

    await query('UPDATE tickets SET assignee_id = $1, updated_at = NOW() WHERE id = $2', [
      developerId,
      ticketResult.rows[0].id,
    ]);

    await query(
      `INSERT INTO assignments (ticket_id, developer_id, trigger_source, score_breakdown, final_score, reasoning_text, manual_override)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        ticketResult.rows[0].id,
        developerId,
        'manual',
        JSON.stringify({}),
        0,
        reason || 'Manual override',
        true,
      ]
    );

    res.json({ success: true, message: 'Ticket assigned successfully' });
  } catch (error) {
    console.error('Manual assign error:', error);
    res.status(500).json({ success: false, error: 'Assignment failed' });
  }
});

router.get('/:id/logs', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const ticketResult = await query('SELECT id FROM tickets WHERE id = $1 OR jira_key = $1', [id]);
    if (ticketResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ticket not found' });
    }

    const logs = await query(
      `SELECT a.*, d.name as developer_name 
       FROM assignments a 
       JOIN developers d ON a.developer_id = d.id 
       WHERE a.ticket_id = $1 
       ORDER BY a.created_at DESC`,
      [ticketResult.rows[0].id]
    );

    res.json({ success: true, logs: logs.rows });
  } catch (error) {
    console.error('Get ticket logs error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch logs' });
  }
});

export default router;
