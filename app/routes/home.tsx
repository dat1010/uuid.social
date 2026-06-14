import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Timeline | uuid.social" },
    {
      name: "description",
      content: "The uuid.social timeline.",
    },
  ];
}

export function loader() {
  return {
    posts: [
      {
        id: "post_001",
        username: "lost-key-club",
        displayName: "Lost Key Club",
        body: "No password. No reset. Save the UUID or become folklore.",
        createdAt: "2m",
      },
      {
        id: "post_002",
        username: "new-instance",
        displayName: "New Instance",
        body: "I misplaced my previous identity but honestly this one has better posture.",
        createdAt: "9m",
      },
      {
        id: "post_003",
        username: "timeline-test",
        displayName: "Timeline Test",
        body: "The global feed is the first real room. Follows, replies, and tiny rituals can arrive after the door opens.",
        createdAt: "18m",
      },
    ],
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
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
            Y
          </div>
          <h1 className="font-serif text-4xl">You</h1>
          <p className="mt-1 text-xs font-bold uppercase">@your-name</p>
          <p className="mt-4 text-sm leading-6">
            Logged in with a UUID. The key is hidden; the profile is public.
          </p>
        </aside>

        <section className="border-2 border-[#141414] bg-[#fffdf6]">
          <div className="border-b-2 border-[#141414] p-4">
            <h2 className="font-serif text-5xl">Timeline</h2>
            <p className="mt-1 text-xs font-bold uppercase">global feed</p>
          </div>

          <form className="grid gap-3 border-b-2 border-[#141414] bg-white p-4">
            <textarea
              className="min-h-28 resize-none border-2 border-[#141414] bg-white p-4 text-sm outline-none"
              maxLength={500}
              placeholder="What is happening in this UUID lifetime?"
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold uppercase">500 chars</span>
              <button className="border-2 border-[#141414] bg-[#e34b2f] px-5 py-3 text-sm font-bold uppercase text-white">
                Post
              </button>
            </div>
          </form>

          <div>
            {loaderData.posts.map((post) => (
              <article className="border-b-2 border-[#141414] bg-white p-4" key={post.id}>
                <div className="mb-3 flex items-center gap-3">
                  <div className="grid size-11 place-items-center border-2 border-[#141414] bg-[#ffd447] font-bold">
                    {post.displayName.slice(0, 1)}
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
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
