CREATE TABLE IF NOT EXISTS remote_desktop_targets (
  id varchar(40) PRIMARY KEY,
  name varchar(80) NOT NULL,
  port integer NOT NULL CHECK (port BETWEEN 1 AND 65535),
  encrypted_credentials text NOT NULL,
  credentials_iv varchar(64) NOT NULL,
  credentials_auth_tag varchar(64) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
