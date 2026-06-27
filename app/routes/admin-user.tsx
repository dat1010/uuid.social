import { data, Form, Link, redirect, useNavigation } from "react-router";

import type { Route } from "./+types/admin-user";
import { AdminHeader } from "../components/AdminHeader";
import { Avatar } from "../components/Avatar";
import { normalizeUsername, requireAdmin } from "../services/auth.server";
import { parseAdminPage } from "../services/admin";
import { deactivateUser, deleteUserRecord, getAdminUser, releaseUserRecord } from "../services/admin.server";
import { getCloudflareEnv } from "../services/cloudflare.server";

export function meta({ data }: Route.MetaArgs) {
  return [{ title: data ? `@${data.detail.user.username} | Control` : "User | Control" }];
}

export function headers() {
  return { "Cache-Control": "private, no-store" };
}

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const currentUser = await requireAdmin(request, context);
  const username = normalizeUsername(params.username ?? "");
  const page = parseAdminPage(new URL(request.url).searchParams.get("page"));
  const detail = await getAdminUser(getCloudflareEnv(context).DB, username, page);
  if (!detail) throw new Response("Not Found", { status: 404 });
  return { currentUsername: currentUser.username, detail };
}

export async function action({ request, context, params }: Route.ActionArgs) {
  const currentUser = await requireAdmin(request, context);
  const username = normalizeUsername(params.username ?? "");
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const db = getCloudflareEnv(context).DB;
  let error: string | null;

  if (intent === "deactivate_user") {
    if (normalizeUsername(String(formData.get("confirmation") ?? "")) !== username) {
      return data({ error: `Type ${username} to confirm account deletion.` }, { status: 400 });
    }
    error = await deactivateUser({ db, actorId: currentUser.id, actorUsername: currentUser.username, targetUsername: username });
  } else if (intent === "delete_record") {
    error = await deleteUserRecord(db, username, String(formData.get("recordId") ?? ""));
  } else if (intent === "release_record") {
    error = await releaseUserRecord(db, username, String(formData.get("recordId") ?? ""));
  } else {
    error = "Choose a valid moderation action.";
  }
  if (error) return data({ error }, { status: 400 });
  return redirect(`/admin/users/${username}`);
}

export default function AdminUser({ loaderData, actionData }: Route.ComponentProps) {
  const { currentUsername, detail } = loaderData;
  const { user } = detail;
  const navigation = useNavigation();
  return (
    <div className="admin-shell min-h-screen"><AdminHeader /><main className="admin-main">
      <Link className="admin-back" to="/admin">← All identities</Link>
      <section className="admin-user-hero"><Avatar {...user} size="lg" /><div><div className="flex flex-wrap gap-2 mb-2"><span className={`badge ${user.deleted ? "badge-error" : "badge-success"}`}>{user.deleted ? "DELETED" : "ACTIVE"}</span>{user.isAdmin && <span className="badge badge-warning">ADMIN</span>}{user.bootstrap && <span className="badge badge-outline">BOOTSTRAP</span>}</div><h1>{user.displayName}</h1><p>@{user.username}</p></div><Link className="btn btn-outline btn-sm ml-auto" to={`/user/${user.username}`}>Public profile</Link></section>
      {actionData?.error && <div className="alert alert-error my-4" role="alert">{actionData.error}</div>}
      <section className="admin-panel"><div className="admin-panel-heading"><div><p className="admin-index">PROFILE / RETAINED</p><h2>Account data</h2></div></div><dl className="admin-details"><div><dt>Joined</dt><dd>{formatDate(user.createdAt)}</dd></div><div><dt>Status</dt><dd>{user.status || "None"}</dd></div><div className="md:col-span-2"><dt>Bio</dt><dd>{user.bio || "No bio"}</dd></div></dl></section>
      <section className="admin-panel"><div className="admin-panel-heading"><div><p className="admin-index">RECORDS / MODERATION</p><h2>Authored records</h2></div></div><div className="admin-records">{detail.records.map((record) => <article className={record.deleted ? "admin-record admin-record-deleted" : "admin-record"} key={record.id}><div><div className="flex gap-2 mb-2"><span className="badge badge-ghost badge-sm">{record.isReply ? "REPLY" : "RECORD"}</span>{record.deleted && <span className="badge badge-error badge-sm">DELETED {record.deletionOrigin ? `BY ${record.deletionOrigin.toUpperCase()}` : ""}</span>}</div><p>{record.deleted ? "Record content retained as a private tombstone." : record.body}</p><Link className="font-mono text-xs link" to={`/record/${record.id}`}>{record.id}</Link><span className="block text-xs text-base-content/40 mt-1">{formatDate(record.createdAt)} · {record.replyCount} replies</span></div>{!record.deleted && <Form method="post" onSubmit={(event) => { if (!confirm("Soft-delete this public record?")) event.preventDefault(); }}><input name="intent" type="hidden" value="delete_record" /><input name="recordId" type="hidden" value={record.id} /><button className="btn btn-error btn-outline btn-xs" disabled={navigation.state === "submitting"}>Delete record</button></Form>}{record.deleted && record.deletionOrigin === "admin" && <Form method="post" onSubmit={(event) => { if (!confirm("Release this moderated record back to public view?")) event.preventDefault(); }}><input name="intent" type="hidden" value="release_record" /><input name="recordId" type="hidden" value={record.id} /><button className="btn btn-success btn-outline btn-xs" disabled={navigation.state === "submitting"}>Release record</button></Form>}</article>)}</div>{detail.records.length === 0 && <p className="admin-empty">No records.</p>}<div className="admin-pagination">{detail.recordPage > 1 ? <Link className="btn btn-sm btn-outline" to={`?page=${detail.recordPage - 1}`}>Previous</Link> : <span />}{detail.hasNextRecordPage && <Link className="btn btn-sm btn-outline" to={`?page=${detail.recordPage + 1}`}>Next</Link>}</div></section>
      {!user.deleted && user.username !== currentUsername && !user.bootstrap && <section className="admin-danger"><div><p className="admin-index">DANGER / IRREVERSIBLE</p><h2>Delete account access</h2><p>Public history remains. Sessions are revoked and the saved login UUID permanently stops working.</p></div><Form method="post"><input name="intent" type="hidden" value="deactivate_user" /><label>Type <strong>{user.username}</strong> to confirm</label><div className="join"><input className="input input-bordered join-item" name="confirmation" required /><button className="btn btn-error join-item">Delete access</button></div></Form></section>}
    </main></div>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}
