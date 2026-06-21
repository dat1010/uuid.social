import { generateRecordIdentity, type RecordClassification } from "./record-identity";

const classificationRank: Record<RecordClassification, number> = {
  singular: 4,
  exceptional: 3,
  rare: 2,
  uncommon: 1,
  common: 0,
};

export function compareSpecimenUuids(firstUuid: string, secondUuid: string) {
  const first = generateRecordIdentity(firstUuid);
  const second = generateRecordIdentity(secondUuid);
  const classificationDifference = classificationRank[second.classification] - classificationRank[first.classification];
  if (classificationDifference !== 0) return classificationDifference;

  const frequencyDifference = (second.traits[0]?.oneIn ?? 1) - (first.traits[0]?.oneIn ?? 1);
  if (frequencyDifference !== 0) return frequencyDifference;
  return firstUuid.localeCompare(secondUuid);
}

