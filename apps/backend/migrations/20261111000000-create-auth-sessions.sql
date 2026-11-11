CREATE TABLE IF NOT EXISTS auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  parent_session_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  absolute_expires_at timestamptz NOT NULL,
  ip varchar(64),
  user_agent varchar(512),
  assurance varchar(16) NOT NULL DEFAULT 'password',
  step_up_until timestamptz,
  revoked_at timestamptz,
  CONSTRAINT auth_sessions_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES users (id)
    ON DELETE CASCADE,
  CONSTRAINT auth_sessions_parent_session_id_fkey
    FOREIGN KEY (parent_session_id)
    REFERENCES auth_sessions (id)
    ON DELETE CASCADE,
  CONSTRAINT auth_sessions_assurance_check
    CHECK (assurance IN ('password', 'mfa')),
  CONSTRAINT auth_sessions_expiry_check
    CHECK (expires_at <= absolute_expires_at)
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id
  ON auth_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_parent_session_id
  ON auth_sessions (parent_session_id)
  WHERE parent_session_id IS NOT NULL;
