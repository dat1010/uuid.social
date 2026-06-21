import {
  generateRecordIdentity,
  type RecordClassification,
  type RecordIdentity,
} from "./record-identity";

export type SpecimenTrophyTier = Extract<
  RecordClassification,
  "rare" | "exceptional" | "singular"
>;

export type BountySpecimenDistinction = {
  tier: SpecimenTrophyTier;
  approximateOneIn: number;
  bountySpecimen: { uuid: string; identity: RecordIdentity };
  specimens: Array<{ uuid: string; identity: RecordIdentity }>;
};

export function deriveBountySpecimenDistinction(
  bountyId: string,
  recordIds: [string] | [string, string],
): BountySpecimenDistinction | null {
  const specimens = recordIds.map((uuid) => ({
    uuid,
    identity: generateRecordIdentity(uuid),
  }));
  const tiers = specimens.map(({ identity }) => identity.classification);

  if (!tiers.every(isSpecimenTrophyTier)) return null;

  const bountySpecimen = {
    uuid: bountyId,
    identity: generateRecordIdentity(bountyId),
  };
  const weakestRecordOneIn = Math.min(
    ...specimens.map(({ identity }) => identity.traits[0].oneIn),
  );
  const approximateOneIn = weakestRecordOneIn
    * bountySpecimen.identity.traits[0].oneIn;

  return {
    tier: trophyTierForFrequency(approximateOneIn),
    approximateOneIn,
    bountySpecimen,
    specimens,
  };
}

export function deriveClaimSpecimenDistinction(
  bountyId: string,
  recordIdA: string | null,
  recordIdB: string | null,
) {
  if (!recordIdA) return null;
  return recordIdB
    ? deriveBountySpecimenDistinction(bountyId, [recordIdA, recordIdB])
    : deriveBountySpecimenDistinction(bountyId, [recordIdA]);
}

function trophyTierForFrequency(oneIn: number): SpecimenTrophyTier {
  if (oneIn > 2_500) return "singular";
  if (oneIn > 250) return "exceptional";
  return "rare";
}

function isSpecimenTrophyTier(
  classification: RecordClassification,
): classification is SpecimenTrophyTier {
  return classification === "rare"
    || classification === "exceptional"
    || classification === "singular";
}
