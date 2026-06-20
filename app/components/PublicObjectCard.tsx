import { Link } from "react-router";
import { shortUuid, type PublicObject } from "../services/connections";

export function PublicObjectCard({ object }: { object: PublicObject }) {
  return (
    <article className={`card bg-base-100 shadow ${object.deleted ? "border border-dashed border-base-content/35" : ""}`}>
      <div className="card-body">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="badge badge-outline uppercase text-[0.65rem] tracking-wider">{object.type}</span>
          <span className="font-mono text-xs text-base-content/45" title={object.id}>{shortUuid(object.id)}</span>
        </div>
        <h1 className="card-title text-2xl">{object.title}</h1>
        {object.deleted ? <p className="text-base-content/55">This {object.type} was deleted by its creator.</p> : object.preview && <p className="whitespace-pre-wrap leading-relaxed">{object.preview}</p>}
        {object.attribution && <p className="text-sm text-base-content/55">by <Link className="link" to={`/user/${object.attribution}`}>@{object.attribution}</Link></p>}
        <p className="font-mono text-[0.65rem] break-all text-base-content/35 select-all">{object.id}</p>
      </div>
    </article>
  );
}
