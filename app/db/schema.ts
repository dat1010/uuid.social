import { relations, sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    uuidHash: text("uuid_hash").notNull().unique(),
    username: text("username").notNull().unique(),
    displayName: text("display_name"),
    status: text("status"),
    bio: text("bio"),
    avatarKey: text("avatar_key"),
    websiteUrl: text("website_url"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    suspendedAt: integer("suspended_at", { mode: "timestamp_ms" }),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (table) => [index("users_username_idx").on(table.username)],
);

export const records = sqliteTable(
  "records",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    parentRecordId: text("parent_record_id").references(
      (): AnySQLiteColumn => records.id,
    ),
    body: text("body").notNull(),
    eventNumber: integer("event_number"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    deletionOrigin: text("deletion_origin", { enum: ["author", "admin"] }),
  },
  (table) => [
    index("records_created_at_idx").on(table.createdAt),
    index("records_user_id_idx").on(table.userId),
    index("records_parent_record_id_idx").on(table.parentRecordId),
  ],
);

export const bounties = sqliteTable(
  "bounties",
  {
    id: text("id").primaryKey(),
    cadence: text("cadence", { enum: ["daily", "weekly"] }).notNull(),
    ruleType: text("rule_type", {
      enum: ["character_count", "event_gap"],
    }).notNull(),
    character: text("character"),
    targetValue: integer("target_value").notNull(),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
    endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
    sampleRecordIdA: text("sample_record_id_a").notNull(),
    sampleRecordIdB: text("sample_record_id_b"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    check(
      "bounties_id_uuid_v4_check",
      sql`length(${table.id}) = 36
        AND ${table.id} = lower(${table.id})
        AND length(replace(${table.id}, '-', '')) = 32
        AND replace(${table.id}, '-', '') NOT GLOB '*[^0-9a-f]*'
        AND substr(${table.id}, 9, 1) = '-'
        AND substr(${table.id}, 14, 1) = '-'
        AND substr(${table.id}, 15, 1) = '4'
        AND substr(${table.id}, 19, 1) = '-'
        AND substr(${table.id}, 20, 1) IN ('8', '9', 'a', 'b')
        AND substr(${table.id}, 24, 1) = '-'`,
    ),
    index("bounties_period_idx").on(table.cadence, table.startsAt),
    index("bounties_ends_at_idx").on(table.endsAt),
  ],
);

export const bountyClaims = sqliteTable(
  "bounty_claims",
  {
    id: text("id").primaryKey(),
    bountyId: text("bounty_id")
      .notNull()
      .unique()
      .references(() => bounties.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    recordIdA: text("record_id_a")
      .notNull()
      .references(() => records.id),
    recordIdB: text("record_id_b").references(() => records.id),
    claimedAt: integer("claimed_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("bounty_claims_user_id_idx").on(table.userId)],
);

export const uuidObjects = sqliteTable("uuid_objects", {
  id: text("id").primaryKey(),
  objectType: text("object_type", {
    enum: ["record", "bounty", "claim", "connection"],
  }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const connections = sqliteTable(
  "connections",
  {
    id: text("id").primaryKey(),
    sourceId: text("source_id").notNull().references(() => uuidObjects.id),
    targetId: text("target_id").notNull().references(() => uuidObjects.id),
    relationship: text("relationship", {
      enum: [
        "REPLIES_TO", "ANSWERS", "USES_RECORD", "REFERENCES",
        "SUPPORTS", "DISPUTES", "CORRECTS",
      ],
    }).notNull(),
    origin: text("origin", { enum: ["system", "user"] }).notNull(),
    creatorUserId: text("creator_user_id").references(() => users.id),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    check("connections_no_self_check", sql`${table.sourceId} <> ${table.targetId}`),
    index("connections_source_active_idx").on(table.sourceId, table.createdAt),
    index("connections_target_active_idx").on(table.targetId, table.createdAt),
    index("connections_creator_idx").on(table.creatorUserId, table.createdAt),
    uniqueIndex("connections_user_active_unique")
      .on(table.sourceId, table.targetId, table.relationship, table.creatorUserId)
      .where(sql`${table.origin} = 'user' AND ${table.deletedAt} IS NULL`),
    uniqueIndex("connections_system_active_unique")
      .on(table.sourceId, table.targetId, table.relationship)
      .where(sql`${table.origin} = 'system' AND ${table.deletedAt} IS NULL`),
  ],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

export const follows = sqliteTable(
  "follows",
  {
    followerId: text("follower_id")
      .notNull()
      .references(() => users.id),
    followingId: text("following_id")
      .notNull()
      .references(() => users.id),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.followerId, table.followingId] }),
    check("follows_no_self_check", sql`${table.followerId} <> ${table.followingId}`),
    index("follows_follower_id_idx").on(table.followerId),
    index("follows_following_id_idx").on(table.followingId),
  ],
);

export const admins = sqliteTable(
  "admins",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id),
    grantedByUserId: text("granted_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("admins_granted_by_idx").on(table.grantedByUserId)],
);

export const userRelations = relations(users, ({ many }) => ({
  records: many(records),
}));

export const recordRelations = relations(records, ({ many, one }) => ({
  author: one(users, {
    fields: [records.userId],
    references: [users.id],
  }),
  parent: one(records, {
    fields: [records.parentRecordId],
    references: [records.id],
    relationName: "recordReplies",
  }),
  replies: many(records, { relationName: "recordReplies" }),
}));
