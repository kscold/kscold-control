CREATE TABLE IF NOT EXISTS worktree_cleanup_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(64) NOT NULL,
  description text NOT NULL DEFAULT '',
  root_path varchar(1024) NOT NULL,
  keep_recent integer NOT NULL DEFAULT 3,
  protect_unmerged boolean NOT NULL DEFAULT true,
  base_refs jsonb NOT NULL DEFAULT '["origin/dev","origin/main","origin/master"]'::jsonb,
  schedule_time varchar(5) NOT NULL DEFAULT '04:30',
  enabled boolean NOT NULL DEFAULT true,
  schedule_cursor_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT worktree_cleanup_targets_name_key UNIQUE (name),
  CONSTRAINT worktree_cleanup_targets_root_path_key UNIQUE (root_path),
  CONSTRAINT worktree_cleanup_targets_keep_recent_check
    CHECK (keep_recent BETWEEN 0 AND 100),
  CONSTRAINT worktree_cleanup_targets_schedule_time_check
    CHECK (schedule_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  CONSTRAINT worktree_cleanup_targets_base_refs_array_check
    CHECK (jsonb_typeof(base_refs) = 'array'),
  CONSTRAINT worktree_cleanup_targets_created_by_fkey
    FOREIGN KEY (created_by)
    REFERENCES users (id)
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_worktree_cleanup_targets_enabled
  ON worktree_cleanup_targets (enabled);

CREATE TABLE IF NOT EXISTS worktree_cleanup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id uuid NOT NULL,
  trigger_type varchar(16) NOT NULL,
  status varchar(16) NOT NULL,
  message text NOT NULL DEFAULT '',
  removed jsonb NOT NULL DEFAULT '[]'::jsonb,
  kept jsonb NOT NULL DEFAULT '[]'::jsonb,
  freed_bytes bigint NOT NULL DEFAULT 0,
  actor_id uuid,
  actor_email varchar(320),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  CONSTRAINT worktree_cleanup_runs_target_id_fkey
    FOREIGN KEY (target_id)
    REFERENCES worktree_cleanup_targets (id)
    ON DELETE CASCADE,
  CONSTRAINT worktree_cleanup_runs_trigger_type_check
    CHECK (trigger_type IN ('schedule', 'manual')),
  CONSTRAINT worktree_cleanup_runs_status_check
    CHECK (status IN ('running', 'success', 'failed')),
  CONSTRAINT worktree_cleanup_runs_removed_array_check
    CHECK (jsonb_typeof(removed) = 'array'),
  CONSTRAINT worktree_cleanup_runs_kept_array_check
    CHECK (jsonb_typeof(kept) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_worktree_cleanup_runs_target_started_at
  ON worktree_cleanup_runs (target_id, started_at);
CREATE INDEX IF NOT EXISTS idx_worktree_cleanup_runs_started_at
  ON worktree_cleanup_runs (started_at);
