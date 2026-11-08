import { afterEach, describe, expect, it } from "vitest";
import { createTestDatabase, addRecord, addUser } from "../test/database";
import { getFeed } from "./feed.server";

const databases: ReturnType<typeof createTestDatabase>[] = [];
function setup() {
  const test = createTestDatabase();
  databases.push(test);
  for (const user of ["viewer", "followed", "stranger"]) addUser(test.sqlite, user);
  test.sqlite.prepare("INSERT INTO follows VALUES ('viewer', 'followed', 1)").run();
  return test;
}
afterEach(() => { for (const { sqlite } of databases.splice(0)) sqlite.close(); });

describe("record discovery", () => {
  it("shows only followed authors in Following and excludes deleted records", async () => {
    const { db, sqlite } = setup();
    const followed = addRecord(sqlite, "followed", "A followed record");
    addRecord(sqlite, "stranger", "An unrelated record");
    addRecord(sqlite, "followed", "Deleted", { deletedAt: 2 });
    const page = await getFeed(db, "viewer", new URL("https://uuid.test/home?view=following"));
    expect(page.records.map(({ id }) => id)).toEqual([followed]);
    expect((await getFeed(db, "viewer", new URL("https://uuid.test/home"))).records).toHaveLength(2);
  });

  it("searches old records, replies, usernames, and UUIDs while keeping search characters literal", async () => {
    const { db, sqlite } = setup();
    const parent = addRecord(sqlite, "stranger", "A 100% discovery", { createdAt: 1 });
    const reply = addRecord(sqlite, "followed", "Hidden gem", { parentId: parent });
    for (let i = 0; i < 40; i++) addRecord(sqlite, "stranger", "Recent noise", { createdAt: 10 + i });
    for (const [query, expected] of [["100%", parent], ["GEM", reply], [parent, parent], ["followed", reply]]) {
      const result = await getFeed(db, "viewer", new URL(`https://uuid.test/home?q=${encodeURIComponent(query)}`));
      expect(result.records.map(({ id }) => id)).toEqual([expected]);
    }
    const following = await getFeed(db, "viewer", new URL("https://uuid.test/home?view=following&q=100%25"));
    expect(following.records).toEqual([]);
  });

  it("paginates equal timestamps deterministically without duplicates", async () => {
    const { db, sqlite } = setup();
    for (let i = 0; i < 35; i++) addRecord(sqlite, "followed", "Record", { createdAt: 1 });
    const first = await getFeed(db, "viewer", new URL("https://uuid.test/home"));
    const second = await getFeed(db, "viewer", new URL("https://uuid.test/home?page=2"));
    expect(first.records).toHaveLength(30);
    expect(first.hasNextPage).toBe(true);
    expect(second.records).toHaveLength(5);
    expect(second.hasNextPage).toBe(false);
    expect(new Set([...first.records, ...second.records].map(({ id }) => id)).size).toBe(35);
  });
});
