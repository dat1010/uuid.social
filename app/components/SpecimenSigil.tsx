import type { RecordIdentity } from "../services/record-identity";

export function SpecimenSigil({ identity, size = "full" }: { identity: RecordIdentity; size?: "full" | "compact" }) {
  const nodeRadius = size === "compact" ? 2.8 : 3.4;
  return (
    <figure className={`specimen-sigil specimen-sigil-${size}`} style={{ background: identity.palette.background, color: identity.palette.foreground }}>
      <svg aria-hidden="true" viewBox="0 0 100 110" role="img">
        <g className="specimen-sigil-lines" stroke={identity.palette.accent}>
          {identity.sigil.connections.map(([from, to], index) => (
            <line key={index} x1={identity.sigil.points[from].x} y1={identity.sigil.points[from].y} x2={identity.sigil.points[to].x} y2={identity.sigil.points[to].y} />
          ))}
        </g>
        <g fill={identity.palette.foreground}>
          {identity.sigil.points.map((point, index) => identity.sigil.nodeShape === "circle" ? (
            <circle key={index} cx={point.x} cy={point.y} r={nodeRadius} />
          ) : identity.sigil.nodeShape === "diamond" ? (
            <rect key={index} x={point.x - nodeRadius} y={point.y - nodeRadius} width={nodeRadius * 2} height={nodeRadius * 2} transform={`rotate(45 ${point.x} ${point.y})`} />
          ) : (
            <rect key={index} x={point.x - nodeRadius} y={point.y - nodeRadius} width={nodeRadius * 2} height={nodeRadius * 2} />
          ))}
        </g>
      </svg>
      {size === "full" && <figcaption>{identity.name}: a mirrored {identity.sigil.nodeShape}-node sigil.</figcaption>}
    </figure>
  );
}
