import {
  buildSocialGraph,
  socialPageSize,
  type SocialFollow,
  type SocialUser,
  type SocialView,
} from "./social";

type UserRow = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_key: string | null;
};

type CountRow = { followers: number | null; following: number | null };

export async function getSocialSummary(
  db: D1Database,
  userId: string,
  viewerId: string | null,
) {
  const [counts, relationship] = await Promise.all([
    getCounts(db, userId),
    viewerId
      ? db.prepare(
          "SELECT 1 AS found FROM follows WHERE follower_id = ? AND following_id = ?",
        ).bind(viewerId, userId).first<{ found: number }>()
      : null,
  ]);

  return { ...counts, isFollowing: Boolean(relationship) };
}

export async function setFollowing(input: {
  db: D1Database;
  followerId: string;
  targetUsername: string;
  following: boolean;
}) {
  const target = await input.db.prepare(
    "SELECT id FROM users WHERE username = ? AND suspended_at IS NULL",
  ).bind(input.targetUsername).first<{ id: string }>();
  if (!target) return "That user is not available.";
  if (target.id === input.followerId) return "You cannot follow yourself.";

  if (input.following) {
    await input.db.prepare(
      "INSERT OR IGNORE INTO follows (follower_id, following_id, created_at) VALUES (?, ?, ?)",
    ).bind(input.followerId, target.id, Date.now()).run();
  } else {
    await input.db.prepare(
      "DELETE FROM follows WHERE follower_id = ? AND following_id = ?",
    ).bind(input.followerId, target.id).run();
  }
  return null;
}

export async function getSocialGraphPage(
  db: D1Database,
  username: string,
  view: SocialView,
  page: number,
) {
  const centerRow = await db.prepare(
    `${publicUserSelect} WHERE u.username = ? AND u.suspended_at IS NULL`,
  ).bind(username).first<UserRow>();
  if (!centerRow) return null;

  const offset = (page - 1) * socialPageSize;
  const [counts, followerResult, followingResult, listResult] = await Promise.all([
    getCounts(db, centerRow.id),
    db.prepare(`${publicUserSelect}
      JOIN follows f ON f.follower_id = u.id
      WHERE f.following_id = ? AND u.suspended_at IS NULL
      ORDER BY f.created_at DESC, u.username LIMIT ?`)
      .bind(centerRow.id, socialPageSize).all<UserRow>(),
    db.prepare(`${publicUserSelect}
      JOIN follows f ON f.following_id = u.id
      WHERE f.follower_id = ? AND u.suspended_at IS NULL
      ORDER BY f.created_at DESC, u.username LIMIT ?`)
      .bind(centerRow.id, socialPageSize).all<UserRow>(),
    getSocialList(db, centerRow.id, view, socialPageSize + 1, offset),
  ]);

  const selectedIds = new Set<string>([centerRow.id]);
  for (const row of [...followerResult.results, ...followingResult.results]) {
    selectedIds.add(row.id);
  }
  const idList = JSON.stringify([...selectedIds]);
  const edgeResult = await db.prepare(`${followSelect}
    WHERE f.follower_id IN (SELECT value FROM json_each(?))
      AND f.following_id IN (SELECT value FROM json_each(?))
      AND follower.suspended_at IS NULL AND following.suspended_at IS NULL
    ORDER BY f.created_at DESC`)
    .bind(idList, idList).all<FollowRow>();

  const total = view === "followers" ? counts.followers : counts.following;
  return {
    graph: buildSocialGraph({
      center: toSocialUser(centerRow),
      followers: followerResult.results.map(toSocialUser),
      following: followingResult.results.map(toSocialUser),
      follows: edgeResult.results.map(toSocialFollow),
      counts,
    }),
    list: listResult.results.slice(0, socialPageSize).map((row) => ({
      ...toSocialUser(row),
      followedAt: new Date(row.created_at).toISOString(),
    })),
    view,
    page,
    total,
    hasNextPage: listResult.results.length > socialPageSize,
  };
}

async function getCounts(db: D1Database, userId: string) {
  const row = await db.prepare(`SELECT
    (SELECT count(*) FROM follows f JOIN users u ON u.id = f.follower_id
      WHERE f.following_id = ? AND u.suspended_at IS NULL) AS followers,
    (SELECT count(*) FROM follows f JOIN users u ON u.id = f.following_id
      WHERE f.follower_id = ? AND u.suspended_at IS NULL) AS following`)
    .bind(userId, userId).first<CountRow>();
  return {
    followers: Number(row?.followers ?? 0),
    following: Number(row?.following ?? 0),
  };
}

type ListRow = UserRow & { created_at: number };

function getSocialList(
  db: D1Database,
  userId: string,
  view: SocialView,
  limit: number,
  offset: number,
) {
  const join = view === "followers"
    ? "f.follower_id = u.id"
    : "f.following_id = u.id";
  const filter = view === "followers" ? "f.following_id" : "f.follower_id";
  return db.prepare(`SELECT u.id, u.username, u.display_name, u.avatar_key, f.created_at FROM users u
    JOIN follows f ON ${join}
    WHERE ${filter} = ? AND u.suspended_at IS NULL
    ORDER BY f.created_at DESC, u.username LIMIT ? OFFSET ?`)
    .bind(userId, limit, offset).all<ListRow>();
}

type FollowRow = {
  follower_username: string;
  following_username: string;
  created_at: number;
};

function toSocialUser(row: UserRow): SocialUser {
  return {
    username: row.username,
    displayName: row.display_name || row.username,
    hasAvatar: Boolean(row.avatar_key),
  };
}

function toSocialFollow(row: FollowRow): SocialFollow {
  return {
    followerUsername: row.follower_username,
    followingUsername: row.following_username,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

const publicUserSelect = `SELECT u.id, u.username, u.display_name, u.avatar_key FROM users u`;
const followSelect = `SELECT follower.username AS follower_username,
  following.username AS following_username, f.created_at
  FROM follows f
  JOIN users follower ON follower.id = f.follower_id
  JOIN users following ON following.id = f.following_id`;
