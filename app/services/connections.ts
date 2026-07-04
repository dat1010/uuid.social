export const manualRelationships = [
  "REFERENCES",
  "SUPPORTS",
  "DISPUTES",
  "CORRECTS",
] as const;

export type ManualRelationship = (typeof manualRelationships)[number];
export type Relationship =
  | "REPLIES_TO"
  | "ANSWERS"
  | "USES_RECORD"
  | ManualRelationship;
export type PublicObjectType = "record" | "bounty" | "claim" | "connection";

export type PublicObject = {
  id: string;
  type: PublicObjectType;
  deleted: boolean;
  title: string;
  preview: string | null;
  attribution: string | null;
  createdAt: string;
  url: string;
};

export type PublicConnection = {
  id: string;
  sourceId: string;
  sourceType: PublicObjectType;
  targetId: string;
  targetType: PublicObjectType;
  relationship: Relationship;
  origin: "system" | "user";
  creatorUsername: string | null;
  createdAt: string;
};

export type GraphNeighborhood = {
  center: PublicObject;
  nodes: PublicObject[];
  connections: PublicConnection[];
  counts: { incoming: number; outgoing: number };
  truncated: boolean;
};

export const relationshipLabels: Record<Relationship, string> = {
  REPLIES_TO: "replies to",
  ANSWERS: "answers",
  USES_RECORD: "uses record",
  REFERENCES: "references",
  SUPPORTS: "supports",
  DISPUTES: "disputes",
  CORRECTS: "corrects",
};

export function isManualRelationship(value: string): value is ManualRelationship {
  return manualRelationships.includes(value as ManualRelationship);
}

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function truncateUuid(id: string) {
  if (typeof id !== "string" || !UUID_V4.test(id)) {
    throw new TypeError("truncateUuid requires a canonical lowercase UUIDv4.");
  }

  return id.slice(0, 8);
}

export function shortUuid(id: string) {
  return `${id.slice(0, 5)}...${id.slice(-4)}`;
}

export function objectUrl(type: PublicObjectType, id: string) {
  return `/${type}/${id}`;
}
