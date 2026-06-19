import { and, eq, isNull } from "drizzle-orm";
import { Form, Link } from "react-router";

import type { Route } from "./+types/post";
import { PostCard } from "../components/PostCard";
import { ThemeToggle } from "../components/ThemeToggle";
import { createDb } from "../db/client.server";
import { posts, users } from "../db/schema";
import { getCurrentUser, validateUuid } from "../services/auth.server";
import { getCloudflareEnv } from "../services/cloudflare.server";

export function meta({ data }: Route.MetaArgs) {
  const title = data?.post.id
    ? `Post ${data.post.id} | uuid.social`
    : "Post | uuid.social";

  return [
    { title },
    { name: "description", content: "A post on uuid.social." },
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
  const [currentUser, postRows] = await Promise.all([
    getCurrentUser(request, context),
    db
      .select({
        id: posts.id,
        username: users.username,
        displayName: users.displayName,
        body: posts.body,
        createdAt: posts.createdAt,
      })
      .from(posts)
      .innerJoin(users, eq(posts.userId, users.id))
      .where(and(eq(posts.id, uuid), isNull(posts.deletedAt)))
      .limit(1),
  ]);
  const [post] = postRows;

  if (!post) {
    throw new Response("Not Found", { status: 404, statusText: "Not Found" });
  }

  return {
    currentUser,
    post: {
      ...post,
      displayName: post.displayName || post.username,
      createdAt: post.createdAt.toISOString(),
    },
  };
}

export default function Post({ loaderData }: Route.ComponentProps) {
  const { currentUser, post } = loaderData;
  const homeUrl = currentUser ? "/home" : "/";

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

      <main className="max-w-2xl mx-auto px-4 py-6 lg:px-8">
        <div className="card bg-base-100 shadow">
          <PostCard post={post} />
        </div>
      </main>
    </div>
  );
}
