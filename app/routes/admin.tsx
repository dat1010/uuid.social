import { data, Form, Link, redirect, useNavigation } from "react-router";

import type { Route } from "./+types/admin";
import { AdminHeader } from "../components/AdminHeader";
import { normalizeUsername, requireAdmin } from "../services/auth.server";
import { parseAdminPage } from "../services/admin";
import { getAdminDashboard, grantAdmin, revokeAdmin } from "../services/admin.server";
import { getCloudflareEnv } from "../services/cloudflare.server";

export function meta() {
  return [{ title: "Control | uuid.social" }];
}

export function headers() {
  return { "Cache-Control": "private, no-store" };
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const currentUser = await requireAdmin(request, context);
  const url = new URL(request.url);
  const query = normalizeUsername(url.searchParams.get("q") ?? "");
  const page = parseAdminPage(url.searchParams.get("page"));
  const dashboard = await getAdminDashboard(getCloudflareEnv(context).DB, query, page);
  return { currentUsername: currentUser.username, dashboard };
}

export async function action({ request, context }: Route.ActionArgs) {
  const currentUser = await requireAdmin(request, context);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const username = normalizeUsername(String(formData.get("username") ?? ""));
  if (!username) return data({ error: "Enter a username." }, { status: 400 });

  const db = getCloudflareEnv(context).DB;
  const error = intent === "grant_admin"
    ? await grantAdmin(db, currentUser.id, username)
    : intent === "revoke_admin"
      ? await revokeAdmin({ db, actorId: currentUser.id, actorUsername: currentUser.username, targetUsername: username })
      : "Choose a valid admin action.";
  if (error) return data({ error }, { status: 400 });
  return redirect("/admin");
}

export default function AdminDashboard({ loaderData, actionData }: Route.ComponentProps) {
  const { currentUsername, dashboard } = loaderData;
  const navigation = useNavigation();
  return (
    <div className="admin-shell min-h-screen">
      <AdminHeader />
      <main className="admin-main">
        <section className="admin-hero">
          <div><p className="admin-eyebrow">Authenticated operator / @{currentUsername}</p><h1>User control plane</h1><p>Account access, delegated administrators, and public record moderation.</p></div>
          <div className="admin-signal"><span className="admin-signal-dot" />SYSTEM ACTIVE</div>
        </section>

        <section className="admin-stats" aria-label="User totals">
          <Stat label="All identities" value={dashboard.counts.total} />
          <Stat label="Active" value={dashboard.counts.active} tone="active" />
          <Stat label="Deleted" value={dashboard.counts.deleted} tone="danger" />
          <Stat label="Administrators" value={dashboard.admins.length} tone="admin" />
        </section>

        <section className="admin-panel">
          <div className="admin-panel-heading"><div><p className="admin-index">01 / ACCESS</p><h2>Administrators</h2></div></div>
          <div className="admin-admin-grid">
            <div className="admin-roster">
              {dashboard.admins.map((admin) => <div className="admin-roster-row" key={admin.username}><div><strong>@{admin.username}</strong><span>{admin.bootstrap ? "Permanent bootstrap admin" : `Granted by @${admin.grantedByUsername}`}</span></div><div className="flex items-center gap-2"><span className="badge badge-sm badge-warning">ADMIN</span>{!admin.bootstrap && admin.username !== currentUsername && <Form method="post" onSubmit={(event) => { if (!confirm(`Revoke admin access from @${admin.username}?`)) event.preventDefault(); }}><input name="intent" type="hidden" value="revoke_admin" /><input name="username" type="hidden" value={admin.username} /><button className="btn btn-error btn-outline btn-xs">Revoke</button></Form>}</div></div>)}
            </div>
            <Form className="admin-grant-form" method="post">
              <input name="intent" type="hidden" value="grant_admin" />
              <label htmlFor="admin-username">Grant full control</label>
              <p>Active users receive the same permissions as every administrator.</p>
              <div className="join w-full"><input className="input input-bordered join-item min-w-0 flex-1" id="admin-username" name="username" placeholder="username" required /><button className="btn btn-warning join-item" disabled={navigation.state === "submitting"}>Grant</button></div>
              {actionData?.error && <p className="text-error text-xs" role="alert">{actionData.error}</p>}
            </Form>
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-heading"><div><p className="admin-index">02 / IDENTITIES</p><h2>All users</h2></div><Form className="join" method="get"><input className="input input-bordered input-sm join-item" defaultValue={dashboard.query} name="q" placeholder="Search username" /><button className="btn btn-sm join-item">Search</button></Form></div>
          <div className="overflow-x-auto"><table className="table admin-table"><thead><tr><th>User</th><th>Status</th><th>Records</th><th>Social</th><th>Joined</th><th /></tr></thead><tbody>{dashboard.users.map((user) => <tr key={user.username}><td><strong>{user.displayName}</strong><span>@{user.username}</span></td><td><span className={`badge badge-sm ${user.deleted ? "badge-error" : "badge-success"}`}>{user.deleted ? "DELETED" : "ACTIVE"}</span>{user.isAdmin && <span className="badge badge-sm badge-warning ml-1">ADMIN</span>}</td><td>{user.recordCount}</td><td>{user.followerCount} in / {user.followingCount} out</td><td>{formatDate(user.createdAt)}</td><td><Link className="btn btn-xs btn-outline" to={`/admin/users/${user.username}`}>Inspect</Link></td></tr>)}</tbody></table></div>
          {dashboard.users.length === 0 && <p className="admin-empty">No users match that query.</p>}
          <div className="admin-pagination">{dashboard.page > 1 ? <Link className="btn btn-sm btn-outline" to={pageUrl(dashboard.query, dashboard.page - 1)}>Previous</Link> : <span />}{dashboard.hasNextPage && <Link className="btn btn-sm btn-outline" to={pageUrl(dashboard.query, dashboard.page + 1)}>Next</Link>}</div>
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value, tone = "" }: { label: string; value: number; tone?: string }) {
  return <div className={`admin-stat admin-stat-${tone}`}><span>{label}</span><strong>{value.toLocaleString()}</strong></div>;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function pageUrl(query: string, page: number) {
  const params = new URLSearchParams({ page: String(page) });
  if (query) params.set("q", query);
  return `?${params}`;
}
