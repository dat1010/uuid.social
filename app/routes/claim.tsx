import type { Route } from "./+types/claim";
import { ConnectionsPanel } from "../components/ConnectionsPanel";
import { ObjectPageHeader } from "../components/ObjectPageHeader";
import { PublicObjectCard } from "../components/PublicObjectCard";
import { getCurrentUser } from "../services/auth.server";
import { getConnectionLists, resolvePublicObject } from "../services/connections.server";
import { getCloudflareEnv } from "../services/cloudflare.server";

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const id = params.uuid?.toLowerCase() ?? "";
  const db = getCloudflareEnv(context).DB;
  const [user, object, connections] = await Promise.all([
    getCurrentUser(request, context), resolvePublicObject(db, id), getConnectionLists(db, id),
  ]);
  if (!object || object.type !== "claim") throw new Response("Not Found", { status: 404 });
  return { signedIn: Boolean(user), object, connections };
}

export default function Claim({ loaderData }: Route.ComponentProps) {
  return <div className="min-h-screen bg-base-200"><ObjectPageHeader signedIn={loaderData.signedIn} /><main className="max-w-3xl mx-auto px-4 py-8"><PublicObjectCard object={loaderData.object} /><ConnectionsPanel objectId={loaderData.object.id} connections={loaderData.connections} /></main></div>;
}
