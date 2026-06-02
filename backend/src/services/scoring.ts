import { query } from '../config/db';
import { JiraService } from './jira';
import { loadDeveloperProfiles, ProfileMap } from './profiles';

interface ScoreBreakdown {
  expertise: number;
  similarity: number;
  workload: number;
  fairness: number;
  adjustments: number;
  total: number;
}

interface DeveloperScore {
  developerId: string;
  developerName: string;
  jiraUserId: string;
  breakdown: ScoreBreakdown;
}

interface AssignmentResult {
  ticketId: string;
  ticketKey: string;
  developerId: string;
  developerName: string;
  breakdown: ScoreBreakdown;
  reasoning: string;
}

interface TicketRow {
  id: string;
  jira_key: string;
  components: string[];
  labels: string[];
  type: string;
  priority: string;
}

interface DeveloperRow {
  id: string;
  name: string;
  jira_user_id: string;
  workload_capacity: number;
  active_tickets: string;
  recent_assignments: string;
  expertise_tags?: string[];
}

export class ScoringService {
  private weights = {
    expertise: 0.3,
    similarity: 0.25,
    workload: 0.25,
    fairness: 0.2,
  };

  async loadWeights(): Promise<void> {
    const result = await query('SELECT * FROM settings LIMIT 1');
    if (result.rows.length > 0) {
      const s = result.rows[0];
      this.weights = {
        expertise: s.expertise_weight || 0.3,
        similarity: s.similarity_weight || 0.25,
        workload: s.workload_weight || 0.25,
        fairness: s.fairness_weight || 0.2,
      };
    }
  }

  async autoAssignTicket(ticketKey: string, triggerSource: string): Promise<AssignmentResult> {
    await this.loadWeights();

    const ticketResult = await query('SELECT * FROM tickets WHERE jira_key = $1', [ticketKey]);
    if (ticketResult.rows.length === 0) {
      throw new Error(`Ticket ${ticketKey} not found`);
    }
    const ticket = ticketResult.rows[0] as TicketRow;

    const developers = await query(`
      SELECT d.*,
        (SELECT COUNT(*) FROM tickets t WHERE t.assignee_id = d.id AND t.status NOT IN ('Done', 'Closed')) as active_tickets,
        (SELECT COUNT(*) FROM assignments a WHERE a.developer_id = d.id AND a.created_at > NOW() - INTERVAL '30 days') as recent_assignments
      FROM developers d
      WHERE d.active = true AND d.workload_capacity > 0
    `);

    if (developers.rows.length === 0) {
      throw new Error('No active developers available');
    }

    const scores = await this.batchScoreDevelopers(ticket, developers.rows as DeveloperRow[]);
    scores.sort((a, b) => b.breakdown.total - a.breakdown.total);
    const winner = scores[0];
    const reasoning = this.generateReasoning(winner, scores);

    await query('UPDATE tickets SET assignee_id = $1, updated_at = NOW() WHERE id = $2', [
      winner.developerId,
      ticket.id,
    ]);

    await query(
      `INSERT INTO assignments (ticket_id, developer_id, trigger_source, score_breakdown, final_score, reasoning_text, manual_override)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [ticket.id, winner.developerId, triggerSource, JSON.stringify(winner.breakdown), winner.breakdown.total, reasoning, false]
    );

    const connection = await query('SELECT * FROM jira_connections LIMIT 1');
    if (connection.rows.length > 0) {
      const { base_url, api_token, user_email } = connection.rows[0];
      const jiraService = new JiraService(base_url, api_token, user_email);
      await jiraService.assignTicket(ticketKey, winner.jiraUserId);
    }

    return {
      ticketId: ticket.id,
      ticketKey: ticket.jira_key,
      developerId: winner.developerId,
      developerName: winner.developerName,
      breakdown: winner.breakdown,
      reasoning,
    };
  }

  // 5 total DB queries regardless of team size: expertise, fairness, profiles, avg, feedback adjustments
  private async batchScoreDevelopers(ticket: TicketRow, developers: DeveloperRow[]): Promise<DeveloperScore[]> {
    const devIds = developers.map((d) => d.id);

    // One query for all component-expertise scores
    const expertiseRows = ticket.components?.length > 0
      ? (await query(
          `SELECT assignee_id, COUNT(*) as count FROM tickets
           WHERE assignee_id = ANY($1) AND components && $2 AND status IN ('Done', 'Closed')
           GROUP BY assignee_id`,
          [devIds, ticket.components]
        )).rows
      : [];
    const expertiseMap = new Map<string, number>(
      expertiseRows.map((r) => [r.assignee_id, parseInt(r.count, 10)])
    );

    // One query for the team-average recent-assignment count (fairness denominator)
    const avgResult = await query(`
      SELECT AVG(cnt) as avg_assignments FROM (
        SELECT COUNT(*) as cnt FROM assignments
        WHERE created_at > NOW() - INTERVAL '30 days'
        GROUP BY developer_id
      ) sub
    `);
    const avgAssignments = parseFloat(avgResult.rows[0]?.avg_assignments) || 0;

    // Load skill profiles for all developers in one query
    const profilesById = await loadDeveloperProfiles(devIds);

    // Load feedback-based score adjustments for ticket components
    const feedbackAdjMap = new Map<string, number>();
    if (ticket.components?.length > 0) {
      const adjRows = (await query(
        `SELECT developer_id, component, adjustment FROM developer_score_adjustments
         WHERE developer_id = ANY($1) AND component = ANY($2)`,
        [devIds, ticket.components]
      )).rows;
      for (const row of adjRows) {
        const key = `${row.developer_id}`;
        feedbackAdjMap.set(key, (feedbackAdjMap.get(key) || 0) + parseFloat(row.adjustment));
      }
    }

    return developers.map((dev) => {
      const expertiseCount = expertiseMap.get(dev.id) || 0;
      const expertise = ticket.components?.length > 0 ? Math.min(expertiseCount / 20, 1) : 0.5;
      const similarity = this.scoreSimilarity(ticket, profilesById.get(dev.id) || new Map());
      const workload = this.calculateWorkload(parseInt(dev.active_tickets, 10), dev.workload_capacity);

      const recentAssignments = parseInt(dev.recent_assignments);
      const fairness = avgAssignments === 0
        ? 1
        : Math.max(0, Math.min(1, 1 - ((recentAssignments - avgAssignments) / avgAssignments) * 0.5));

      const ruleAdj = this.applyRuleAdjustments(ticket.priority, ticket.labels);
      const feedbackAdj = feedbackAdjMap.get(dev.id) || 0;
      const adjustments = ruleAdj + feedbackAdj;

      const total =
        this.weights.expertise * expertise +
        this.weights.similarity * similarity +
        this.weights.workload * workload +
        this.weights.fairness * fairness +
        adjustments;

      return {
        developerId: dev.id,
        developerName: dev.name,
        jiraUserId: dev.jira_user_id,
        breakdown: { expertise, similarity, workload, fairness, adjustments, total },
      };
    });
  }

  // Profile-based similarity: type 40%, labels 35%, components 25%. Saturates at 15 resolved tickets.
  private scoreSimilarity(ticket: TicketRow, profile: ProfileMap): number {
    const sat = (key: string) => Math.min((profile.get(key) || 0) / 15, 1);

    const typeScore = sat(`type:${ticket.type}`);

    const labels = ticket.labels || [];
    const labelScore = labels.length > 0
      ? labels.reduce((sum, l) => sum + sat(`label:${l}`), 0) / labels.length
      : 0.5;

    const components = ticket.components || [];
    const componentScore = components.length > 0
      ? components.reduce((sum, c) => sum + sat(`component:${c}`), 0) / components.length
      : 0.5;

    return 0.40 * typeScore + 0.35 * labelScore + 0.25 * componentScore;
  }

  private calculateWorkload(activeTickets: number, capacity: number): number {
    if (capacity <= 0) return 0;
    return Math.max(0, 1 - activeTickets / capacity);
  }

  private applyRuleAdjustments(priority: string, labels: string[]): number {
    let adjustment = 0;
    if (priority === 'Highest' || priority === 'Critical') adjustment += 0.1;
    if (labels?.includes('urgent') || labels?.includes('critical')) adjustment += 0.05;
    return adjustment;
  }

  private generateReasoning(winner: DeveloperScore, allScores: DeveloperScore[]): string {
    const { breakdown } = winner;
    const parts: string[] = [`Selected ${winner.developerName} with total score ${breakdown.total.toFixed(2)}.`];
    if (breakdown.expertise > 0.7) parts.push('High expertise match based on component history.');
    if (breakdown.workload > 0.7) parts.push('Good workload availability.');
    if (breakdown.fairness > 0.7) parts.push('Fair distribution of recent assignments.');
    if (allScores.length > 1) {
      const runnerUp = allScores[1];
      parts.push(`Runner-up: ${runnerUp.developerName} (${runnerUp.breakdown.total.toFixed(2)}).`);
    }
    return parts.join(' ');
  }
}
