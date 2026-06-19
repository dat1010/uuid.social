import type { Route } from "./+types/_index";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "uuid.social" },
    {
      name: "description",
      content: "A tiny social network where your UUID is the only login key.",
    },
  ];
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-base-200 flex flex-col">
      <header className="navbar bg-base-100 shadow-sm px-6">
        <div className="navbar-start">
          <span className="font-bold tracking-widest uppercase text-sm">uuid.social</span>
        </div>
        <div className="navbar-end gap-2">
          <a href="/login" className="btn btn-ghost btn-sm">Sign in</a>
          <a href="/signup" className="btn btn-primary btn-sm">Sign up</a>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-2xl w-full text-center">
          <div className="badge badge-outline mb-6">experiment</div>
          <h1 className="text-5xl font-bold mb-6 leading-tight">
            Your account is one very unlikely number.
          </h1>
          <p className="text-base-content/70 text-lg leading-relaxed mb-12 max-w-xl mx-auto">
            A UUID is a 128-bit identifier. Version 4 UUIDs are random enough
            that guessing someone else&apos;s key is functionally hopeless —
            there are about 340 undecillion possible values.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="/signup" className="btn btn-primary btn-lg">
              Create account
            </a>
            <a href="/login" className="btn btn-outline btn-lg">
              Sign in
            </a>
          </div>

          <p className="mt-12 text-sm text-base-content/40 max-w-md mx-auto leading-relaxed">
            Your UUID is your only login key. We store it as a hash and never
            show it again. Lose it and you start over.
          </p>
        </div>
      </main>
    </div>
  );
}
