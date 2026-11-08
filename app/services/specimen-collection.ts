import { generateRecordIdentity, type RecordClassification, type RecordIdentity } from "./record-identity";

export const classifications: RecordClassification[] = ["singular", "exceptional", "rare", "uncommon", "common"];
export type Specimen = { id: string; identity: RecordIdentity };

const classificationRank: Record<RecordClassification, number> = {
  singular: 4,
  exceptional: 3,
  rare: 2,
  uncommon: 1,
  common: 0,
};

export function compareSpecimens(firstSpecimen: Specimen, secondSpecimen: Specimen) {
  const first = firstSpecimen.identity;
  const second = secondSpecimen.identity;
  const classificationDifference = classificationRank[second.classification] - classificationRank[first.classification];
  if (classificationDifference !== 0) return classificationDifference;

  const frequencyDifference = (second.traits[0]?.oneIn ?? 1) - (first.traits[0]?.oneIn ?? 1);
  if (frequencyDifference !== 0) return frequencyDifference;
  return firstSpecimen.id.localeCompare(secondSpecimen.id);
}

export function getSpecimenPage(records: Array<{ id: string }>, url: URL) {
  const specimens = records.map(({ id }) => ({ id, identity: generateRecordIdentity(id) }));
  const counts = Object.fromEntries(classifications.map((classification) => [
    classification,
    specimens.filter(({ identity }) => identity.classification === classification).length,
  ])) as Record<RecordClassification, number>;
  const regions = [...new Set(specimens.map(({ identity }) => identity.coordinates.region))].sort();
  const classification = url.searchParams.get("classification") ?? "";
  const region = url.searchParams.get("region") ?? "";
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 200);
  const search = query.toLowerCase();
  const filtered = specimens.filter(({ id, identity }) =>
    (!classification || identity.classification === classification)
    && (!region || identity.coordinates.region === region)
    && (!search || [id, identity.name, ...identity.traits.map((trait) => trait.label)]
      .some((value) => value.toLowerCase().includes(search))),
  ).sort(compareSpecimens);
  const pageSize = 24;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(pageCount, Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1));
  return {
    specimens: filtered.slice((page - 1) * pageSize, page * pageSize),
    total: specimens.length,
    matched: filtered.length,
    counts,
    regions,
    classification,
    region,
    query,
    page,
    pageCount,
  };
}

