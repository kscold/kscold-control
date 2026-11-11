ALTER TABLE remote_desktop_targets
  ADD COLUMN IF NOT EXISTS host varchar(15),
  ADD COLUMN IF NOT EXISTS wake_mac varchar(17),
  ADD COLUMN IF NOT EXISTS wake_broadcast varchar(15),
  ADD COLUMN IF NOT EXISTS protocol varchar(8) NOT NULL DEFAULT 'vnc'
    CHECK (protocol IN ('vnc', 'rdp'));
