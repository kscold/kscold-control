ALTER TABLE backup_targets
  ADD COLUMN IF NOT EXISTS network_container varchar(64);
