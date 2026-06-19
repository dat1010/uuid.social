import { useEffect, useState } from "react";

import type { Route } from "./+types/home";

type TimelinePost = {
  id: string;
  username: string;
  displayName: string;
  body: string;
  createdAt: string;
};

const timelineStorageKey = "uuid.social.timeline-posts";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Timeline | uuid.social" },
    {
      name: "description",
      content: "The uuid.social timeline.",
    },
  ];
}

export function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const username = cleanUsername(url.searchParams.get("username"));

  return {
    currentUser: {
      username: username || "uuid-user",
      displayName: username || "uuid user",
    },
    posts: [] satisfies TimelinePost[],
  };
}

function cleanUsername(value: string | null) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const [draft, setDraft] = useState("");
  const [posts, setPosts] = useState<TimelinePost[]>(loaderData.posts);
  const [hasLoadedStoredPosts, setHasLoadedStoredPosts] = useState(false);
  const { currentUser } = loaderData;
  const remainingCharacters = 500 - draft.length;

  useEffect(() => {
    const storedPosts = window.localStorage.getItem(timelineStorageKey);

    if (storedPosts) {
      try {
        setPosts(JSON.parse(storedPosts) as TimelinePost[]);
      } catch {
        window.localStorage.removeItem(timelineStorageKey);
      }
    }

    setHasLoadedStoredPosts(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedStoredPosts) return;

    window.localStorage.setItem(timelineStorageKey, JSON.stringify(posts));
  }, [hasLoadedStoredPosts, posts]);

  function createPost(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const body = draft.trim();
    if (!body) return;

    setPosts([
      {
        id: crypto.randomUUID(),
        username: currentUser.username,
        displayName: currentUser.displayName,
        body,
        createdAt: "now",
      },
      ...posts,
    ]);
    setDraft("");
  }

  return (
    <main className="min-h-screen px-4 py-4 md:px-8">
      <header className="mx-auto mb-5 flex max-w-5xl items-center justify-between border-2 border-[#141414] bg-[#fffdf6] px-4 py-3 shadow-[5px_5px_0_#141414]">
        <a className="text-sm font-bold uppercase tracking-[0.18em]" href="/home">
          uuid.social
        </a>
        <nav className="flex items-center gap-3 text-xs font-bold uppercase">
          <a href="/home">Timeline</a>
          <a href="/">Logout</a>
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
          <p className="mt-4 text-sm leading-6">
            Logged in with a UUID. The key is hidden; the profile is public.
          </p>
        </aside>

        <section className="border-2 border-[#141414] bg-[#fffdf6]">
          <div className="border-b-2 border-[#141414] p-4">
            <h2 className="font-serif text-5xl">Timeline</h2>
            <p className="mt-1 text-xs font-bold uppercase">global feed</p>
          </div>

          <form
            className="grid gap-3 border-b-2 border-[#141414] bg-white p-4"
            onSubmit={createPost}
          >
            <textarea
              className="min-h-28 resize-none border-2 border-[#141414] bg-white p-4 text-sm outline-none"
              maxLength={500}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="What is happening in this UUID lifetime?"
              value={draft}
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold uppercase">
                {remainingCharacters} chars
              </span>
              <button
                className="border-2 border-[#141414] bg-[#e34b2f] px-5 py-3 text-sm font-bold uppercase text-white disabled:cursor-not-allowed disabled:bg-[#8f8a81]"
                disabled={!draft.trim()}
              >
                Post
              </button>
            </div>
          </form>

          <div>
            {posts.length === 0 ? (
              <div className="bg-white p-8 text-center">
                <h3 className="font-serif text-4xl">No posts yet</h3>
                <p className="mx-auto mt-3 max-w-md text-sm leading-6">
                  Write the first post for this browser. The next backend step
                  is saving these to D1 so everyone sees the same timeline.
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
                        @{post.username} · {post.createdAt}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm leading-6">{post.body}</p>
                </article>
              ))
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
