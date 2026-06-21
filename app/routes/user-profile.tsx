import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { data, Form, Link, redirect, useNavigation } from "react-router";

import type { Route } from "./+types/user-profile";
import { Avatar } from "../components/Avatar";
import { RecordCard } from "../components/RecordCard";
import { ThemeToggle } from "../components/ThemeToggle";
import { BountySpecimenTrophy } from "../components/BountySpecimenTrophy";
import { createDb } from "../db/client.server";
import { records, users } from "../db/schema";
import { getCurrentUser, normalizeUsername, requireUser, toPublicCurrentUser } from "../services/auth.server";
import { getCloudflareEnv } from "../services/cloudflare.server";
import { formatBountyPrompt, type BountyRuleType } from "../services/bounty";
import { getSocialSummary, setFollowing } from "../services/social.server";
import { deriveClaimSpecimenDistinction, type BountySpecimenDistinction } from "../services/bounty-specimen";

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
      deletedAt: users.deletedAt,
    }).from(users).where(and(eq(users.username, username), isNull(users.suspendedAt))).limit(1),
  ]);
  const [profile] = profileRows;
  if (!profile) throw new Response("Not Found", { status: 404, statusText: "Not Found" });

  const [profileRecords, trophyResult, social] = await Promise.all([db.select({
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
      `SELECT c.id AS claim_id, c.bounty_id, c.record_id_a, c.record_id_b,
              b.cadence, b.rule_type, b.character, b.target_value, c.claimed_at,
              count(*) OVER () AS trophy_count
       FROM bounty_claims c JOIN bounties b ON b.id = c.bounty_id
       WHERE c.user_id = ? ORDER BY c.claimed_at DESC LIMIT 12`,
    ).bind(profile.id).all<{
      cadence: "daily" | "weekly"; rule_type: BountyRuleType; character: string | null;
      target_value: number; claimed_at: number; trophy_count: number;
      claim_id: string; bounty_id: string; record_id_a: string; record_id_b: string | null;
    }>(), getSocialSummary(env.DB, profile.id, currentUser?.id ?? null)]);

  return {
    currentUser: toPublicCurrentUser(currentUser),
    isOwner: currentUser?.id === profile.id,
    profile: {
      username: profile.username,
      displayName: profile.displayName || profile.username,
      status: profile.status,
      bio: profile.bio,
      hasAvatar: Boolean(profile.avatarKey),
      createdAt: profile.createdAt.toISOString(),
      deleted: Boolean(profile.deletedAt),
      followers: social.followers,
      following: social.following,
      isFollowing: social.isFollowing,
    },
    trophies: trophyResult.results.map((trophy) => ({
      claimId: trophy.claim_id,
      cadence: trophy.cadence,
      prompt: formatBountyPrompt({ ruleType: trophy.rule_type, character: trophy.character, targetValue: trophy.target_value }),
      claimedAt: new Date(trophy.claimed_at).toISOString(),
      specimenDistinction: deriveClaimSpecimenDistinction(
        trophy.bounty_id,
        trophy.record_id_a,
        trophy.record_id_b,
      ),
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

export async function action({ request, context, params }: Route.ActionArgs) {
  const currentUser = await requireUser(request, context);
  const username = normalizeUsername(params.username ?? "");
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  if (intent !== "follow" && intent !== "unfollow") {
    return data({ error: "Choose a valid action." }, { status: 400 });
  }

  const error = await setFollowing({
    db: getCloudflareEnv(context).DB,
    followerId: currentUser.id,
    targetUsername: username,
    following: intent === "follow",
  });
  if (error) return data({ error }, { status: 400 });
  return redirect(`/user/${username}`);
}

export default function UserProfile({ loaderData, actionData }: Route.ComponentProps) {
  const { currentUser, isOwner, profile, records, trophies, trophyCount } = loaderData;
  const navigation = useNavigation();
  const isUpdatingFollow = navigation.state === "submitting";
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
              {isOwner ? <Link className="btn btn-outline btn-sm" to="/profile">Edit profile</Link> : currentUser && !profile.deleted ? (
                <Form method="post">
                  <input name="intent" type="hidden" value={profile.isFollowing ? "unfollow" : "follow"} />
                  <button className={`btn btn-sm ${profile.isFollowing ? "btn-outline" : "btn-primary"}`} disabled={isUpdatingFollow}>
                    {isUpdatingFollow ? "Updating..." : profile.isFollowing ? "Unfollow" : "Follow"}
                  </button>
                </Form>
              ) : null}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{profile.displayName}</h1>
              <p className="text-sm text-base-content/50">@{profile.username}</p>
            </div>
            {profile.deleted && <div className="alert text-sm"><span className="badge badge-error">Deleted account</span><span>This profile is retained as read-only history.</span></div>}
            {profile.status && <div className="badge badge-primary badge-outline">{profile.status}</div>}
            {profile.bio && <p className="whitespace-pre-wrap leading-relaxed">{profile.bio}</p>}
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <Link className="link link-hover" to={`/user/${profile.username}/graph?view=followers`}><strong>{profile.followers}</strong> followers</Link>
              <Link className="link link-hover" to={`/user/${profile.username}/graph?view=following`}><strong>{profile.following}</strong> following</Link>
              <Link className="link text-primary" to={`/user/${profile.username}/graph`}>View social graph</Link>
            </div>
            {actionData?.error && <div className="alert alert-error text-sm py-2" role="alert"><span>{actionData.error}</span></div>}
            <p className="text-xs text-base-content/40">Joined {new Date(profile.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}</p>
          </div>
        </section>
        <section className="card bg-base-100 shadow mb-4">
          <div className="px-4 py-3 border-b border-base-200 flex items-center justify-between">
            <h2 className="font-bold text-sm">Bounty trophies</h2>
            <span className="badge badge-primary">{trophyCount}</span>
          </div>
          {trophies.length === 0 ? <div className="card-body py-6 text-sm text-base-content/40">No UUID bounties claimed yet.</div> : <div className="card-body p-4 gap-2">{trophies.map((trophy) => <ProfileTrophy key={trophy.claimId} trophy={trophy} />)}</div>}
        </section>
        <section className="card bg-base-100 shadow">
          <div className="px-4 py-3 border-b border-base-200"><h2 className="font-bold text-sm">Records</h2></div>
          {records.length === 0 ? <div className="card-body items-center py-12 text-center"><p className="text-base-content/40">No records yet.</p></div> : records.map((record, index) => <RecordCard key={record.id} record={record} className={index < records.length - 1 ? "border-b border-base-200" : ""} />)}
        </section>
      </main>
    </div>
  );
}

type ProfileTrophyData = {
  claimId: string;
  cadence: "daily" | "weekly";
  prompt: string;
  claimedAt: string;
  specimenDistinction: BountySpecimenDistinction | null;
};

function ProfileTrophy({ trophy }: { trophy: ProfileTrophyData }) {
  return <article className="rounded-box border border-base-300 p-3"><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><span aria-hidden="true" className="text-primary">◆</span><span className="badge badge-ghost badge-sm capitalize">{trophy.cadence}</span></div><Link className="link text-[0.65rem]" to={`/claim/${trophy.claimId}`}>View claim</Link></div><p className="text-xs mt-2">{trophy.prompt}</p>{trophy.specimenDistinction && <BountySpecimenTrophy claimId={trophy.claimId} distinction={trophy.specimenDistinction} variant="compact" />}</article>;
}
