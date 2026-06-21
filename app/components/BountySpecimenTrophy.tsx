import { Link } from "react-router";

import type { BountySpecimenDistinction } from "../services/bounty-specimen";
import { SpecimenSigil } from "./SpecimenSigil";

type BountySpecimenTrophyProps = {
  distinction: BountySpecimenDistinction;
  claimId?: string | null;
  variant?: "full" | "compact";
};

export function BountySpecimenTrophy({
  distinction,
  claimId,
  variant = "full",
}: BountySpecimenTrophyProps) {
  const title = `${capitalize(distinction.tier)} specimen trophy`;
  return (
    <section className={`bounty-specimen-trophy bounty-specimen-${distinction.tier} bounty-specimen-${variant}`} aria-label={title}>
      <header>
        <span aria-hidden="true" className="bounty-specimen-mark">◆</span>
        <div>
          <p>Specimen distinction</p>
          {claimId ? <Link to={`/claim/${claimId}`}>{title}</Link> : <strong>{title}</strong>}
        </div>
      </header>
      <div className="bounty-specimen-list">
        <Link className="bounty-specimen-record bounty-specimen-source" to={`/bounty/${distinction.bountySpecimen.uuid}`} aria-label={`${distinction.bountySpecimen.identity.name}, bounty UUID specimen`}>
          <SpecimenSigil identity={distinction.bountySpecimen.identity} size="compact" />
          <span><em>Bounty UUID</em><strong>{distinction.bountySpecimen.identity.name}</strong><small>{distinction.bountySpecimen.identity.classification} · {distinction.bountySpecimen.uuid.slice(0, 8)}…</small></span>
        </Link>
        {distinction.specimens.map(({ uuid, identity }) => (
          <Link className="bounty-specimen-record" key={uuid} to={`/record/${uuid}`} aria-label={`${identity.name}, ${identity.classification} specimen`}>
            <SpecimenSigil identity={identity} size="compact" />
            <span><em>Winning specimen</em><strong>{identity.name}</strong><small>{identity.classification} · {uuid.slice(0, 8)}…</small></span>
          </Link>
        ))}
      </div>
      <p className="bounty-specimen-frequency">Combined occurrence: approximately 1 in {distinction.approximateOneIn.toLocaleString("en-US")}</p>
      {variant === "full" && <p className="bounty-specimen-note">This approximation combines independent UUID pattern frequencies. It does not describe the quality or value of the bounty claim.</p>}
    </section>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
