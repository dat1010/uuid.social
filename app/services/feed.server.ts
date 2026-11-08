const pageSize = 30;

type FeedRecord = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_key: string | null;
  body: string;
  event_number: number;
  created_at: number;
  reply_count: number;
};

export async function getFeed(db: D1Database, userId: string, url: URL) {
  const view = url.searchParams.get("view") === "following" ? "following" : "everyone";
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 200);
  const page = Math.min(100_000, Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1));
  const result = await db.prepare(`SELECT r.id, r.body, r.event_number, r.created_at,
      u.username, u.display_name, u.avatar_key,
      (SELECT count(*) FROM records replies
       WHERE replies.parent_record_id = r.id AND replies.deleted_at IS NULL) AS reply_count
    FROM records r JOIN users u ON u.id = r.user_id
    WHERE r.deleted_at IS NULL AND u.suspended_at IS NULL
      AND (? <> '' OR r.parent_record_id IS NULL)
      AND (? = 'everyone' OR EXISTS (
        SELECT 1 FROM follows f WHERE f.follower_id = ? AND f.following_id = r.user_id
      ))
      AND (? = '' OR instr(lower(r.body), lower(?)) > 0
        OR instr(r.id, lower(?)) > 0 OR instr(u.username, lower(?)) > 0)
    ORDER BY r.created_at DESC, r.id DESC LIMIT ? OFFSET ?`)
    .bind(query, view, userId, query, query, query, query, pageSize + 1, (page - 1) * pageSize)
    .all<FeedRecord>();

  return {
    view,
    query,
    page,
    hasNextPage: result.results.length > pageSize,
    records: result.results.slice(0, pageSize).map((record) => ({
      id: record.id,
      username: record.username,
      displayName: record.display_name || record.username,
      hasAvatar: Boolean(record.avatar_key),
      body: record.body,
      eventNumber: record.event_number,
      createdAt: new Date(record.created_at).toISOString(),
      replyCount: Number(record.reply_count),
    })),
  };
}
