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
    <main className="min-h-screen px-5 py-5 md:px-8">
      <section className="mx-auto grid min-h-[calc(100vh-2.5rem)] max-w-6xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="flex flex-col justify-between border-2 border-[#141414] bg-[#f4f0e8] p-5 shadow-[8px_8px_0_#141414] md:p-8">
          <header className="flex items-center justify-between gap-4">
            <a className="text-sm font-bold uppercase tracking-[0.18em]" href="/">
              uuid.social
            </a>
            <span className="border border-[#141414] px-2 py-1 text-xs font-semibold uppercase">
              auto deploy check
            </span>
          </header>

          <div className="py-12 md:py-20">
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.22em]">
              login with one UUID
            </p>
            <h1 className="font-serif text-6xl leading-[0.9] md:text-8xl">
              Your account is one very unlikely number.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 md:text-lg">
              A UUID is a 128-bit identifier. Version 4 UUIDs are random enough
              that guessing someone else&apos;s key is functionally hopeless:
              there are about 340 undecillion possible values.
            </p>
          </div>

          <p className="max-w-lg text-sm leading-6">
            uuid.social uses that UUID as your only login key. We do not show it
            in the app after signup. If you lose it, there is no reset; you make
            a new account.
          </p>
        </div>

        <div className="grid content-center gap-5">
          <section className="border-2 border-[#141414] bg-[#fffdf6] p-5 shadow-[6px_6px_0_#141414]">
            <h2 className="font-serif text-4xl">Start</h2>
            <p className="mt-3 text-sm leading-6">
              Create a public username and receive your private UUID. Save it
              somewhere you trust.
            </p>
            <a
              className="mt-5 block border-2 border-[#141414] bg-[#ffd447] px-5 py-3 text-center text-sm font-bold uppercase"
              href="/signup"
            >
              Sign up
            </a>
          </section>

          <section className="border-2 border-[#141414] bg-[#e9f7f1] p-5 shadow-[6px_6px_0_#e34b2f]">
            <h2 className="font-serif text-4xl">Return</h2>
            <p className="mt-3 text-sm leading-6">
              Already have your UUID? Paste it in and go straight to the
              timeline.
            </p>
            <a
              className="mt-5 block border-2 border-[#141414] bg-[#141414] px-5 py-3 text-center text-sm font-bold uppercase text-white"
              href="/login"
            >
              Sign in
            </a>
          </section>
        </div>
      </section>
    </main>
  );
}
