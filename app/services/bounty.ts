export type BountyCadence = "daily" | "weekly";
export type BountyRuleType = "character_count" | "event_gap";

export type BountyRule = {
  ruleType: BountyRuleType;
  character: string | null;
  targetValue: number;
};

export function countUuidCharacter(uuid: string, character: string) {
  const normalized = uuid.toLowerCase().replaceAll("-", "");
  const target = character.toLowerCase();
  return [...normalized].filter((value) => value === target).length;
}

export function matchesCharacterCount(
  uuid: string,
  character: string,
  targetValue: number,
) {
  return countUuidCharacter(uuid, character) === targetValue;
}

export function matchesEventGap(
  firstEventNumber: number,
  secondEventNumber: number,
  targetValue: number,
) {
  return Math.abs(firstEventNumber - secondEventNumber) === targetValue;
}

export function formatBountyPrompt(rule: BountyRule) {
  if (rule.ruleType === "character_count") {
    return `Find a record UUID where "${rule.character}" appears exactly ${rule.targetValue} times.`;
  }

  return `Locate two record UUIDs born exactly ${rule.targetValue.toLocaleString("en-US")} events apart.`;
}
