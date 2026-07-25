PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS workspace_users (
  email TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY,
  external_source_id TEXT UNIQUE,
  title TEXT NOT NULL,
  happened_at TEXT NOT NULL,
  participants_json TEXT NOT NULL DEFAULT '[]',
  raw_notes TEXT NOT NULL,
  source_url TEXT,
  summary TEXT,
  processing_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (processing_status IN ('pending', 'processing', 'ready', 'failed')),
  processing_error TEXT,
  created_by_email TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by_email) REFERENCES workspace_users(email)
);

CREATE TABLE IF NOT EXISTS discussions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'paused', 'closed')),
  first_discussed_at TEXT NOT NULL,
  last_discussed_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS meeting_discussions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id TEXT NOT NULL,
  discussion_id INTEGER,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  source_excerpt TEXT,
  sequence_number INTEGER NOT NULL DEFAULT 0,
  resurfaced INTEGER NOT NULL DEFAULT 0 CHECK (resurfaced IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
  FOREIGN KEY (discussion_id) REFERENCES discussions(id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'waiting', 'completed', 'archived')),
  owner_email TEXT,
  due_at TEXT,
  review_at TEXT,
  discussion_id INTEGER,
  created_by_email TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  archived_at TEXT,
  FOREIGN KEY (owner_email) REFERENCES workspace_users(email),
  FOREIGN KEY (created_by_email) REFERENCES workspace_users(email),
  FOREIGN KEY (discussion_id) REFERENCES discussions(id)
);

CREATE TABLE IF NOT EXISTS task_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  author_email TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (author_email) REFERENCES workspace_users(email)
);

CREATE TABLE IF NOT EXISTS proposals (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL,
  proposal_type TEXT NOT NULL CHECK (proposal_type IN ('create_task', 'update_task')),
  target_task_id INTEGER,
  meeting_discussion_id INTEGER,
  payload_json TEXT NOT NULL,
  evidence TEXT,
  confidence REAL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'partially_approved', 'rejected')),
  proposed_by TEXT NOT NULL DEFAULT 'prime-ops-ai',
  reviewed_by_email TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
  FOREIGN KEY (target_task_id) REFERENCES tasks(id),
  FOREIGN KEY (meeting_discussion_id) REFERENCES meeting_discussions(id),
  FOREIGN KEY (reviewed_by_email) REFERENCES workspace_users(email)
);

CREATE TABLE IF NOT EXISTS task_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  actor_id TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('human', 'ai', 'system')),
  event_type TEXT NOT NULL,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  source_type TEXT NOT NULL DEFAULT 'manual',
  source_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_meetings_happened_at ON meetings(happened_at DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_discussions_meeting ON meeting_discussions(meeting_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_owner ON tasks(owner_email, status);
CREATE INDEX IF NOT EXISTS idx_task_notes_task ON task_notes(task_id, created_at);
CREATE INDEX IF NOT EXISTS idx_task_events_task ON task_events(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status, created_at DESC);

