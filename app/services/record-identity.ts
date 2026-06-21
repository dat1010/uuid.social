export type RecordClassification =
  | "common"
  | "uncommon"
  | "rare"
  | "exceptional"
  | "singular";

export type RecordTrait = {
  id: string;
  label: string;
  explanation: string;
  approximateFrequency: number;
  oneIn: number;
  classification: RecordClassification;
};

export type RecordIdentity = {
  version: "specimen-v1";
  name: string;
  palette: { background: string; foreground: string; accent: string };
  sigil: {
    points: Array<{ x: number; y: number }>;
    connections: Array<[number, number]>;
    nodeShape: "circle" | "diamond" | "square";
  };
  coordinates: {
    region: string;
    sector: number;
    x: number;
    y: number;
    depth: number;
  };
  traits: RecordTrait[];
  classification: RecordClassification;
};

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const CLASSIFICATION_RANK: Record<RecordClassification, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  exceptional: 3,
  singular: 4,
};

// Immutable specimen-v1 constants, calibrated offline against 10,000,000
// uniformly generated 30-nibble sequences. Runtime generation never simulates.
const ONE_IN = {
  adjacentDouble: 1,
  adjacentTriple: 10,
  dominantFive: 3,
  dominantSix: 9,
  dominantSeven: 37,
  dominantEight: 160,
  repeatedPair: 1,
  reversedPair: 1,
  mirroredFragment: 4,
  matchingBookends: 16,
  alphabetEleven: 36,
  alphabetTen: 262,
  alphabetNine: 3_464,
  balanced: 2,
  imbalanced: 4,
  extremeImbalance: 7,
} as const;

const ADJECTIVES = [
  "Auburn", "Brisk", "Cinder", "Distant", "Ember", "Fallow", "Glacial", "Hushed",
  "Ivory", "Jade", "Keen", "Luminous", "Misted", "Nocturne", "Ochre", "Pale",
  "Quiet", "Riven", "Solar", "Tidal", "Umber", "Verdant", "Waning", "Zephyr",
] as const;
const NOUNS = [
  "Archive", "Beacon", "Cipher", "Delta", "Echo", "Folio", "Glyph", "Harbor",
  "Index", "Junction", "Keystone", "Lantern", "Meridian", "Needle", "Orbit", "Prism",
  "Quarry", "Relay", "Signal", "Trace", "Undertow", "Vector", "Window", "Zenith",
] as const;
const REGIONS = ["Aster", "Boreal", "Cygnus", "Drift", "Equinox", "Fathom", "Helix", "Umbra"] as const;

export function generateRecordIdentity(uuid: string): RecordIdentity {
  const normalized = normalizeUuid(uuid);
  const independent = [...normalized].filter((_, index) => index !== 12 && index !== 16).join("");
  const seed = hashHex(normalized);
  const traits = detectTraits(independent)
    .sort((a, b) => b.oneIn - a.oneIn || a.id.localeCompare(b.id))
    .slice(0, 4);
  const classification = traits.reduce<RecordClassification>(
    (rarest, trait) => CLASSIFICATION_RANK[trait.classification] > CLASSIFICATION_RANK[rarest]
      ? trait.classification
      : rarest,
    "common",
  );

  return {
    version: "specimen-v1",
    name: `${pick(ADJECTIVES, seed[0])} ${pick(NOUNS, seed[1])}`,
    palette: buildPalette(seed),
    sigil: buildSigil(normalized),
    coordinates: {
      region: pick(REGIONS, seed[2]),
      sector: 1 + seed[3] % 96,
      x: signedCoordinate(seed[4], seed[5]),
      y: signedCoordinate(seed[6], seed[7]),
      depth: seed[0] % 1_001,
    },
    traits,
    classification,
  };
}

function normalizeUuid(uuid: string) {
  if (typeof uuid !== "string" || !UUID_V4.test(uuid)) {
    throw new TypeError("Record identity requires a canonical lowercase UUIDv4.");
  }
  return uuid.replaceAll("-", "");
}

function detectTraits(sequence: string): RecordTrait[] {
  const traits: RecordTrait[] = [];
  const counts = new Map<string, number>();
  for (const character of sequence) counts.set(character, (counts.get(character) ?? 0) + 1);

  const triple = /(.)\1\1/.exec(sequence)?.[0];
  const double = /(.)\1/.exec(sequence)?.[0];
  if (triple) traits.push(trait("adjacent-triple", "Triple run", `The sequence contains the adjacent run ${triple}.`, ONE_IN.adjacentTriple));
  else if (double) traits.push(trait("adjacent-double", "Double run", `The sequence contains the adjacent pair ${double}.`, ONE_IN.adjacentDouble));

  const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  if (dominant[1] >= 5) {
    const oneIn = dominant[1] >= 8 ? ONE_IN.dominantEight : dominant[1] === 7
      ? ONE_IN.dominantSeven : dominant[1] === 6 ? ONE_IN.dominantSix : ONE_IN.dominantFive;
    traits.push(trait("dominant-character", "Dominant character", `${dominant[0]} appears ${dominant[1]} times in the independent positions.`, oneIn));
  }

  const pairs = windows(sequence, 2);
  const repeatedPair = firstRepeated(pairs);
  if (repeatedPair) traits.push(trait("repeated-pair", "Repeated pair", `The ordered pair ${repeatedPair} occurs more than once.`, ONE_IN.repeatedPair));

  const reversedPair = pairs.find((pair, index) => pair[0] !== pair[1] && pairs.slice(index + 1).includes(reverse(pair)));
  if (reversedPair) traits.push(trait("reversed-pair", "Reversed pair", `${reversedPair} also appears in reverse as ${reverse(reversedPair)}.`, ONE_IN.reversedPair));

  const fragments = windows(sequence, 3);
  const mirrored = fragments.find((fragment, index) => fragment !== reverse(fragment) && fragments.slice(index + 1).includes(reverse(fragment)));
  if (mirrored) traits.push(trait("mirrored-fragment", "Mirrored fragment", `${mirrored} is reflected elsewhere as ${reverse(mirrored)}.`, ONE_IN.mirroredFragment));

  if (sequence[0] === sequence.at(-1)) traits.push(trait("matching-bookends", "Matching bookends", `The independent sequence begins and ends with ${sequence[0]}.`, ONE_IN.matchingBookends));

  if (counts.size <= 11) {
    const oneIn = counts.size <= 9 ? ONE_IN.alphabetNine : counts.size === 10 ? ONE_IN.alphabetTen : ONE_IN.alphabetEleven;
    traits.push(trait("narrow-alphabet", "Narrow alphabet", `Only ${counts.size} of 16 hexadecimal characters appear.`, oneIn));
  }

  const digits = [...sequence].filter((character) => character <= "9").length;
  if (digits <= 8 || digits >= 22) {
    traits.push(trait("extreme-balance", "Extreme character balance", `${digits} positions are digits and ${30 - digits} are letters.`, ONE_IN.extremeImbalance));
  } else if (digits <= 11 || digits >= 20) {
    traits.push(trait("character-imbalance", "Character imbalance", `${digits} positions are digits and ${30 - digits} are letters.`, ONE_IN.imbalanced));
  } else {
    traits.push(trait("character-balance", "Character balance", `${digits} positions are digits and ${30 - digits} are letters.`, ONE_IN.balanced));
  }

  return traits;
}

function trait(id: string, label: string, explanation: string, oneIn: number): RecordTrait {
  return { id, label, explanation, oneIn, approximateFrequency: 1 / oneIn, classification: classify(oneIn) };
}

function classify(oneIn: number): RecordClassification {
  if (oneIn > 2_500) return "singular";
  if (oneIn > 250) return "exceptional";
  if (oneIn > 25) return "rare";
  if (oneIn > 5) return "uncommon";
  return "common";
}

function buildPalette(seed: number[]) {
  const hue = seed[0] % 360;
  const accentHue = (hue + 72 + seed[1] % 144) % 360;
  const dark = seed[2] % 2 === 0;
  return {
    background: hslToHex(hue, 28 + seed[3] % 18, dark ? 14 + seed[4] % 9 : 88 + seed[4] % 7),
    foreground: dark ? "#f7f8fa" : "#111318",
    accent: hslToHex(accentHue, 55 + seed[5] % 25, dark ? 62 + seed[6] % 14 : 34 + seed[6] % 13),
  };
}

function buildSigil(hex: string): RecordIdentity["sigil"] {
  const values = [...hex].map((character) => Number.parseInt(character, 16));
  const left = Array.from({ length: 5 }, (_, index) => ({
    x: 12 + values[index] * 2,
    y: 10 + index * 20 + values[index + 5] % 9,
  }));
  const points = [...left, ...left.map((point) => ({ x: 100 - point.x, y: point.y }))];
  const connections: Array<[number, number]> = [];
  for (let index = 0; index < 4; index++) {
    connections.push([index, index + 1], [index + 5, index + 6]);
    if (values[index + 10] % 2 === 0) connections.push([index, 9 - index]);
  }
  connections.push([4, 9]);
  return { points, connections, nodeShape: (["circle", "diamond", "square"] as const)[values[15] % 3] };
}

function hashHex(hex: string) {
  let state = 0x811c9dc5;
  const output: number[] = [];
  for (let index = 0; index < hex.length; index++) {
    state ^= hex.charCodeAt(index);
    state = Math.imul(state, 0x01000193) >>> 0;
    state ^= state >>> 13;
    output.push(state >>> 0);
  }
  return output;
}

function hslToHex(hue: number, saturation: number, lightness: number) {
  const s = saturation / 100;
  const l = lightness / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
  const m = l - c / 2;
  const [r, g, b] = hue < 60 ? [c, x, 0] : hue < 120 ? [x, c, 0] : hue < 180
    ? [0, c, x] : hue < 240 ? [0, x, c] : hue < 300 ? [x, 0, c] : [c, 0, x];
  return `#${[r, g, b].map((channel) => Math.round((channel + m) * 255).toString(16).padStart(2, "0")).join("")}`;
}

function windows(value: string, size: number) {
  return Array.from({ length: value.length - size + 1 }, (_, index) => value.slice(index, index + size));
}
function firstRepeated(values: string[]) {
  return values.find((value, index) => values.indexOf(value) !== index);
}
function reverse(value: string) { return [...value].reverse().join(""); }
function pick<const T extends readonly string[]>(values: T, seed: number): T[number] { return values[seed % values.length]; }
function signedCoordinate(high: number, low: number) { return (((high ^ low) >>> 0) % 20_001) - 10_000; }
