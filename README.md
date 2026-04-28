# AssignIQ - Jira Smart Assign

An intelligent ticket assignment system that integrates with Jira to automatically assign tickets based on developer expertise, workload, and fairness.

## Features

- **Jira Integration**: Connect via API token, sync historical tickets (3-4 months), receive webhooks for new tickets
- **Smart Scoring**: Rule-based assignment considering expertise, similarity, workload, and fairness
- **Auto-Assignment**: Automatic assignment on new tickets or on-demand via button click
- **Admin Dashboard**: Overview, developer analytics, ticket explorer, assignment logs, settings
- **Manual Override**: Override auto-assignments with logged reasoning

## Tech Stack

- **Backend**: Node.js + Express (TypeScript)
- **Frontend**: Next.js 14 + Tailwind CSS
- **Database**: PostgreSQL
- **Deployment**: Docker Compose

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Docker & Docker Compose (optional)

### Development Setup

1. **Clone and install dependencies**:
```bash
cd AssignIQ

# Backend
cd backend
npm install
cd ..

# Frontend
cd frontend
npm install
cd ..
```

2. **Configure environment**:
```bash
cp .env.example .env
# Edit .env with your settings
```

3. **Start PostgreSQL** (or use Docker):
```bash
docker run -d --name assigniq-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=assigniq \
  -p 5432:5432 \
  postgres:15-alpine
```

4. **Run database migrations**:
```bash
psql -h localhost -U postgres -d assigniq -f backend/migrations/001_initial_schema.sql
```

5. **Start the backend**:
```bash
cd backend
npm run dev
```

6. **Start the frontend** (in a new terminal):
```bash
cd frontend
npm run dev
```

7. **Access the app**: Open http://localhost:3000

### Docker Deployment

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | - |
| `JWT_SECRET` | Secret for JWT tokens | - |
| `ENCRYPTION_KEY` | 32-char key for encrypting API tokens | - |
| `WEBHOOK_SECRET` | Secret for Jira webhook verification | - |
| `PORT` | Backend server port | 4000 |
| `NEXT_PUBLIC_API_URL` | Backend API URL for frontend | http://localhost:4000/api |

### Jira Setup

1. Go to **Settings** in the dashboard
2. Enter your Jira base URL (e.g., `https://your-domain.atlassian.net`)
3. Enter your Jira user email
4. Generate an API token at https://id.atlassian.com/manage-profile/security/api-tokens
5. Click **Connect Jira**
6. Click **Sync Now** to fetch historical tickets

### Webhook Configuration

1. In Jira, go to **Settings > System > Webhooks**
2. Create a new webhook with URL: `https://your-domain.com/api/jira/webhook`
3. Set the secret from your `.env` file
4. Select events: `Issue Created`, `Issue Updated`
5. Save and test

## API Endpoints

### Authentication
- `POST /api/auth/login` - Admin login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Jira
- `POST /api/jira/connect` - Connect Jira account
- `POST /api/jira/sync` - Trigger manual sync
- `POST /api/jira/webhook` - Webhook receiver
- `GET /api/jira/status` - Get connection status

### Tickets
- `GET /api/tickets` - List tickets (with filters)
- `GET /api/tickets/:id` - Get ticket details
- `POST /api/tickets/:id/auto-assign` - Trigger auto-assignment
- `PATCH /api/tickets/:id/assign` - Manual assignment
- `GET /api/tickets/:id/logs` - Get assignment logs

### Developers
- `GET /api/developers` - List developers
- `GET /api/developers/:id/analytics` - Get developer analytics
- `PATCH /api/developers/:id` - Update developer settings

### Assignments
- `GET /api/assignments` - List assignments
- `GET /api/assignments/:id` - Get assignment details
- `POST /api/assignments/replay` - Re-run assignment

### Settings
- `GET /api/settings` - Get settings
- `PUT /api/settings` - Update settings
- `GET /api/settings/webhook` - Get webhook info

### Analytics
- `GET /api/analytics/overview` - Dashboard overview
- `GET /api/analytics/workload` - Developer workload
- `GET /api/analytics/components` - Component stats
- `GET /api/analytics/fairness` - Fairness metrics

## Scoring Algorithm

The scoring algorithm evaluates each active developer:

```
total_score = w_expertise * expertise_score
            + w_similarity * similarity_score
            + w_workload * workload_score
            + w_fairness * fairness_score
            + rule_adjustments
```

- **Expertise Score**: Based on historical tickets with matching components
- **Similarity Score**: Based on label/type matches with developer's expertise tags
- **Workload Score**: Inverse of current utilization (active tickets / capacity)
- **Fairness Score**: Balances assignments across the team
- **Rule Adjustments**: Priority-based boosts for urgent tickets

Default weights: expertise=0.3, similarity=0.25, workload=0.25, fairness=0.2

## Future Enhancements

- ML-based similarity using embeddings (pgvector)
- Slack/Teams notifications
- Assignment approval workflow
- Multi-project support
- Advanced analytics and reporting

## License

MIT
