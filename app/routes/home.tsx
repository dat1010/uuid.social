import { desc, eq, isNull } from "drizzle-orm";
import { data, Form, useNavigation } from "react-router";

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
    <main className="min-h-screen px-4 py-4 md:px-8">
      <header className="mx-auto mb-5 flex max-w-5xl items-center justify-between border-2 border-[#141414] bg-[#fffdf6] px-4 py-3 shadow-[5px_5px_0_#141414]">
        <a className="text-sm font-bold uppercase tracking-[0.18em]" href="/home">
          uuid.social
        </a>
        <nav className="flex items-center gap-3 text-xs font-bold uppercase">
          <a href="/home">Timeline</a>
          <Form action="/logout" method="post">
            <button type="submit">Logout</button>
          </Form>
        </nav>
      </header>

      <section className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[220px_1fr]">
        <aside className="h-max border-2 border-[#141414] bg-[#e9f7f1] p-4">
          <div className="mb-4 grid size-16 place-items-center border-2 border-[#141414] bg-[#ffd447] text-2xl font-bold">
            {currentUser.displayName.slice(0, 1).toUpperCase()}
          </div>
          <h1 className="font-serif text-4xl">{currentUser.displayName}</h1>
          <p className="mt-1 text-xs font-bold uppercase">
            @{currentUser.username}
          </p>
        </aside>

        <section className="border-2 border-[#141414] bg-[#fffdf6]">
          <div className="border-b-2 border-[#141414] p-4">
            <h2 className="font-serif text-5xl">Timeline</h2>
            <p className="mt-1 text-xs font-bold uppercase">global feed</p>
          </div>

          <Form
            className="grid gap-3 border-b-2 border-[#141414] bg-white p-4"
            method="post"
          >
            <textarea
              className="min-h-28 resize-none border-2 border-[#141414] bg-white p-4 text-sm outline-none"
              maxLength={500}
              name="body"
              placeholder="What is happening in this UUID lifetime?"
              required
            />
            {actionData?.error && (
              <p className="text-sm">{actionData.error}</p>
            )}
            <button
              className="justify-self-end border-2 border-[#141414] bg-[#e34b2f] px-5 py-3 text-sm font-bold uppercase text-white disabled:cursor-wait disabled:bg-[#8f8a81]"
              disabled={isPosting}
            >
              {isPosting ? "Posting..." : "Post"}
            </button>
          </Form>

          <div>
            {posts.length === 0 ? (
              <div className="bg-white p-8 text-center">
                <h3 className="font-serif text-4xl">No posts yet</h3>
                <p className="mx-auto mt-3 max-w-md text-sm leading-6">
                  Write the first post on uuid.social.
                </p>
              </div>
            ) : (
              posts.map((post) => (
                <article
                  className="border-b-2 border-[#141414] bg-white p-4"
                  key={post.id}
                >
                  <div className="mb-3 flex items-center gap-3">
                    <div className="grid size-11 place-items-center border-2 border-[#141414] bg-[#ffd447] font-bold">
                      {post.displayName.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold">{post.displayName}</h3>
                      <p className="text-xs uppercase">
                        @{post.username} · {formatPostDate(post.createdAt)}
                      </p>
                    </div>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-6">
                    {post.body}
                  </p>
                </article>
              ))
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

function formatPostDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
