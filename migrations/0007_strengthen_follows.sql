CREATE TABLE follows_next (
  follower_id TEXT NOT NULL REFERENCES users(id),
  following_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

INSERT INTO follows_next (follower_id, following_id, created_at)
SELECT follower_id, following_id, created_at
FROM follows
WHERE follower_id <> following_id;

DROP TABLE follows;
ALTER TABLE follows_next RENAME TO follows;

CREATE INDEX follows_follower_id_idx ON follows (follower_id);
CREATE INDEX follows_following_id_idx ON follows (following_id);
