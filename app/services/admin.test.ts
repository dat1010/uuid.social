import { describe, expect, it } from "vitest";

import {
  bootstrapAdminUsername,
  canManageAdmin,
  isBootstrapAdmin,
  parseAdminPage,
} from "./admin";

describe("admin authorization rules", () => {
  it("keeps tannerd as the permanent bootstrap admin", () => {
    expect(bootstrapAdminUsername).toBe("tannerd");
    expect(isBootstrapAdmin("tannerd")).toBe(true);
    expect(isBootstrapAdmin("other-admin")).toBe(false);
  });

  it("prevents self-management and changes to the bootstrap admin", () => {
    expect(canManageAdmin("tannerd", "alice")).toBe(true);
    expect(canManageAdmin("alice", "bob")).toBe(true);
    expect(canManageAdmin("alice", "alice")).toBe(false);
    expect(canManageAdmin("alice", "tannerd")).toBe(false);
  });

  it("normalizes pagination", () => {
    expect(parseAdminPage("4")).toBe(4);
    expect(parseAdminPage("0")).toBe(1);
    expect(parseAdminPage("invalid")).toBe(1);
  });
});
