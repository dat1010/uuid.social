import { afterEach, describe, expect, it } from "vitest";
import { createTestDatabase, addRecord, addUser } from "../test/database";
import { getFeaturedSpecimen, setFeaturedSpecimen } from "./featured-specimen.server";

const databases: ReturnType<typeof createTestDatabase>[] = [];
function setup() {
  const test = createTestDatabase();
  databases.push(test);
  addUser(test.sqlite, "owner");
  addUser(test.sqlite, "other");
  return test;
}
afterEach(() => { for (const { sqlite } of databases.splice(0)) sqlite.close(); });

describe("featured specimens", () => {
  it("features an owned reply, replaces it, and removes the feature", async () => {
    const { db, sqlite } = setup();
    const parent = addRecord(sqlite, "other", "Thread");
    const reply = addRecord(sqlite, "owner", "Reply", { parentId: parent });
    expect(await setFeaturedSpecimen(db, "owner", reply)).toBeNull();
    expect((await getFeaturedSpecimen(db, "owner"))?.id).toBe(reply);
    const next = addRecord(sqlite, "owner", "Another");
    expect(await setFeaturedSpecimen(db, "owner", next)).toBeNull();
    expect((await getFeaturedSpecimen(db, "owner"))?.id).toBe(next);
    expect(await setFeaturedSpecimen(db, "owner", null)).toBeNull();
    expect(await getFeaturedSpecimen(db, "owner")).toBeNull();
  });

  it("rejects another user's, deleted, and nonexistent records without changing the feature", async () => {
    const { db, sqlite } = setup();
    const own = addRecord(sqlite, "owner", "Keep this");
    await setFeaturedSpecimen(db, "owner", own);
    for (const id of [addRecord(sqlite, "other", "Not mine"), addRecord(sqlite, "owner", "Deleted", { deletedAt: 2 }), crypto.randomUUID()]) {
      expect(await setFeaturedSpecimen(db, "owner", id)).toBe("Choose one of your active records or replies.");
      expect((await getFeaturedSpecimen(db, "owner"))?.id).toBe(own);
    }
  });

  it("hides a featured record after deletion or account deactivation", async () => {
    const { db, sqlite } = setup();
    const id = addRecord(sqlite, "owner", "Temporary");
    await setFeaturedSpecimen(db, "owner", id);
    sqlite.prepare("UPDATE records SET deleted_at = 2 WHERE id = ?").run(id);
    expect(await getFeaturedSpecimen(db, "owner")).toBeNull();
    sqlite.prepare("UPDATE records SET deleted_at = NULL WHERE id = ?").run(id);
    sqlite.exec("UPDATE users SET deleted_at = 2 WHERE id = 'owner'");
    expect(await getFeaturedSpecimen(db, "owner")).toBeNull();
  });
});
