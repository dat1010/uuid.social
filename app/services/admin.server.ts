import {
  adminRecordPageSize,
  adminUserPageSize,
  bootstrapAdminUsername,
  canManageAdmin,
  isBootstrapAdmin,
} from "./admin";

type UserListRow = {
  username: string;
  display_name: string | null;
  created_at: number;
  deleted_at: number | null;
  record_count: number;
  follower_count: number;
  following_count: number;
  is_admin: number;
};

export async function getAdminDashboard(
  db: D1Database,
  query: string,
  page: number,
) {
  const search = `%${query}%`;
  const offset = (page - 1) * adminUserPageSize;
  const [counts, usersResult, adminsResult] = await Promise.all([
    db.prepare(`SELECT count(*) AS total,
      sum(CASE WHEN deleted_at IS NULL THEN 1 ELSE 0 END) AS active,
      sum(CASE WHEN deleted_at IS NOT NULL THEN 1 ELSE 0 END) AS deleted
      FROM users`).first<{ total: number; active: number | null; deleted: number | null }>(),
    db.prepare(`SELECT u.username, u.display_name, u.created_at, u.deleted_at,
      (SELECT count(*) FROM records r WHERE r.user_id = u.id) AS record_count,
      (SELECT count(*) FROM follows f WHERE f.following_id = u.id) AS follower_count,
      (SELECT count(*) FROM follows f WHERE f.follower_id = u.id) AS following_count,
      CASE WHEN u.username = ? OR EXISTS (SELECT 1 FROM admins a WHERE a.user_id = u.id)
        THEN 1 ELSE 0 END AS is_admin
      FROM users u
      WHERE (? = '' OR u.username LIKE ? OR coalesce(u.display_name, '') LIKE ?)
      ORDER BY u.created_at DESC, u.username
      LIMIT ? OFFSET ?`)
      .bind(
        bootstrapAdminUsername, query, search, search,
        adminUserPageSize + 1, offset,
      ).all<UserListRow>(),
    db.prepare(`SELECT u.username, u.display_name, u.deleted_at, a.created_at,
      grantor.username AS granted_by_username
      FROM users u
      LEFT JOIN admins a ON a.user_id = u.id
      LEFT JOIN users grantor ON grantor.id = a.granted_by_user_id
      WHERE u.username = ? OR a.user_id IS NOT NULL
      ORDER BY CASE WHEN u.username = ? THEN 0 ELSE 1 END, a.created_at`)
      .bind(bootstrapAdminUsername, bootstrapAdminUsername).all<{
        username: string; display_name: string | null; deleted_at: number | null;
        created_at: number | null; granted_by_username: string | null;
      }>(),
  ]);

  return {
    counts: {
      total: Number(counts?.total ?? 0),
      active: Number(counts?.active ?? 0),
      deleted: Number(counts?.deleted ?? 0),
    },
    users: usersResult.results.slice(0, adminUserPageSize).map((user) => ({
      username: user.username,
      displayName: user.display_name || user.username,
      createdAt: new Date(user.created_at).toISOString(),
      deleted: Boolean(user.deleted_at),
      recordCount: Number(user.record_count),
      followerCount: Number(user.follower_count),
      followingCount: Number(user.following_count),
      isAdmin: Boolean(user.is_admin),
    })),
    admins: adminsResult.results.map((admin) => ({
      username: admin.username,
      displayName: admin.display_name || admin.username,
      deleted: Boolean(admin.deleted_at),
      bootstrap: isBootstrapAdmin(admin.username),
      grantedAt: admin.created_at ? new Date(admin.created_at).toISOString() : null,
      grantedByUsername: admin.granted_by_username,
    })),
    page,
    query,
    hasNextPage: usersResult.results.length > adminUserPageSize,
  };
}

export async function getAdminUser(
  db: D1Database,
  username: string,
  recordPage: number,
) {
  const row = await db.prepare(`SELECT u.id, u.username, u.display_name, u.status,
    u.bio, u.avatar_key, u.created_at, u.deleted_at,
    CASE WHEN u.username = ? OR EXISTS (SELECT 1 FROM admins a WHERE a.user_id = u.id)
      THEN 1 ELSE 0 END AS is_admin
    FROM users u WHERE u.username = ?`)
    .bind(bootstrapAdminUsername, username).first<{
      id: string; username: string; display_name: string | null; status: string | null;
      bio: string | null; avatar_key: string | null; created_at: number;
      deleted_at: number | null; is_admin: number;
    }>();
  if (!row) return null;

  const offset = (recordPage - 1) * adminRecordPageSize;
  const recordResult = await db.prepare(`SELECT id, body, created_at, deleted_at,
    deletion_origin, parent_record_id,
    (SELECT count(*) FROM records replies
      WHERE replies.parent_record_id = records.id AND replies.deleted_at IS NULL) AS reply_count
    FROM records WHERE user_id = ?
    ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .bind(row.id, adminRecordPageSize + 1, offset).all<{
      id: string; body: string; created_at: number; deleted_at: number | null;
      deletion_origin: "author" | "admin" | null; parent_record_id: string | null;
      reply_count: number;
    }>();

  return {
    user: {
      username: row.username,
      displayName: row.display_name || row.username,
      status: row.status,
      bio: row.bio,
      hasAvatar: Boolean(row.avatar_key),
      createdAt: new Date(row.created_at).toISOString(),
      deleted: Boolean(row.deleted_at),
      isAdmin: Boolean(row.is_admin),
      bootstrap: isBootstrapAdmin(row.username),
    },
    records: recordResult.results.slice(0, adminRecordPageSize).map((record) => ({
      id: record.id,
      body: record.body,
      createdAt: new Date(record.created_at).toISOString(),
      deleted: Boolean(record.deleted_at),
      deletionOrigin: record.deletion_origin,
      isReply: Boolean(record.parent_record_id),
      replyCount: Number(record.reply_count),
    })),
    recordPage,
    hasNextRecordPage: recordResult.results.length > adminRecordPageSize,
  };
}

export async function grantAdmin(
  db: D1Database,
  actorId: string,
  targetUsername: string,
) {
  if (isBootstrapAdmin(targetUsername)) return null;
  const target = await db.prepare(`SELECT id, deleted_at, suspended_at FROM users
    WHERE username = ?`).bind(targetUsername).first<{
      id: string; deleted_at: number | null; suspended_at: number | null;
    }>();
  if (!target) return "That user does not exist.";
  if (target.deleted_at || target.suspended_at) return "Only active users can become admins.";
  await db.prepare(`INSERT OR IGNORE INTO admins (user_id, granted_by_user_id, created_at)
    VALUES (?, ?, ?)`).bind(target.id, actorId, Date.now()).run();
  return null;
}

export async function revokeAdmin(input: {
  db: D1Database;
  actorId: string;
  actorUsername: string;
  targetUsername: string;
}) {
  if (!canManageAdmin(input.actorUsername, input.targetUsername)) {
    return "That admin role cannot be removed.";
  }
  await input.db.prepare(`DELETE FROM admins WHERE user_id =
    (SELECT id FROM users WHERE username = ?)`)
    .bind(input.targetUsername).run();
  return null;
}

export async function deactivateUser(input: {
  db: D1Database;
  actorId: string;
  actorUsername: string;
  targetUsername: string;
}) {
  if (!canManageAdmin(input.actorUsername, input.targetUsername)) {
    return "That account cannot be deactivated.";
  }
  const target = await input.db.prepare(
    "SELECT id, deleted_at FROM users WHERE username = ?",
  ).bind(input.targetUsername).first<{ id: string; deleted_at: number | null }>();
  if (!target) return "That user does not exist.";
  if (target.deleted_at) return null;

  await input.db.batch([
    input.db.prepare(`UPDATE users SET deleted_at = ?, uuid_hash = ?, updated_at = ?
      WHERE id = ?`).bind(Date.now(), crypto.randomUUID(), Date.now(), target.id),
    input.db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(target.id),
    input.db.prepare("DELETE FROM admins WHERE user_id = ?").bind(target.id),
  ]);
  return null;
}

export async function deleteUserRecord(
  db: D1Database,
  targetUsername: string,
  recordId: string,
) {
  const result = await db.prepare(`UPDATE records SET deleted_at = ?, deletion_origin = 'admin'
    WHERE id = ? AND user_id = (SELECT id FROM users WHERE username = ?)
      AND deleted_at IS NULL`)
    .bind(Date.now(), recordId, targetUsername).run();
  return result.meta.changes === 1 ? null : "That active record was not found.";
}
