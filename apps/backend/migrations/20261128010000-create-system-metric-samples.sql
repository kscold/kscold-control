CREATE TABLE IF NOT EXISTS system_metric_samples (
  sampled_at timestamptz PRIMARY KEY,
  cpu_percent real NOT NULL,
  memory_percent real NOT NULL,
  disk_percent real
);
