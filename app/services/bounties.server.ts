import {
  matchesCharacterCount,
  matchesEventGap,
  type BountyRuleType,
} from "./bounty";

type RecordCandidate = {
  id: string;
  event_number: number;
};

export async function claimBounty(db: D1Database, input: {
  bountyId: string;
  userId: string;
  recordIdA: string;
  recordIdB: string | null;
  now: number;
}) {
  const bounty = await db.prepare(`SELECT b.*, c.id AS claim_id FROM bounties b
    LEFT JOIN bounty_claims c ON c.bounty_id = b.id WHERE b.id = ?`)
    .bind(input.bountyId).first<{
      id: string; starts_at: number; ends_at: number; claim_id: string | null;
      rule_type: BountyRuleType; character: string | null; target_value: number;
    }>();
  if (!bounty || bounty.starts_at > input.now || bounty.ends_at <= input.now) return "That bounty is not active.";
  if (bounty.claim_id) return "Someone already claimed this bounty.";

  const recordA = await findPublicRecord(db, input.recordIdA);
  if (!recordA) return "The first UUID is not a public record.";
  if (bounty.rule_type === "character_count") {
    if (input.recordIdB) return "This bounty accepts exactly one record UUID.";
    if (!bounty.character || !matchesCharacterCount(recordA.id, bounty.character, bounty.target_value)) {
      return "Those UUIDs do not match the bounty.";
    }
  } else {
    if (!input.recordIdB || input.recordIdA === input.recordIdB) return "This bounty requires two different record UUIDs.";
    const recordB = await findPublicRecord(db, input.recordIdB);
    if (!recordB) return "The second UUID is not a public record.";
    if (!matchesEventGap(recordA.event_number, recordB.event_number, bounty.target_value)) {
      return "Those UUIDs do not match the bounty.";
    }
  }

  const claimId = crypto.randomUUID();
  const answerId = crypto.randomUUID();
  const recordAConnectionId = crypto.randomUUID();
  const statements = [
    db.prepare(`INSERT OR IGNORE INTO bounty_claims
      (id, bounty_id, user_id, record_id_a, record_id_b, claimed_at)
      SELECT ?, id, ?, ?, ?, ? FROM bounties
      WHERE id = ? AND starts_at <= ? AND ends_at > ?`)
      .bind(claimId, input.userId, input.recordIdA, input.recordIdB, input.now,
        input.bountyId, input.now, input.now),
    systemConnectionFromClaim(db, answerId, claimId, "bounty_id", "ANSWERS", input.now),
    systemConnectionFromClaim(db, recordAConnectionId, claimId, "record_id_a", "USES_RECORD", input.now),
  ];
  if (input.recordIdB) {
    statements.push(systemConnectionFromClaim(db, crypto.randomUUID(), claimId, "record_id_b", "USES_RECORD", input.now));
  }
  const [claimResult] = await db.batch(statements);
  if (claimResult.meta.changes < 1) return "Someone else claimed this bounty first.";
  return null;
}

function systemConnectionFromClaim(
  db: D1Database,
  connectionId: string,
  claimId: string,
  targetColumn: "bounty_id" | "record_id_a" | "record_id_b",
  relationship: "ANSWERS" | "USES_RECORD",
  createdAt: number,
) {
  return db.prepare(`INSERT INTO connections
    (id, source_id, target_id, relationship, origin, created_at)
    SELECT ?, id, ${targetColumn}, ?, 'system', ? FROM bounty_claims
    WHERE id = ? AND ${targetColumn} IS NOT NULL`)
    .bind(connectionId, relationship, createdAt, claimId);
}

async function findPublicRecord(db: D1Database, id: string) {
  return db.prepare("SELECT id, event_number FROM records WHERE id = ? AND deleted_at IS NULL")
    .bind(id).first<RecordCandidate>();
}
