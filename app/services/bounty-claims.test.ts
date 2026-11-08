import { afterEach, describe, expect, it } from "vitest";
import { createTestDatabase, addRecord, addUser } from "../test/database";
import { claimBounty } from "./bounties.server";

const databases: ReturnType<typeof createTestDatabase>[] = [];
function setup(rule = "character_count", endsAt = 100) {
  const test = createTestDatabase();
  databases.push(test);
  addUser(test.sqlite, "hunter");
  addUser(test.sqlite, "other");
  const recordIdA = addRecord(test.sqlite, "hunter", "First", { id: "aaaa0000-0000-4000-8000-000000000000" });
  const recordIdB = addRecord(test.sqlite, "other", "Second");
  const bountyId = crypto.randomUUID();
  test.sqlite.prepare(`INSERT INTO bounties
    (id, cadence, rule_type, character, target_value, starts_at, ends_at, sample_record_id_a, sample_record_id_b, created_at)
    VALUES (?, ?, ?, 'a', ?, 1, ?, ?, ?, 1)`)
    .run(bountyId, rule === "character_count" ? "daily" : "weekly", rule, rule === "character_count" ? 4 : 1, endsAt, recordIdA, rule === "event_gap" ? recordIdB : null);
  const input = { bountyId, userId: "hunter", recordIdA, recordIdB: null as string | null, now: 50 };
  return { ...test, input, recordIdB };
}
afterEach(() => { for (const { sqlite } of databases.splice(0)) sqlite.close(); });

describe("remaining bounty claims", () => {
  it("rejects an extra record on daily claims without writing claims or connections", async () => {
    const { db, sqlite, input, recordIdB } = setup();
    expect(await claimBounty(db, { ...input, recordIdB })).toBe("This bounty accepts exactly one record UUID.");
    expect(sqlite.prepare("SELECT count(*) AS total FROM bounty_claims").get()?.total).toBe(0);
    expect(sqlite.prepare("SELECT count(*) AS total FROM connections").get()?.total).toBe(0);
  });

  it("honors an existing deadline and preserves the first winner and graph links", async () => {
    const { db, sqlite, input } = setup();
    expect(await claimBounty(db, input)).toBeNull();
    expect(await claimBounty(db, { ...input, userId: "other" })).toBe("Someone already claimed this bounty.");
    expect(sqlite.prepare("SELECT count(*) AS total FROM bounty_claims").get()?.total).toBe(1);
    expect(sqlite.prepare("SELECT relationship FROM connections ORDER BY relationship").all().map((row) => row.relationship)).toEqual(["ANSWERS", "USES_RECORD"]);
    expect(await claimBounty(db, { ...input, now: 100 })).toBe("That bounty is not active.");
  });

  it("continues validating both records for existing weekly bounties", async () => {
    const { db, sqlite, input, recordIdB } = setup("event_gap");
    expect(await claimBounty(db, input)).toBe("This bounty requires two different record UUIDs.");
    sqlite.prepare("UPDATE records SET deleted_at = 2 WHERE id = ?").run(recordIdB);
    expect(await claimBounty(db, { ...input, recordIdB })).toBe("The second UUID is not a public record.");
    sqlite.prepare("UPDATE records SET deleted_at = NULL WHERE id = ?").run(recordIdB);
    expect(await claimBounty(db, { ...input, recordIdB })).toBeNull();
    expect(sqlite.prepare("SELECT count(*) AS total FROM connections").get()?.total).toBe(3);
  });
});
