import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { FeedbackService } from '../services/feedback';

const router = Router();
const feedbackService = new FeedbackService();

// Record an outcome manually
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { assignmentId, ticketId, developerId, outcome, resolutionHours, wasReassigned, reassignedTo } = req.body;

    if (!assignmentId || !ticketId || !developerId || !outcome) {
      return res.status(400).json({ success: false, error: 'assignmentId, ticketId, developerId, and outcome are required' });
    }

    const validOutcomes = ['completed', 'reassigned', 'completed_late', 'completed_fast'];
    if (!validOutcomes.includes(outcome)) {
      return res.status(400).json({ success: false, error: `outcome must be one of: ${validOutcomes.join(', ')}` });
    }

    await feedbackService.recordOutcome({
      assignmentId, ticketId, developerId, outcome, resolutionHours, wasReassigned, reassignedTo, source: 'manual',
    });

    res.json({ success: true, message: 'Feedback recorded' });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to record feedback';
    res.status(500).json({ success: false, error: msg });
  }
});

// Get feedback stats for a specific developer
router.get('/developer/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const stats = await feedbackService.getDevStats(req.params.id);
    const adjustments = await feedbackService.getAdjustments(req.params.id);
    res.json({ success: true, stats, adjustments: Object.fromEntries(adjustments) });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch stats';
    res.status(500).json({ success: false, error: msg });
  }
});

// Get team-wide feedback stats
router.get('/team', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const stats = await feedbackService.getTeamStats();
    res.json({ success: true, stats });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch team stats';
    res.status(500).json({ success: false, error: msg });
  }
});

export default router;
