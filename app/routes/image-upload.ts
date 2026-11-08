import { getCurrentUser } from "../services/auth.server";
import { getCloudflareEnv } from "../services/cloudflare.server";
import { ImageUploadError, uploadImage } from "../services/image-upload.server";
import type { Route } from "./+types/image-upload";

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") return Response.json({ error: "Method not allowed." }, { status: 405 });
  if (request.headers.get("Origin") !== new URL(request.url).origin) return Response.json({ error: "Upload from uuid.social." }, { status: 403 });
  const user = await getCurrentUser(request, context);
  if (!user) return Response.json({ error: "Sign in again to upload images." }, { status: 401 });
  try {
    return Response.json(await uploadImage(request, getCloudflareEnv(context), user.id), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ImageUploadError) return Response.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    throw error;
  }
}
