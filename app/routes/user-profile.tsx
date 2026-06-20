import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { Form, Link } from "react-router";

import type { Route } from "./+types/user-profile";
import { Avatar } from "../components/Avatar";
import { RecordCard } from "../components/RecordCard";
import { ThemeToggle } from "../components/ThemeToggle";
import { createDb } from "../db/client.server";
import { records, users } from "../db/schema";
import { getCurrentUser, normalizeUsername } from "../services/auth.server";
import { getCloudflareEnv } from "../services/cloudflare.server";
import { formatBountyPrompt, type BountyRuleType } from "../services/bounty";

export function meta({ data }: Route.MetaArgs) {
  const name = data?.profile.displayName ?? "Profile";
  return [
    { title: `${name} | uuid.social` },
    { name: "description", content: data?.profile.bio ?? `${name}'s profile on uuid.social.` },
  ];
}

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const env = getCloudflareEnv(context);
  const db = createDb(env.DB);
  const username = normalizeUsername(params.username ?? "");
  const [currentUser, profileRows] = await Promise.all([
    getCurrentUser(request, context),
    db.select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      status: users.status,
      bio: users.bio,
      avatarKey: users.avatarKey,
      createdAt: users.createdAt,
    }).from(users).where(and(eq(users.username, username), isNull(users.suspendedAt))).limit(1),
  ]);
  const [profile] = profileRows;
  if (!profile) throw new Response("Not Found", { status: 404, statusText: "Not Found" });

  const [profileRecords, trophyResult] = await Promise.all([db.select({
    id: records.id,
    username: users.username,
    displayName: users.displayName,
    avatarKey: users.avatarKey,
    body: records.body,
    eventNumber: records.eventNumber,
    createdAt: records.createdAt,
    replyCount: sql<number>`(
      select count(*) from records as replies
      where replies.parent_record_id = ${records.id} and replies.deleted_at is null
    )`,
  }).from(records)
    .innerJoin(users, eq(records.userId, users.id))
    .where(and(eq(records.userId, profile.id), isNull(records.deletedAt), isNull(records.parentRecordId)))
    .orderBy(desc(records.createdAt)).limit(50), env.DB.prepare(
      `SELECT b.cadence, b.rule_type, b.character, b.target_value, c.claimed_at,
              count(*) OVER () AS trophy_count
       FROM bounty_claims c JOIN bounties b ON b.id = c.bounty_id
       WHERE c.user_id = ? ORDER BY c.claimed_at DESC LIMIT 12`,
    ).bind(profile.id).all<{
      cadence: "daily" | "weekly"; rule_type: BountyRuleType; character: string | null;
      target_value: number; claimed_at: number; trophy_count: number;
    }>()]);

  return {
    currentUser,
    isOwner: currentUser?.id === profile.id,
    profile: {
      username: profile.username,
      displayName: profile.displayName || profile.username,
      status: profile.status,
      bio: profile.bio,
      hasAvatar: Boolean(profile.avatarKey),
      createdAt: profile.createdAt.toISOString(),
    },
    trophies: trophyResult.results.map((trophy) => ({
      cadence: trophy.cadence,
      prompt: formatBountyPrompt({ ruleType: trophy.rule_type, character: trophy.character, targetValue: trophy.target_value }),
      claimedAt: new Date(trophy.claimed_at).toISOString(),
    })),
    trophyCount: trophyResult.results[0]?.trophy_count ?? 0,
    records: profileRecords.map((record) => ({
      ...record,
      displayName: record.displayName || record.username,
      hasAvatar: Boolean(record.avatarKey),
      createdAt: record.createdAt.toISOString(),
      replyCount: Number(record.replyCount),
    })),
  };
}

export default function UserProfile({ loaderData }: Route.ComponentProps) {
  const { currentUser, isOwner, profile, records, trophies, trophyCount } = loaderData;
  return (
    <div className="min-h-screen bg-base-200">
      <header className="navbar bg-base-100 shadow-sm px-4 lg:px-8">
        <div className="navbar-start"><Link className="font-bold tracking-widest uppercase text-sm" to={currentUser ? "/home" : "/"}>uuid.social</Link></div>
        <div className="navbar-end gap-2">
          <ThemeToggle />
          <Link className="btn btn-ghost btn-sm" to="/bounties">Bounties</Link>
          {currentUser ? <><Link className="btn btn-ghost btn-sm" to="/home">Home</Link><Form action="/logout" method="post"><button className="btn btn-ghost btn-sm">Logout</button></Form></> : <Link className="btn btn-primary btn-sm" to="/login">Sign in</Link>}
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-6 lg:px-8">
        <section className="card bg-base-100 shadow mb-4">
          <div className="card-body gap-4">
            <div className="flex items-start justify-between gap-4">
              <Avatar {...profile} size="lg" />
              {isOwner && <Link className="btn btn-outline btn-sm" to="/profile">Edit profile</Link>}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{profile.displayName}</h1>
              <p className="text-sm text-base-content/50">@{profile.username}</p>
            </div>
            {profile.status && <div className="badge badge-primary badge-outline">{profile.status}</div>}
            {profile.bio && <p className="whitespace-pre-wrap leading-relaxed">{profile.bio}</p>}
            <p className="text-xs text-base-content/40">Joined {new Date(profile.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}</p>
          </div>
        </section>
        <section className="card bg-base-100 shadow mb-4">
          <div className="px-4 py-3 border-b border-base-200 flex items-center justify-between">
            <h2 className="font-bold text-sm">Bounty trophies</h2>
            <span className="badge badge-primary">{trophyCount}</span>
          </div>
          {trophies.length === 0 ? <div className="card-body py-6 text-sm text-base-content/40">No UUID bounties claimed yet.</div> : <div className="card-body p-4 gap-2">{trophies.map((trophy, index) => <div className="rounded-box border border-base-300 p-3" key={`${trophy.claimedAt}-${index}`}><div className="flex items-center gap-2"><span aria-hidden="true" className="text-primary">◆</span><span className="badge badge-ghost badge-sm capitalize">{trophy.cadence}</span></div><p className="text-xs mt-2">{trophy.prompt}</p></div>)}</div>}
        </section>
        <section className="card bg-base-100 shadow">
          <div className="px-4 py-3 border-b border-base-200"><h2 className="font-bold text-sm">Records</h2></div>
          {records.length === 0 ? <div className="card-body items-center py-12 text-center"><p className="text-base-content/40">No records yet.</p></div> : records.map((record, index) => <RecordCard key={record.id} record={record} className={index < records.length - 1 ? "border-b border-base-200" : ""} />)}
        </section>
      </main>
    </div>
  );
}
