-- Admins table
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Jira connections table
CREATE TABLE IF NOT EXISTS jira_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_url VARCHAR(500) NOT NULL,
  api_token TEXT NOT NULL,
  user_email VARCHAR(255) NOT NULL,
  sync_frequency INTEGER DEFAULT 60,
  last_sync_at TIMESTAMP,
  project_filters TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Developers table
CREATE TABLE IF NOT EXISTS developers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jira_user_id VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  active BOOLEAN DEFAULT true,
  workload_capacity INTEGER DEFAULT 10,
  expertise_tags TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tickets table
CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jira_key VARCHAR(50) UNIQUE NOT NULL,
  summary TEXT NOT NULL,
  description TEXT,
  assignee_id UUID REFERENCES developers(id),
  labels TEXT[],
  components TEXT[],
  type VARCHAR(100),
  status VARCHAR(100),
  priority VARCHAR(50),
  resolution_time_hours NUMERIC,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Ticket stats table (for future ML/embeddings)
CREATE TABLE IF NOT EXISTS ticket_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  component_expertise JSONB,
  similarity_vector VECTOR(1536),
  last_score_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Assignments table
CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  developer_id UUID REFERENCES developers(id),
  trigger_source VARCHAR(50) NOT NULL,
  score_breakdown JSONB,
  final_score NUMERIC,
  reasoning_text TEXT,
  manual_override BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expertise_weight NUMERIC DEFAULT 0.3,
  similarity_weight NUMERIC DEFAULT 0.25,
  workload_weight NUMERIC DEFAULT 0.25,
  fairness_weight NUMERIC DEFAULT 0.2,
  sync_frequency INTEGER DEFAULT 60,
  webhook_secret VARCHAR(255),
  ml_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Webhook events table
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  error_info TEXT,
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tickets_jira_key ON tickets(jira_key);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_assignee ON tickets(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tickets_components ON tickets USING GIN(components);
CREATE INDEX IF NOT EXISTS idx_assignments_ticket ON assignments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_assignments_developer ON assignments(developer_id);
CREATE INDEX IF NOT EXISTS idx_assignments_created ON assignments(created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status);

-- Seed default admin (password: admin123)
INSERT INTO admins (email, password_hash) 
VALUES ('admin@assigniq.local', '$2a$10$/xCWT27JIq1vjRa6KzKvGuY9NXynx55bgKwz.1gxRoue5dhmFEO/S')
ON CONFLICT (email) DO NOTHING;

-- Seed default settings
INSERT INTO settings (expertise_weight, similarity_weight, workload_weight, fairness_weight)
VALUES (0.3, 0.25, 0.25, 0.2)
ON CONFLICT DO NOTHING;
