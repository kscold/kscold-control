CREATE TABLE IF NOT EXISTS storage_trim_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type varchar(16) NOT NULL,
  status varchar(16) NOT NULL,
  message text NOT NULL DEFAULT '',
  allocated_before_bytes bigint,
  allocated_after_bytes bigint,
  trimmed_bytes bigint,
  actor_email varchar(255),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  CONSTRAINT storage_trim_runs_trigger_type_check
    CHECK (trigger_type IN ('schedule', 'manual')),
  CONSTRAINT storage_trim_runs_status_check
    CHECK (status IN ('running', 'succeeded', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_storage_trim_runs_started_at
  ON storage_trim_runs (started_at DESC);
