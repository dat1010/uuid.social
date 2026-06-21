import { useMemo } from "react";
import { Link } from "react-router";
import {
  Background,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { Route } from "./+types/social-graph";
import { Avatar } from "../components/Avatar";
import { ThemeToggle } from "../components/ThemeToggle";
import { getCurrentUser, normalizeUsername, toPublicCurrentUser } from "../services/auth.server";
import { getCloudflareEnv } from "../services/cloudflare.server";
import { parsePage, parseSocialView, type SocialGraph } from "../services/social";
import { getSocialGraphPage } from "../services/social.server";

export function meta({ data }: Route.MetaArgs) {
  const name = data?.social.graph.center.displayName ?? "Social graph";
  return [{ title: `${name}'s social graph | uuid.social` }];
}

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const username = normalizeUsername(params.username ?? "");
  const url = new URL(request.url);
  const view = parseSocialView(url.searchParams.get("view"));
  const page = parsePage(url.searchParams.get("page"));
  const [currentUser, social] = await Promise.all([
    getCurrentUser(request, context),
    getSocialGraphPage(getCloudflareEnv(context).DB, username, view, page),
  ]);
  if (!social) throw new Response("Not Found", { status: 404 });
  return { currentUser: toPublicCurrentUser(currentUser), social };
}

export default function SocialGraphPage({ loaderData }: Route.ComponentProps) {
  const { currentUser, social } = loaderData;
  const flow = useMemo(() => buildFlow(social.graph), [social.graph]);
  const center = social.graph.center;

  return (
    <div className="min-h-screen bg-base-200">
      <header className="navbar bg-base-100 shadow-sm px-4 lg:px-8">
        <div className="navbar-start"><Link className="font-bold tracking-widest uppercase text-sm" to={currentUser ? "/home" : "/"}>uuid.social</Link></div>
        <div className="navbar-end gap-2"><ThemeToggle /><Link className="btn btn-ghost btn-sm" to={`/user/${center.username}`}>Profile</Link>{currentUser ? <Link className="btn btn-ghost btn-sm" to="/home">Home</Link> : <Link className="btn btn-primary btn-sm" to="/login">Sign in</Link>}</div>
      </header>
      <main className="graph-page">
        <header className="graph-titlebar">
          <div><p className="graph-kicker">Social graph</p><h1>{center.displayName}</h1><p className="text-sm text-base-content/50">@{center.username}</p></div>
          <div className="flex gap-2"><span className="badge badge-outline">{social.graph.counts.followers} followers</span><span className="badge badge-outline">{social.graph.counts.following} following</span></div>
        </header>
        {social.graph.truncated && <div className="alert mb-4 text-sm"><span>The canvas shows the 50 newest relationships in each direction. Use the lists below to browse every relation.</span></div>}
        <div className="graph-workspace graph-workspace-static">
          <section aria-label={`Social graph for @${center.username}`} className="graph-canvas">
            <ReactFlow nodes={flow.nodes} edges={flow.edges} fitView fitViewOptions={{ padding: 0.2 }} nodesDraggable={false} nodesConnectable={false} deleteKeyCode={null} minZoom={0.15} maxZoom={1.4} zoomOnDoubleClick={false}>
              <Background gap={28} size={1} />
            </ReactFlow>
          </section>
        </div>
        <SocialList social={social} />
      </main>
    </div>
  );
}

function SocialList({ social }: { social: Route.ComponentProps["loaderData"]["social"] }) {
  return (
    <section className="card bg-base-100 shadow mt-4 overflow-hidden">
      <div className="flex border-b border-base-200">
        {(["followers", "following"] as const).map((view) => <Link className={`flex-1 p-4 text-center font-bold capitalize ${social.view === view ? "bg-primary text-primary-content" : "hover:bg-base-200"}`} key={view} to={`?view=${view}`}>{view} ({social.graph.counts[view]})</Link>)}
      </div>
      {social.list.length === 0 ? <div className="card-body text-base-content/45">No {social.view} to show.</div> : <ul className="divide-y divide-base-200">{social.list.map((user) => <li className="p-4" key={user.username}><Link className="flex items-center gap-3 link link-hover" to={`/user/${user.username}`}><Avatar {...user} size="sm" /><span><strong className="block">{user.displayName}</strong><span className="text-xs text-base-content/50">@{user.username}</span></span></Link></li>)}</ul>}
      <div className="flex justify-between p-4 border-t border-base-200">
        {social.page > 1 ? <Link className="btn btn-sm btn-outline" to={`?view=${social.view}&page=${social.page - 1}`}>Newer</Link> : <span />}
        <span className="self-center text-xs text-base-content/45">{social.total} total</span>
        {social.hasNextPage ? <Link className="btn btn-sm btn-outline" to={`?view=${social.view}&page=${social.page + 1}`}>Older</Link> : <span />}
      </div>
    </section>
  );
}

function buildFlow(graph: SocialGraph) {
  const followers = new Set(graph.follows.filter((edge) => edge.followingUsername === graph.center.username).map((edge) => edge.followerUsername));
  const following = new Set(graph.follows.filter((edge) => edge.followerUsername === graph.center.username).map((edge) => edge.followingUsername));
  const columns = { followers: [] as string[], mutual: [] as string[], following: [] as string[] };
  for (const user of graph.nodes) {
    if (user.username === graph.center.username) continue;
    if (followers.has(user.username) && following.has(user.username)) columns.mutual.push(user.username);
    else if (followers.has(user.username)) columns.followers.push(user.username);
    else columns.following.push(user.username);
  }
  const positions = new Map<string, { x: number; y: number }>([[graph.center.username, { x: 0, y: 0 }]]);
  placeColumn(positions, columns.followers, -340, 0);
  placeColumn(positions, columns.mutual, 0, 180);
  placeColumn(positions, columns.following, 340, 0);

  const nodes: Node[] = graph.nodes.map((user) => ({
    id: user.username,
    position: positions.get(user.username) ?? { x: 340, y: 0 },
    data: { label: <Link className="graph-node-link nodrag nopan" to={`/user/${user.username}`}><span className="graph-node-heading"><strong>{user.displayName}</strong><small>@{user.username}</small></span><span className="graph-node-cta">View profile</span></Link> },
    className: `graph-node graph-node-user ${user.username === graph.center.username ? "graph-node-center" : ""}`,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  }));
  const edges: Edge[] = graph.follows.map((follow, index) => ({
    id: `${follow.followerUsername}-${follow.followingUsername}-${index}`,
    source: follow.followerUsername,
    target: follow.followingUsername,
    label: "follows",
    markerEnd: { type: MarkerType.ArrowClosed },
    type: "straight",
  }));
  return { nodes, edges };
}

function placeColumn(positions: Map<string, { x: number; y: number }>, usernames: string[], x: number, startY: number) {
  usernames.forEach((username, index) => positions.set(username, { x, y: startY + index * 150 }));
}
