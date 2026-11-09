CREATE TABLE IF NOT EXISTS ssh_key_vault (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(64) NOT NULL,
  description text NOT NULL DEFAULT '',
  public_key text NOT NULL,
  fingerprint varchar(128) NOT NULL,
  encrypted_private_key text NOT NULL,
  private_key_iv varchar(64) NOT NULL,
  private_key_auth_tag varchar(64) NOT NULL,
  created_by varchar(255),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ssh_key_vault_name_key UNIQUE (name)
);
