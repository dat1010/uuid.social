import { generateRecordIdentity } from "./record-identity";

export async function getFeaturedSpecimen(db: D1Database, userId: string) {
  const record = await db.prepare(`SELECT r.id FROM users u
    JOIN records r ON r.id = u.featured_record_id AND r.user_id = u.id
    WHERE u.id = ? AND r.deleted_at IS NULL
      AND u.deleted_at IS NULL AND u.suspended_at IS NULL`)
    .bind(userId).first<{ id: string }>();
  return record ? { id: record.id, identity: generateRecordIdentity(record.id) } : null;
}

export async function setFeaturedSpecimen(db: D1Database, userId: string, recordId: string | null) {
  if (!recordId) {
    await db.prepare("UPDATE users SET featured_record_id = NULL, updated_at = ? WHERE id = ?")
      .bind(Date.now(), userId).run();
    return null;
  }
  const result = await db.prepare(`UPDATE users SET featured_record_id = ?, updated_at = ?
    WHERE id = ? AND EXISTS (
      SELECT 1 FROM records WHERE id = ? AND user_id = ? AND deleted_at IS NULL
    )`).bind(recordId, Date.now(), userId, recordId, userId).run();
  return result.meta.changes === 1 ? null : "Choose one of your active records or replies.";
}
