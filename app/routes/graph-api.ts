import type { Route } from "./+types/graph-api";
import { validateUuid } from "../services/auth.server";
import { getGraphNeighborhood } from "../services/connections.server";
import { getCloudflareEnv } from "../services/cloudflare.server";

export async function loader({ context, params }: Route.LoaderArgs) {
  const id = params.uuid?.toLowerCase() ?? "";
  if (!validateUuid(id)) throw new Response("Not Found", { status: 404 });
  const graph = await getGraphNeighborhood(getCloudflareEnv(context).DB, id);
  if (!graph) throw new Response("Not Found", { status: 404 });
  return Response.json(graph, { headers: { "Cache-Control": "public, max-age=30" } });
}
