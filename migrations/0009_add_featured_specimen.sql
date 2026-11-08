ALTER TABLE users ADD COLUMN featured_record_id TEXT REFERENCES records(id);
