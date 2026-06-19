import type { Route } from "./+types/login";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Sign in | uuid.social" }];
}

export default function Login() {
  function enterTimeline(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    window.location.assign("/home");
  }

  return (
    <main className="grid min-h-screen place-items-center px-5 py-5">
      <section className="w-full max-w-xl border-2 border-[#141414] bg-[#fffdf6] p-5 shadow-[8px_8px_0_#141414] md:p-8">
        <a className="text-sm font-bold uppercase tracking-[0.18em]" href="/">
          uuid.social
        </a>
        <div className="my-8">
          <h1 className="font-serif text-6xl">Sign in</h1>
          <p className="mt-3 text-sm leading-6">
            Paste the UUID you saved when you created your account.
          </p>
        </div>

        <form className="grid gap-3" onSubmit={enterTimeline}>
          <label className="grid gap-2 text-xs font-bold uppercase">
            Your UUID
            <input
              className="border-2 border-[#141414] bg-white px-4 py-3 text-sm font-normal normal-case outline-none"
              autoComplete="current-password"
              name="password"
              placeholder="00000000-0000-0000-0000-000000000000"
              type="password"
            />
          </label>
          <button className="border-2 border-[#141414] bg-[#141414] px-5 py-3 text-sm font-bold uppercase text-white">
            Enter timeline
          </button>
        </form>
      </section>
    </main>
  );
}
