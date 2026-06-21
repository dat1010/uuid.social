import type { Route } from "./+types/claim";
import { ConnectionsPanel } from "../components/ConnectionsPanel";
import { ObjectPageHeader } from "../components/ObjectPageHeader";
import { PublicObjectCard } from "../components/PublicObjectCard";
import { BountySpecimenTrophy } from "../components/BountySpecimenTrophy";
import { getCurrentUser } from "../services/auth.server";
import { getConnectionLists, resolvePublicObject } from "../services/connections.server";
import { getCloudflareEnv } from "../services/cloudflare.server";
import { deriveClaimSpecimenDistinction } from "../services/bounty-specimen";

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const id = params.uuid?.toLowerCase() ?? "";
  const db = getCloudflareEnv(context).DB;
  const [user, object, connections, claim] = await Promise.all([
    getCurrentUser(request, context), resolvePublicObject(db, id), getConnectionLists(db, id),
    db.prepare("SELECT bounty_id, record_id_a, record_id_b FROM bounty_claims WHERE id = ?")
      .bind(id).first<{ bounty_id: string; record_id_a: string; record_id_b: string | null }>(),
  ]);
  if (!object || object.type !== "claim") throw new Response("Not Found", { status: 404 });
  return {
    signedIn: Boolean(user),
    object,
    connections,
    specimenDistinction: deriveClaimSpecimenDistinction(
      claim?.bounty_id ?? id,
      claim?.record_id_a ?? null,
      claim?.record_id_b ?? null,
    ),
  };
}

export default function Claim({ loaderData }: Route.ComponentProps) {
  return <div className="min-h-screen bg-base-200"><ObjectPageHeader signedIn={loaderData.signedIn} /><main className="max-w-3xl mx-auto px-4 py-8"><PublicObjectCard object={loaderData.object} />{loaderData.specimenDistinction && <BountySpecimenTrophy distinction={loaderData.specimenDistinction} />}<ConnectionsPanel objectId={loaderData.object.id} connections={loaderData.connections} /></main></div>;
}
