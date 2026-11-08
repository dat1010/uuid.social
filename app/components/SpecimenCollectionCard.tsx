import { Link } from "react-router";
import { SpecimenSigil } from "./SpecimenSigil";
import type { Specimen } from "../services/specimen-collection";

export function SpecimenCollectionCard({ specimen }: { specimen: Specimen }) {
  const { id, identity } = specimen;
  return (
    <Link className={`specimen-collection-card specimen-class-${identity.classification}`} to={`/record/${id}`}>
      <SpecimenSigil identity={identity} />
      <div className="specimen-collection-card-body">
        <div className="specimen-collection-labels"><span>{identity.coordinates.region}</span><strong>{identity.classification}</strong></div>
        <h2>{identity.name}</h2>
        <p className="specimen-collection-uuid">{id}</p>
        <div className="specimen-collection-trait"><span>{identity.traits[0].label}</span><small>Approx. 1 in {identity.traits[0].oneIn.toLocaleString("en-US")}</small></div>
        <footer><span>Open thread →</span></footer>
      </div>
    </Link>
  );
}
