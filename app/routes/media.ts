import type { Route } from "./+types/media";
import { getCurrentUser, validateUuid } from "../services/auth.server";
import { getCloudflareEnv } from "../services/cloudflare.server";

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const notFound = () => new Response("Not Found", { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!validateUuid(params.uuid) || !["feed", "full"].includes(params.variant)) return notFound();
  const env = getCloudflareEnv(context);
  const row = await env.DB.prepare(`SELECT a.feed_key, a.full_key, a.status, r.deleted_at, r.deletion_origin,
      u.suspended_at FROM record_attachments a JOIN records r ON r.id = a.record_id
      JOIN users u ON u.id = r.user_id WHERE a.id = ? AND a.status = 'attached'`)
    .bind(params.uuid).first<{ feed_key: string; full_key: string; deleted_at: number | null; deletion_origin: string | null; suspended_at: number | null }>();
  if (!row) return notFound();
  if (row.deleted_at !== null || row.suspended_at !== null) {
    const user = await getCurrentUser(request, context);
    if (!user?.isAdmin || row.deletion_origin === "author") return notFound();
  }
  const image = await env.MEDIA.get(params.variant === "feed" ? row.feed_key : row.full_key);
  if (!image) return notFound();
  // Always check record visibility before serving bytes, even for a conditional request.
  const headers = new Headers({
    "Content-Type": "image/webp",
    "Cache-Control": "private, no-cache, must-revalidate",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": "inline",
    "ETag": image.httpEtag,
    "Vary": "Cookie",
  });
  if (request.headers.get("If-None-Match") === image.httpEtag) return new Response(null, { status: 304, headers });
  return new Response(image.body, { headers });
}
