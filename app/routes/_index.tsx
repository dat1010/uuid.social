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
      <header className="navbar bg-base-100 shadow-sm px-3 py-2 flex-wrap sm:flex-nowrap sm:px-6 sm:py-0">
        <div className="navbar-start w-full sm:w-1/2">
          <span className="font-bold tracking-widest uppercase text-sm">
            uuid.social
          </span>
        </div>
        <nav
          aria-label="Main navigation"
          className="navbar-end w-full gap-1 sm:w-1/2 sm:gap-2"
        >
          <a
            aria-label="View uuid.social on GitHub"
            className="btn btn-ghost btn-sm btn-square"
            href="https://github.com/dat1010/uuid.social"
            rel="noreferrer"
            target="_blank"
          >
            <svg
              aria-hidden="true"
              className="size-5"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 .7a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2.23c-3.22.7-3.9-1.37-3.9-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.71.08-.71 1.17.08 1.78 1.2 1.78 1.2 1.04 1.77 2.72 1.26 3.38.96.1-.75.4-1.26.74-1.55-2.57-.3-5.27-1.29-5.27-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.16 1.18a10.98 10.98 0 0 1 5.76 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.59.23 2.77.11 3.06.74.81 1.19 1.84 1.19 3.1 0 4.42-2.71 5.39-5.29 5.68.42.36.79 1.06.79 2.14v3.27c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .7Z" />
            </svg>
          </a>
          <a href="/bounties" className="btn btn-ghost btn-sm">
            Bounties
          </a>
          <a href="/login" className="btn btn-ghost btn-sm">
            Sign in
          </a>
          <a href="/signup" className="btn btn-primary btn-sm">
            Sign up
          </a>
        </nav>
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

          <p className="mt-12 font-semibold">
            We don&apos;t want your personal data. We want UUIDs.
          </p>
          <p className="mt-3 text-sm text-base-content/40 max-w-md mx-auto leading-relaxed">
            Your UUID is your only login key. We store it as a hash and never
            show it again. Lose it and you start over.
          </p>
        </div>
      </main>
    </div>
  );
}
