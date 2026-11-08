import { afterEach, describe, expect, it, vi } from "vitest";
import { addUser, createTestDatabase } from "../test/database";
import { maxImageBytes } from "./media";
import { detectImageType, readImageBody, uploadImage } from "./image-upload.server";

const databases: ReturnType<typeof createTestDatabase>[] = [];
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]);
const webp = new Uint8Array([82, 73, 70, 70, 4, 0, 0, 0, 87, 69, 66, 80]);
function setup() {
  const test = createTestDatabase();
  databases.push(test);
  addUser(test.sqlite, "alice");
  const put = vi.fn().mockResolvedValue({});
  const remove = vi.fn().mockResolvedValue(undefined);
  const info = vi.fn().mockResolvedValue({ format: "image/png", width: 200, height: 100 });
  const output = vi.fn().mockResolvedValue({ response: () => new Response(webp) });
  const input = () => ({ transform: () => ({ output }) });
  const env = { DB: test.db, MEDIA: { put, delete: remove }, IMAGES: { info, input },
    MEDIA_DAILY_USER_LIMIT: "20", MEDIA_PENDING_LIMIT: "8", MEDIA_DAILY_GLOBAL_LIMIT: "500" } as unknown as Env;
  return { ...test, env, put, remove, info, output };
}
function request(bytes = png, type = "image/png") {
  return new Request("https://uuid.test/api/images", { method: "POST", headers: { "Content-Type": type }, body: bytes });
}
afterEach(() => { for (const { sqlite } of databases.splice(0)) sqlite.close(); vi.restoreAllMocks(); });

describe("image uploads", () => {
  it("recognizes supported signatures and rejects SVG or misleading MIME types", async () => {
    const { env, put } = setup();
    expect(detectImageType(png)).toBe("image/png");
    expect(detectImageType(webp)).toBe("image/webp");
    expect(detectImageType(new Uint8Array([255, 216, 255]))).toBe("image/jpeg");
    await expect(uploadImage(request(new TextEncoder().encode("<svg />")), env, "alice")).rejects.toMatchObject({ status: 415 });
    expect(put).not.toHaveBeenCalled();
  });

  it("enforces byte limits on chunked bodies even without Content-Length", async () => {
    const stream = new ReadableStream({ start(controller) {
      controller.enqueue(new Uint8Array(maxImageBytes));
      controller.enqueue(new Uint8Array(1));
      controller.close();
    } });
    const incoming = new Request("https://uuid.test/api/images", { method: "POST", body: stream, duplex: "half" } as RequestInit);
    await expect(readImageBody(incoming)).rejects.toMatchObject({ status: 413 });
    const oversized = request();
    oversized.headers.set("Content-Length", String(maxImageBytes + 1));
    await expect(readImageBody(oversized)).rejects.toMatchObject({ status: 413 });
  });

  it("rejects excessive dimensions and decoding failures without storing images", async () => {
    const { env, info, put } = setup();
    info.mockResolvedValueOnce({ width: 10_000, height: 10_000 });
    await expect(uploadImage(request(), env, "alice")).rejects.toMatchObject({ status: 422 });
    vi.spyOn(console, "error").mockImplementation(() => {});
    info.mockRejectedValueOnce(new Error("Cannot decode"));
    await expect(uploadImage(request(), env, "alice")).rejects.toMatchObject({ status: 503 });
    expect(put).not.toHaveBeenCalled();
  });

  it("stores only processed variants and makes an attachment ready after both succeed", async () => {
    const { env, sqlite, put } = setup();
    const image = await uploadImage(request(), env, "alice");
    expect(put).toHaveBeenCalledTimes(2);
    expect(put.mock.calls.map(([key]) => key)).toEqual([`${image.id}/feed.webp`, `${image.id}/full.webp`]);
    expect(new Uint8Array(put.mock.calls[0][1])).toEqual(webp);
    expect(sqlite.prepare("SELECT status, record_id, byte_size FROM record_attachments WHERE id = ?").get(image.id))
      .toMatchObject({ status: "ready", record_id: null, byte_size: 24 });
  });

  it("cleans up partial writes and leaves failed deletes available for scheduled retry", async () => {
    const { env, sqlite, put, remove } = setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    put.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("Storage unavailable"));
    remove.mockRejectedValueOnce(new Error("Retry deletion"));
    await expect(uploadImage(request(), env, "alice")).rejects.toMatchObject({ status: 503 });
    expect(sqlite.prepare("SELECT status FROM record_attachments").get()?.status).toBe("deleting");
  });

  it("stops before decoding if the global budget is exhausted", async () => {
    const { env, info, put } = setup();
    const disabled = { ...env, MEDIA_DAILY_GLOBAL_LIMIT: "0" } as unknown as Env;
    await expect(uploadImage(request(), disabled, "alice")).rejects.toMatchObject({ status: 429 });
    expect(info).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });
});
