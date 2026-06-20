import { data, Form, redirect, useNavigation } from "react-router";
import { ThemeToggle } from "../components/ThemeToggle";

import type { Route } from "./+types/login";
import { createDb } from "../db/client.server";
import { users } from "../db/schema";
import {
  createUserSession,
  hashCredential,
  validateUuid,
} from "../services/auth.server";
import { getCloudflareEnv } from "../services/cloudflare.server";
import { and, eq, isNull } from "drizzle-orm";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Sign in | uuid.social" }];
}

export function headers() {
  return { "Cache-Control": "no-store" };
}

export async function action({ request, context }: Route.ActionArgs) {
  const formData = await request.formData();
  const uuid = String(formData.get("password") ?? "").trim();

  if (!validateUuid(uuid)) {
    return data({ error: "Could not sign in with that UUID." }, { status: 400 });
  }

  const env = getCloudflareEnv(context);
  const db = createDb(env.DB);
  const uuidHash = await hashCredential(uuid, env.AUTH_PEPPER);
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(
      eq(users.uuidHash, uuidHash),
      isNull(users.suspendedAt),
      isNull(users.deletedAt),
    ))
    .limit(1);

  if (!user) {
    return data({ error: "Could not sign in with that UUID." }, { status: 401 });
  }

  const cookie = await createUserSession(user.id, request, context);
  return redirect("/home", { headers: { "Set-Cookie": cookie } });
}

export default function Login({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const isPending = navigation.state !== "idle";

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
              <h1 className="card-title text-2xl">Sign in</h1>
              <p className="text-base-content/60 text-sm mt-1">
                Paste the UUID you saved when you created your account.
              </p>
            </div>

            <Form className="flex flex-col gap-4" method="post">
              <fieldset className="fieldset">
                <legend className="fieldset-legend">Your UUID</legend>
                <input
                  className="input input-bordered w-full font-mono"
                  autoComplete="current-password"
                  name="password"
                  placeholder="00000000-0000-0000-0000-000000000000"
                  required
                  type="password"
                />
              </fieldset>

              {actionData?.error && (
                <div role="alert" className="alert alert-error text-sm py-3">
                  <span>{actionData.error}</span>
                </div>
              )}

              <button
                className="btn btn-primary w-full"
                disabled={isPending}
              >
                {isPending ? "Signing in..." : "Enter timeline"}
              </button>
            </Form>

            <div className="divider text-xs text-base-content/40 my-0">
              no account?
            </div>

            <a href="/signup" className="btn btn-outline w-full">
              Create one
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
