CREATE TABLE IF NOT EXISTS service_monitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(80) NOT NULL,
  url varchar(500) NOT NULL,
  interval_seconds integer NOT NULL DEFAULT 60 CHECK (interval_seconds BETWEEN 30 AND 3600),
  enabled boolean NOT NULL DEFAULT true,
  state varchar(8) NOT NULL DEFAULT 'unknown' CHECK (state IN ('unknown', 'up', 'down')),
  state_changed_at timestamptz,
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_monitor_checks (
  id bigserial PRIMARY KEY,
  monitor_id uuid NOT NULL REFERENCES service_monitors(id) ON DELETE CASCADE,
  checked_at timestamptz NOT NULL DEFAULT now(),
  ok boolean NOT NULL,
  status_code integer,
  latency_ms integer,
  error varchar(200)
);

CREATE INDEX IF NOT EXISTS idx_service_monitor_checks_monitor_time
  ON service_monitor_checks (monitor_id, checked_at DESC);
