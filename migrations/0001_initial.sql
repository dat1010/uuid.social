CREATE TABLE users (
  id TEXT PRIMARY KEY NOT NULL,
  uuid_hash TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT,
  bio TEXT,
  avatar_key TEXT,
  website_url TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  suspended_at INTEGER
);

CREATE INDEX users_username_idx ON users (username);

CREATE TABLE posts (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  deleted_at INTEGER
);

CREATE INDEX posts_created_at_idx ON posts (created_at);
CREATE INDEX posts_user_id_idx ON posts (user_id);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX sessions_user_id_idx ON sessions (user_id);

CREATE TABLE follows (
  follower_id TEXT NOT NULL REFERENCES users(id),
  following_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (follower_id, following_id)
);

CREATE INDEX follows_follower_id_idx ON follows (follower_id);
CREATE INDEX follows_following_id_idx ON follows (following_id);
