import { describe, expect, it } from "vitest";

import { generateRecordIdentity } from "./record-identity";

const fixtures = [
  "123e4567-e89b-42d3-a456-426614174000",
  "aaaaaaaa-1234-4abc-8def-1234567890aa",
  "01234567-89ab-4cde-8f01-23456789abcd",
  "ffff0123-4567-489a-bcde-f0123456789f",
];

const classificationFixtures = [
  "3c6ef362-2f5e-43b8-85c5-87561ca25fac",
  "9e3779b1-a972-4941-8312-d919f4cd747d",
  "17156075-c121-431d-8ddd-920d94212139",
  "ea33ee14-14e5-4dd6-8301-56e0ded5b4ba",
  "007dc219-0722-4519-8500-c0610dc29715",
];

describe("record specimen identity", () => {
  it("is deeply deterministic", () => {
    for (const uuid of fixtures) {
      expect(generateRecordIdentity(uuid)).toEqual(generateRecordIdentity(uuid));
    }
  });

  it("returns bounded, canonical specimen-v1 output", () => {
    for (const uuid of fixtures) {
      const identity = generateRecordIdentity(uuid);
      expect(identity.version).toBe("specimen-v1");
      expect(identity.name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
      expect(identity.palette).toEqual({
        background: expect.stringMatching(/^#[0-9a-f]{6}$/),
        foreground: expect.stringMatching(/^#[0-9a-f]{6}$/),
        accent: expect.stringMatching(/^#[0-9a-f]{6}$/),
      });
      expect(contrast(identity.palette.background, identity.palette.foreground)).toBeGreaterThanOrEqual(4.5);
      expect(identity.coordinates.sector).toBeGreaterThanOrEqual(1);
      expect(identity.coordinates.sector).toBeLessThanOrEqual(96);
      expect(identity.coordinates.x).toBeGreaterThanOrEqual(-10_000);
      expect(identity.coordinates.x).toBeLessThanOrEqual(10_000);
      expect(identity.coordinates.depth).toBeGreaterThanOrEqual(0);
      expect(identity.coordinates.depth).toBeLessThanOrEqual(1_000);
      expect(identity.sigil.points.every(({ x, y }) => x >= 0 && x <= 100 && y >= 0 && y <= 100)).toBe(true);
      expect(identity.traits.length).toBeGreaterThan(0);
      expect(identity.traits.length).toBeLessThanOrEqual(4);
      expect(identity.classification).toBe(identity.traits[0].classification);
    }
  });

  it("snapshots representative specimens across every classification", () => {
    expect(classificationFixtures.map((uuid) => {
      const identity = generateRecordIdentity(uuid);
      return {
        uuid,
        name: identity.name,
        classification: identity.classification,
        traits: identity.traits.map(({ id, oneIn }) => ({ id, oneIn })),
      };
    })).toMatchInlineSnapshot(`
      [
        {
          "classification": "common",
          "name": "Pale Window",
          "traits": [
            {
              "id": "mirrored-fragment",
              "oneIn": 4,
            },
            {
              "id": "dominant-character",
              "oneIn": 3,
            },
            {
              "id": "character-balance",
              "oneIn": 2,
            },
            {
              "id": "adjacent-double",
              "oneIn": 1,
            },
          ],
          "uuid": "3c6ef362-2f5e-43b8-85c5-87561ca25fac",
        },
        {
          "classification": "uncommon",
          "name": "Riven Keystone",
          "traits": [
            {
              "id": "dominant-character",
              "oneIn": 9,
            },
            {
              "id": "extreme-balance",
              "oneIn": 7,
            },
            {
              "id": "mirrored-fragment",
              "oneIn": 4,
            },
            {
              "id": "adjacent-double",
              "oneIn": 1,
            },
          ],
          "uuid": "9e3779b1-a972-4941-8312-d919f4cd747d",
        },
        {
          "classification": "rare",
          "name": "Brisk Junction",
          "traits": [
            {
              "id": "dominant-character",
              "oneIn": 37,
            },
            {
              "id": "narrow-alphabet",
              "oneIn": 36,
            },
            {
              "id": "adjacent-triple",
              "oneIn": 10,
            },
            {
              "id": "extreme-balance",
              "oneIn": 7,
            },
          ],
          "uuid": "17156075-c121-431d-8ddd-920d94212139",
        },
        {
          "classification": "exceptional",
          "name": "Riven Harbor",
          "traits": [
            {
              "id": "narrow-alphabet",
              "oneIn": 262,
            },
            {
              "id": "dominant-character",
              "oneIn": 9,
            },
            {
              "id": "character-balance",
              "oneIn": 2,
            },
            {
              "id": "adjacent-double",
              "oneIn": 1,
            },
          ],
          "uuid": "ea33ee14-14e5-4dd6-8301-56e0ded5b4ba",
        },
        {
          "classification": "singular",
          "name": "Keen Signal",
          "traits": [
            {
              "id": "narrow-alphabet",
              "oneIn": 3464,
            },
            {
              "id": "dominant-character",
              "oneIn": 37,
            },
            {
              "id": "extreme-balance",
              "oneIn": 7,
            },
            {
              "id": "adjacent-double",
              "oneIn": 1,
            },
          ],
          "uuid": "007dc219-0722-4519-8500-c0610dc29715",
        },
      ]
    `);
  });

  it("excludes fixed version and variant positions from trait analysis", () => {
    const first = generateRecordIdentity("01234567-89ab-4cde-8f01-23456789abcd");
    const second = generateRecordIdentity("01234567-89ab-4cde-bf01-23456789abcd");
    expect(first.traits).toEqual(second.traits);
  });

  it("detects overlapping runs and the fixed explainable patterns", () => {
    const run = generateRecordIdentity("aaaa0123-4567-489a-bcde-f0123456789a");
    expect(run.traits.map((trait) => trait.id)).toContain("adjacent-triple");
    expect(run.traits.map((trait) => trait.id)).toContain("matching-bookends");

    const mirror = generateRecordIdentity("abc0cba1-2345-4678-9abc-def012345678");
    expect(mirror.traits.map((trait) => trait.id)).toContain("mirrored-fragment");
  });

  it.each([
    "",
    "123E4567-E89B-42D3-A456-426614174000",
    "123e4567-e89b-12d3-a456-426614174000",
    "123e4567-e89b-42d3-c456-426614174000",
    "not-a-uuid",
  ])("rejects invalid UUID input: %s", (uuid) => {
    expect(() => generateRecordIdentity(uuid)).toThrow(TypeError);
  });
});

function contrast(first: string, second: string) {
  const luminance = (hex: string) => {
    const channels = hex.match(/[0-9a-f]{2}/gi)!.map((value) => Number.parseInt(value, 16) / 255)
      .map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
