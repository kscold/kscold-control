CREATE TABLE IF NOT EXISTS user_key_management_targets (
  user_id uuid NOT NULL,
  target_id varchar(80) NOT NULL,
  granted_by_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, target_id),
  CONSTRAINT user_key_management_targets_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES users (id)
    ON DELETE CASCADE,
  CONSTRAINT user_key_management_targets_target_id_fkey
    FOREIGN KEY (target_id)
    REFERENCES key_management_targets (id)
    ON DELETE RESTRICT,
  CONSTRAINT user_key_management_targets_granted_by_id_fkey
    FOREIGN KEY (granted_by_id)
    REFERENCES users (id)
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_user_key_management_targets_target_id
  ON user_key_management_targets (target_id, user_id);

INSERT INTO user_key_management_targets (user_id, target_id)
SELECT users.id, grants.target_id
FROM users
CROSS JOIN (
  VALUES
    ('kgw1999zz@naver.com', 'gole-production'),
    ('kgw1999zz@naver.com', 'pawpong-production'),
    ('tnals72441@daum.net', 'gole-production')
) AS grants(email, target_id)
WHERE lower(users.email) = grants.email
  AND EXISTS (
    SELECT 1
    FROM key_management_targets targets
    WHERE targets.id = grants.target_id
  )
ON CONFLICT (user_id, target_id) DO NOTHING;
