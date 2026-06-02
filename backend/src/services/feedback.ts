import { query } from '../config/db';

interface RecordOutcomeParams {
  assignmentId: string;
  ticketId: string;
  developerId: string;
  outcome: 'completed' | 'reassigned' | 'completed_late' | 'completed_fast';
  resolutionHours?: number;
  wasReassigned?: boolean;
  reassignedTo?: string;
  source: 'webhook' | 'manual' | 'sync';
}

interface FeedbackStats {
  developerId: string;
  totalAssignments: number;
  completed: number;
  reassigned: number;
  completedLate: number;
  completedFast: number;
  avgResolutionHours: number;
  successRate: number;
}

export class FeedbackService {
  async recordOutcome(params: RecordOutcomeParams): Promise<void> {
    const { assignmentId, ticketId, developerId, outcome, resolutionHours, wasReassigned, reassignedTo, source } = params;

    await query(
      `INSERT INTO assignment_feedback (assignment_id, ticket_id, developer_id, outcome, resolution_hours, was_reassigned, reassigned_to, feedback_source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT DO NOTHING`,
      [assignmentId, ticketId, developerId, outcome, resolutionHours || null, wasReassigned || false, reassignedTo || null, source]
    );

    await query(
      'UPDATE assignments SET outcome = $1, resolved_at = NOW() WHERE id = $2',
      [outcome, assignmentId]
    );

    await this.updateScoreAdjustments(developerId, ticketId, outcome);
  }

  // Recalculate the per-component adjustment for this developer based on all their feedback
  private async updateScoreAdjustments(developerId: string, ticketId: string, outcome: string): Promise<void> {
    const ticketResult = await query('SELECT components FROM tickets WHERE id = $1', [ticketId]);
    const components: string[] = ticketResult.rows[0]?.components || [];
    if (components.length === 0) return;

    const delta = outcome === 'completed' || outcome === 'completed_fast' ? 0.02
      : outcome === 'completed_late' ? -0.01
      : -0.03; // reassigned

    for (const component of components) {
      await query(
        `INSERT INTO developer_score_adjustments (developer_id, component, adjustment, sample_count, updated_at)
         VALUES ($1, $2, $3, 1, NOW())
         ON CONFLICT (developer_id, component) DO UPDATE SET
           adjustment = LEAST(0.3, GREATEST(-0.3, developer_score_adjustments.adjustment + $3)),
           sample_count = developer_score_adjustments.sample_count + 1,
           updated_at = NOW()`,
        [developerId, component, delta]
      );
    }
  }

  async getDevStats(developerId: string): Promise<FeedbackStats> {
    const result = await query(
      `SELECT
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE outcome = 'completed') as completed,
         COUNT(*) FILTER (WHERE outcome = 'reassigned') as reassigned,
         COUNT(*) FILTER (WHERE outcome = 'completed_late') as completed_late,
         COUNT(*) FILTER (WHERE outcome = 'completed_fast') as completed_fast,
         AVG(resolution_hours) FILTER (WHERE resolution_hours IS NOT NULL) as avg_hours
       FROM assignment_feedback WHERE developer_id = $1`,
      [developerId]
    );

    const row = result.rows[0];
    const total = parseInt(row.total) || 0;
    const completed = parseInt(row.completed) || 0;
    const fast = parseInt(row.completed_fast) || 0;

    return {
      developerId,
      totalAssignments: total,
      completed,
      reassigned: parseInt(row.reassigned) || 0,
      completedLate: parseInt(row.completed_late) || 0,
      completedFast: fast,
      avgResolutionHours: parseFloat(row.avg_hours) || 0,
      successRate: total > 0 ? (completed + fast) / total : 0,
    };
  }

  async getAdjustments(developerId: string): Promise<Map<string, number>> {
    const result = await query(
      'SELECT component, adjustment FROM developer_score_adjustments WHERE developer_id = $1',
      [developerId]
    );
    return new Map(result.rows.map((r) => [r.component, parseFloat(r.adjustment)]));
  }

  async getTeamStats(): Promise<FeedbackStats[]> {
    const result = await query(
      `SELECT developer_id,
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE outcome = 'completed') as completed,
         COUNT(*) FILTER (WHERE outcome = 'reassigned') as reassigned,
         COUNT(*) FILTER (WHERE outcome = 'completed_late') as completed_late,
         COUNT(*) FILTER (WHERE outcome = 'completed_fast') as completed_fast,
         AVG(resolution_hours) FILTER (WHERE resolution_hours IS NOT NULL) as avg_hours
       FROM assignment_feedback GROUP BY developer_id`
    );

    return result.rows.map((row) => {
      const total = parseInt(row.total) || 0;
      const completed = parseInt(row.completed) || 0;
      const fast = parseInt(row.completed_fast) || 0;
      return {
        developerId: row.developer_id,
        totalAssignments: total,
        completed,
        reassigned: parseInt(row.reassigned) || 0,
        completedLate: parseInt(row.completed_late) || 0,
        completedFast: fast,
        avgResolutionHours: parseFloat(row.avg_hours) || 0,
        successRate: total > 0 ? (completed + fast) / total : 0,
      };
    });
  }
}
