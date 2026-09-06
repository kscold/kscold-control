CREATE TABLE IF NOT EXISTS key_management_targets (
  id varchar(80) PRIMARY KEY,
  display_name varchar(120) NOT NULL,
  description text NOT NULL,
  environment varchar(32) NOT NULL,
  provider varchar(32) NOT NULL,
  deployment_provider varchar(32) NOT NULL,
  env_file_name varchar(120) NOT NULL,
  instance_name varchar(160) NOT NULL,
  location varchar(160) NOT NULL,
  required_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  secret_config jsonb NOT NULL,
  deployment_config jsonb NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT key_management_targets_provider_check
    CHECK (provider IN ('gcp-secret-manager', 'ssh-env-file')),
  CONSTRAINT key_management_targets_deployment_provider_check
    CHECK (deployment_provider IN ('github-actions', 'ssh-blue-green')),
  CONSTRAINT key_management_targets_required_keys_array_check
    CHECK (jsonb_typeof(required_keys) = 'array'),
  CONSTRAINT key_management_targets_secret_config_object_check
    CHECK (jsonb_typeof(secret_config) = 'object'),
  CONSTRAINT key_management_targets_deployment_config_object_check
    CHECK (jsonb_typeof(deployment_config) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_key_management_targets_enabled_sort
  ON key_management_targets (enabled, sort_order);

-- Targets are installation-specific. New installations start empty.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'secret_backups_target_id_fkey'
      AND conrelid = 'secret_backups'::regclass
  ) THEN
    ALTER TABLE secret_backups
      ADD CONSTRAINT secret_backups_target_id_fkey
      FOREIGN KEY (target_id)
      REFERENCES key_management_targets (id)
      ON DELETE RESTRICT;
  END IF;
END
$$;
