import { data, Form, Link, redirect, useNavigation } from "react-router";

import type { Route } from "./+types/bounties";
import { ThemeToggle } from "../components/ThemeToggle";
import { BountyCountdown } from "../components/BountyCountdown";
import { getCurrentUser, requireUser, toPublicCurrentUser, validateUuid, type PublicCurrentUser } from "../services/auth.server";
import {
  formatBountyPrompt,
  type BountyRuleType,
} from "../services/bounty";
import { claimBounty, ensureCurrentBounties } from "../services/bounties.server";
import { getCloudflareEnv } from "../services/cloudflare.server";

type BountyRow = {
  id: string;
  cadence: "daily" | "weekly";
  rule_type: BountyRuleType;
  character: string | null;
  target_value: number;
  starts_at: number;
  ends_at: number;
  sample_record_id_a: string;
  sample_record_id_b: string | null;
  claim_id: string | null;
  record_id_a: string | null;
  record_id_b: string | null;
  claimed_at: number | null;
  winner_username: string | null;
};

export function meta() {
  return [
    { title: "UUID Bounties | uuid.social" },
    { name: "description", content: "Hunt strange record UUIDs and earn trophies." },
  ];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = getCloudflareEnv(context);
  const now = new Date();
  await ensureCurrentBounties(env.DB, now);
  const currentUser = await getCurrentUser(request, context);
  const url = new URL(request.url);
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = 10;

  const [activeResult, archiveResult] = await Promise.all([
    env.DB.prepare(`${bountySelect} WHERE b.ends_at > ? ORDER BY b.ends_at, b.cadence`)
      .bind(now.getTime())
      .all<BountyRow>(),
    env.DB.prepare(
      `${bountySelect} WHERE b.ends_at <= ? ORDER BY b.ends_at DESC LIMIT ? OFFSET ?`,
    )
      .bind(now.getTime(), pageSize + 1, (page - 1) * pageSize)
      .all<BountyRow>(),
  ]);

  return {
    currentUser: toPublicCurrentUser(currentUser),
    active: activeResult.results.map(toActiveBountyView),
    archive: archiveResult.results.slice(0, pageSize).map(toBountyView),
    page,
    hasNextPage: archiveResult.results.length > pageSize,
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const currentUser = await requireUser(request, context);
  const env = getCloudflareEnv(context);
  const form = await request.formData();
  const bountyId = String(form.get("bountyId") ?? "");
  const recordIdA = String(form.get("recordIdA") ?? "").trim().toLowerCase();
  const recordIdB = String(form.get("recordIdB") ?? "").trim().toLowerCase();
  const now = Date.now();

  if (!validateUuid(recordIdA) || (recordIdB && !validateUuid(recordIdB))) {
    return claimError(bountyId, "Enter complete record UUIDs in canonical format.");
  }

  const error = await claimBounty(env.DB, {
    bountyId, userId: currentUser.id, recordIdA, recordIdB: recordIdB || null, now,
  });
  if (error) return claimError(bountyId, error);

  return redirect("/bounties?claimed=1");
}

export default function Bounties({ loaderData, actionData }: Route.ComponentProps) {
  const { currentUser, active, archive, page, hasNextPage } = loaderData;
  const navigation = useNavigation();

  return (
    <div className="min-h-screen bg-base-200">
      <header className="navbar bg-base-100 shadow-sm px-4 lg:px-8 sticky top-0 z-10">
        <div className="navbar-start">
          <Link className="font-bold tracking-widest uppercase text-sm" to={currentUser ? "/home" : "/"}>uuid.social</Link>
        </div>
        <div className="navbar-end gap-1">
          <ThemeToggle />
          {currentUser ? <Link className="btn btn-ghost btn-sm" to="/home">Home</Link> : <Link className="btn btn-primary btn-sm" to="/login">Sign in</Link>}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 lg:px-8">
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Public record hunt</p>
          <h1 className="text-3xl font-bold mt-2">UUID Bounties</h1>
          <p className="text-sm text-base-content/60 mt-2 max-w-2xl">Find peculiar public record UUIDs. Account login UUIDs are private credentials and never participate.</p>
        </div>

        <section className="grid md:grid-cols-2 gap-4 mb-10">
          {active.length === 0 ? (
            <div className="card bg-base-100 shadow md:col-span-2"><div className="card-body"><p>No solvable bounty is available yet. More records will unlock the hunt.</p></div></div>
          ) : active.map((bounty) => (
            <BountyCard key={bounty.id} bounty={bounty} currentUser={currentUser} actionData={actionData} isSubmitting={navigation.formData?.get("bountyId") === bounty.id} />
          ))}
        </section>

        <section>
          <h2 className="font-bold text-xl mb-4">Bounty archive</h2>
          <div className="card bg-base-100 shadow divide-y divide-base-200">
            {archive.length === 0 ? <div className="card-body text-base-content/50">No retired bounties yet.</div> : archive.map((bounty) => <ArchiveRow key={bounty.id} bounty={bounty} />)}
          </div>
          <div className="flex justify-between mt-4">
            {page > 1 ? <Link className="btn btn-sm btn-outline" to={`?page=${page - 1}`}>Newer</Link> : <span />}
            {hasNextPage && <Link className="btn btn-sm btn-outline" to={`?page=${page + 1}`}>Older</Link>}
          </div>
        </section>
      </main>
    </div>
  );
}

function BountyCard({ bounty, currentUser, actionData, isSubmitting }: { bounty: ReturnType<typeof toActiveBountyView>; currentUser: PublicCurrentUser | null; actionData: { bountyId: string; error: string } | undefined; isSubmitting: boolean }) {
  return (
    <article className="card bg-base-100 shadow border-t-4 border-primary">
      <div className="card-body p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="badge badge-primary badge-outline capitalize">{bounty.cadence}</span>
          <time className="text-xs text-base-content/50" dateTime={bounty.endsAt}><BountyCountdown endsAt={bounty.endsAt} /> · {formatUtc(bounty.endsAt)}</time>
        </div>
        <h2 className="font-bold text-lg leading-snug">{bounty.prompt}</h2>
        <BountyUuid id={bounty.id} />
        {bounty.winnerUsername ? <Winner bounty={bounty} /> : currentUser ? (
          <Form className="flex flex-col gap-3 mt-2" method="post">
            <input type="hidden" name="bountyId" value={bounty.id} />
            <input className="input input-bordered w-full font-mono text-xs" name="recordIdA" placeholder="First record UUID" required />
            {bounty.ruleType === "event_gap" && <input className="input input-bordered w-full font-mono text-xs" name="recordIdB" placeholder="Second record UUID" required />}
            {actionData?.bountyId === bounty.id && <div role="alert" className="alert alert-error text-sm py-2">{actionData.error}</div>}
            <button className="btn btn-primary btn-sm" disabled={isSubmitting}>{isSubmitting ? "Checking..." : "Claim bounty"}</button>
          </Form>
        ) : <Link className="btn btn-primary btn-sm mt-2" to="/login">Sign in to claim</Link>}
      </div>
    </article>
  );
}

function ArchiveRow({ bounty }: { bounty: ReturnType<typeof toBountyView> }) {
  return <article className="p-4">
    <div className="flex flex-wrap items-center gap-2 mb-2"><span className="badge badge-ghost capitalize">{bounty.cadence}</span><span className="text-xs text-base-content/40">Ended {formatUtc(bounty.endsAt)}</span></div>
    <p className="font-semibold text-sm">{bounty.prompt}</p>
    <BountyUuid id={bounty.id} />
    {bounty.winnerUsername ? <Winner bounty={bounty} /> : <p className="text-xs mt-2 text-base-content/60">Unclaimed. Sample answer: <RecordLink id={bounty.sampleRecordIdA} />{bounty.sampleRecordIdB && <> and <RecordLink id={bounty.sampleRecordIdB} /></>}</p>}
  </article>;
}

function Winner({ bounty }: { bounty: Pick<ReturnType<typeof toBountyView>, "winnerUsername" | "recordIdA" | "recordIdB"> }) {
  return <p className="text-sm mt-2">Trophy claimed by <Link className="link font-bold" to={`/user/${bounty.winnerUsername}`}>@{bounty.winnerUsername}</Link> with <RecordLink id={bounty.recordIdA!} />{bounty.recordIdB && <> and <RecordLink id={bounty.recordIdB} /></>}.</p>;
}

function RecordLink({ id }: { id: string }) {
  return <Link className="link font-mono" to={`/record/${id}`}>{id.slice(0, 8)}…</Link>;
}

function BountyUuid({ id }: { id: string }) {
  return <p className="text-[0.65rem] text-base-content/40 break-all">Bounty UUID: <Link className="font-mono select-all link" to={`/bounty/${id}`}>{id}</Link></p>;
}

function toBountyView(row: BountyRow) {
  return {
    id: row.id,
    cadence: row.cadence,
    ruleType: row.rule_type,
    prompt: formatBountyPrompt({ ruleType: row.rule_type, character: row.character, targetValue: row.target_value }),
    startsAt: new Date(row.starts_at).toISOString(),
    endsAt: new Date(row.ends_at).toISOString(),
    sampleRecordIdA: row.sample_record_id_a,
    sampleRecordIdB: row.sample_record_id_b,
    recordIdA: row.record_id_a,
    recordIdB: row.record_id_b,
    winnerUsername: row.winner_username,
  };
}

function toActiveBountyView(row: BountyRow) {
  const { sampleRecordIdA: _sampleA, sampleRecordIdB: _sampleB, ...active } = toBountyView(row);
  return active;
}

function claimError(bountyId: string, error: string) {
  return data({ bountyId, error }, { status: 400 });
}

function formatUtc(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" }).format(new Date(value));
}

const bountySelect = `
  SELECT b.*, c.id AS claim_id, c.record_id_a, c.record_id_b, c.claimed_at,
         u.username AS winner_username
  FROM bounties b
  LEFT JOIN bounty_claims c ON c.bounty_id = b.id
  LEFT JOIN users u ON u.id = c.user_id`;
