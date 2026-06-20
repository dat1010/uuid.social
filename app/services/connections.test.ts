import { describe, expect, it } from "vitest";

import { toPublicCurrentUser } from "./auth.server";
import {
  isManualRelationship,
  objectUrl,
  relationshipLabels,
  shortUuid,
} from "./connections";

describe("public identity boundaries", () => {
  it("removes the internal user id from serialized current-user data", () => {
    const publicUser = toPublicCurrentUser({
      id: "private-user-id",
      username: "ada",
      displayName: "Ada",
      status: null,
      bio: null,
      hasAvatar: false,
      isAdmin: false,
    });

    expect(JSON.stringify(publicUser)).not.toContain("private-user-id");
    expect(publicUser).toEqual({
      username: "ada",
      displayName: "Ada",
      status: null,
      bio: null,
      hasAvatar: false,
      isAdmin: false,
    });
  });
});

describe("connection presentation rules", () => {
  it("accepts only user-assertable relationships", () => {
    expect(isManualRelationship("SUPPORTS")).toBe(true);
    expect(isManualRelationship("REPLIES_TO")).toBe(false);
    expect(isManualRelationship("anything")).toBe(false);
  });

  it("maps public objects and relationship labels consistently", () => {
    const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    expect(objectUrl("claim", id)).toBe(`/claim/${id}`);
    expect(shortUuid(id)).toBe("aaaaa...aaaa");
    expect(relationshipLabels.USES_RECORD).toBe("uses record");
  });
});
