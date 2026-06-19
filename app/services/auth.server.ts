import { and, eq, gt, isNull } from "drizzle-orm";
import { createCookie, redirect } from "react-router";

import { createDb } from "../db/client.server";
import { sessions, users } from "../db/schema";
import { getCloudflareEnv } from "./cloudflare.server";

const sessionLifetimeSeconds = 60 * 60 * 24 * 30;
const sessionCookie = createCookie("uuid_social_session", {
  httpOnly: true,
  maxAge: sessionLifetimeSeconds,
  path: "/",
  sameSite: "lax",
});

export type CurrentUser = {
  id: string;
  username: string;
  displayName: string;
};

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function validateUsername(username: string) {
  if (!/^[a-z0-9_-]{3,24}$/.test(username)) {
    return "Use 3-24 lowercase letters, numbers, underscores, or hyphens.";
  }

  return null;
}

export function validateUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function hashCredential(uuid: string, pepper: string) {
  if (!pepper) {
    throw new Error("AUTH_PEPPER is not configured");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pepper),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(uuid),
  );

  return toHex(signature);
}

export async function createUserSession(
  userId: string,
  request: Request,
  context: unknown,
) {
  const env = getCloudflareEnv(context);
  const db = createDb(env.DB);
  const token = createSessionToken();
  const tokenHash = await hashSessionToken(token);
  const now = new Date();

  await db.insert(sessions).values({
    id: crypto.randomUUID(),
    userId,
    tokenHash,
    createdAt: now,
    expiresAt: new Date(now.getTime() + sessionLifetimeSeconds * 1000),
  });

  return sessionCookie.serialize(token, {
    secure: new URL(request.url).protocol === "https:",
  });
}

export async function getCurrentUser(request: Request, context: unknown) {
  const token = await sessionCookie.parse(request.headers.get("Cookie"));
  if (typeof token !== "string" || !token) return null;

  const env = getCloudflareEnv(context);
  const db = createDb(env.DB);
  const tokenHash = await hashSessionToken(token);
  const [result] = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.tokenHash, tokenHash),
        gt(sessions.expiresAt, new Date()),
        isNull(users.suspendedAt),
      ),
    )
    .limit(1);

  if (!result) return null;

  return {
    id: result.id,
    username: result.username,
    displayName: result.displayName || result.username,
  } satisfies CurrentUser;
}

export async function requireUser(request: Request, context: unknown) {
  const user = await getCurrentUser(request, context);
  if (!user) throw redirect("/login");
  return user;
}

export async function destroyUserSession(request: Request, context: unknown) {
  const token = await sessionCookie.parse(request.headers.get("Cookie"));

  if (typeof token === "string" && token) {
    const env = getCloudflareEnv(context);
    const db = createDb(env.DB);
    const tokenHash = await hashSessionToken(token);
    await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
  }

  return sessionCookie.serialize("", {
    expires: new Date(0),
    secure: new URL(request.url).protocol === "https:",
  });
}

function createSessionToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

async function hashSessionToken(token: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return toHex(digest);
}

function toHex(value: ArrayBuffer) {
  return [...new Uint8Array(value)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
