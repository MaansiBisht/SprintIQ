import { Router, Request, Response } from 'express';
import { query } from '../config/db';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, developerId, triggerSource } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const offset = (pageNum - 1) * limitNum;

    const conditions: string[] = ['1=1'];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (developerId) { conditions.push(`a.developer_id = $${paramIndex++}`); params.push(developerId); }
    if (triggerSource) { conditions.push(`a.trigger_source = $${paramIndex++}`); params.push(triggerSource); }

    const where = conditions.join(' AND ');
    const base = `FROM assignments a JOIN tickets t ON a.ticket_id = t.id JOIN developers d ON a.developer_id = d.id WHERE ${where}`;

    const countResult = await query(`SELECT COUNT(*) ${base}`, params);
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
      `SELECT a.*, t.jira_key, t.summary, d.name as developer_name ${base} ORDER BY a.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, limitNum, offset]
    );

    res.json({
      success: true,
      assignments: result.rows,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch assignments' });
  }
});

router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT a.*, t.jira_key, t.summary, t.description, d.name as developer_name
       FROM assignments a
       JOIN tickets t ON a.ticket_id = t.id
       JOIN developers d ON a.developer_id = d.id
       WHERE a.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Assignment not found' });
    }

    res.json({ success: true, assignment: result.rows[0] });
  } catch (error) {
    console.error('Get assignment error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch assignment' });
  }
});

router.post('/replay', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { ticketId } = req.body;

    if (!ticketId) {
      return res.status(400).json({ success: false, error: 'Ticket ID required' });
    }

    const { ScoringService } = await import('../services/scoring');
    const scoringService = new ScoringService();

    const ticketResult = await query('SELECT jira_key FROM tickets WHERE id = $1', [ticketId]);
    if (ticketResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ticket not found' });
    }

    const assignment = await scoringService.autoAssignTicket(ticketResult.rows[0].jira_key, 'manual');

    res.json({ success: true, assignment });
  } catch (error) {
    console.error('Replay assignment error:', error);
    res.status(500).json({ success: false, error: 'Replay failed' });
  }
});

export default router;
