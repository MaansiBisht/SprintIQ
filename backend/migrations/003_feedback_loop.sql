-- Assignment feedback table: tracks outcomes of each assignment
CREATE TABLE IF NOT EXISTS assignment_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  developer_id UUID NOT NULL REFERENCES developers(id) ON DELETE CASCADE,
  outcome VARCHAR(50) NOT NULL,  -- 'completed' | 'reassigned' | 'completed_late' | 'completed_fast'
  resolution_hours NUMERIC,
  was_reassigned BOOLEAN DEFAULT false,
  reassigned_to UUID REFERENCES developers(id),
  feedback_source VARCHAR(50) NOT NULL,  -- 'webhook' | 'manual' | 'sync'
  recorded_at TIMESTAMP DEFAULT NOW()
);

-- Add outcome column to assignments for quick filtering
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS outcome VARCHAR(50);
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP;

-- Developer score adjustments derived from feedback
CREATE TABLE IF NOT EXISTS developer_score_adjustments (
  developer_id UUID NOT NULL REFERENCES developers(id) ON DELETE CASCADE,
  component VARCHAR(255) NOT NULL,
  adjustment NUMERIC NOT NULL DEFAULT 0,  -- range: -0.3 to +0.3
  sample_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (developer_id, component)
);

CREATE INDEX IF NOT EXISTS idx_feedback_assignment ON assignment_feedback(assignment_id);
CREATE INDEX IF NOT EXISTS idx_feedback_developer ON assignment_feedback(developer_id);
CREATE INDEX IF NOT EXISTS idx_feedback_outcome ON assignment_feedback(outcome);
CREATE INDEX IF NOT EXISTS idx_score_adj_developer ON developer_score_adjustments(developer_id);
