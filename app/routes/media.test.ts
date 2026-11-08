import { afterEach, describe, expect, it, vi } from "vitest";
import { addUser, createTestDatabase } from "../test/database";
import { reserveImage } from "../services/media.server";
import { publishRecord } from "../services/publish-record.server";
import { loader } from "./media";

const { viewer } = vi.hoisted(() => ({ viewer: { admin: false } }));
vi.mock("../services/auth.server", async (importOriginal) => ({
  ...await importOriginal<typeof import("../services/auth.server")>(),
  getCurrentUser: async () => viewer.admin ? { isAdmin: true } : null,
}));
const databases: ReturnType<typeof createTestDatabase>[] = [];
afterEach(() => { for (const { sqlite } of databases.splice(0)) sqlite.close(); viewer.admin = false; });
async function setup() {
  const test = createTestDatabase();
  databases.push(test);
  addUser(test.sqlite, "alice");
  const image = (await reserveImage(test.db, "alice", { perUser: 20, pending: 8, global: 500 }))!;
  await test.db.prepare("UPDATE record_attachments SET status = 'ready', width = 20, height = 10 WHERE id = ?").bind(image.id).run();
  const get = vi.fn(async () => ({ body: new Blob(["image"]).stream(), httpEtag: '"image-etag"' }));
  const context = { cloudflare: { env: { DB: test.db, MEDIA: { get } } } };
  const read = (etag?: string) => loader({
    request: new Request(`https://uuid.test/media/${image.id}/feed`, { headers: etag ? { "If-None-Match": etag } : {} }),
    params: { uuid: image.id, variant: "feed" }, context,
  } as never);
  const publish = () => publishRecord(test.db, { userId: "alice", body: "", attachments: [{ id: image.id, alt: "" }] });
  return { ...test, image, get, read, publish };
}

describe("media visibility", () => {
  it("never exposes unfinished or unattached uploads", async () => {
    const { read, get } = await setup();
    expect((await read()).status).toBe(404);
    expect(get).not.toHaveBeenCalled();
  });

  it("revalidates public media and honors ETags only after checking visibility", async () => {
    const { read, publish, sqlite } = await setup();
    const record = await publish();
    const response = await read();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("must-revalidate");
    expect(response.headers.get("Content-Type")).toBe("image/webp");
    expect((await read('"image-etag"')).status).toBe(304);
    sqlite.prepare("UPDATE records SET deleted_at = 1, deletion_origin = 'author' WHERE id = ?").run(record.id!);
    expect((await read('"image-etag"')).status).toBe(404);
  });

  it("allows only admins to review quarantined images and restores public access on release", async () => {
    const { read, publish, sqlite } = await setup();
    const record = await publish();
    sqlite.prepare("UPDATE records SET deleted_at = 1, deletion_origin = 'admin' WHERE id = ?").run(record.id!);
    expect((await read()).status).toBe(404);
    viewer.admin = true;
    expect((await read()).status).toBe(200);
    viewer.admin = false;
    sqlite.prepare("UPDATE records SET deleted_at = NULL, deletion_origin = NULL WHERE id = ?").run(record.id!);
    expect((await read()).status).toBe(200);
  });
});
