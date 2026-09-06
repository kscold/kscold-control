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

INSERT INTO key_management_targets (
  id,
  display_name,
  description,
  environment,
  provider,
  deployment_provider,
  env_file_name,
  instance_name,
  location,
  required_keys,
  secret_config,
  deployment_config,
  enabled,
  sort_order
) VALUES (
  'gole-production',
  'GoLe Production',
  'GCP Secret Manager와 GitHub Actions로 배포되는 GoLe 운영 환경',
  'production',
  'gcp-secret-manager',
  'github-actions',
  'gole.env',
  'gole-production',
  'GCP asia-northeast3-a',
  '["MONGODB_URI", "MONGODB_DATABASE", "REDIS_HOST", "REDIS_PORT", "GOLE_ENVIRONMENT"]'::jsonb,
  '{"projectId":"project-72a52bf1-06aa-4519-b2c","secretName":"gole-production-env","serviceAccount":"kscold-control-secrets@project-72a52bf1-06aa-4519-b2c.iam.gserviceaccount.com"}'::jsonb,
  '{"repository":"GoLe-by-Colding/GoLe","workflow":"secret-sync.yml","ref":"main"}'::jsonb,
  true,
  10
), (
  'pawpong-production',
  'Pawpong Production',
  'SSH 원격 환경 파일과 Docker Compose blue/green으로 배포되는 Pawpong 운영 환경',
  'production',
  'ssh-env-file',
  'ssh-blue-green',
  '.env.production',
  'colding-304515',
  '115.68.227.188',
  '["NODE_ENV", "MONGODB_URI", "REDIS_HOST", "REDIS_PORT", "JWT_SECRET"]'::jsonb,
  '{"host":"115.68.227.188","port":22,"username":"colding","envPath":"/home/colding/pawpong_backend/.env.production","credentialRef":"pawpong-production"}'::jsonb,
  '{"workingDirectory":"/home/colding/pawpong_backend","script":"deploy.sh","statusDirectory":"/home/colding/pawpong_backend/.kscold-control/deployments"}'::jsonb,
  true,
  20
)
ON CONFLICT (id) DO NOTHING;

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
