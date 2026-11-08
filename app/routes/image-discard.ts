import type { Route } from "./+types/image-discard";
import { getCurrentUser, validateUuid } from "../services/auth.server";
import { getCloudflareEnv } from "../services/cloudflare.server";
import { discardImage } from "../services/media.server";

export async function action({ request, context, params }: Route.ActionArgs) {
  if (request.method !== "DELETE") return new Response(null, { status: 405 });
  if (request.headers.get("Origin") !== new URL(request.url).origin) return new Response(null, { status: 403 });
  const user = await getCurrentUser(request, context);
  if (!user) return new Response(null, { status: 401 });
  if (!validateUuid(params.uuid)) return new Response(null, { status: 400 });
  await discardImage(getCloudflareEnv(context).DB, params.uuid, user.id);
  return new Response(null, { status: 204 });
}
