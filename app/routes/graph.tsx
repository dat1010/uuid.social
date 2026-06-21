import { useMemo } from "react";
import { Link } from "react-router";
import {
  Background,
  Position,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { Route } from "./+types/graph";
import { ObjectPageHeader } from "../components/ObjectPageHeader";
import { getCurrentUser, validateUuid } from "../services/auth.server";
import { getGraphNeighborhood } from "../services/connections.server";
import {
  relationshipLabels,
  shortUuid,
  type GraphNeighborhood,
} from "../services/connections";
import { getCloudflareEnv } from "../services/cloudflare.server";

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const id = params.uuid?.toLowerCase() ?? "";
  if (!validateUuid(id)) throw new Response("Not Found", { status: 404 });
  const [user, graph] = await Promise.all([
    getCurrentUser(request, context),
    getGraphNeighborhood(getCloudflareEnv(context).DB, id),
  ]);
  if (!graph) throw new Response("Not Found", { status: 404 });
  return { signedIn: Boolean(user), graph };
}

export default function GraphPage({ loaderData }: Route.ComponentProps) {
  const graph = loaderData.graph;
  const flow = useMemo(() => buildFlow(graph), [graph]);

  return (
    <div className="min-h-screen bg-base-200"><ObjectPageHeader signedIn={loaderData.signedIn} />
      <main className="graph-page">
        <header className="graph-titlebar">
          <div><p className="graph-kicker">Relationship map</p><h1>{graph.center.title}</h1><p className="font-mono">{shortUuid(graph.center.id)}</p></div>
          <div className="flex gap-2"><span className="badge badge-outline">{graph.counts.incoming} in</span><span className="badge badge-outline">{graph.counts.outgoing} out</span></div>
        </header>
        <div className="graph-workspace graph-workspace-static">
          <section aria-label="Interactive UUID connection graph" className="graph-canvas">
            <ReactFlow nodes={flow.nodes} edges={flow.edges} fitView fitViewOptions={{ padding: 0.2 }} nodesDraggable={false} nodesConnectable={false} deleteKeyCode={null} minZoom={0.4} maxZoom={1.4} zoomOnDoubleClick={false}>
              <Background gap={28} size={1} />
            </ReactFlow>
          </section>
        </div>
        <section className="graph-list card bg-base-100 shadow" aria-label="Accessible connection list">
          <div className="card-body"><h2 className="font-bold">Relationships</h2>{graph.truncated && <p className="text-xs text-base-content/50">Showing the closest relationships.</p>}<ul className="divide-y divide-base-200">{graph.connections.map((connection) => <li className="py-3 text-sm" key={connection.id}><Link className="link font-mono" to={`/${connection.sourceType}/${connection.sourceId}`}>{shortUuid(connection.sourceId)}</Link><span> {relationshipLabels[connection.relationship]} </span><Link className="link font-mono" to={`/${connection.targetType}/${connection.targetId}`}>{shortUuid(connection.targetId)}</Link>{connection.creatorUsername && <span className="block text-xs text-base-content/45">added by @{connection.creatorUsername}</span>}</li>)}</ul></div>
        </section>
      </main>
    </div>
  );
}

function buildFlow(graph: GraphNeighborhood) {
  const objectNodes = graph.nodes.filter((node) => node.type !== "connection" || !graph.connections.some((connection) => connection.id === node.id));
  const levels = assignLevels(graph);
  const positions = positionLevels([...objectNodes.map((node) => node.id), ...graph.connections.map((connection) => connection.id)], levels);
  const nodes: Node[] = objectNodes.map((node) => ({
    id: node.id, position: positions.get(node.id)!,
    data: { label: <Link aria-label={`View ${node.title} ${shortUuid(node.id)}`} className="graph-node-link nodrag nopan" to={node.url}><span className="graph-node-heading"><strong>{node.title}</strong><small>{shortUuid(node.id)}</small></span>{node.preview && <span className="graph-node-preview">{previewText(node.preview)}</span>}<span className="graph-node-cta">View {node.type}</span></Link> },
    className: `graph-node graph-node-${node.deleted ? "deleted" : node.type} ${node.id === graph.center.id ? "graph-node-center" : ""}`,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  }));
  const edges: Edge[] = [];
  graph.connections.forEach((connection, index) => {
    if (!positions.has(connection.sourceId) || !positions.has(connection.targetId)) return;
    const id = connection.id;
    nodes.push({
      id,
      position: positions.get(id)!,
      data: { label: <><strong>{relationshipLabels[connection.relationship]}</strong><small>{shortUuid(id)}</small></> },
      className: `graph-node graph-node-connection ${id === graph.center.id ? "graph-node-center" : ""}`,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    });
    const edge = { type: "straight", animated: connection.origin === "user" };
    edges.push(
      { id: `${id}-a-${index}`, source: connection.sourceId, target: id, ...edge },
      { id: `${id}-b-${index}`, source: id, target: connection.targetId, ...edge },
    );
  });
  return { nodes, edges };
}

function assignLevels(graph: GraphNeighborhood) {
  const levels = new Map<string, number>();
  const centeredConnection = graph.connections.find((connection) => connection.id === graph.center.id);
  if (centeredConnection) {
    levels.set(centeredConnection.sourceId, -1);
    levels.set(centeredConnection.id, 0);
    levels.set(centeredConnection.targetId, 1);
  } else {
    levels.set(graph.center.id, 0);
  }

  for (let pass = 0; pass < graph.connections.length + 1; pass += 1) {
    for (const connection of graph.connections) {
      const sourceLevel = levels.get(connection.sourceId);
      const targetLevel = levels.get(connection.targetId);
      if (sourceLevel !== undefined && targetLevel === undefined) levels.set(connection.targetId, sourceLevel + 2);
      if (targetLevel !== undefined && sourceLevel === undefined) levels.set(connection.sourceId, targetLevel - 2);
      const resolvedSource = levels.get(connection.sourceId);
      const resolvedTarget = levels.get(connection.targetId);
      if (resolvedSource !== undefined && resolvedTarget !== undefined && !levels.has(connection.id)) {
        levels.set(connection.id, (resolvedSource + resolvedTarget) / 2);
      }
    }
  }

  let fallbackLevel = 2;
  for (const node of graph.nodes) {
    if (!levels.has(node.id)) {
      levels.set(node.id, fallbackLevel);
      fallbackLevel += 2;
    }
  }
  return levels;
}

function positionLevels(ids: string[], levels: Map<string, number>) {
  const grouped = new Map<number, string[]>();
  for (const id of ids) {
    const level = levels.get(id) ?? 0;
    const group = grouped.get(level) ?? [];
    if (!group.includes(id)) group.push(id);
    grouped.set(level, group);
  }

  const positions = new Map<string, { x: number; y: number }>();
  for (const [level, group] of grouped) {
    group.forEach((id, index) => {
      positions.set(id, {
        x: level * 300,
        y: (index - (group.length - 1) / 2) * 180,
      });
    });
  }
  return positions;
}

function previewText(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 140 ? `${normalized.slice(0, 137)}...` : normalized;
}
