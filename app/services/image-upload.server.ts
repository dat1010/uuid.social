import { imageTypes, maxImageBytes, maxImagePixels } from "./media";
import { getMediaLimits, reserveImage } from "./media.server";

export class ImageUploadError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function readImageBody(request: Request) {
  if (!request.body) throw new ImageUploadError("Choose an image to upload.", 400);
  if (Number(request.headers.get("Content-Length")) > maxImageBytes) {
    throw new ImageUploadError("Images must be 10 MB or smaller.", 413);
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxImageBytes) {
        await reader.cancel();
        throw new ImageUploadError("Images must be 10 MB or smaller.", 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

export function detectImageType(bytes: Uint8Array) {
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, i) => bytes[i] === value)) return "image/png";
  const tag = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (bytes.length >= 12 && tag(0, 4) === "RIFF" && tag(8, 12) === "WEBP") return "image/webp";
  return null;
}

export async function uploadImage(request: Request, env: Env, userId: string) {
  const contentType = request.headers.get("Content-Type")?.split(";")[0].toLowerCase() ?? "";
  if (!imageTypes.includes(contentType)) throw new ImageUploadError("Use a JPEG, PNG, or WebP image.", 415);
  const reservation = await reserveImage(env.DB, userId, getMediaLimits(env));
  if (!reservation) throw new ImageUploadError("The image upload limit has been reached. Remove unused uploads or try again tomorrow.", 429);
  try {
    const bytes = await readImageBody(request);
    if (detectImageType(bytes) !== contentType) throw new ImageUploadError("This file is not a valid JPEG, PNG, or WebP image.", 415);
    const source = new Blob([bytes]);
    const info = await env.IMAGES.info(source.stream());
    if (!("width" in info) || info.width < 1 || info.height < 1 || info.width * info.height > maxImagePixels) {
      throw new ImageUploadError("Images must contain at most 50 million pixels.", 422);
    }
    // Encode once; WebP output removes EXIF/XMP while applying source orientation.
    const variants = [];
    for (const [key, edge] of [[reservation.feedKey, 800], [reservation.fullKey, 2048]] as const) {
      const output = await env.IMAGES.input(source.stream())
        .transform({ width: edge, height: edge, fit: "scale-down" })
        .output({ format: "image/webp", quality: 82, anim: false });
      const image = await output.response().arrayBuffer();
      if (image.byteLength > maxImageBytes) throw new ImageUploadError("This image could not be reduced enough. Try a smaller image.", 422);
      const dimensions = await env.IMAGES.info(new Blob([image]).stream());
      if (!("width" in dimensions)) throw new ImageUploadError("This image could not be processed.", 422);
      await env.MEDIA.put(key, image, { httpMetadata: { contentType: "image/webp" } });
      variants.push({ width: dimensions.width, height: dimensions.height, size: image.byteLength });
    }
    const full = variants[1];
    const result = await env.DB.prepare(`UPDATE record_attachments SET status = 'ready', width = ?, height = ?, byte_size = ?
      WHERE id = ? AND status = 'uploading' AND expires_at > ?`)
      .bind(full.width, full.height, variants.reduce((sum, variant) => sum + variant.size, 0), reservation.id, Date.now()).run();
    if (result.meta.changes !== 1) throw new ImageUploadError("This upload expired or was removed. Please upload it again.", 409);
    return { id: reservation.id, width: full.width, height: full.height, alt: "" };
  } catch (error) {
    // Also requeue a cancelled upload if a late R2 write followed cleanup.
    await env.DB.prepare("UPDATE record_attachments SET status = 'deleting' WHERE id = ? AND record_id IS NULL")
      .bind(reservation.id).run();
    try {
      await env.MEDIA.delete([reservation.feedKey, reservation.fullKey]);
      await env.DB.prepare("UPDATE record_attachments SET status = 'deleted' WHERE id = ? AND status = 'deleting'")
        .bind(reservation.id).run();
    } catch { /* The scheduled cleanup retries incomplete deletes. */ }
    if (error instanceof ImageUploadError) throw error;
    console.error("Image processing failed", reservation.id);
    throw new ImageUploadError("Image processing is unavailable or the file could not be decoded. Please try again with a JPEG, PNG, or WebP image.", 503);
  }
}
