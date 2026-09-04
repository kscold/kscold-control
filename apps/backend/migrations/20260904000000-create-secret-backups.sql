CREATE TABLE IF NOT EXISTS secret_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id varchar(80) NOT NULL,
  operation varchar(20) NOT NULL,
  source_version varchar(64) NOT NULL,
  new_version varchar(64),
  checksum varchar(64) NOT NULL,
  changed_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  encrypted_payload text NOT NULL,
  iv varchar(64) NOT NULL,
  auth_tag varchar(64) NOT NULL,
  actor_id uuid,
  actor_email varchar(320),
  status varchar(32) NOT NULL DEFAULT 'backed_up',
  deployment_request_id uuid,
  deployment_run_id varchar(64),
  deployment_url text,
  error_message text,
  restored_from_backup_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_secret_backups_target_id
  ON secret_backups (target_id);
CREATE INDEX IF NOT EXISTS idx_secret_backups_status
  ON secret_backups (status);
CREATE INDEX IF NOT EXISTS idx_secret_backups_target_created_at
  ON secret_backups (target_id, created_at DESC);
