ALTER TABLE users ADD COLUMN deleted_at INTEGER;

ALTER TABLE records ADD COLUMN deletion_origin TEXT
  CHECK (deletion_origin IN ('author', 'admin'));

UPDATE records SET deletion_origin = 'author'
WHERE deleted_at IS NOT NULL AND deletion_origin IS NULL;

CREATE TABLE admins (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES users(id),
  granted_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL
);

CREATE INDEX admins_granted_by_idx ON admins (granted_by_user_id);
