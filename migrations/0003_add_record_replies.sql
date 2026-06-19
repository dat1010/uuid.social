ALTER TABLE records
ADD COLUMN parent_record_id TEXT REFERENCES records(id);

CREATE INDEX records_parent_record_id_idx
ON records (parent_record_id);
