import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import { query } from '../config/db';
import { authMiddleware } from '../middleware/auth';
import { JiraService } from '../services/jira';
import { rebuildDeveloperProfiles } from '../services/profiles';

const router = Router();

const SYNC_BATCH_SIZE = 50;

router.post('/connect', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { baseUrl, apiToken, userEmail } = req.body;

    if (!baseUrl || !apiToken || !userEmail) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const jiraService = new JiraService(baseUrl, apiToken, userEmail);
    const isValid = await jiraService.testConnection();

    if (!isValid) {
      return res.status(400).json({ success: false, error: 'Invalid Jira credentials' });
    }

    const existing = await query('SELECT id FROM jira_connections LIMIT 1');

    if (existing.rows.length > 0) {
      await query(
        'UPDATE jira_connections SET base_url = $1, api_token = $2, user_email = $3, updated_at = NOW() WHERE id = $4',
        [baseUrl, apiToken, userEmail, existing.rows[0].id]
      );
    } else {
      await query(
        'INSERT INTO jira_connections (base_url, api_token, user_email) VALUES ($1, $2, $3)',
        [baseUrl, apiToken, userEmail]
      );
    }

    res.json({ success: true, message: 'Jira connected successfully' });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to connect to Jira' });
  }
});

router.post('/sync', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const connection = await query('SELECT * FROM jira_connections LIMIT 1');

    if (connection.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Jira not connected' });
    }

    const { base_url, api_token, user_email } = connection.rows[0];
    const jiraService = new JiraService(base_url, api_token, user_email);
    const tickets = await jiraService.fetchRecentTickets(120);

    // Batch upsert in chunks to avoid hitting PostgreSQL parameter limits
    for (let i = 0; i < tickets.length; i += SYNC_BATCH_SIZE) {
      const batch = tickets.slice(i, i + SYNC_BATCH_SIZE);
      if (batch.length === 0) continue;

      const COLS = 13;
      const placeholders = batch
        .map((_, bi) => {
          const base = bi * COLS;
          return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9},$${base + 10},$${base + 11},$${base + 12},$${base + 13})`;
        })
        .join(',');

      const values = batch.flatMap((t) => [
        t.key, t.summary, t.description, t.assigneeId,
        t.labels, t.components, t.type, t.status, t.priority,
        t.resolutionTimeHours, t.createdAt, t.updatedAt, t.metadata,
      ]);

      await query(
        `INSERT INTO tickets
           (jira_key,summary,description,assignee_id,labels,components,type,status,priority,resolution_time_hours,created_at,updated_at,metadata)
         VALUES ${placeholders}
         ON CONFLICT (jira_key) DO UPDATE SET
           summary=EXCLUDED.summary, description=EXCLUDED.description,
           assignee_id=EXCLUDED.assignee_id, labels=EXCLUDED.labels,
           components=EXCLUDED.components, type=EXCLUDED.type,
           status=EXCLUDED.status, priority=EXCLUDED.priority,
           resolution_time_hours=EXCLUDED.resolution_time_hours,
           updated_at=EXCLUDED.updated_at, metadata=EXCLUDED.metadata`,
        values
      );
    }

    await query('UPDATE jira_connections SET last_sync_at = NOW()');
    await rebuildDeveloperProfiles();
    res.json({ success: true, message: `Synced ${tickets.length} tickets` });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Sync failed';
    res.status(500).json({ success: false, error: msg });
  }
});

router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const webhookSecret = process.env.WEBHOOK_SECRET;

    if (webhookSecret) {
      const signature = req.headers['x-hub-signature'] as string | undefined;
      if (!signature) {
        return res.status(401).json({ success: false, error: 'Missing webhook signature' });
      }

      const rawBody = JSON.stringify(req.body);
      const expected = 'sha256=' + crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');

      const sigBuffer = Buffer.from(signature.padEnd(expected.length));
      const expBuffer = Buffer.from(expected);

      if (sigBuffer.length !== expBuffer.length || !crypto.timingSafeEqual(sigBuffer, expBuffer)) {
        return res.status(401).json({ success: false, error: 'Invalid webhook signature' });
      }
    }

    const { webhookEvent, issue } = req.body;

    await query(
      'INSERT INTO webhook_events (event_type, payload, status) VALUES ($1, $2, $3)',
      [webhookEvent, JSON.stringify(req.body), 'pending']
    );

    if (webhookEvent === 'jira:issue_created' && issue) {
      const { ScoringService } = await import('../services/scoring');
      const scoringService = new ScoringService();
      await scoringService.autoAssignTicket(issue.key, 'webhook');
    }

    if (webhookEvent === 'jira:issue_updated' && issue) {
      const { FeedbackService } = await import('../services/feedback');
      const feedbackService = new FeedbackService();
      const changelog = req.body.changelog;

      if (changelog?.items) {
        for (const item of changelog.items) {
          // Detect status change to Done/Closed
          if (item.field === 'status' && ['Done', 'Closed'].includes(item.toString)) {
            const ticketResult = await query(
              'SELECT t.id, t.created_at FROM tickets t WHERE t.jira_key = $1', [issue.key]
            );
            if (ticketResult.rows.length > 0) {
              const ticket = ticketResult.rows[0];
              const assignmentResult = await query(
                'SELECT id, developer_id FROM assignments WHERE ticket_id = $1 ORDER BY created_at DESC LIMIT 1',
                [ticket.id]
              );
              if (assignmentResult.rows.length > 0) {
                const a = assignmentResult.rows[0];
                const hoursElapsed = (Date.now() - new Date(ticket.created_at).getTime()) / 3_600_000;
                const avgResult = await query(
                  'SELECT AVG(resolution_time_hours) as avg FROM tickets WHERE resolution_time_hours IS NOT NULL'
                );
                const avgHours = parseFloat(avgResult.rows[0]?.avg) || 48;
                const outcome = hoursElapsed < avgHours * 0.5 ? 'completed_fast'
                  : hoursElapsed > avgHours * 2 ? 'completed_late' : 'completed';

                await feedbackService.recordOutcome({
                  assignmentId: a.id, ticketId: ticket.id, developerId: a.developer_id,
                  outcome, resolutionHours: hoursElapsed, source: 'webhook',
                });
              }
            }
          }

          // Detect reassignment
          if (item.field === 'assignee' && item.from && item.to && item.from !== item.to) {
            const ticketResult = await query('SELECT id FROM tickets WHERE jira_key = $1', [issue.key]);
            if (ticketResult.rows.length > 0) {
              const ticketId = ticketResult.rows[0].id;
              const prevDev = await query('SELECT id FROM developers WHERE jira_user_id = $1', [item.from]);
              const newDev = await query('SELECT id FROM developers WHERE jira_user_id = $1', [item.to]);
              if (prevDev.rows.length > 0) {
                const assignmentResult = await query(
                  'SELECT id FROM assignments WHERE ticket_id = $1 AND developer_id = $2 ORDER BY created_at DESC LIMIT 1',
                  [ticketId, prevDev.rows[0].id]
                );
                if (assignmentResult.rows.length > 0) {
                  await feedbackService.recordOutcome({
                    assignmentId: assignmentResult.rows[0].id, ticketId, developerId: prevDev.rows[0].id,
                    outcome: 'reassigned', wasReassigned: true,
                    reassignedTo: newDev.rows[0]?.id, source: 'webhook',
                  });
                }
              }
            }
          }
        }
      }
    }

    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: 'Webhook processing failed' });
  }
});

router.get('/status', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const connection = await query('SELECT base_url, last_sync_at, sync_frequency FROM jira_connections LIMIT 1');

    if (connection.rows.length === 0) {
      return res.json({ success: true, connected: false });
    }

    const ticketCount = await query('SELECT COUNT(*) FROM tickets');

    res.json({
      success: true,
      connected: true,
      baseUrl: connection.rows[0].base_url,
      lastSyncAt: connection.rows[0].last_sync_at,
      syncFrequency: connection.rows[0].sync_frequency,
      ticketCount: parseInt(ticketCount.rows[0].count),
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get status' });
  }
});

export default router;
