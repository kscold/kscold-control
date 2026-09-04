CREATE INDEX IF NOT EXISTS ip_bans_active_idx
  ON ip_bans (active)
  WHERE active = true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ip_bans_created_by_fkey'
      AND conrelid = 'ip_bans'::regclass
  ) THEN
    ALTER TABLE ip_bans
      ADD CONSTRAINT ip_bans_created_by_fkey
      FOREIGN KEY (created_by)
      REFERENCES users (id)
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_secret_backups_target_id
  ON secret_backups (target_id);
CREATE INDEX IF NOT EXISTS idx_secret_backups_status
  ON secret_backups (status);
CREATE INDEX IF NOT EXISTS idx_secret_backups_target_created_at
  ON secret_backups (target_id, created_at DESC);

DROP INDEX IF EXISTS "IDX_e3728ccd8dc16a08e311344d7c";
DROP INDEX IF EXISTS "IDX_bfa2298a5220d01b032753b423";
