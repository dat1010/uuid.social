import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { useEffect } from "react";
import { data, Form, Link, redirect, useNavigation, useSearchParams } from "react-router";

import type { Route } from "./+types/record";
import { RecordCard } from "../components/RecordCard";
import { RecordSpecimen } from "../components/RecordSpecimen";
import { ConnectionsPanel } from "../components/ConnectionsPanel";
import { ThemeToggle } from "../components/ThemeToggle";
import { createDb } from "../db/client.server";
import { records, users } from "../db/schema";
import {
  getCurrentUser,
  requireUser,
  toPublicCurrentUser,
  validateUuid,
} from "../services/auth.server";
import { createReply, getConnectionLists } from "../services/connections.server";
import { getCloudflareEnv } from "../services/cloudflare.server";

export function meta({ data }: Route.MetaArgs) {
  const title = data?.record.id
    ? `Record ${data.record.id} | uuid.social`
    : "Record | uuid.social";

  return [
    { title },
    { name: "description", content: "A record on uuid.social." },
  ];
}

export function headers() {
  return { "Cache-Control": "private, no-store" };
}

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const uuid = params.uuid?.toLowerCase();
  if (!uuid || !validateUuid(uuid)) {
    throw new Response("Not Found", { status: 404, statusText: "Not Found" });
  }

  const env = getCloudflareEnv(context);
  const db = createDb(env.DB);
  const [currentUser, recordRows, replyRows, connections] = await Promise.all([
    getCurrentUser(request, context),
    db
      .select({
        id: records.id,
        username: users.username,
        displayName: users.displayName,
        avatarKey: users.avatarKey,
        body: records.body,
        eventNumber: records.eventNumber,
        createdAt: records.createdAt,
        userId: records.userId,
        parentRecordId: records.parentRecordId,
        deletedAt: records.deletedAt,
        deletionOrigin: records.deletionOrigin,
        replyCount: replyCountSql,
      })
      .from(records)
      .innerJoin(users, eq(records.userId, users.id))
      .where(eq(records.id, uuid))
      .limit(1),
    db
      .select({
        id: records.id,
        username: users.username,
        displayName: users.displayName,
        avatarKey: users.avatarKey,
        body: records.body,
        eventNumber: records.eventNumber,
        createdAt: records.createdAt,
        replyCount: replyCountSql,
      })
      .from(records)
      .innerJoin(users, eq(records.userId, users.id))
      .where(
        and(
          eq(records.parentRecordId, uuid),
          isNull(records.deletedAt),
        ),
      )
      .orderBy(asc(records.createdAt)),
    getConnectionLists(env.DB, uuid),
  ]);
  const [record] = recordRows;

  if (!record) {
    throw new Response("Not Found", { status: 404, statusText: "Not Found" });
  }

  const { userId, parentRecordId, deletedAt, deletionOrigin, ...publicRecord } = record;
  const deleted = deletedAt !== null;

  return {
    currentUser: toPublicCurrentUser(currentUser),
    isOwner: !deleted && currentUser?.id === userId,
    canDelete: !deleted && Boolean(currentUser && (currentUser.id === userId || currentUser.isAdmin)),
    isReply: parentRecordId !== null,
    parentRecordId,
    deleted,
    deletionOrigin,
    connections,
    record: {
      ...publicRecord,
      username: deleted ? "" : record.username,
      displayName: deleted ? "" : record.displayName || record.username,
      hasAvatar: deleted ? false : Boolean(record.avatarKey),
      body: deleted ? "" : record.body,
      createdAt: record.createdAt.toISOString(),
      replyCount: Number(record.replyCount),
    },
    replies: replyRows.map((reply) => ({
      ...reply,
      displayName: reply.displayName || reply.username,
      hasAvatar: Boolean(reply.avatarKey),
      createdAt: reply.createdAt.toISOString(),
      replyCount: Number(reply.replyCount),
    })),
  };
}

export async function action({ request, context, params }: Route.ActionArgs) {
  const currentUser = await requireUser(request, context);
  const uuid = params.uuid?.toLowerCase();
  if (!uuid || !validateUuid(uuid)) {
    throw new Response("Not Found", { status: 404, statusText: "Not Found" });
  }

  const env = getCloudflareEnv(context);
  const db = createDb(env.DB);
  const [targetRecord] = await db
    .select({
      id: records.id,
      userId: records.userId,
      parentRecordId: records.parentRecordId,
    })
    .from(records)
    .where(and(eq(records.id, uuid), isNull(records.deletedAt)))
    .limit(1);

  if (!targetRecord) {
    throw new Response("Not Found", { status: 404, statusText: "Not Found" });
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent === "delete") {
    if (targetRecord.userId !== currentUser.id && !currentUser.isAdmin) {
      throw new Response("Forbidden", {
        status: 403,
        statusText: "Forbidden",
      });
    }

    await db
      .update(records)
      .set({
        deletedAt: new Date(),
        deletionOrigin: targetRecord.userId === currentUser.id ? "author" : "admin",
      })
      .where(eq(records.id, targetRecord.id));

    return redirect(
      targetRecord.parentRecordId
        ? `/record/${targetRecord.parentRecordId}`
        : "/home",
    );
  }

  if (intent !== "reply") {
    return data({ error: "Unsupported record action." }, { status: 400 });
  }

  const body = String(formData.get("body") ?? "").trim();
  if (!body || body.length > 500) {
    return data(
      { error: "Replies must contain between 1 and 500 characters." },
      { status: 400 },
    );
  }

  const replyId = crypto.randomUUID();
  await createReply(env.DB, {
    id: replyId, userId: currentUser.id,
    parentId: targetRecord.id, body, createdAt: Date.now(),
  });

  return redirect(`/record/${replyId}?reveal=1`);
}

export default function Record({ loaderData, actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const { currentUser, canDelete, isReply, parentRecordId, deleted, deletionOrigin, record, replies, connections } = loaderData;
  const [searchParams] = useSearchParams();
  const reveal = searchParams.get("reveal") === "1";
  const homeUrl = currentUser ? "/home" : "/";
  const isReplying =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "reply";
  const isDeleting =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "delete";

  useEffect(() => {
    if (!reveal) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("reveal");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, [reveal]);

  return (
    <div className="min-h-screen bg-base-200">
      <header className="navbar bg-base-100 shadow-sm px-4 lg:px-8">
        <div className="navbar-start">
          <Link
            to={homeUrl}
            className="font-bold tracking-widest uppercase text-sm"
          >
            uuid.social
          </Link>
        </div>
        <div className="navbar-end gap-2">
          <ThemeToggle />
          {currentUser && <Link className="btn btn-ghost btn-sm" to="/specimens">Specimens</Link>}
          <Link className="btn btn-ghost btn-sm" to="/bounties">Bounties</Link>
          {currentUser ? (
            <>
              <Link className="btn btn-ghost btn-sm" to="/home">
                Home
              </Link>
              <Form action="/logout" method="post">
                <button className="btn btn-ghost btn-sm" type="submit">
                  Logout
                </button>
              </Form>
            </>
          ) : (
            <>
              <Link className="btn btn-ghost btn-sm" to="/login">
                Sign in
              </Link>
              <Link className="btn btn-primary btn-sm" to="/signup">
                Sign up
              </Link>
            </>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 lg:px-8">
        <div className="card bg-base-100 shadow mb-4 overflow-hidden">
          <RecordSpecimen record={record} deleted={deleted} deletionOrigin={deletionOrigin} parentRecordId={parentRecordId} reveal={reveal} />
          {canDelete && (
            <div className="px-4 pb-4 flex justify-end">
              <Form method="post">
                <input name="intent" type="hidden" value="delete" />
                <button
                  className="btn btn-error btn-outline btn-xs"
                  disabled={isDeleting}
                >
                  {isDeleting
                    ? "Deleting..."
                    : isReply
                      ? "Delete reply"
                      : currentUser?.isAdmin ? "Moderate record" : "Delete record"}
                </button>
              </Form>
            </div>
          )}
        </div>

        <div className="record-thread-column">
        {!deleted && <div className="card bg-base-100 shadow mb-4">
          <div className="card-body p-4">
            {currentUser ? (
              <Form
                className="flex flex-col gap-3"
                key={isReplying ? "replying" : "idle"}
                method="post"
              >
                <input name="intent" type="hidden" value="reply" />
                <textarea
                  className="textarea textarea-bordered w-full min-h-24 resize-none"
                  maxLength={500}
                  name="body"
                  placeholder="Reply to this record"
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
                    disabled={isReplying}
                  >
                    {isReplying ? "Replying..." : "Reply"}
                  </button>
                </div>
              </Form>
            ) : (
              <p className="text-sm text-base-content/60">
                <Link className="link" to="/login">Sign in</Link> to reply.
              </p>
            )}
          </div>
        </div>}

        <div className="card bg-base-100 shadow">
          <div className="px-4 py-3 border-b border-base-200">
            <h2 className="font-bold text-sm">
              {replies.length} {replies.length === 1 ? "reply" : "replies"}
            </h2>
          </div>
          {replies.length === 0 ? (
            <div className="card-body items-center py-12 text-center">
              <p className="text-base-content/40">No replies yet.</p>
            </div>
          ) : (
            replies.map((reply, index) => (
              <RecordCard
                key={reply.id}
                record={reply}
                className={
                  index < replies.length - 1
                    ? "border-b border-base-200"
                    : ""
                }
              />
            ))
          )}
        </div>
        <ConnectionsPanel objectId={record.id} connections={connections} />
        </div>
      </main>
    </div>
  );
}

const replyCountSql = sql<number>`(
  select count(*) from records as replies
  where replies.parent_record_id = ${records.id}
    and replies.deleted_at is null
)`;
