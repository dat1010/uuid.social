export type RecordTextPart =
  | { type: "text"; value: string }
  | { type: "link"; value: string; href: string };

const urlPattern = /(?:https?:\/\/|www\.)[^\s<]+/gi;
const trailingPunctuation = /[.,!?;:]+$/;

export function parseRecordText(value: string): RecordTextPart[] {
  const parts: RecordTextPart[] = [];
  let cursor = 0;

  for (const match of value.matchAll(urlPattern)) {
    const index = match.index;
    const candidate = match[0];
    if (index > cursor) parts.push({ type: "text", value: value.slice(cursor, index) });

    const punctuation = candidate.match(trailingPunctuation)?.[0] ?? "";
    const label = punctuation ? candidate.slice(0, -punctuation.length) : candidate;
    const href = label.startsWith("www.") ? `https://${label}` : label;

    try {
      const url = new URL(href);
      if (url.protocol === "http:" || url.protocol === "https:") {
        parts.push({ type: "link", value: label, href: url.href });
      } else {
        parts.push({ type: "text", value: label });
      }
    } catch {
      parts.push({ type: "text", value: label });
    }

    if (punctuation) parts.push({ type: "text", value: punctuation });
    cursor = index + candidate.length;
  }

  if (cursor < value.length) parts.push({ type: "text", value: value.slice(cursor) });
  return parts;
}
