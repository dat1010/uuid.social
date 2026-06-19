import { desc, eq, isNull } from "drizzle-orm";
import { data, Form, useNavigation } from "react-router";
import { ThemeToggle } from "../components/ThemeToggle";

import type { Route } from "./+types/home";
import { createDb } from "../db/client.server";
import { posts as postsTable, users } from "../db/schema";
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
  const posts = await db
    .select({
      id: postsTable.id,
      username: users.username,
      displayName: users.displayName,
      body: postsTable.body,
      createdAt: postsTable.createdAt,
    })
    .from(postsTable)
    .innerJoin(users, eq(postsTable.userId, users.id))
    .where(isNull(postsTable.deletedAt))
    .orderBy(desc(postsTable.createdAt))
    .limit(50);

  return {
    currentUser,
    posts: posts.map((post) => ({
      ...post,
      displayName: post.displayName || post.username,
      createdAt: post.createdAt.toISOString(),
    })),
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const currentUser = await requireUser(request, context);
  const formData = await request.formData();
  const body = String(formData.get("body") ?? "").trim();

  if (!body || body.length > 500) {
    return data(
      { error: "Posts must contain between 1 and 500 characters." },
      { status: 400 },
    );
  }

  const env = getCloudflareEnv(context);
  const db = createDb(env.DB);
  await db.insert(postsTable).values({
    id: crypto.randomUUID(),
    userId: currentUser.id,
    body,
    createdAt: new Date(),
  });

  return data({ error: null });
}

export default function Home({ loaderData, actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const { currentUser, posts } = loaderData;
  const isPosting = navigation.formAction === "/home";

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
              <div className="avatar avatar-placeholder">
                <div className="bg-primary text-primary-content rounded-full w-12">
                  <span className="text-lg font-bold">
                    {currentUser.displayName.slice(0, 1).toUpperCase()}
                  </span>
                </div>
              </div>
              <div>
                <p className="font-bold">{currentUser.displayName}</p>
                <p className="text-sm text-base-content/50">@{currentUser.username}</p>
              </div>
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
                  key={isPosting ? "posting" : "idle"}
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
                      disabled={isPosting}
                    >
                      {isPosting ? "Posting..." : "Post"}
                    </button>
                  </div>
                </Form>
              </div>
            </div>

            {/* Feed */}
            <div className="card bg-base-100 shadow">
              {posts.length === 0 ? (
                <div className="card-body items-center py-16 text-center">
                  <p className="text-base-content/40">No posts yet. Write the first one.</p>
                </div>
              ) : (
                posts.map((post, i) => (
                  <article
                    key={post.id}
                    className={`p-4 ${i < posts.length - 1 ? "border-b border-base-200" : ""}`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="avatar avatar-placeholder">
                        <div className="bg-primary text-primary-content rounded-full w-9">
                          <span className="text-sm font-bold">
                            {post.displayName.slice(0, 1).toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm truncate">{post.displayName}</p>
                        <p className="text-xs text-base-content/50">
                          @{post.username} · {formatPostDate(post.createdAt)}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {post.body}
                    </p>
                  </article>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function formatPostDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
