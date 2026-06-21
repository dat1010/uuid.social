import { describe, expect, it } from "vitest";

import { generateRecordIdentity } from "./record-identity";
import { compareSpecimenUuids } from "./specimen-collection";

describe("specimen collection ordering", () => {
  it("orders classifications from singular to common", () => {
    const uuids = [
      "3c6ef362-2f5e-43b8-85c5-87561ca25fac",
      "9e3779b1-a972-4941-8312-d919f4cd747d",
      "17156075-c121-431d-8ddd-920d94212139",
      "ea33ee14-14e5-4dd6-8301-56e0ded5b4ba",
      "007dc219-0722-4519-8500-c0610dc29715",
    ];

    expect(uuids.sort(compareSpecimenUuids).map((uuid) => generateRecordIdentity(uuid).classification)).toEqual([
      "singular", "exceptional", "rare", "uncommon", "common",
    ]);
  });
});

