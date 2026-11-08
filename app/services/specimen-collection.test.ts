import { describe, expect, it } from "vitest";
import { generateRecordIdentity } from "./record-identity";
import { getSpecimenPage } from "./specimen-collection";

const ids = [
  "3c6ef362-2f5e-43b8-85c5-87561ca25fac",
  "9e3779b1-a972-4941-8312-d919f4cd747d",
  "17156075-c121-431d-8ddd-920d94212139",
  "ea33ee14-14e5-4dd6-8301-56e0ded5b4ba",
  "007dc219-0722-4519-8500-c0610dc29715",
];
const records = ids.map((id) => ({ id }));

describe("specimen collection", () => {
  it("orders classifications from singular to common", () => {
    const result = getSpecimenPage(records, new URL("https://uuid.test/specimens"));
    expect(result.specimens.map(({ identity }) => identity.classification)).toEqual([
      "singular", "exceptional", "rare", "uncommon", "common",
    ]);
    expect(result.counts).toEqual({ common: 1, uncommon: 1, rare: 1, exceptional: 1, singular: 1 });
  });

  it("combines classification, region, and name filters without changing collection totals", () => {
    const identity = generateRecordIdentity(ids[2]);
    const url = new URL("https://uuid.test/specimens");
    url.search = new URLSearchParams({ classification: "rare", region: identity.coordinates.region, q: identity.name.toUpperCase() }).toString();
    const result = getSpecimenPage(records, url);
    expect(result.specimens.map(({ id }) => id)).toEqual([ids[2]]);
    expect(result.total).toBe(5);
    expect(result.matched).toBe(1);
  });

  it("searches traits and UUIDs and handles empty results", () => {
    const trait = generateRecordIdentity(ids[4]).traits[0].label;
    const result = getSpecimenPage(records, new URL(`https://uuid.test/specimens?q=${encodeURIComponent(trait)}`));
    expect(result.specimens.map(({ id }) => id)).toContain(ids[4]);
    expect(getSpecimenPage(records, new URL(`https://uuid.test/specimens?q=${ids[1]}`)).matched).toBe(1);
    expect(getSpecimenPage(records, new URL("https://uuid.test/specimens?q=missing&page=99"))).toMatchObject({ specimens: [], page: 1, pageCount: 1 });
  });

  it("bounds page payloads and clamps invalid page numbers", () => {
    const many = Array.from({ length: 31 }, () => ({ id: crypto.randomUUID() }));
    const first = getSpecimenPage(many, new URL("https://uuid.test/specimens?page=-1"));
    const last = getSpecimenPage(many, new URL("https://uuid.test/specimens?page=99"));
    expect(first.specimens).toHaveLength(24);
    expect(last.specimens).toHaveLength(7);
    expect(last.page).toBe(2);
    expect(new Set([...first.specimens, ...last.specimens].map(({ id }) => id)).size).toBe(31);
  });
});
