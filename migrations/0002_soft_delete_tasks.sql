ALTER TABLE tasks ADD COLUMN deleted_at TEXT;
ALTER TABLE tasks ADD COLUMN deleted_by_email TEXT REFERENCES workspace_users(email);

CREATE INDEX IF NOT EXISTS idx_tasks_visible
  ON tasks(deleted_at, status, updated_at DESC);
