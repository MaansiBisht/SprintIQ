import { Router, Request, Response } from 'express';
import { query } from '../config/db';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.get('/overview', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const totalTickets = await query('SELECT COUNT(*) FROM tickets');
    const activeTickets = await query(
      `SELECT COUNT(*) FROM tickets WHERE status NOT IN ('Done', 'Closed')`
    );
    const assignmentsToday = await query(
      `SELECT COUNT(*) FROM assignments WHERE created_at > NOW() - INTERVAL '24 hours'`
    );
    const autoAssignSuccess = await query(
      `SELECT COUNT(*) FROM assignments WHERE trigger_source IN ('webhook', 'button', 'auto') AND created_at > NOW() - INTERVAL '7 days'`
    );

    const jiraStatus = await query('SELECT last_sync_at FROM jira_connections LIMIT 1');
    const recentWebhook = await query(
      `SELECT created_at FROM webhook_events ORDER BY created_at DESC LIMIT 1`
    );

    res.json({
      success: true,
      overview: {
        totalTickets: parseInt(totalTickets.rows[0].count),
        activeTickets: parseInt(activeTickets.rows[0].count),
        assignmentsToday: parseInt(assignmentsToday.rows[0].count),
        autoAssignSuccess: parseInt(autoAssignSuccess.rows[0].count),
        lastSyncAt: jiraStatus.rows[0]?.last_sync_at || null,
        lastWebhookAt: recentWebhook.rows[0]?.created_at || null,
      },
    });
  } catch (error) {
    console.error('Get overview error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch overview' });
  }
});

router.get('/workload', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT d.id, d.name, d.workload_capacity,
        (SELECT COUNT(*) FROM tickets t WHERE t.assignee_id = d.id AND t.status NOT IN ('Done', 'Closed')) as active_tickets,
        (SELECT COUNT(*) FROM assignments a WHERE a.developer_id = d.id AND a.created_at > NOW() - INTERVAL '7 days') as weekly_assignments
      FROM developers d
      WHERE d.active = true
      ORDER BY active_tickets DESC
    `);

    res.json({
      success: true,
      workload: result.rows.map((row) => ({
        ...row,
        utilizationPercent: row.workload_capacity > 0
          ? Math.round((parseInt(row.active_tickets) / row.workload_capacity) * 100)
          : 0,
      })),
    });
  } catch (error) {
    console.error('Get workload error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch workload' });
  }
});

router.get('/components', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT unnest(components) as component, COUNT(*) as ticket_count,
        AVG(resolution_time_hours) as avg_resolution_hours
      FROM tickets
      WHERE components IS NOT NULL
      GROUP BY component
      ORDER BY ticket_count DESC
      LIMIT 20
    `);

    res.json({ success: true, components: result.rows });
  } catch (error) {
    console.error('Get components error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch components' });
  }
});

router.get('/fairness', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT d.id, d.name,
        (SELECT COUNT(*) FROM assignments a WHERE a.developer_id = d.id AND a.created_at > NOW() - INTERVAL '30 days') as monthly_assignments,
        (SELECT COUNT(*) FROM assignments a WHERE a.developer_id = d.id AND a.manual_override = true AND a.created_at > NOW() - INTERVAL '30 days') as manual_overrides
      FROM developers d
      WHERE d.active = true
      ORDER BY monthly_assignments DESC
    `);

    const total = result.rows.reduce((sum, row) => sum + parseInt(row.monthly_assignments), 0);
    const avgPerDev = result.rows.length > 0 ? total / result.rows.length : 0;

    res.json({
      success: true,
      fairness: {
        developers: result.rows.map((row) => ({
          ...row,
          deviationFromAvg: parseInt(row.monthly_assignments) - avgPerDev,
        })),
        averageAssignments: Math.round(avgPerDev),
        totalAssignments: total,
      },
    });
  } catch (error) {
    console.error('Get fairness error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch fairness data' });
  }
});

export default router;
