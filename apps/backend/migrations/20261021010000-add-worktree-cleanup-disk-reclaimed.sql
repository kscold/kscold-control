ALTER TABLE worktree_cleanup_runs
  ADD COLUMN IF NOT EXISTS disk_reclaimed_bytes bigint;
