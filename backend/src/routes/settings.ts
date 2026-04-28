import { Router, Request, Response } from 'express';
import { query } from '../config/db';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.get('/', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM settings ORDER BY id DESC LIMIT 1');
    
    if (result.rows.length === 0) {
      return res.json({
        success: true,
        settings: {
          expertiseWeight: 0.3,
          similarityWeight: 0.25,
          workloadWeight: 0.25,
          fairnessWeight: 0.2,
          syncFrequency: 60,
          mlEnabled: false,
        },
      });
    }

    res.json({ success: true, settings: result.rows[0] });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch settings' });
  }
});

router.put('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const {
      expertiseWeight,
      similarityWeight,
      workloadWeight,
      fairnessWeight,
      syncFrequency,
      mlEnabled,
    } = req.body;

    if ([expertiseWeight, similarityWeight, workloadWeight, fairnessWeight].every((w) => w !== undefined)) {
      const sum = expertiseWeight + similarityWeight + workloadWeight + fairnessWeight;
      if (Math.abs(sum - 1.0) > 0.01) {
        return res.status(400).json({
          success: false,
          error: `Weights must sum to 1.0 (got ${sum.toFixed(3)})`,
        });
      }
    }

    const existing = await query('SELECT id FROM settings LIMIT 1');

    if (existing.rows.length > 0) {
      await query(
        `UPDATE settings SET 
         expertise_weight = COALESCE($1, expertise_weight),
         similarity_weight = COALESCE($2, similarity_weight),
         workload_weight = COALESCE($3, workload_weight),
         fairness_weight = COALESCE($4, fairness_weight),
         sync_frequency = COALESCE($5, sync_frequency),
         ml_enabled = COALESCE($6, ml_enabled),
         updated_at = NOW()
         WHERE id = $7`,
        [expertiseWeight, similarityWeight, workloadWeight, fairnessWeight, syncFrequency, mlEnabled, existing.rows[0].id]
      );
    } else {
      await query(
        `INSERT INTO settings (expertise_weight, similarity_weight, workload_weight, fairness_weight, sync_frequency, ml_enabled)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          expertiseWeight || 0.3,
          similarityWeight || 0.25,
          workloadWeight || 0.25,
          fairnessWeight || 0.2,
          syncFrequency || 60,
          mlEnabled || false,
        ]
      );
    }

    res.json({ success: true, message: 'Settings updated' });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ success: false, error: 'Failed to update settings' });
  }
});

router.get('/webhook', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const webhookSecret = process.env.WEBHOOK_SECRET || 'not-configured';
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

    res.json({
      success: true,
      webhook: {
        url: `${baseUrl}/jira/webhook`,
        secret: webhookSecret,
        instructions: [
          '1. Go to Jira Settings > System > Webhooks',
          '2. Create a new webhook with the URL above',
          '3. Set the secret to the value shown',
          '4. Select events: Issue Created, Issue Updated',
          '5. Save and test the webhook',
        ],
      },
    });
  } catch (error) {
    console.error('Get webhook info error:', error);
    res.status(500).json({ success: false, error: 'Failed to get webhook info' });
  }
});

export default router;
