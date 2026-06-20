ALTER TABLE records ADD COLUMN event_number INTEGER;

WITH ranked AS (
  SELECT id, row_number() OVER (ORDER BY created_at, id) AS event_number
  FROM records
)
UPDATE records
SET event_number = (SELECT ranked.event_number FROM ranked WHERE ranked.id = records.id);

CREATE UNIQUE INDEX records_event_number_idx ON records (event_number);

CREATE TRIGGER records_assign_event_number
AFTER INSERT ON records
WHEN NEW.event_number IS NULL
BEGIN
  UPDATE records SET event_number = NEW.rowid WHERE rowid = NEW.rowid;
END;

CREATE TABLE bounties (
  id TEXT PRIMARY KEY NOT NULL CHECK (
    length(id) = 36
    AND id = lower(id)
    AND length(replace(id, '-', '')) = 32
    AND replace(id, '-', '') NOT GLOB '*[^0-9a-f]*'
    AND substr(id, 9, 1) = '-'
    AND substr(id, 14, 1) = '-'
    AND substr(id, 15, 1) = '4'
    AND substr(id, 19, 1) = '-'
    AND substr(id, 20, 1) IN ('8', '9', 'a', 'b')
    AND substr(id, 24, 1) = '-'
  ),
  cadence TEXT NOT NULL CHECK (cadence IN ('daily', 'weekly')),
  rule_type TEXT NOT NULL CHECK (rule_type IN ('character_count', 'event_gap')),
  character TEXT,
  target_value INTEGER NOT NULL,
  starts_at INTEGER NOT NULL,
  ends_at INTEGER NOT NULL,
  sample_record_id_a TEXT NOT NULL REFERENCES records(id),
  sample_record_id_b TEXT REFERENCES records(id),
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX bounties_period_idx ON bounties (cadence, starts_at);
CREATE INDEX bounties_ends_at_idx ON bounties (ends_at);

CREATE TABLE bounty_claims (
  id TEXT PRIMARY KEY NOT NULL,
  bounty_id TEXT NOT NULL UNIQUE REFERENCES bounties(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  record_id_a TEXT NOT NULL REFERENCES records(id),
  record_id_b TEXT REFERENCES records(id),
  claimed_at INTEGER NOT NULL
);

CREATE INDEX bounty_claims_user_id_idx ON bounty_claims (user_id);
