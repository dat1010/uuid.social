import { useState } from "react";

import type { Route } from "./+types/signup";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Sign up | uuid.social" }];
}

export default function Signup() {
  const [generatedUuid, setGeneratedUuid] = useState("");
  const [copyLabel, setCopyLabel] = useState("Copy UUID");
  const [savedUuid, setSavedUuid] = useState(false);

  async function copyUuid() {
    if (!generatedUuid) return;

    await navigator.clipboard.writeText(generatedUuid);
    setCopyLabel("Copied");
    window.setTimeout(() => setCopyLabel("Copy UUID"), 1500);
  }

  function generateUuid() {
    setGeneratedUuid(crypto.randomUUID());
    setSavedUuid(false);
    setCopyLabel("Copy UUID");
  }

  return (
    <main className="grid min-h-screen place-items-center px-5 py-5">
      <section className="w-full max-w-2xl border-2 border-[#141414] bg-[#e9f7f1] p-5 shadow-[8px_8px_0_#e34b2f] md:p-8">
        <a className="text-sm font-bold uppercase tracking-[0.18em]" href="/">
          uuid.social
        </a>
        <div className="my-8">
          <h1 className="font-serif text-6xl">Create account</h1>
          <p className="mt-3 text-sm leading-6">
            Pick a unique public username. Then generate your private UUID and
            save it before entering the timeline.
          </p>
        </div>

        <form action="/home" className="grid gap-3">
          <label className="grid gap-2 text-xs font-bold uppercase">
            Public username
            <input
              className="border-2 border-[#141414] bg-white px-4 py-3 text-sm font-normal normal-case outline-none"
              autoComplete="username"
              name="username"
              placeholder="choose-a-name"
              type="text"
            />
          </label>
          <button
            className="border-2 border-[#141414] bg-[#ffd447] px-5 py-3 text-sm font-bold uppercase"
            onClick={generateUuid}
            type="button"
          >
            Generate UUID
          </button>

          {generatedUuid && (
            <div className="grid gap-3 border-2 border-[#141414] bg-white p-4">
              <label className="grid gap-2 text-xs font-bold uppercase">
                Save this UUID
                <input
                  className="border-2 border-[#141414] bg-[#fffdf6] px-4 py-3 text-sm font-normal normal-case outline-none"
                  autoComplete="new-password"
                  name="password"
                  readOnly
                  type="text"
                  value={generatedUuid}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <label className="flex items-center gap-3 text-xs font-bold uppercase leading-5">
                  <input
                    checked={savedUuid}
                    className="size-5 accent-[#141414]"
                    onChange={(event) => setSavedUuid(event.target.checked)}
                    type="checkbox"
                  />
                  I copied this UUID
                </label>
                <button
                  className="border-2 border-[#141414] bg-[#141414] px-4 py-2 text-sm font-bold uppercase text-white"
                  onClick={copyUuid}
                  type="button"
                >
                  {copyLabel}
                </button>
              </div>
            </div>
          )}

          <button
            className="border-2 border-[#141414] bg-[#141414] px-5 py-3 text-sm font-bold uppercase text-white disabled:cursor-not-allowed disabled:bg-[#8f8a81]"
            disabled={!generatedUuid || !savedUuid}
          >
            Continue to timeline
          </button>
        </form>

        <p className="mt-4 text-sm leading-6">
          This is the only time the app will show your UUID. Copy it into a
          password manager, notes app, or wherever you keep important keys.
        </p>
      </section>
    </main>
  );
}
