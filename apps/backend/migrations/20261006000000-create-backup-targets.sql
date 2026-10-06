CREATE TABLE IF NOT EXISTS backup_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(64) NOT NULL,
  description text NOT NULL DEFAULT '',
  engine varchar(32) NOT NULL DEFAULT 'mongodb',
  encrypted_uri text NOT NULL,
  uri_iv varchar(64) NOT NULL,
  uri_auth_tag varchar(64) NOT NULL,
  connection_summary varchar(255) NOT NULL,
  dump_image varchar(200) NOT NULL DEFAULT 'mongo:7',
  retention_days integer NOT NULL DEFAULT 10,
  schedule_time varchar(5) NOT NULL DEFAULT '03:30',
  enabled boolean NOT NULL DEFAULT true,
  schedule_cursor_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT backup_targets_name_key UNIQUE (name),
  CONSTRAINT backup_targets_engine_check
    CHECK (engine IN ('mongodb')),
  CONSTRAINT backup_targets_retention_days_check
    CHECK (retention_days BETWEEN 1 AND 3650),
  CONSTRAINT backup_targets_schedule_time_check
    CHECK (schedule_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  CONSTRAINT backup_targets_created_by_fkey
    FOREIGN KEY (created_by)
    REFERENCES users (id)
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_backup_targets_enabled
  ON backup_targets (enabled);

CREATE TABLE IF NOT EXISTS backup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id uuid NOT NULL,
  trigger_type varchar(16) NOT NULL,
  status varchar(16) NOT NULL,
  message text NOT NULL DEFAULT '',
  archive_path text,
  archive_size_bytes bigint,
  pruned jsonb NOT NULL DEFAULT '[]'::jsonb,
  actor_id uuid,
  actor_email varchar(320),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  CONSTRAINT backup_runs_target_id_fkey
    FOREIGN KEY (target_id)
    REFERENCES backup_targets (id)
    ON DELETE CASCADE,
  CONSTRAINT backup_runs_trigger_type_check
    CHECK (trigger_type IN ('schedule', 'manual')),
  CONSTRAINT backup_runs_status_check
    CHECK (status IN ('running', 'success', 'failed')),
  CONSTRAINT backup_runs_pruned_array_check
    CHECK (jsonb_typeof(pruned) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_backup_runs_target_started_at
  ON backup_runs (target_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_backup_runs_started_at
  ON backup_runs (started_at DESC);
