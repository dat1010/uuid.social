import type { AttachmentInput } from "./media";

export async function publishRecord(db: D1Database, input: {
  userId: string; body: string; attachments: AttachmentInput[]; parentId?: string; now?: number;
}) {
  const { userId, body, attachments } = input;
  const now = input.now ?? Date.now();
  const parentId = input.parentId ?? null;
  if (attachments.length > 4 || new Set(attachments.map(({ id }) => id)).size !== attachments.length
    || (!body.trim() && !attachments.length) || body.length > 500 || attachments.some(({ alt }) => alt.length > 500)) {
    return { error: "Add text or up to four valid images." } as const;
  }
  const id = crypto.randomUUID();
  const attached = JSON.stringify(attachments);
  const statements = [
    db.prepare(`INSERT INTO records (id, user_id, parent_record_id, body, created_at)
      SELECT ?, ?, ?, ?, ? WHERE
        EXISTS (SELECT 1 FROM users WHERE id = ? AND deleted_at IS NULL AND suspended_at IS NULL)
        AND (? IS NULL OR EXISTS (SELECT 1 FROM records WHERE id = ? AND deleted_at IS NULL))
        AND (SELECT count(*) FROM record_attachments
          WHERE id IN (SELECT json_extract(value, '$.id') FROM json_each(?))
            AND user_id = ? AND record_id IS NULL AND status = 'ready' AND expires_at > ?) = ?`)
      .bind(id, userId, parentId, body, now, userId, parentId, parentId, attached, userId, now, attachments.length),
    db.prepare(`UPDATE record_attachments SET record_id = ?, status = 'attached',
        position = (SELECT key FROM json_each(?) WHERE json_extract(value, '$.id') = record_attachments.id),
        alt_text = (SELECT json_extract(value, '$.alt') FROM json_each(?) WHERE json_extract(value, '$.id') = record_attachments.id)
      WHERE id IN (SELECT json_extract(value, '$.id') FROM json_each(?))
        AND EXISTS (SELECT 1 FROM records WHERE id = ?)`)
      .bind(id, attached, attached, attached, id),
  ];
  if (parentId) {
    statements.push(db.prepare(`INSERT INTO connections (id, source_id, target_id, relationship, origin, created_at)
      SELECT ?, id, parent_record_id, 'REPLIES_TO', 'system', ? FROM records WHERE id = ?`)
      .bind(crypto.randomUUID(), now, id));
  }
  const [result] = await db.batch(statements);
  if (result.meta.changes < 1) return { error: "An image expired or was already used, or this thread is no longer available. Please refresh and try again." } as const;
  return { id } as const;
}
