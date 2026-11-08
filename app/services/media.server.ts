import type { RecordImage } from "./media";

export const draftLifetime = 24 * 60 * 60 * 1000;
export const moderationRetention = 30 * draftLifetime;
export type MediaLimits = { perUser: number; pending: number; global: number };

export function getMediaLimits(env: { MEDIA_DAILY_USER_LIMIT: string; MEDIA_PENDING_LIMIT: string; MEDIA_DAILY_GLOBAL_LIMIT: string }): MediaLimits {
  const limit = (value: string, fallback: number) => /^\d+$/.test(value) ? Math.min(Number(value), 100_000) : fallback;
  return { perUser: limit(env.MEDIA_DAILY_USER_LIMIT, 20), pending: limit(env.MEDIA_PENDING_LIMIT, 8), global: limit(env.MEDIA_DAILY_GLOBAL_LIMIT, 500) };
}

export async function reserveImage(db: D1Database, userId: string, limits: MediaLimits, now = Date.now()) {
  const id = crypto.randomUUID();
  const feedKey = `${id}/feed.webp`;
  const fullKey = `${id}/full.webp`;
  const dayStart = Math.floor(now / draftLifetime) * draftLifetime;
  // One conditional write reserves capacity before any paid processing starts.
  const result = await db.prepare(`INSERT INTO record_attachments
    (id, user_id, status, feed_key, full_key, created_at, expires_at)
    SELECT ?, ?, 'uploading', ?, ?, ?, ?
    WHERE (SELECT count(*) FROM record_attachments WHERE user_id = ? AND created_at >= ?) < ?
      AND (SELECT count(*) FROM record_attachments WHERE user_id = ?
        AND status IN ('uploading', 'ready') AND expires_at > ?) < ?
      AND (SELECT count(*) FROM record_attachments WHERE created_at >= ?) < ?`)
    .bind(id, userId, feedKey, fullKey, now, now + draftLifetime,
      userId, dayStart, limits.perUser, userId, now, limits.pending, dayStart, limits.global).run();
  return result.meta.changes === 1 ? { id, feedKey, fullKey } : null;
}

export async function getRecordImages(db: D1Database, recordIds: string[], includeModerated = false) {
  const images: Record<string, RecordImage[]> = {};
  if (recordIds.length === 0) return images;
  const result = await db.prepare(`SELECT a.id, a.record_id, a.width, a.height, a.alt_text
    FROM record_attachments a JOIN records r ON r.id = a.record_id
    WHERE a.record_id IN (SELECT value FROM json_each(?)) AND a.status = 'attached'
      AND (r.deleted_at IS NULL OR (? = 1 AND r.deletion_origin = 'admin'))
    ORDER BY a.position`).bind(JSON.stringify(recordIds), Number(includeModerated))
    .all<{ id: string; record_id: string; width: number; height: number; alt_text: string }>();
  for (const row of result.results) {
    (images[row.record_id] ??= []).push({ id: row.id, width: row.width, height: row.height, alt: row.alt_text });
  }
  return images;
}

export async function discardImage(db: D1Database, id: string, userId: string) {
  await db.prepare(`UPDATE record_attachments SET status = 'deleting'
    WHERE id = ? AND user_id = ? AND record_id IS NULL AND status IN ('uploading', 'ready')`)
    .bind(id, userId).run();
}

export async function cleanupImages(db: D1Database, bucket: R2Bucket, now = Date.now()) {
  // Claim a bounded batch first. Publishing and restoration cannot revive a claimed image.
  await db.prepare(`UPDATE record_attachments SET status = 'deleting' WHERE id IN (
    SELECT a.id FROM record_attachments a LEFT JOIN records r ON r.id = a.record_id
    WHERE (a.status IN ('uploading', 'ready') AND a.expires_at <= ?)
      OR (a.status = 'attached' AND r.deleted_at IS NOT NULL
        AND (r.deletion_origin = 'author' OR r.deleted_at <= ?))
    ORDER BY a.created_at LIMIT 100
  )`).bind(now, now - moderationRetention).run();
  const pending = await db.prepare(`SELECT id, feed_key, full_key FROM record_attachments
    WHERE status = 'deleting' ORDER BY created_at LIMIT 100`).all<{ id: string; feed_key: string; full_key: string }>();
  for (const image of pending.results) {
    try {
      await bucket.delete([image.feed_key, image.full_key]);
      await db.prepare("UPDATE record_attachments SET status = 'deleted' WHERE id = ? AND status = 'deleting'")
        .bind(image.id).run();
    } catch {
      console.error("Image cleanup failed; will retry", image.id);
    }
  }
  // Keep failed/discarded reservations through the quota window.
  await db.prepare(`DELETE FROM record_attachments WHERE status = 'deleted'
    AND record_id IS NULL AND created_at < ?`).bind(now - 2 * draftLifetime).run();
}
