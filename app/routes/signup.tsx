import { useEffect, useState } from "react";
import { data, Form, useNavigation } from "react-router";

import type { Route } from "./+types/signup";
import { createDb } from "../db/client.server";
import { users } from "../db/schema";
import {
  createUserSession,
  hashCredential,
  normalizeUsername,
  validateUsername,
} from "../services/auth.server";
import { getCloudflareEnv } from "../services/cloudflare.server";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Sign up | uuid.social" }];
}

export function headers() {
  return { "Cache-Control": "no-store" };
}

export async function action({ request, context }: Route.ActionArgs) {
  const formData = await request.formData();
  const username = normalizeUsername(String(formData.get("username") ?? ""));
  const usernameError = validateUsername(username);

  if (usernameError) {
    return data({ error: usernameError, uuid: null, username }, { status: 400 });
  }

  const env = getCloudflareEnv(context);
  const db = createDb(env.DB);
  const uuid = crypto.randomUUID();
  const uuidHash = await hashCredential(uuid, env.AUTH_PEPPER);
  const userId = crypto.randomUUID();
  const now = new Date();

  try {
    await db.insert(users).values({
      id: userId,
      uuidHash,
      username,
      displayName: username,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return data(
        { error: "That username is already taken.", uuid: null, username },
        { status: 409 },
      );
    }
    throw error;
  }

  const cookie = await createUserSession(userId, request, context);

  return data(
    { error: null, uuid, username },
    { headers: { "Set-Cookie": cookie } },
  );
}

export default function Signup({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const generatedUuid = actionData?.uuid ?? "";
  const [copyLabel, setCopyLabel] = useState("Copy UUID");
  const [savedUuid, setSavedUuid] = useState(false);

  useEffect(() => {
    setSavedUuid(false);
    setCopyLabel("Copy UUID");
  }, [generatedUuid]);

  async function copyUuid() {
    if (!generatedUuid) return;

    await navigator.clipboard.writeText(generatedUuid);
    setCopyLabel("Copied");
    window.setTimeout(() => setCopyLabel("Copy UUID"), 1500);
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
            Pick a unique public username. We will create your private UUID and
            show it exactly once.
          </p>
        </div>

        {!generatedUuid ? (
          <Form className="grid gap-3" method="post">
            <label className="grid gap-2 text-xs font-bold uppercase">
              Public username
              <input
                className="border-2 border-[#141414] bg-white px-4 py-3 text-sm font-normal normal-case outline-none"
                autoComplete="username"
                defaultValue={actionData?.username}
                name="username"
                pattern="[a-z0-9_-]{3,24}"
                placeholder="choose-a-name"
                required
                type="text"
              />
            </label>
            {actionData?.error && (
              <p className="border-2 border-[#141414] bg-white p-3 text-sm">
                {actionData.error}
              </p>
            )}
            <button
              className="border-2 border-[#141414] bg-[#ffd447] px-5 py-3 text-sm font-bold uppercase disabled:cursor-wait disabled:bg-[#8f8a81]"
              disabled={navigation.state !== "idle"}
            >
              {navigation.state === "submitting"
                ? "Creating account..."
                : "Create account and UUID"}
            </button>
          </Form>
        ) : (
          <div className="grid gap-3">
            <input
              autoComplete="username"
              className="sr-only"
              name="username"
              readOnly
              type="text"
              value={actionData?.username ?? ""}
            />
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
              <button
                className="border-2 border-[#141414] bg-[#141414] px-4 py-2 text-sm font-bold uppercase text-white"
                onClick={copyUuid}
                type="button"
              >
                {copyLabel}
              </button>
            </div>

            <label className="flex items-center gap-3 text-xs font-bold uppercase leading-5">
              <input
                checked={savedUuid}
                className="size-5 accent-[#141414]"
                onChange={(event) => setSavedUuid(event.target.checked)}
                type="checkbox"
              />
              I saved this UUID
            </label>
            <button
              className={`border-2 border-[#141414] px-5 py-3 text-center text-sm font-bold uppercase text-white ${
                savedUuid
                  ? "bg-[#141414]"
                  : "cursor-not-allowed bg-[#8f8a81]"
              }`}
              disabled={!savedUuid}
              onClick={() => window.location.replace("/home")}
              type="button"
            >
              Continue to timeline
            </button>
          </div>
        )}

        <p className="mt-4 text-sm leading-6">
          The UUID is stored only as a keyed hash. We cannot recover or show it
          again after you leave this page.
        </p>
      </section>
    </main>
  );
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Error && error.message.includes("UNIQUE constraint");
}
