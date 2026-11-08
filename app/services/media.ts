export const maxImages = 4;
export const maxImageBytes = 10 * 1024 * 1024;
export const maxImagePixels = 50_000_000;
export const imageTypes = ["image/jpeg", "image/png", "image/webp"];

export type RecordImage = {
  id: string;
  width: number;
  height: number;
  alt: string;
};
export type AttachmentInput = { id: string; alt: string };

export function parseRecordInput(form: FormData) {
  const body = String(form.get("body") ?? "").trim();
  const ids = form.getAll("attachmentId").map(String);
  const alts = form.getAll("attachmentAlt").map(String);
  if (body.length > 500) return { error: "Text must be 500 characters or fewer." } as const;
  if (ids.length > maxImages) return { error: "Attach up to four images." } as const;
  if (new Set(ids).size !== ids.length || ids.some((id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id))) {
    return { error: "Choose valid image attachments." } as const;
  }
  if (alts.some((alt) => alt.length > 500)) return { error: "Image descriptions must be 500 characters or fewer." } as const;
  if (!body && ids.length === 0) return { error: "Add some text or an image before publishing." } as const;
  return { body, attachments: ids.map((id, index) => ({ id, alt: alts[index]?.trim() ?? "" })) } as const;
}

export function imageUrl(id: string, variant: "feed" | "full" = "feed") {
  return `/media/${id}/${variant}`;
}
