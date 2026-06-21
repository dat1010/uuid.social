import { Link } from "react-router";

import type { RecordCardData } from "./RecordCard";
import { RecordBody } from "./RecordCard";
import { SpecimenSigil } from "./SpecimenSigil";
import { generateRecordIdentity } from "../services/record-identity";

type RecordSpecimenProps = {
  record: RecordCardData;
  deleted: boolean;
  deletionOrigin: "author" | "admin" | null;
  parentRecordId: string | null;
  reveal: boolean;
};

export function RecordSpecimen({ record, deleted, deletionOrigin, parentRecordId, reveal }: RecordSpecimenProps) {
  const identity = generateRecordIdentity(record.id);
  return (
    <article className={`specimen-card specimen-class-${identity.classification} ${reveal ? "specimen-reveal" : ""}`} style={{ "--specimen-background": identity.palette.background, "--specimen-foreground": identity.palette.foreground, "--specimen-accent": identity.palette.accent } as React.CSSProperties}>
      <header className="specimen-header">
        <span>{parentRecordId ? "Reply" : "Record"}</span>
        <span className="specimen-classification">Specimen / {identity.classification}</span>
      </header>
      {parentRecordId && <Link className="specimen-parent-link" to={`/record/${parentRecordId}`}>← Parent record</Link>}
      <div className="specimen-layout">
        <div className="specimen-record-column">
        <section className="specimen-content" aria-label={parentRecordId ? "Reply content" : "Record content"}>
          {deleted ? (
            <div className="specimen-deleted"><strong>Deleted record</strong><p>{deletionOrigin === "admin" ? "This record was removed by an administrator." : "This record was deleted by its author."} Its content and attribution are not displayed.</p></div>
          ) : (
            <>
              <p className="specimen-author">Recorded by <Link to={`/user/${record.username}`}>{record.displayName} (@{record.username})</Link></p>
              <div className="specimen-body"><RecordBody value={record.body} /></div>
            </>
          )}
          <p className="specimen-record-meta">
            {record.eventNumber !== null && <>Event #{record.eventNumber.toLocaleString("en-US")} · </>}
            <span>{record.id}</span>
          </p>
        </section>
        <details className="specimen-details" open={reveal || undefined}>
          <summary>Specimen details</summary>
          <ol className="specimen-traits">
            {identity.traits.map((trait) => <li key={trait.id}><div><strong>{trait.label}</strong><span>{trait.classification}</span></div><p>{trait.explanation}</p><small>Approx. 1 in {trait.oneIn.toLocaleString("en-US")}</small></li>)}
          </ol>
          <footer><span>Algorithm {identity.version}</span><Link to={`/graph/${record.id}`}>Open relationship graph</Link></footer>
        </details>
        </div>
        <aside className="specimen-primary" aria-label="Generated specimen identity">
          <SpecimenSigil identity={identity} />
          <div className="specimen-summary">
            <p className="specimen-kicker">Deterministic identity</p>
            <h1>{identity.name}</h1>
            <p className="specimen-uuid">{record.id}</p>
            <span className="specimen-tier">{identity.classification}</span>
          </div>
          <details className="specimen-guide" open={reveal || undefined}>
            <summary>How to read this specimen</summary>
            <p>It is a permanent fingerprint of the UUID, not a score.</p>
            <dl>
              <div><dt>Name + sigil</dt><dd>The same UUID always produces the same visual identity.</dd></div>
              <div><dt>Classification</dt><dd>Pattern rarity, never quality, popularity, or value.</dd></div>
              <div><dt>Traits</dt><dd>The detected patterns that explain the classification.</dd></div>
            </dl>
          </details>
        </aside>
      </div>
    </article>
  );
}
