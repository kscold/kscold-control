CREATE TABLE IF NOT EXISTS user_backup_targets (
  user_id uuid NOT NULL,
  target_id uuid NOT NULL,
  granted_by_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, target_id),
  CONSTRAINT user_backup_targets_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES users (id)
    ON DELETE CASCADE,
  CONSTRAINT user_backup_targets_target_id_fkey
    FOREIGN KEY (target_id)
    REFERENCES backup_targets (id)
    ON DELETE CASCADE,
  CONSTRAINT user_backup_targets_granted_by_id_fkey
    FOREIGN KEY (granted_by_id)
    REFERENCES users (id)
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_user_backup_targets_target_id
  ON user_backup_targets (target_id, user_id);
