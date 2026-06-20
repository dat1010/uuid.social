import {
  isManualRelationship,
  objectUrl,
  type ManualRelationship,
  type PublicConnection,
  type PublicObject,
  type PublicObjectType,
  type Relationship,
} from "./connections";
import { formatBountyPrompt, type BountyRuleType } from "./bounty";

type RegistryRow = { id: string; object_type: PublicObjectType; created_at: number };
type ConnectionRow = {
  id: string;
  source_id: string;
  source_type: PublicObjectType;
  target_id: string;
  target_type: PublicObjectType;
  relationship: Relationship;
  origin: "system" | "user";
  creator_username: string | null;
  created_at: number;
  deleted_at: number | null;
};

export async function resolvePublicObject(
  db: D1Database,
  id: string,
): Promise<PublicObject | null> {
  const registry = await db.prepare(
    "SELECT id, object_type, created_at FROM uuid_objects WHERE id = ?",
  ).bind(id).first<RegistryRow>();
  if (!registry) return null;

  if (registry.object_type === "record") return resolveRecord(db, registry);
  if (registry.object_type === "bounty") return resolveBounty(db, registry);
  if (registry.object_type === "claim") return resolveClaim(db, registry);
  return resolveConnection(db, registry);
}

export async function getConnectionLists(db: D1Database, id: string, limit = 10) {
  const [incoming, outgoing, counts] = await Promise.all([
    db.prepare(`${connectionSelect} WHERE c.target_id = ? AND c.deleted_at IS NULL ORDER BY c.created_at DESC LIMIT ?`)
      .bind(id, limit).all<ConnectionRow>(),
    db.prepare(`${connectionSelect} WHERE c.source_id = ? AND c.deleted_at IS NULL ORDER BY c.created_at DESC LIMIT ?`)
      .bind(id, limit).all<ConnectionRow>(),
    db.prepare(`SELECT
      sum(CASE WHEN target_id = ? THEN 1 ELSE 0 END) AS incoming,
      sum(CASE WHEN source_id = ? THEN 1 ELSE 0 END) AS outgoing
      FROM connections WHERE deleted_at IS NULL AND (target_id = ? OR source_id = ?)`)
      .bind(id, id, id, id).first<{ incoming: number | null; outgoing: number | null }>(),
  ]);
  return {
    incoming: incoming.results.map(toPublicConnection),
    outgoing: outgoing.results.map(toPublicConnection),
    counts: { incoming: Number(counts?.incoming ?? 0), outgoing: Number(counts?.outgoing ?? 0) },
  };
}

export async function getGraphNeighborhood(db: D1Database, id: string) {
  const center = await resolvePublicObject(db, id);
  if (!center) return null;
  const lists = await getConnectionLists(db, id, 13);
  const incoming = lists.incoming.slice(0, 12);
  const outgoing = lists.outgoing.slice(0, 12);
  const connections = [...incoming, ...outgoing];

  if (center.type === "connection" && !center.deleted) {
    const own = await getConnectionById(db, center.id);
    if (own && !connections.some((connection) => connection.id === own.id)) connections.push(own);
  }

  const ids = new Set<string>([center.id]);
  for (const connection of connections) {
    ids.add(connection.id);
    ids.add(connection.sourceId);
    ids.add(connection.targetId);
  }
  const nodes = (await Promise.all([...ids].map((nodeId) => resolvePublicObject(db, nodeId))))
    .filter((node): node is PublicObject => Boolean(node));

  return {
    center,
    nodes,
    connections,
    counts: lists.counts,
    truncated: lists.incoming.length > 12 || lists.outgoing.length > 12,
  };
}

export async function createManualConnection(input: {
  db: D1Database;
  creatorUserId: string;
  sourceId: string;
  targetId: string;
  relationship: string;
}) {
  const { db, creatorUserId, sourceId, targetId, relationship } = input;
  if (!isManualRelationship(relationship)) return { error: "Choose a valid relationship." };
  if (sourceId === targetId) return { error: "An object cannot connect to itself." };

  const [source, target] = await Promise.all([
    resolvePublicObject(db, sourceId),
    resolvePublicObject(db, targetId),
  ]);
  if (!source || !target) return { error: "Both UUIDs must identify public objects." };
  if (source.deleted || target.deleted) return { error: "Deleted objects cannot form new connections." };
  if (relationship === "CORRECTS" && (source.type !== "record" || target.type !== "record")) {
    return { error: "CORRECTS is only valid between two records." };
  }

  const id = crypto.randomUUID();
  try {
    await db.prepare(`INSERT INTO connections
      (id, source_id, target_id, relationship, origin, creator_user_id, created_at)
      VALUES (?, ?, ?, ?, 'user', ?, ?)`)
      .bind(id, sourceId, targetId, relationship, creatorUserId, Date.now()).run();
    return { id };
  } catch (error) {
    if (String(error).includes("UNIQUE")) return { error: "You already made that connection." };
    throw error;
  }
}

export async function deleteManualConnection(db: D1Database, id: string, userId: string) {
  const result = await db.prepare(`UPDATE connections SET deleted_at = ?
    WHERE id = ? AND origin = 'user' AND creator_user_id = ? AND deleted_at IS NULL`)
    .bind(Date.now(), id, userId).run();
  return result.meta.changes === 1;
}

export async function createReply(
  db: D1Database,
  input: { id: string; userId: string; parentId: string; body: string; createdAt: number },
) {
  const connectionId = crypto.randomUUID();
  await db.batch([
    db.prepare(`INSERT INTO records (id, user_id, parent_record_id, body, created_at)
      VALUES (?, ?, ?, ?, ?)`).bind(input.id, input.userId, input.parentId, input.body, input.createdAt),
    db.prepare(`INSERT INTO connections
      (id, source_id, target_id, relationship, origin, created_at)
      VALUES (?, ?, ?, 'REPLIES_TO', 'system', ?)`)
      .bind(connectionId, input.id, input.parentId, input.createdAt),
  ]);
}

async function getConnectionById(db: D1Database, id: string) {
  const row = await db.prepare(`${connectionSelect} WHERE c.id = ? AND c.deleted_at IS NULL`)
    .bind(id).first<ConnectionRow>();
  return row ? toPublicConnection(row) : null;
}

async function resolveRecord(db: D1Database, registry: RegistryRow): Promise<PublicObject> {
  const row = await db.prepare(`SELECT r.body, r.deleted_at, u.username
    FROM records r JOIN users u ON u.id = r.user_id WHERE r.id = ?`)
    .bind(registry.id).first<{ body: string; deleted_at: number | null; username: string }>();
  const deleted = Boolean(row?.deleted_at);
  return object(registry, deleted, deleted ? "Deleted record" : "Record", deleted ? null : row?.body ?? null, deleted ? null : row?.username ?? null);
}

async function resolveBounty(db: D1Database, registry: RegistryRow): Promise<PublicObject> {
  const row = await db.prepare(`SELECT cadence, rule_type, character, target_value, ends_at
    FROM bounties WHERE id = ?`).bind(registry.id).first<{
      cadence: string; rule_type: BountyRuleType; character: string | null; target_value: number; ends_at: number;
    }>();
  return object(registry, false, `${capitalize(row?.cadence ?? "UUID")} bounty`, row ? formatBountyPrompt({
    ruleType: row.rule_type, character: row.character, targetValue: row.target_value,
  }) : null, null);
}

async function resolveClaim(db: D1Database, registry: RegistryRow): Promise<PublicObject> {
  const row = await db.prepare(`SELECT b.cadence, u.username FROM bounty_claims c
    JOIN bounties b ON b.id = c.bounty_id JOIN users u ON u.id = c.user_id WHERE c.id = ?`)
    .bind(registry.id).first<{ cadence: string; username: string }>();
  return object(registry, false, "Bounty claim", row ? `Claimed a ${row.cadence} UUID bounty.` : null, row?.username ?? null);
}

async function resolveConnection(db: D1Database, registry: RegistryRow): Promise<PublicObject> {
  const row = await db.prepare(`SELECT relationship, deleted_at, u.username FROM connections c
    LEFT JOIN users u ON u.id = c.creator_user_id WHERE c.id = ?`)
    .bind(registry.id).first<{ relationship: Relationship; deleted_at: number | null; username: string | null }>();
  const deleted = Boolean(row?.deleted_at);
  return object(registry, deleted, deleted ? "Deleted connection" : row?.relationship ?? "Connection", null, deleted ? null : row?.username ?? null);
}

function object(registry: RegistryRow, deleted: boolean, title: string, preview: string | null, attribution: string | null): PublicObject {
  return {
    id: registry.id, type: registry.object_type, deleted, title, preview, attribution,
    createdAt: new Date(registry.created_at).toISOString(),
    url: objectUrl(registry.object_type, registry.id),
  };
}

function toPublicConnection(row: ConnectionRow): PublicConnection {
  return {
    id: row.id, sourceId: row.source_id, sourceType: row.source_type,
    targetId: row.target_id, targetType: row.target_type,
    relationship: row.relationship, origin: row.origin,
    creatorUsername: row.creator_username,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const connectionSelect = `SELECT c.id, c.source_id, source.object_type AS source_type,
  c.target_id, target.object_type AS target_type, c.relationship, c.origin,
  u.username AS creator_username, c.created_at, c.deleted_at
  FROM connections c
  JOIN uuid_objects source ON source.id = c.source_id
  JOIN uuid_objects target ON target.id = c.target_id
  LEFT JOIN users u ON u.id = c.creator_user_id`;
