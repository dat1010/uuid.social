import { useState } from "react";

export function ShareRecordLink({ recordId }: { recordId: string }) {
  const [result, setResult] = useState<{ url: string; copied: boolean } | null>(null);

  async function copyLink() {
    const url = new URL(`/record/${recordId}`, window.location.origin).href;

    try {
      await navigator.clipboard.writeText(url);
      setResult({ url, copied: true });
    } catch {
      setResult({ url, copied: false });
    }
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <button className="btn btn-ghost btn-sm" type="button" onClick={copyLink}>
        {result?.copied ? "Link copied" : "Share link"}
      </button>
      <span className="sr-only" role="status">{result?.copied ? "Link copied to clipboard" : ""}</span>
      {result && !result.copied && (
        <input
          aria-label="Copy this link"
          className="input input-sm w-64 max-w-full font-mono"
          value={result.url}
          readOnly
          ref={(input) => input?.focus()}
          onFocus={(event) => event.currentTarget.select()}
        />
      )}
    </div>
  );
}
