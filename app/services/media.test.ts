import { afterEach, describe, expect, it, vi } from "vitest";
import { addRecord, addUser, createTestDatabase } from "../test/database";
import { parseRecordInput } from "./media";
import { cleanupImages, discardImage, draftLifetime, getRecordImages, moderationRetention, reserveImage } from "./media.server";
import { publishRecord } from "./publish-record.server";

const databases: ReturnType<typeof createTestDatabase>[] = [];
function setup() {
  const test = createTestDatabase();
  databases.push(test);
  addUser(test.sqlite, "alice");
  addUser(test.sqlite, "bob");
  return test;
}
afterEach(() => { for (const { sqlite } of databases.splice(0)) sqlite.close(); vi.restoreAllMocks(); });
const limits = { perUser: 20, pending: 8, global: 500 };
async function ready(db: D1Database, user = "alice", now = Date.now()) {
  const image = (await reserveImage(db, user, limits, now))!;
  await db.prepare("UPDATE record_attachments SET status = 'ready', width = 200, height = 100, byte_size = 1000 WHERE id = ?").bind(image.id).run();
  return { id: image.id, alt: "A landscape" };
}

describe("image publishing", () => {
  it("accepts image-only records and atomically attaches images in the chosen order", async () => {
    const { db, sqlite } = setup();
    const first = await ready(db);
    const second = await ready(db);
    const result = await publishRecord(db, { userId: "alice", body: "", attachments: [second, first] });
    expect(result.id).toBeDefined();
    expect(sqlite.prepare("SELECT body FROM records WHERE id = ?").get(result.id!)?.body).toBe("");
    const images = await getRecordImages(db, [result.id!]);
    expect(images[result.id!].map(({ id }) => id)).toEqual([second.id, first.id]);
    expect(images[result.id!][0].alt).toBe("A landscape");
  });

  it("creates image replies with their existing graph connection", async () => {
    const { db, sqlite } = setup();
    const parentId = addRecord(sqlite, "bob", "Parent");
    const result = await publishRecord(db, { userId: "alice", body: "", attachments: [await ready(db)], parentId });
    expect(result.id).toBeDefined();
    expect(sqlite.prepare("SELECT target_id, relationship FROM connections WHERE source_id = ?").get(result.id!))
      .toMatchObject({ target_id: parentId, relationship: "REPLIES_TO" });
  });

  it("rejects stolen, expired, unfinished, repeated, and previously attached images without creating a record", async () => {
    const { db, sqlite } = setup();
    const own = await ready(db);
    const stolen = await ready(db, "bob");
    const expired = await ready(db, "alice", Date.now() - 2 * draftLifetime);
    const uploading = (await reserveImage(db, "alice", limits))!;
    const used = await ready(db);
    await publishRecord(db, { userId: "alice", body: "One", attachments: [used] });
    for (const attachments of [[stolen], [expired], [{ id: uploading.id, alt: "" }], [own, own], [used], [own, stolen]]) {
      expect((await publishRecord(db, { userId: "alice", body: "Invalid", attachments })).error).toBeDefined();
    }
    expect(sqlite.prepare("SELECT count(*) AS total FROM records").get()?.total).toBe(1);
    expect(sqlite.prepare("SELECT status FROM record_attachments WHERE id = ?").get(own.id)?.status).toBe("ready");
  });

  it("only lets one submission claim an attachment and rejects a deleted parent", async () => {
    const { db, sqlite } = setup();
    const image = await ready(db);
    // D1 batches serialize; the second transaction sees the first attachment claim.
    const input = { userId: "alice", body: "", attachments: [image] };
    expect((await publishRecord(db, input)).id).toBeDefined();
    expect((await publishRecord(db, input)).error).toBeDefined();
    const parentId = addRecord(sqlite, "bob", "Gone", { deletedAt: 1 });
    expect((await publishRecord(db, { ...input, attachments: [await ready(db)], parentId })).error).toBeDefined();
  });

  it("keeps text-only posting and validates image-only form data", async () => {
    const { db } = setup();
    expect((await publishRecord(db, { userId: "alice", body: "Text", attachments: [] })).id).toBeDefined();
    const form = new FormData();
    expect(parseRecordInput(form).error).toBeDefined();
    const id = crypto.randomUUID();
    form.append("attachmentId", id);
    form.append("attachmentAlt", "Photo description");
    expect(parseRecordInput(form)).toMatchObject({ body: "", attachments: [{ id, alt: "Photo description" }] });
    form.append("attachmentId", id);
    expect(parseRecordInput(form).error).toBeDefined();
  });

  it("rejects more than four images and oversized descriptions", async () => {
    const { db } = setup();
    const attachments = [];
    for (let i = 0; i < 5; i++) attachments.push(await ready(db));
    expect((await publishRecord(db, { userId: "alice", body: "", attachments })).error).toBeDefined();
    expect((await publishRecord(db, { userId: "alice", body: "", attachments: [{ ...attachments[0], alt: "x".repeat(501) }] })).error).toBeDefined();
  });
});

describe("image quotas and cleanup", () => {
  it("reserves user, pending, and global quotas before processing", async () => {
    const { db } = setup();
    const quota = { perUser: 2, pending: 1, global: 3 };
    const first = (await reserveImage(db, "alice", quota))!;
    expect(await reserveImage(db, "alice", quota)).toBeNull();
    await discardImage(db, first.id, "alice");
    const second = (await reserveImage(db, "alice", quota))!;
    await discardImage(db, second.id, "alice");
    expect(await reserveImage(db, "alice", quota)).toBeNull();
    expect(await reserveImage(db, "bob", quota)).not.toBeNull();
    expect(await reserveImage(db, "bob", { ...quota, pending: 2 })).toBeNull();
  });

  it("cannot discard another user's upload or an attached image", async () => {
    const { db, sqlite } = setup();
    const image = await ready(db);
    await discardImage(db, image.id, "bob");
    expect(sqlite.prepare("SELECT status FROM record_attachments WHERE id = ?").get(image.id)?.status).toBe("ready");
    await publishRecord(db, { userId: "alice", body: "", attachments: [image] });
    await discardImage(db, image.id, "alice");
    expect(sqlite.prepare("SELECT status FROM record_attachments WHERE id = ?").get(image.id)?.status).toBe("attached");
  });

  it("removes abandoned uploads, retries failed R2 deletes, and preserves quota reservations", async () => {
    const { db, sqlite } = setup();
    const now = Date.now();
    const image = await ready(db, "alice", now - draftLifetime - 1);
    const remove = vi.fn().mockRejectedValueOnce(new Error("R2 unavailable")).mockResolvedValue(undefined);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const bucket = { delete: remove } as unknown as R2Bucket;
    await cleanupImages(db, bucket, now);
    expect(sqlite.prepare("SELECT status FROM record_attachments WHERE id = ?").get(image.id)?.status).toBe("deleting");
    await cleanupImages(db, bucket, now);
    expect(remove).toHaveBeenCalledTimes(2);
    expect(sqlite.prepare("SELECT status FROM record_attachments WHERE id = ?").get(image.id)?.status).toBe("deleted");
    await cleanupImages(db, bucket, now + 2 * draftLifetime);
    expect(sqlite.prepare("SELECT id FROM record_attachments WHERE id = ?").get(image.id)).toBeUndefined();
  });

  it("queues author deletions immediately and keeps public images out of cleanup", async () => {
    const { db, sqlite } = setup();
    const image = await ready(db);
    const result = await publishRecord(db, { userId: "alice", body: "", attachments: [image] });
    const remove = vi.fn();
    const bucket = { delete: remove } as unknown as R2Bucket;
    await cleanupImages(db, bucket);
    expect(remove).not.toHaveBeenCalled();
    sqlite.prepare("UPDATE records SET deleted_at = ?, deletion_origin = 'author' WHERE id = ?").run(Date.now(), result.id!);
    expect(sqlite.prepare("SELECT status FROM record_attachments WHERE id = ?").get(image.id)?.status).toBe("deleting");
    expect(await getRecordImages(db, [result.id!], true)).toEqual({});
    await cleanupImages(db, bucket);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("retains moderated images for restoration, then purges them after 30 days", async () => {
    const { db, sqlite } = setup();
    const now = Date.now();
    const image = await ready(db);
    const result = await publishRecord(db, { userId: "alice", body: "", attachments: [image] });
    sqlite.prepare("UPDATE records SET deleted_at = ?, deletion_origin = 'admin' WHERE id = ?").run(now, result.id!);
    expect(await getRecordImages(db, [result.id!])).toEqual({});
    expect((await getRecordImages(db, [result.id!], true))[result.id!]).toHaveLength(1);
    const remove = vi.fn();
    const bucket = { delete: remove } as unknown as R2Bucket;
    await cleanupImages(db, bucket, now + 1000);
    expect(remove).not.toHaveBeenCalled();
    sqlite.prepare("UPDATE records SET deleted_at = NULL, deletion_origin = NULL WHERE id = ?").run(result.id!);
    expect((await getRecordImages(db, [result.id!]))[result.id!]).toHaveLength(1);
    sqlite.prepare("UPDATE records SET deleted_at = ?, deletion_origin = 'admin' WHERE id = ?").run(now, result.id!);
    await cleanupImages(db, bucket, now + moderationRetention + 1);
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
