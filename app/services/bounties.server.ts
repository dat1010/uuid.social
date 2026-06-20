import { getBountyPeriod, type BountyCadence } from "./bounty";

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
