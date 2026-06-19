ALTER TABLE posts RENAME TO records;

DROP INDEX posts_created_at_idx;
DROP INDEX posts_user_id_idx;

CREATE INDEX records_created_at_idx ON records (created_at);
CREATE INDEX records_user_id_idx ON records (user_id);
