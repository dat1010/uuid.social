CREATE TABLE record_attachments (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  record_id TEXT REFERENCES records(id),
  status TEXT NOT NULL CHECK (status IN ('uploading', 'ready', 'attached', 'deleting', 'deleted')),
  feed_key TEXT NOT NULL UNIQUE,
  full_key TEXT NOT NULL UNIQUE,
  width INTEGER,
  height INTEGER,
  byte_size INTEGER,
  content_type TEXT NOT NULL DEFAULT 'image/webp',
  position INTEGER NOT NULL DEFAULT 0 CHECK (position BETWEEN 0 AND 3),
  alt_text TEXT NOT NULL DEFAULT '' CHECK (length(alt_text) <= 500),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  CHECK (status <> 'attached' OR record_id IS NOT NULL)
);
CREATE INDEX record_attachments_record_idx ON record_attachments(record_id, position);
CREATE INDEX record_attachments_user_created_idx ON record_attachments(user_id, created_at);
CREATE INDEX record_attachments_created_idx ON record_attachments(created_at);
CREATE INDEX record_attachments_cleanup_idx ON record_attachments(status, expires_at);
CREATE UNIQUE INDEX record_attachments_position_idx ON record_attachments(record_id, position);

CREATE TRIGGER records_queue_image_deletion
AFTER UPDATE OF deleted_at, deletion_origin ON records
WHEN NEW.deleted_at IS NOT NULL AND NEW.deletion_origin = 'author'
BEGIN
  UPDATE record_attachments SET status = 'deleting'
  WHERE record_id = NEW.id AND status = 'attached';
END;
