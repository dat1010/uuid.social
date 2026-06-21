import { describe, expect, it } from "vitest";

import { toPublicCurrentUser } from "./auth.server";
import { resolvePublicObject } from "./connections.server";
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

  it("qualifies connection columns when resolving joined users", async () => {
    const queries: string[] = [];
    const db = {
      prepare(sql: string) {
        queries.push(sql);
        return {
          bind: () => ({
            first: async () => queries.length === 1
              ? { id: "connection-id", object_type: "connection", created_at: 1 }
              : { relationship: "SUPPORTS", deleted_at: null, username: "ada" },
          }),
        };
      },
    };

    const connection = await resolvePublicObject(db as unknown as D1Database, "connection-id");

    expect(queries[1]).toContain("SELECT c.relationship, c.deleted_at, u.username");
    expect(connection).toMatchObject({ type: "connection", deleted: false, title: "SUPPORTS" });
  });
});
