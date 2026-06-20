import {
  getBountyPeriod,
  matchesCharacterCount,
  matchesEventGap,
  type BountyCadence,
  type BountyRuleType,
} from "./bounty";

type DailyCandidate = {
  character: string;
  targetValue: number;
};

type RecordCandidate = {
  id: string;
  event_number: number;
};

const dailyCandidates: DailyCandidate[] = [
  ...["a", "b", "c", "d", "e", "f"].flatMap((character) =>
    [4, 3, 5, 2].map((targetValue) => ({ character, targetValue })),
  ),
];
const weeklyGaps = [1000, 500, 100, 50, 10];

export async function ensureCurrentBounties(db: D1Database, now = new Date()) {
  await Promise.all([
    ensureBounty(db, "daily", now),
    ensureBounty(db, "weekly", now),
  ]);
}

async function ensureBounty(
  db: D1Database,
  cadence: BountyCadence,
  now: Date,
) {
  const { startsAt, endsAt } = getBountyPeriod(cadence, now);
  const existing = await db
    .prepare("SELECT id FROM bounties WHERE cadence = ? AND starts_at = ?")
    .bind(cadence, startsAt.getTime())
    .first<{ id: string }>();
  if (existing) return;

  const candidate =
    cadence === "daily"
      ? await findDailyCandidate(db, startsAt)
      : await findWeeklyCandidate(db, startsAt);
  if (!candidate) return;

  await db
    .prepare(
      `INSERT OR IGNORE INTO bounties (
        id, cadence, rule_type, character, target_value, starts_at, ends_at,
        sample_record_id_a, sample_record_id_b, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      cadence,
      cadence === "daily" ? "character_count" : "event_gap",
      "character" in candidate ? candidate.character : null,
      candidate.targetValue,
      startsAt.getTime(),
      endsAt.getTime(),
      candidate.recordA.id,
      candidate.recordB?.id ?? null,
      now.getTime(),
    )
    .run();
}

async function findDailyCandidate(db: D1Database, startsAt: Date) {
  const ordered = rotate(dailyCandidates, periodSeed(startsAt));

  for (const candidate of ordered) {
    const record = await db
      .prepare(
        `SELECT id, event_number FROM records
         WHERE deleted_at IS NULL
           AND length(replace(lower(id), '-', ''))
             - length(replace(replace(lower(id), '-', ''), ?, '')) = ?
         ORDER BY event_number LIMIT 1`,
      )
      .bind(candidate.character, candidate.targetValue)
      .first<RecordCandidate>();
    if (record) return { ...candidate, recordA: record, recordB: null };
  }

  return null;
}

async function findWeeklyCandidate(db: D1Database, startsAt: Date) {
  const ordered = rotate(weeklyGaps, periodSeed(startsAt));

  for (const targetValue of ordered) {
    const pair = await db
      .prepare(
        `SELECT a.id AS record_a_id, a.event_number AS event_a,
                b.id AS record_b_id, b.event_number AS event_b
         FROM records a
         JOIN records b ON b.event_number = a.event_number + ?
         WHERE a.deleted_at IS NULL AND b.deleted_at IS NULL
         ORDER BY a.event_number LIMIT 1`,
      )
      .bind(targetValue)
      .first<{
        record_a_id: string;
        event_a: number;
        record_b_id: string;
        event_b: number;
      }>();
    if (pair) {
      return {
        targetValue,
        recordA: { id: pair.record_a_id, event_number: pair.event_a },
        recordB: { id: pair.record_b_id, event_number: pair.event_b },
      };
    }
  }

  return null;
}

function periodSeed(date: Date) {
  return Math.floor(date.getTime() / 86_400_000);
}

function rotate<T>(values: T[], seed: number) {
  const offset = seed % values.length;
  return [...values.slice(offset), ...values.slice(0, offset)];
}

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
  if (claimResult.meta.changes !== 1) return "Someone else claimed this bounty first.";
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
