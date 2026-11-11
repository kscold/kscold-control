CREATE TABLE IF NOT EXISTS login_attempts (
  id bigserial PRIMARY KEY,
  ip varchar(64),
  ip_group varchar(64),
  account varchar(320) NOT NULL,
  origin varchar(16) NOT NULL,
  result varchar(16) NOT NULL,
  reason varchar(32),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT login_attempts_origin_check
    CHECK (origin IN ('vouched', 'internal', 'external', 'unverified')),
  CONSTRAINT login_attempts_result_check
    CHECK (result IN ('success', 'failure', 'refused'))
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_group_created_at
  ON login_attempts (ip_group, created_at);
CREATE INDEX IF NOT EXISTS idx_login_attempts_account_created_at
  ON login_attempts (account, created_at);
CREATE INDEX IF NOT EXISTS idx_login_attempts_created_at
  ON login_attempts (created_at);
