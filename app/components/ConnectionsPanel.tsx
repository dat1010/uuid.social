import { Link } from "react-router";

import {
  relationshipLabels,
  shortUuid,
  type PublicConnection,
} from "../services/connections";

type ConnectionLists = {
  incoming: PublicConnection[];
  outgoing: PublicConnection[];
  counts: { incoming: number; outgoing: number };
};

export function ConnectionsPanel({
  objectId,
  connections,
}: {
  objectId: string;
  connections: ConnectionLists;
}) {
  return (
    <section className="card bg-base-100 shadow mt-4 overflow-hidden">
      <div className="px-4 py-3 border-b border-base-200 flex items-center justify-between gap-3">
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.2em] text-base-content/45">Nearby objects</p>
          <h2 className="font-bold">Relationships</h2>
        </div>
        <Link className="btn btn-sm btn-outline" to={`/graph/${objectId}`}>View map</Link>
      </div>
      <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-base-200">
        <ConnectionDirection title="Incoming" count={connections.counts.incoming} rows={connections.incoming} objectId={objectId} />
        <ConnectionDirection title="Outgoing" count={connections.counts.outgoing} rows={connections.outgoing} objectId={objectId} />
      </div>
    </section>
  );
}

function ConnectionDirection({ title, count, rows, objectId }: {
  title: string; count: number; rows: PublicConnection[]; objectId: string;
}) {
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">{title}</h3>
        <span className="badge badge-ghost badge-sm">{count}</span>
      </div>
      {rows.length === 0 ? <p className="text-xs text-base-content/40 py-3">No {title.toLowerCase()} connections.</p> : (
        <ul className="space-y-2">
          {rows.map((connection) => {
            const otherId = connection.sourceId === objectId ? connection.targetId : connection.sourceId;
            const otherType = connection.sourceId === objectId ? connection.targetType : connection.sourceType;
            return (
              <li className="rounded-box border border-base-300 p-3 text-xs" key={connection.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold uppercase tracking-wide">
                    {relationshipLabels[connection.relationship]}
                  </span>
                  <span className="text-base-content/35">to</span>
                  <Link className="font-mono link" to={`/${otherType}/${otherId}`}>{otherType} {shortUuid(otherId)}</Link>
                </div>
                {connection.creatorUsername && <p className="mt-1 text-base-content/45">added by @{connection.creatorUsername}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
