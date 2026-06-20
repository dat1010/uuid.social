import { Form, redirect } from "react-router";
import type { Route } from "./+types/connection";
import { ConnectionsPanel } from "../components/ConnectionsPanel";
import { ObjectPageHeader } from "../components/ObjectPageHeader";
import { PublicObjectCard } from "../components/PublicObjectCard";
import { getCurrentUser, requireUser } from "../services/auth.server";
import { deleteManualConnection, getConnectionLists, getGraphNeighborhood, resolvePublicObject } from "../services/connections.server";
import { relationshipLabels } from "../services/connections";
import { getCloudflareEnv } from "../services/cloudflare.server";

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const id = params.uuid?.toLowerCase() ?? "";
  const db = getCloudflareEnv(context).DB;
  const [user, object, connections, graph] = await Promise.all([
    getCurrentUser(request, context), resolvePublicObject(db, id), getConnectionLists(db, id), getGraphNeighborhood(db, id),
  ]);
  if (!object || object.type !== "connection") throw new Response("Not Found", { status: 404 });
  const assertion = graph?.connections.find((connection) => connection.id === id) ?? null;
  return { signedIn: Boolean(user), object, connections, assertion, canDelete: Boolean(user && assertion?.creatorUsername === user.username) };
}

export async function action({ request, context, params }: Route.ActionArgs) {
  const user = await requireUser(request, context);
  const id = params.uuid?.toLowerCase() ?? "";
  const deleted = await deleteManualConnection(getCloudflareEnv(context).DB, id, user.id);
  if (!deleted) throw new Response("Forbidden", { status: 403 });
  return redirect(`/connection/${id}`);
}

export default function Connection({ loaderData }: Route.ComponentProps) {
  const { object, assertion } = loaderData;
  return <div className="min-h-screen bg-base-200"><ObjectPageHeader signedIn={loaderData.signedIn} /><main className="max-w-3xl mx-auto px-4 py-8"><PublicObjectCard object={object} />{assertion && <div className="my-4 rounded-box border border-base-300 bg-base-100 p-4 text-center font-mono text-sm"><a className="link" href={`/${assertion.sourceType}/${assertion.sourceId}`}>{assertion.sourceType}</a><span className="mx-3 badge badge-primary badge-outline">{relationshipLabels[assertion.relationship]}</span><a className="link" href={`/${assertion.targetType}/${assertion.targetId}`}>{assertion.targetType}</a></div>}{loaderData.canDelete && <Form className="flex justify-end my-3" method="post"><button className="btn btn-error btn-outline btn-sm">Delete assertion</button></Form>}<ConnectionsPanel objectId={object.id} connections={loaderData.connections} /></main></div>;
}
