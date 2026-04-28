import { query } from '../config/db';

interface JiraIssueFields {
  summary: string;
  description?: { content?: Array<{ content?: Array<{ text?: string }> }> };
  assignee?: { accountId: string; displayName: string; emailAddress?: string } | null;
  labels?: string[];
  components?: Array<{ name: string }>;
  issuetype?: { name: string };
  status?: { name: string };
  priority?: { name: string };
  created: string;
  updated: string;
  resolutiondate?: string;
  reporter?: { displayName: string };
  project?: { key: string };
}

interface JiraIssue {
  key: string;
  fields: JiraIssueFields;
}

interface JiraSearchResponse {
  issues?: JiraIssue[];
  nextPageToken?: string;
  isLast?: boolean;
}

export interface JiraTicket {
  key: string;
  summary: string;
  description: string | null;
  assigneeId: string | null;
  labels: string[];
  components: string[];
  type: string;
  status: string;
  priority: string;
  resolutionTimeHours: number | null;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
}

export class JiraService {
  private baseUrl: string;
  private apiToken: string;
  private userEmail: string;

  constructor(baseUrl: string, apiToken: string, userEmail: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiToken = apiToken;
    this.userEmail = userEmail;
  }

  private getAuthHeader(): string {
    const credentials = Buffer.from(`${this.userEmail}:${this.apiToken}`).toString('base64');
    return `Basic ${credentials}`;
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/rest/api/3/myself`, {
        headers: {
          Authorization: this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async fetchRecentTickets(days: number = 120): Promise<JiraTicket[]> {
    const tickets: JiraTicket[] = [];
    let nextPageToken: string | undefined;
    const maxResults = 100;

    const jql = `created >= -${days}d ORDER BY created DESC`;

    while (true) {
      const requestBody: Record<string, unknown> = {
        jql,
        maxResults,
        fields: ['summary', 'description', 'assignee', 'labels', 'components', 'issuetype', 'status', 'priority', 'created', 'updated', 'resolutiondate', 'reporter', 'project'],
      };

      if (nextPageToken) {
        requestBody.nextPageToken = nextPageToken;
      }

      const response = await fetch(
        `${this.baseUrl}/rest/api/3/search/jql`,
        {
          method: 'POST',
          headers: {
            Authorization: this.getAuthHeader(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Jira API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as JiraSearchResponse;
      const issues = data.issues || [];

      for (const issue of issues) {
        const developerId = await this.getOrCreateDeveloper(issue.fields.assignee || null);
        
        const resolutionTime = this.calculateResolutionTime(issue);

        tickets.push({
          key: issue.key,
          summary: issue.fields.summary,
          description: issue.fields.description?.content?.[0]?.content?.[0]?.text || null,
          assigneeId: developerId,
          labels: issue.fields.labels || [],
          components: (issue.fields.components || []).map((c) => c.name),
          type: issue.fields.issuetype?.name || 'Unknown',
          status: issue.fields.status?.name || 'Unknown',
          priority: issue.fields.priority?.name || 'Medium',
          resolutionTimeHours: resolutionTime,
          createdAt: new Date(issue.fields.created),
          updatedAt: new Date(issue.fields.updated),
          metadata: {
            reporter: issue.fields.reporter?.displayName,
            project: issue.fields.project?.key,
          },
        });
      }

      if (data.isLast || !data.nextPageToken) {
        break;
      }
      nextPageToken = data.nextPageToken;
    }

    return tickets;
  }

  private async getOrCreateDeveloper(assignee: { accountId: string; displayName: string; emailAddress?: string } | null): Promise<string | null> {
    if (!assignee) return null;

    const existing = await query('SELECT id FROM developers WHERE jira_user_id = $1', [assignee.accountId]);
    
    if (existing.rows.length > 0) {
      return existing.rows[0].id;
    }

    const result = await query(
      'INSERT INTO developers (jira_user_id, name, email, active, workload_capacity) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [assignee.accountId, assignee.displayName, assignee.emailAddress || null, true, 10]
    );

    return result.rows[0].id;
  }

  private calculateResolutionTime(issue: JiraIssue): number | null {
    if (!issue.fields.resolutiondate) return null;

    const created = new Date(issue.fields.created);
    const resolved = new Date(issue.fields.resolutiondate);
    const diffMs = resolved.getTime() - created.getTime();
    return Math.round(diffMs / (1000 * 60 * 60));
  }

  async assignTicket(ticketKey: string, jiraUserId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/rest/api/3/issue/${ticketKey}/assignee`, {
        method: 'PUT',
        headers: {
          Authorization: this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accountId: jiraUserId }),
      });

      return response.ok;
    } catch {
      return false;
    }
  }
}
