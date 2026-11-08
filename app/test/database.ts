import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function createTestDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  const migrations = fileURLToPath(new URL("../../migrations/", import.meta.url));
  for (const file of readdirSync(migrations).filter((name) => name.endsWith(".sql")).sort()) {
    sqlite.exec(readFileSync(`${migrations}/${file}`, "utf8"));
  }
  function prepare(sql: string) {
    const statement = sqlite.prepare(sql);
    let bindings: SQLInputValue[] = [];
    return {
      bind(...values: SQLInputValue[]) { bindings = values; return this; },
      async first() { return statement.get(...bindings) ?? null; },
      async all() { return { results: statement.all(...bindings) }; },
      async run() {
        // D1 includes changes made by triggers, unlike StatementSync.run().changes.
        const before = Number(sqlite.prepare("SELECT total_changes() AS total").get()!.total);
        statement.run(...bindings);
        const after = Number(sqlite.prepare("SELECT total_changes() AS total").get()!.total);
        return { meta: { changes: after - before } };
      },
    };
  }
  const db = {
    prepare,
    async batch(statements: ReturnType<typeof prepare>[]) {
      sqlite.exec("BEGIN");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  } as unknown as D1Database;
  return { sqlite, db };
}

export function addUser(sqlite: DatabaseSync, id: string) {
  sqlite.prepare("INSERT INTO users (id, uuid_hash, username, created_at, updated_at) VALUES (?, ?, ?, 1, 1)")
    .run(id, `hash-${id}`, id);
}

export function addRecord(sqlite: DatabaseSync, userId: string, body: string, options: {
  id?: string; createdAt?: number; parentId?: string; deletedAt?: number;
} = {}) {
  const id = options.id ?? crypto.randomUUID();
  sqlite.prepare("INSERT INTO records (id, user_id, body, created_at, parent_record_id, deleted_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, userId, body, options.createdAt ?? 1, options.parentId ?? null, options.deletedAt ?? null);
  return id;
}
