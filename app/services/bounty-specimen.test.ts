import { describe, expect, it } from "vitest";

import { deriveBountySpecimenDistinction } from "./bounty-specimen";

const common = "3c6ef362-2f5e-43b8-85c5-87561ca25fac";
const uncommon = "9e3779b1-a972-4941-8312-d919f4cd747d";
const rare = "17156075-c121-431d-8ddd-920d94212139";
const exceptional = "ea33ee14-14e5-4dd6-8301-56e0ded5b4ba";
const singular = "007dc219-0722-4519-8500-c0610dc29715";

describe("bounty specimen distinctions", () => {
  it("does not enhance daily Common or Uncommon claims", () => {
    expect(deriveBountySpecimenDistinction(common, [common])).toBeNull();
    expect(deriveBountySpecimenDistinction(common, [uncommon])).toBeNull();
  });

  it.each([
    [rare, "rare"],
    [exceptional, "exceptional"],
    [singular, "singular"],
  ] as const)("gives daily %s specimens their matching tier", (uuid, tier) => {
    expect(deriveBountySpecimenDistinction(common, [uuid])?.tier).toBe(tier);
  });

  it("requires both weekly specimens to qualify", () => {
    expect(deriveBountySpecimenDistinction(singular, [rare, common])).toBeNull();
    expect(deriveBountySpecimenDistinction(singular, [singular, uncommon])).toBeNull();
  });

  it("uses the lower qualifying weekly tier", () => {
    expect(deriveBountySpecimenDistinction(common, [rare, singular])?.tier).toBe("rare");
    expect(deriveBountySpecimenDistinction(common, [exceptional, singular])?.tier).toBe("exceptional");
  });

  it("uses the bounty UUID as an independent rarity multiplier", () => {
    const distinction = deriveBountySpecimenDistinction(rare, [rare]);
    expect(distinction).toMatchObject({
      tier: "exceptional",
      approximateOneIn: 1_369,
      bountySpecimen: { uuid: rare },
    });
  });

  it("can elevate an Exceptional record trophy to Singular", () => {
    expect(deriveBountySpecimenDistinction(rare, [exceptional])?.tier)
      .toBe("singular");
  });

  it("is deterministic for historical claims", () => {
    expect(deriveBountySpecimenDistinction(rare, [exceptional, singular]))
      .toEqual(deriveBountySpecimenDistinction(rare, [exceptional, singular]));
  });
});
