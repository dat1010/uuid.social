import { eq } from "drizzle-orm";

import type { Route } from "./+types/avatar";
import { createDb } from "../db/client.server";
import { users } from "../db/schema";
import { normalizeUsername } from "../services/auth.server";
import { getCloudflareEnv } from "../services/cloudflare.server";

export async function loader({ context, params }: Route.LoaderArgs) {
  const env = getCloudflareEnv(context);
  const db = createDb(env.DB);
  const [user] = await db
    .select({ avatarKey: users.avatarKey })
    .from(users)
    .where(eq(users.username, normalizeUsername(params.username ?? "")))
    .limit(1);

  if (!user?.avatarKey) throw new Response("Not Found", { status: 404 });

  const image = await env.AVATARS.get(user.avatarKey);
  if (!image) throw new Response("Not Found", { status: 404 });

  const headers = new Headers();
  image.writeHttpMetadata(headers);
  headers.set("Cache-Control", "public, max-age=3600");
  headers.set("ETag", image.httpEtag);
  return new Response(image.body, { headers });
}
