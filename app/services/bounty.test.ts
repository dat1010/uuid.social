import { describe, expect, it } from "vitest";

import {
  countUuidCharacter,
  formatBountyPrompt,
  getBountyPeriod,
  matchesCharacterCount,
  matchesEventGap,
} from "./bounty";
import { ensureCurrentBounties } from "./bounties.server";

describe("UUID bounty rules", () => {
  it("counts characters without hyphens or case sensitivity", () => {
    expect(countUuidCharacter("AAAA0000-0000-4000-8000-000000000000", "a")).toBe(4);
    expect(matchesCharacterCount("aaaa0000-0000-4000-8000-000000000000", "A", 4)).toBe(true);
  });

  it("requires an exact event gap in either order", () => {
    expect(matchesEventGap(40, 1040, 1000)).toBe(true);
    expect(matchesEventGap(1040, 40, 1000)).toBe(true);
    expect(matchesEventGap(40, 1039, 1000)).toBe(false);
  });

  it("uses midnight UTC for daily periods", () => {
    const period = getBountyPeriod("daily", new Date("2026-06-20T18:45:00-04:00"));
    expect(period.startsAt.toISOString()).toBe("2026-06-20T00:00:00.000Z");
    expect(period.endsAt.toISOString()).toBe("2026-06-21T00:00:00.000Z");
  });

  it("uses Monday midnight UTC for weekly periods", () => {
    const period = getBountyPeriod("weekly", new Date("2026-06-20T12:00:00Z"));
    expect(period.startsAt.toISOString()).toBe("2026-06-15T00:00:00.000Z");
    expect(period.endsAt.toISOString()).toBe("2026-06-22T00:00:00.000Z");
  });

  it("formats prompts from typed rules", () => {
    expect(formatBountyPrompt({ ruleType: "character_count", character: "a", targetValue: 4 })).toBe('Find a record UUID where "a" appears exactly 4 times.');
    expect(formatBountyPrompt({ ruleType: "event_gap", character: null, targetValue: 1000 })).toBe("Locate two record UUIDs born exactly 1,000 events apart.");
  });
});

describe("bounty generation", () => {
  it("creates solvable periods once", async () => {
    const fake = new FakeBountyDb(true);
    const now = new Date("2026-06-20T12:00:00Z");

    await ensureCurrentBounties(fake as unknown as D1Database, now);
    await ensureCurrentBounties(fake as unknown as D1Database, now);

    expect(fake.inserts).toBe(2);
    expect(new Set(fake.bountyIds).size).toBe(2);
    expect(fake.bountyIds).toEqual([
      expect.stringMatching(uuidV4Pattern),
      expect.stringMatching(uuidV4Pattern),
    ]);
  });

  it("skips periods without a valid answer", async () => {
    const fake = new FakeBountyDb(false);
    await ensureCurrentBounties(fake as unknown as D1Database, new Date("2026-06-20T12:00:00Z"));
    expect(fake.inserts).toBe(0);
  });
});

class FakeBountyDb {
  inserts = 0;
  bountyIds: string[] = [];
  private periods = new Set<string>();

  constructor(private readonly solvable: boolean) {}

  prepare(sql: string) {
    return {
      bind: (...values: unknown[]) => ({
        first: async () => {
          if (sql.includes("SELECT id FROM bounties")) {
            return this.periods.has(`${values[0]}:${values[1]}`) ? { id: "existing" } : null;
          }
          if (!this.solvable) return null;
          if (sql.includes("FROM records a")) {
            return { record_a_id: testUuidA, event_a: 1, record_b_id: testUuidB, event_b: 1001 };
          }
          return { id: testUuidA, event_number: 1 };
        },
        run: async () => {
          this.periods.add(`${values[1]}:${values[5]}`);
          this.bountyIds.push(String(values[0]));
          this.inserts += 1;
          return { success: true };
        },
      }),
    };
  }
}

const testUuidA = "aaaa0000-0000-4000-8000-000000000000";
const testUuidB = "bbbb0000-0000-4000-8000-000000000000";
const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
