import { data, Form, redirect, useNavigation } from "react-router";

import type { Route } from "./+types/login";
import { createDb } from "../db/client.server";
import { users } from "../db/schema";
import {
  createUserSession,
  hashCredential,
  validateUuid,
} from "../services/auth.server";
import { getCloudflareEnv } from "../services/cloudflare.server";
import { eq } from "drizzle-orm";

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
    .where(eq(users.uuidHash, uuidHash))
    .limit(1);

  if (!user) {
    return data({ error: "Could not sign in with that UUID." }, { status: 401 });
  }

  const cookie = await createUserSession(user.id, request, context);
  return redirect("/home", { headers: { "Set-Cookie": cookie } });
}

export default function Login({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation();

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

        <Form className="grid gap-3" method="post">
          <label className="grid gap-2 text-xs font-bold uppercase">
            Your UUID
            <input
              className="border-2 border-[#141414] bg-white px-4 py-3 text-sm font-normal normal-case outline-none"
              autoComplete="current-password"
              name="password"
              placeholder="00000000-0000-0000-0000-000000000000"
              required
              type="password"
            />
          </label>
          {actionData?.error && (
            <p className="border-2 border-[#141414] bg-[#e9f7f1] p-3 text-sm">
              {actionData.error}
            </p>
          )}
          <button
            className="border-2 border-[#141414] bg-[#141414] px-5 py-3 text-sm font-bold uppercase text-white disabled:cursor-wait disabled:bg-[#8f8a81]"
            disabled={navigation.state !== "idle"}
          >
            {navigation.state === "submitting" ? "Signing in..." : "Enter timeline"}
          </button>
        </Form>
      </section>
    </main>
  );
}
