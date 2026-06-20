import { Link } from "react-router";
import { formatBountyPrompt, type BountyRuleType } from "../services/bounty";
import { BountyCountdown } from "./BountyCountdown";

export type BountyTeaserData = {
  id: string;
  cadence: "daily" | "weekly";
  ruleType: BountyRuleType;
  character: string | null;
  targetValue: number;
  endsAt: string;
  winnerUsername: string | null;
};

export function BountyTeaser({ bounties }: { bounties: BountyTeaserData[] }) {
  return (
    <section className="card bg-base-100 shadow">
      <div className="card-body p-4 gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-sm">UUID Bounties</h2>
          <Link className="link text-xs" to="/bounties">View all</Link>
        </div>
        {bounties.length === 0 ? <p className="text-xs text-base-content/50">The hunt unlocks when a solvable UUID appears.</p> : bounties.map((bounty) => (
          <Link className="block rounded-box border border-base-300 p-3 hover:border-primary transition-colors" key={bounty.id} to="/bounties">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[0.65rem] font-bold uppercase tracking-wider text-primary">{bounty.cadence}</span>
              <span className="text-[0.65rem] text-base-content/40">{bounty.winnerUsername ? "Claimed" : <BountyCountdown endsAt={bounty.endsAt} />}</span>
            </div>
            <p className="text-xs leading-relaxed">{formatBountyPrompt({ ruleType: bounty.ruleType, character: bounty.character, targetValue: bounty.targetValue })}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
