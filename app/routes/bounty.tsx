import { data, Form, Link, redirect } from "react-router";
import type { Route } from "./+types/bounty";
import { ConnectionsPanel } from "../components/ConnectionsPanel";
import { ObjectPageHeader } from "../components/ObjectPageHeader";
import { PublicObjectCard } from "../components/PublicObjectCard";
import { BountySpecimenTrophy } from "../components/BountySpecimenTrophy";
import { getCurrentUser, requireUser, validateUuid } from "../services/auth.server";
import { claimBounty } from "../services/bounties.server";
import { getConnectionLists, resolvePublicObject } from "../services/connections.server";
import { getCloudflareEnv } from "../services/cloudflare.server";
import { deriveClaimSpecimenDistinction } from "../services/bounty-specimen";

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const id = params.uuid?.toLowerCase() ?? "";
  const db = getCloudflareEnv(context).DB;
  const [user, object, connections, bounty] = await Promise.all([
    getCurrentUser(request, context), resolvePublicObject(db, id), getConnectionLists(db, id),
    db.prepare(`SELECT b.rule_type, b.ends_at, c.id AS claim_id,
      c.record_id_a, c.record_id_b, u.username AS winner_username
      FROM bounties b
      LEFT JOIN bounty_claims c ON c.bounty_id = b.id
      LEFT JOIN users u ON u.id = c.user_id
      WHERE b.id = ?`).bind(id).first<{
        rule_type: "character_count" | "event_gap";
        ends_at: number;
        claim_id: string | null;
        record_id_a: string | null;
        record_id_b: string | null;
        winner_username: string | null;
      }>(),
  ]);
  if (!object || object.type !== "bounty" || !bounty) throw new Response("Not Found", { status: 404 });
  return {
    signedIn: Boolean(user),
    object,
    connections,
    needsTwo: bounty.rule_type === "event_gap",
    active: bounty.ends_at > Date.now() && !bounty.claim_id,
    claim: bounty.claim_id ? {
      id: bounty.claim_id,
      winnerUsername: bounty.winner_username,
      specimenDistinction: deriveClaimSpecimenDistinction(
        id,
        bounty.record_id_a,
        bounty.record_id_b,
      ),
    } : null,
  };
}

export async function action({ request, context, params }: Route.ActionArgs) {
  const user = await requireUser(request, context);
  const form = await request.formData();
  const bountyId = params.uuid?.toLowerCase() ?? "";
  const recordIdA = String(form.get("recordIdA") ?? "").trim().toLowerCase();
  const recordIdB = String(form.get("recordIdB") ?? "").trim().toLowerCase();
  if (!validateUuid(recordIdA) || (recordIdB && !validateUuid(recordIdB))) return data({ error: "Enter complete record UUIDs." }, { status: 400 });
  const error = await claimBounty(getCloudflareEnv(context).DB, { bountyId, userId: user.id, recordIdA, recordIdB: recordIdB || null, now: Date.now() });
  if (error) return data({ error }, { status: 400 });
  return redirect(`/bounty/${bountyId}`);
}

export default function Bounty({ loaderData, actionData }: Route.ComponentProps) {
  return <div className="min-h-screen bg-base-200"><ObjectPageHeader signedIn={loaderData.signedIn} /><main className="max-w-3xl mx-auto px-4 py-8"><PublicObjectCard object={loaderData.object} />{loaderData.claim && <div className="card bg-base-100 shadow mt-4"><div className="card-body"><p className="text-sm">Claimed{loaderData.claim.winnerUsername && <> by <Link className="link font-bold" to={`/user/${loaderData.claim.winnerUsername}`}>@{loaderData.claim.winnerUsername}</Link></>}.</p><Link className="link text-xs" to={`/claim/${loaderData.claim.id}`}>View bounty claim</Link>{loaderData.claim.specimenDistinction && <BountySpecimenTrophy claimId={loaderData.claim.id} distinction={loaderData.claim.specimenDistinction} />}</div></div>}{loaderData.active && <div className="card bg-base-100 shadow mt-4"><Form className="card-body gap-3" method="post"><h2 className="font-bold">Claim this bounty</h2>{loaderData.signedIn ? <><input className="input input-bordered font-mono text-xs" name="recordIdA" placeholder="First record UUID" required />{loaderData.needsTwo && <input className="input input-bordered font-mono text-xs" name="recordIdB" placeholder="Second record UUID" required />}{actionData?.error && <p className="text-error text-sm">{actionData.error}</p>}<button className="btn btn-primary">Check UUID{loaderData.needsTwo ? "s" : ""}</button></> : <Link className="btn btn-primary" to="/login">Sign in to claim</Link>}</Form></div>}<ConnectionsPanel objectId={loaderData.object.id} connections={loaderData.connections} /></main></div>;
}
