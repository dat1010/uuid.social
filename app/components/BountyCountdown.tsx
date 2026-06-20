import { useEffect, useState } from "react";

export function BountyCountdown({ endsAt }: { endsAt: string }) {
  const [remaining, setRemaining] = useState(() => formatRemaining(endsAt));

  useEffect(() => {
    const update = () => setRemaining(formatRemaining(endsAt));
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, [endsAt]);

  return <span>{remaining}</span>;
}

function formatRemaining(endsAt: string) {
  const totalMinutes = Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 60_000));
  if (totalMinutes === 0) return "ended";
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}
