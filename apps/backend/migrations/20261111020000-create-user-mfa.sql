CREATE TABLE IF NOT EXISTS user_mfa (
  user_id uuid PRIMARY KEY,
  totp_secret text NOT NULL,
  last_used_step integer NOT NULL,
  recovery_code_hashes text[] NOT NULL DEFAULT '{}',
  enabled_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_mfa_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES users (id)
    ON DELETE CASCADE
);
