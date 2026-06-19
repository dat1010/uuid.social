import { useEffect, useState } from "react";
import { data, Form, useNavigation } from "react-router";
import { ThemeToggle } from "../components/ThemeToggle";

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
  const [copyLabel, setCopyLabel] = useState("Copy");
  const [savedUuid, setSavedUuid] = useState(false);

  useEffect(() => {
    setSavedUuid(false);
    setCopyLabel("Copy");
  }, [generatedUuid]);

  async function copyUuid() {
    if (!generatedUuid) return;
    await navigator.clipboard.writeText(generatedUuid);
    setCopyLabel("Copied!");
    window.setTimeout(() => setCopyLabel("Copy"), 1500);
  }

  return (
    <div className="min-h-screen bg-base-200 flex flex-col">
      <header className="navbar bg-base-100 shadow-sm px-6">
        <div className="navbar-start">
          <a href="/" className="font-bold tracking-widest uppercase text-sm">
            uuid.social
          </a>
        </div>
        <div className="navbar-end">
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="card bg-base-100 shadow-lg w-full max-w-md">
          <div className="card-body gap-6">
            <div>
              <h1 className="card-title text-2xl">Create account</h1>
              <p className="text-base-content/60 text-sm mt-1">
                Pick a username. We&apos;ll generate a private UUID — shown exactly once.
              </p>
            </div>

            {!generatedUuid ? (
              <Form className="flex flex-col gap-4" method="post">
                <fieldset className="fieldset">
                  <legend className="fieldset-legend">Username</legend>
                  <input
                    className="input input-bordered w-full"
                    autoComplete="username"
                    defaultValue={actionData?.username}
                    name="username"
                    pattern="[a-z0-9_-]{3,24}"
                    placeholder="choose-a-name"
                    required
                    type="text"
                  />
                  <p className="fieldset-label">3–24 chars, lowercase, numbers, - and _</p>
                </fieldset>

                {actionData?.error && (
                  <div role="alert" className="alert alert-error text-sm py-3">
                    <span>{actionData.error}</span>
                  </div>
                )}

                <button
                  className="btn btn-primary w-full"
                  disabled={navigation.state !== "idle"}
                >
                  {navigation.state === "submitting"
                    ? "Creating..."
                    : "Create account"}
                </button>
              </Form>
            ) : (
              <div className="flex flex-col gap-4">
                <input
                  autoComplete="username"
                  className="sr-only"
                  name="username"
                  readOnly
                  type="text"
                  value={actionData?.username ?? ""}
                />

                <div role="alert" className="alert alert-warning text-sm py-3">
                  <span>Save this UUID now — you will not see it again.</span>
                </div>

                <fieldset className="fieldset">
                  <legend className="fieldset-legend">Your UUID</legend>
                  <div className="join w-full">
                    <input
                      className="input input-bordered join-item w-full font-mono text-sm"
                      autoComplete="new-password"
                      name="password"
                      readOnly
                      type="text"
                      value={generatedUuid}
                    />
                    <button
                      className="btn btn-neutral join-item"
                      onClick={copyUuid}
                      type="button"
                    >
                      {copyLabel}
                    </button>
                  </div>
                </fieldset>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    checked={savedUuid}
                    className="checkbox checkbox-primary"
                    onChange={(e) => setSavedUuid(e.target.checked)}
                    type="checkbox"
                  />
                  <span className="text-sm">I have saved my UUID somewhere safe</span>
                </label>

                <button
                  className="btn btn-primary w-full"
                  disabled={!savedUuid}
                  onClick={() => window.location.replace("/home")}
                  type="button"
                >
                  Continue to timeline
                </button>
              </div>
            )}

            <p className="text-xs text-base-content/40 leading-relaxed">
              The UUID is stored only as a keyed hash. We cannot recover or show
              it again after you leave this page.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Error && error.message.includes("UNIQUE constraint");
}
