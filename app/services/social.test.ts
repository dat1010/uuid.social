import { describe, expect, it } from "vitest";

import { buildSocialGraph, parsePage, parseSocialView } from "./social";

const user = (username: string) => ({
  username,
  displayName: username.toUpperCase(),
  hasAvatar: false,
});

describe("social graph presentation", () => {
  it("normalizes list query parameters", () => {
    expect(parseSocialView("following")).toBe("following");
    expect(parseSocialView("unknown")).toBe("followers");
    expect(parsePage("3")).toBe(3);
    expect(parsePage("-4")).toBe(1);
    expect(parsePage("invalid")).toBe(1);
  });

  it("deduplicates mutual users and retains every visible follow", () => {
    const graph = buildSocialGraph({
      center: user("ada"),
      followers: [user("grace"), user("linus")],
      following: [user("grace"), user("margaret")],
      follows: [
        { followerUsername: "grace", followingUsername: "ada", createdAt: "2026-01-01T00:00:00.000Z" },
        { followerUsername: "ada", followingUsername: "grace", createdAt: "2026-01-02T00:00:00.000Z" },
        { followerUsername: "linus", followingUsername: "margaret", createdAt: "2026-01-03T00:00:00.000Z" },
        { followerUsername: "hidden", followingUsername: "ada", createdAt: "2026-01-04T00:00:00.000Z" },
      ],
      counts: { followers: 2, following: 2 },
    });

    expect(graph.nodes.map((node) => node.username)).toEqual([
      "ada", "grace", "linus", "margaret",
    ]);
    expect(graph.follows).toHaveLength(3);
    expect(JSON.stringify(graph)).not.toContain("hidden");
    expect(graph.truncated).toBe(false);
  });

  it("marks a canvas truncated when either direct list is capped", () => {
    const graph = buildSocialGraph({
      center: user("ada"),
      followers: [user("grace")],
      following: [],
      follows: [],
      counts: { followers: 2, following: 0 },
    });

    expect(graph.truncated).toBe(true);
  });
});
