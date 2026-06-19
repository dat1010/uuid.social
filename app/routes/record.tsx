import { and, eq, isNull } from "drizzle-orm";
import { Form, Link } from "react-router";

import type { Route } from "./+types/record";
import { RecordCard } from "../components/RecordCard";
import { ThemeToggle } from "../components/ThemeToggle";
import { createDb } from "../db/client.server";
import { records, users } from "../db/schema";
import { getCurrentUser, validateUuid } from "../services/auth.server";
import { getCloudflareEnv } from "../services/cloudflare.server";

export function meta({ data }: Route.MetaArgs) {
  const title = data?.record.id
    ? `Record ${data.record.id} | uuid.social`
    : "Record | uuid.social";

  return [
    { title },
    { name: "description", content: "A record on uuid.social." },
  ];
}

export function headers() {
  return { "Cache-Control": "private, no-store" };
}

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const uuid = params.uuid?.toLowerCase();
  if (!uuid || !validateUuid(uuid)) {
    throw new Response("Not Found", { status: 404, statusText: "Not Found" });
  }

  const env = getCloudflareEnv(context);
  const db = createDb(env.DB);
  const [currentUser, recordRows] = await Promise.all([
    getCurrentUser(request, context),
    db
      .select({
        id: records.id,
        username: users.username,
        displayName: users.displayName,
        body: records.body,
        createdAt: records.createdAt,
      })
      .from(records)
      .innerJoin(users, eq(records.userId, users.id))
      .where(and(eq(records.id, uuid), isNull(records.deletedAt)))
      .limit(1),
  ]);
  const [record] = recordRows;

  if (!record) {
    throw new Response("Not Found", { status: 404, statusText: "Not Found" });
  }

  return {
    currentUser,
    record: {
      ...record,
      displayName: record.displayName || record.username,
      createdAt: record.createdAt.toISOString(),
    },
  };
}

export default function Record({ loaderData }: Route.ComponentProps) {
  const { currentUser, record } = loaderData;
  const homeUrl = currentUser ? "/home" : "/";

  return (
    <div className="min-h-screen bg-base-200">
      <header className="navbar bg-base-100 shadow-sm px-4 lg:px-8">
        <div className="navbar-start">
          <Link
            to={homeUrl}
            className="font-bold tracking-widest uppercase text-sm"
          >
            uuid.social
          </Link>
        </div>
        <div className="navbar-end gap-2">
          <ThemeToggle />
          {currentUser ? (
            <>
              <Link className="btn btn-ghost btn-sm" to="/home">
                Home
              </Link>
              <Form action="/logout" method="post">
                <button className="btn btn-ghost btn-sm" type="submit">
                  Logout
                </button>
              </Form>
            </>
          ) : (
            <>
              <Link className="btn btn-ghost btn-sm" to="/login">
                Sign in
              </Link>
              <Link className="btn btn-primary btn-sm" to="/signup">
                Sign up
              </Link>
            </>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 lg:px-8">
        <div className="card bg-base-100 shadow">
          <RecordCard record={record} />
        </div>
      </main>
    </div>
  );
}
