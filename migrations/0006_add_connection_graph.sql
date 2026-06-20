CREATE TABLE uuid_objects (
  id TEXT PRIMARY KEY NOT NULL,
  object_type TEXT NOT NULL CHECK (object_type IN ('record', 'bounty', 'claim', 'connection')),
  created_at INTEGER NOT NULL
);

CREATE TABLE connections (
  id TEXT PRIMARY KEY NOT NULL,
  source_id TEXT NOT NULL REFERENCES uuid_objects(id),
  target_id TEXT NOT NULL REFERENCES uuid_objects(id),
  relationship TEXT NOT NULL CHECK (
    relationship IN ('REPLIES_TO', 'ANSWERS', 'USES_RECORD', 'REFERENCES', 'SUPPORTS', 'DISPUTES', 'CORRECTS')
  ),
  origin TEXT NOT NULL CHECK (origin IN ('system', 'user')),
  creator_user_id TEXT REFERENCES users(id),
  created_at INTEGER NOT NULL,
  deleted_at INTEGER,
  CHECK (source_id <> target_id),
  CHECK (
    (origin = 'system' AND creator_user_id IS NULL AND relationship IN ('REPLIES_TO', 'ANSWERS', 'USES_RECORD'))
    OR
    (origin = 'user' AND creator_user_id IS NOT NULL AND relationship IN ('REFERENCES', 'SUPPORTS', 'DISPUTES', 'CORRECTS'))
  )
);

CREATE INDEX connections_source_active_idx ON connections (source_id, created_at) WHERE deleted_at IS NULL;
CREATE INDEX connections_target_active_idx ON connections (target_id, created_at) WHERE deleted_at IS NULL;
CREATE INDEX connections_creator_idx ON connections (creator_user_id, created_at);
CREATE UNIQUE INDEX connections_user_active_unique
  ON connections (source_id, target_id, relationship, creator_user_id)
  WHERE origin = 'user' AND deleted_at IS NULL;
CREATE UNIQUE INDEX connections_system_active_unique
  ON connections (source_id, target_id, relationship)
  WHERE origin = 'system' AND deleted_at IS NULL;

CREATE TRIGGER records_register_uuid AFTER INSERT ON records BEGIN
  INSERT INTO uuid_objects (id, object_type, created_at) VALUES (NEW.id, 'record', NEW.created_at);
END;
CREATE TRIGGER bounties_register_uuid AFTER INSERT ON bounties BEGIN
  INSERT INTO uuid_objects (id, object_type, created_at) VALUES (NEW.id, 'bounty', NEW.created_at);
END;
CREATE TRIGGER bounty_claims_register_uuid AFTER INSERT ON bounty_claims BEGIN
  INSERT INTO uuid_objects (id, object_type, created_at) VALUES (NEW.id, 'claim', NEW.claimed_at);
END;
CREATE TRIGGER connections_register_uuid AFTER INSERT ON connections BEGIN
  INSERT INTO uuid_objects (id, object_type, created_at) VALUES (NEW.id, 'connection', NEW.created_at);
END;

INSERT INTO uuid_objects (id, object_type, created_at)
SELECT id, 'record', created_at FROM records;
INSERT INTO uuid_objects (id, object_type, created_at)
SELECT id, 'bounty', created_at FROM bounties;
INSERT INTO uuid_objects (id, object_type, created_at)
SELECT id, 'claim', claimed_at FROM bounty_claims;

INSERT INTO connections (id, source_id, target_id, relationship, origin, created_at)
SELECT
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' ||
    substr('89ab', (abs(random()) % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
  id, parent_record_id, 'REPLIES_TO', 'system', created_at
FROM records WHERE parent_record_id IS NOT NULL;

INSERT INTO connections (id, source_id, target_id, relationship, origin, created_at)
SELECT
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' ||
    substr('89ab', (abs(random()) % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
  id, bounty_id, 'ANSWERS', 'system', claimed_at
FROM bounty_claims;

INSERT INTO connections (id, source_id, target_id, relationship, origin, created_at)
SELECT
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' ||
    substr('89ab', (abs(random()) % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
  claim_id, record_id, 'USES_RECORD', 'system', claimed_at
FROM (
  SELECT id AS claim_id, record_id_a AS record_id, claimed_at FROM bounty_claims
  UNION ALL
  SELECT id, record_id_b, claimed_at FROM bounty_claims WHERE record_id_b IS NOT NULL
);
