import { data, Form, Link, redirect, useNavigation } from "react-router";
import { RecordCard } from "../components/RecordCard";
import { Avatar } from "../components/Avatar";
import { ThemeToggle } from "../components/ThemeToggle";

import type { Route } from "./+types/home";
import { createDb } from "../db/client.server";
import { records as recordsTable } from "../db/schema";
import { requireUser, toPublicCurrentUser } from "../services/auth.server";
import { getCloudflareEnv } from "../services/cloudflare.server";
import { getFeed } from "../services/feed.server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Your Sequence | uuid.social" },
    {
      name: "description",
      content: "The latest records from across uuid.social.",
    },
  ];
}

export function headers() {
  return { "Cache-Control": "private, no-store" };
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const currentUser = await requireUser(request, context);
  const env = getCloudflareEnv(context);
  return {
    currentUser: toPublicCurrentUser(currentUser)!,
    ...await getFeed(env.DB, currentUser.id, new URL(request.url)),
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
  const recordId = crypto.randomUUID();
  await db.insert(recordsTable).values({
    id: recordId,
    userId: currentUser.id,
    body,
    createdAt: new Date(),
  });

  return redirect(`/record/${recordId}?reveal=1`);
}

export default function Home({ loaderData, actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const { currentUser, records, view, query, page, hasNextPage } = loaderData;
  const isPublishing = navigation.state === "submitting" && navigation.formMethod === "POST";
  const feedLink = (nextView = view, nextPage = 1) =>
    `/home?${new URLSearchParams({ view: nextView, q: query, page: String(nextPage) })}`;

  return (
    <div className="min-h-screen bg-base-200">
      <header className="navbar bg-base-100 shadow-sm px-4 lg:px-8 sticky top-0 z-10">
        <div className="navbar-start">
          <a href="/home" className="font-bold tracking-widest uppercase text-sm">
            uuid.social
          </a>
        </div>
        <div className="navbar-end gap-1">
          {currentUser.isAdmin && <a className="btn btn-warning btn-sm" href="/admin">Control</a>}
          <a className="btn btn-ghost btn-sm" href="/specimens">Specimens</a>
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
          <aside className="flex flex-col gap-4 h-fit">
            <div className="card bg-base-100 shadow"><div className="card-body p-4 gap-3">
              <a href={`/user/${currentUser.username}`}>
                <Avatar {...currentUser} />
              </a>
              <div>
                <a className="font-bold link link-hover" href={`/user/${currentUser.username}`}>{currentUser.displayName}</a>
                <p className="text-sm text-base-content/50">@{currentUser.username}</p>
              </div>
              {currentUser.status && <p className="text-sm leading-relaxed">{currentUser.status}</p>}
              <a className="btn btn-outline btn-sm mt-1" href="/profile">Edit profile</a>
            </div></div>
            <section className="card bg-base-100 shadow">
              <div className="card-body p-4 gap-3">
                <p className="text-xs font-bold uppercase tracking-widest text-primary">Your field archive</p>
                <h2 className="font-bold">Every record has a specimen.</h2>
                <p className="text-sm text-base-content/60">Explore its traits, find your favorites, and feature one on your profile.</p>
                <Link className="btn btn-outline btn-sm" to="/specimens">Explore specimens</Link>
              </div>
            </section>
            <Link className="link text-xs text-base-content/50 px-4" to="/bounties">Historical bounty archive</Link>
          </aside>

          {/* Sequence */}
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-2xl font-bold">Your Sequence</h1>
              <p className="mt-1 text-sm text-base-content/50">
                {view === "following" ? "Records from the people you follow." : "The latest records from across uuid.social."}
              </p>
            </div>

            <nav className="flex gap-2" aria-label="Feed views">
              <Link className={`btn btn-sm ${view === "everyone" ? "btn-primary" : "btn-ghost"}`} aria-current={view === "everyone" ? "page" : undefined} to={feedLink("everyone")}>Everyone</Link>
              <Link className={`btn btn-sm ${view === "following" ? "btn-primary" : "btn-ghost"}`} aria-current={view === "following" ? "page" : undefined} to={feedLink("following")}>Following</Link>
            </nav>
            <Form method="get" action="/home" className="flex flex-wrap gap-2 items-end">
              <input type="hidden" name="view" value={view} />
              <label className="flex-1 min-w-40 text-xs font-semibold">
                Search records and replies
                <input key={query} className="input input-bordered w-full mt-1" type="search" name="q" maxLength={200} defaultValue={query} placeholder="Words, username, or record UUID" />
              </label>
              <button className="btn btn-outline" type="submit">Search</button>
              {query && <Link className="btn btn-ghost" to={`/home?view=${view}`}>Clear</Link>}
            </Form>

            {/* Composer */}
            <div className="card bg-base-100 shadow">
              <div className="card-body p-4">
                <Form
                  className="flex flex-col gap-3"
                  method="post"
                  action="/home"
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

            {/* Records */}
            <div className="card bg-base-100 shadow">
              {records.length === 0 ? (
                <div className="card-body items-center py-16 text-center">
                  <p className="text-base-content/40">
                    {query ? "No records match your search." : view === "following" ? "No records here yet. Browse Everyone and follow someone from their profile." : "No records yet. Publish the first one."}
                  </p>
                </div>
              ) : (
                records.map((record, i) => (
                  <RecordCard
                    key={record.id}
                    record={record}
                    showSpecimenIdentity={false}
                    className={i < records.length - 1 ? "border-b border-base-200" : ""}
                  />
                ))
              )}
            </div>
            <nav className="flex items-center justify-between gap-3" aria-label="Feed pages">
              {page > 1 ? <Link className="btn btn-outline btn-sm" to={feedLink(view, page - 1)}>Newer</Link> : <span />}
              <span className="text-xs text-base-content/50">Page {page}</span>
              {hasNextPage ? <Link className="btn btn-outline btn-sm" to={feedLink(view, page + 1)}>Older</Link> : <span />}
            </nav>
          </div>
        </div>
      </main>
    </div>
  );
}
