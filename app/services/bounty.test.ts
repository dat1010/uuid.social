import { describe, expect, it } from "vitest";

import {
  countUuidCharacter,
  formatBountyPrompt,
  matchesCharacterCount,
  matchesEventGap,
} from "./bounty";

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

  it("formats prompts from typed rules", () => {
    expect(formatBountyPrompt({ ruleType: "character_count", character: "a", targetValue: 4 })).toBe('Find a record UUID where "a" appears exactly 4 times.');
    expect(formatBountyPrompt({ ruleType: "event_gap", character: null, targetValue: 1000 })).toBe("Locate two record UUIDs born exactly 1,000 events apart.");
  });
});
