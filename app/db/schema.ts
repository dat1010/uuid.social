import { relations } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  index,
  integer,
  sqliteTable,
  text,
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
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("records_created_at_idx").on(table.createdAt),
    index("records_user_id_idx").on(table.userId),
    index("records_parent_record_id_idx").on(table.parentRecordId),
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
    index("follows_follower_id_idx").on(table.followerId),
    index("follows_following_id_idx").on(table.followingId),
  ],
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
