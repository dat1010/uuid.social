import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { data, Form, useNavigation } from "react-router";
import { RecordCard } from "../components/RecordCard";
import { Avatar } from "../components/Avatar";
import { ThemeToggle } from "../components/ThemeToggle";

import type { Route } from "./+types/home";
import { createDb } from "../db/client.server";
import { records as recordsTable, users } from "../db/schema";
import { requireUser } from "../services/auth.server";
import { getCloudflareEnv } from "../services/cloudflare.server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Timeline | uuid.social" },
    { name: "description", content: "The uuid.social timeline." },
  ];
}

export function headers() {
  return { "Cache-Control": "private, no-store" };
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const currentUser = await requireUser(request, context);
  const env = getCloudflareEnv(context);
  const db = createDb(env.DB);
  const records = await db
    .select({
      id: recordsTable.id,
      username: users.username,
      displayName: users.displayName,
      avatarKey: users.avatarKey,
      body: recordsTable.body,
      createdAt: recordsTable.createdAt,
      replyCount: sql<number>`(
        select count(*) from records as replies
        where replies.parent_record_id = ${recordsTable.id}
          and replies.deleted_at is null
      )`,
    })
    .from(recordsTable)
    .innerJoin(users, eq(recordsTable.userId, users.id))
    .where(
      and(
        isNull(recordsTable.deletedAt),
        isNull(recordsTable.parentRecordId),
      ),
    )
    .orderBy(desc(recordsTable.createdAt))
    .limit(50);

  return {
    currentUser,
    records: records.map((record) => ({
      ...record,
      displayName: record.displayName || record.username,
      hasAvatar: Boolean(record.avatarKey),
      createdAt: record.createdAt.toISOString(),
      replyCount: Number(record.replyCount),
    })),
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const currentUser = await requireUser(request, context);
  const formData = await request.formData();
  const body = String(formData.get("body") ?? "").trim();

  if (!body || body.length > 500) {
    return data(
      { error: "Records must contain between 1 and 500 characters." },
      { status: 400 },
    );
  }

  const env = getCloudflareEnv(context);
  const db = createDb(env.DB);
  await db.insert(recordsTable).values({
    id: crypto.randomUUID(),
    userId: currentUser.id,
    body,
    createdAt: new Date(),
  });

  return data({ error: null });
}

export default function Home({ loaderData, actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const { currentUser, records } = loaderData;
  const isPublishing = navigation.formAction === "/home";

  return (
    <div className="min-h-screen bg-base-200">
      <header className="navbar bg-base-100 shadow-sm px-4 lg:px-8 sticky top-0 z-10">
        <div className="navbar-start">
          <a href="/home" className="font-bold tracking-widest uppercase text-sm">
            uuid.social
          </a>
        </div>
        <div className="navbar-end gap-1">
          <ThemeToggle />
          <Form action="/logout" method="post">
            <button className="btn btn-ghost btn-sm" type="submit">
              Logout
            </button>
          </Form>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          {/* Sidebar */}
          <aside className="card bg-base-100 shadow h-fit">
            <div className="card-body p-4 gap-3">
              <a href={`/user/${currentUser.username}`}>
                <Avatar {...currentUser} />
              </a>
              <div>
                <a className="font-bold link link-hover" href={`/user/${currentUser.username}`}>{currentUser.displayName}</a>
                <p className="text-sm text-base-content/50">@{currentUser.username}</p>
              </div>
              {currentUser.status && <p className="text-sm leading-relaxed">{currentUser.status}</p>}
              <a className="btn btn-outline btn-sm mt-1" href="/profile">Edit profile</a>
            </div>
          </aside>

          {/* Timeline */}
          <div className="flex flex-col gap-4">
            {/* Composer */}
            <div className="card bg-base-100 shadow">
              <div className="card-body p-4">
                <Form
                  className="flex flex-col gap-3"
                  method="post"
                  key={isPublishing ? "publishing" : "idle"}
                >
                  <textarea
                    className="textarea textarea-bordered w-full min-h-24 resize-none"
                    maxLength={500}
                    name="body"
                    placeholder="What is happening in this UUID lifetime?"
                    required
                  />
                  {actionData?.error && (
                    <div role="alert" className="alert alert-error text-sm py-2">
                      <span>{actionData.error}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-base-content/30">max 500 chars</span>
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={isPublishing}
                    >
                      {isPublishing ? "Publishing..." : "Publish"}
                    </button>
                  </div>
                </Form>
              </div>
            </div>

            {/* Feed */}
            <div className="card bg-base-100 shadow">
              {records.length === 0 ? (
                <div className="card-body items-center py-16 text-center">
                  <p className="text-base-content/40">
                    No records yet. Publish the first one.
                  </p>
                </div>
              ) : (
                records.map((record, i) => (
                  <RecordCard
                    key={record.id}
                    record={record}
                    className={i < records.length - 1 ? "border-b border-base-200" : ""}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
