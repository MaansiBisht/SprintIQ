-- Developer skill profiles derived automatically from resolved ticket history.
-- Rebuilt after every Jira sync — no manual tagging required.
CREATE TABLE IF NOT EXISTS developer_profiles (
  developer_id UUID        NOT NULL REFERENCES developers(id) ON DELETE CASCADE,
  dimension    VARCHAR(50) NOT NULL,  -- 'type' | 'label' | 'component'
  value        VARCHAR(255) NOT NULL,
  count        INTEGER      NOT NULL DEFAULT 0,
  updated_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
  PRIMARY KEY (developer_id, dimension, value)
);

CREATE INDEX IF NOT EXISTS idx_dev_profiles_developer  ON developer_profiles(developer_id);
CREATE INDEX IF NOT EXISTS idx_dev_profiles_dim_value  ON developer_profiles(developer_id, dimension);
