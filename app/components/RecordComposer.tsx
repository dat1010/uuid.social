import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { imageTypes, maxImageBytes, maxImages } from "../services/media";

type DraftImage = {
  key: string; file: File; preview: string; id?: string; progress: number;
  alt: string; error?: string;
};

export function RecordComposer({ action, reply = false, serverError }: { action: string; reply?: boolean; serverError?: string }) {
  const fetcher = useFetcher<{ error?: string }>();
  const [body, setBody] = useState("");
  const [images, setImages] = useState<DraftImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const requests = useRef(new Map<string, XMLHttpRequest>());
  const previews = useRef(new Map<string, string>());
  const busy = fetcher.state !== "idle";
  const unfinished = images.some((image) => !image.id);

  useEffect(() => {
    const uploads = requests.current;
    const urls = previews.current;
    return () => {
      for (const request of uploads.values()) request.abort();
      for (const url of urls.values()) URL.revokeObjectURL(url);
      uploads.clear();
      urls.clear();
    };
  }, []);

  function update(key: string, changes: Partial<DraftImage>) {
    setImages((current) => current.map((image) => image.key === key ? { ...image, ...changes } : image));
  }

  function upload(image: DraftImage) {
    requests.current.get(image.key)?.abort();
    update(image.key, { error: undefined, progress: 0 });
    const request = new XMLHttpRequest();
    requests.current.set(image.key, request);
    request.open("POST", "/api/images");
    request.setRequestHeader("Content-Type", image.file.type);
    request.timeout = 120_000;
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) update(image.key, { progress: Math.round(event.loaded / event.total * 100) });
    };
    const failed = (message: string) => { requests.current.delete(image.key); update(image.key, { error: message }); };
    request.onerror = () => failed("Upload interrupted. Please retry.");
    request.ontimeout = () => failed("Upload timed out. Please retry.");
    request.onload = () => {
      requests.current.delete(image.key);
      try {
        const result = JSON.parse(request.responseText);
        if (request.status >= 200 && request.status < 300 && typeof result.id === "string") {
          if (!previews.current.has(image.key)) {
            void fetch(`/api/images/${result.id}`, { method: "DELETE" }).catch(() => {});
          } else update(image.key, { id: result.id, progress: 100 });
        } else failed(result.error || "Upload failed. Please retry.");
      } catch { failed("Upload failed. Check your connection and sign-in, then retry."); }
    };
    request.send(image.file);
  }

  function addFiles(files: FileList | null) {
    if (!files) return;
    setError(null);
    if (images.length + files.length > maxImages) { setError("Attach up to four images."); return; }
    const next: DraftImage[] = [];
    for (const file of files) {
      if (!imageTypes.includes(file.type) || file.size > maxImageBytes || file.size === 0) {
        setError("Choose JPEG, PNG, or WebP images up to 10 MB each.");
        continue;
      }
      const image = { key: crypto.randomUUID(), file, preview: URL.createObjectURL(file), progress: 0, alt: "" };
      previews.current.set(image.key, image.preview);
      next.push(image);
    }
    setImages((current) => [...current, ...next]);
    for (const image of next) upload(image);
  }

  function remove(image: DraftImage) {
    requests.current.get(image.key)?.abort();
    requests.current.delete(image.key);
    URL.revokeObjectURL(image.preview);
    previews.current.delete(image.key);
    setImages((current) => current.filter(({ key }) => key !== image.key));
    if (image.id) void fetch(`/api/images/${image.id}`, { method: "DELETE" }).catch(() => {});
  }

  function move(index: number, step: number) {
    setImages((current) => {
      const next = [...current];
      [next[index], next[index + step]] = [next[index + step], next[index]];
      return next;
    });
  }

  return (
    <fetcher.Form method="post" action={action} className="record-composer">
      {reply && <input type="hidden" name="intent" value="reply" />}
      <label className="sr-only" htmlFor={`body-${reply ? "reply" : "record"}`}>{reply ? "Reply text" : "Record text"}</label>
      <textarea id={`body-${reply ? "reply" : "record"}`} className="textarea textarea-bordered w-full min-h-24 resize-none"
        maxLength={500} name="body" required={images.length === 0} value={body} onChange={(event) => setBody(event.target.value)} disabled={busy}
        placeholder={reply ? "Reply with words, pictures, or both…" : "What is happening in this UUID lifetime?"} />
      {images.length > 0 && <div className="composer-images" aria-label="Attached images">
        {images.map((image, index) => <div className="composer-image" key={image.key}>
          <img src={image.preview} alt={`Preview of image ${index + 1}`} />
          <div className="composer-image-controls">
            <button type="button" className="btn btn-xs btn-ghost" disabled={busy || index === 0} onClick={() => move(index, -1)} aria-label={`Move image ${index + 1} earlier`}>←</button>
            <button type="button" className="btn btn-xs btn-ghost" disabled={busy || index === images.length - 1} onClick={() => move(index, 1)} aria-label={`Move image ${index + 1} later`}>→</button>
            <button type="button" className="btn btn-xs btn-ghost ml-auto" disabled={busy} onClick={() => remove(image)}>Remove</button>
          </div>
          {image.id ? <input type="hidden" name="attachmentId" value={image.id} /> : image.error ? <div className="text-xs text-error" role="alert">{image.error}<button type="button" className="link ml-2" onClick={() => upload(image)}>Retry</button></div> : <div className="composer-progress" role="status"><progress className="progress progress-primary" value={image.progress} max={100} aria-label={`Uploading image ${index + 1}`} /><span>{image.progress === 100 ? "Processing image…" : `Uploading ${image.progress}%`}</span></div>}
          <label className="composer-alt">Image description <span>(optional)</span><textarea className="textarea textarea-bordered w-full" name={image.id ? "attachmentAlt" : undefined} maxLength={500} rows={2} value={image.alt} disabled={busy} onChange={(event) => update(image.key, { alt: event.target.value })} placeholder="Describe this image for people who cannot see it." /></label>
        </div>)}
      </div>}
      {(error || fetcher.data?.error || serverError) && <div role="alert" className="alert alert-error text-sm py-2">{error || fetcher.data?.error || serverError}</div>}
      <div className="composer-toolbar">
        <label className={`btn btn-outline btn-sm ${busy || images.length === maxImages ? "btn-disabled" : ""}`}>
          Add images
          <input className="sr-only" type="file" accept={imageTypes.join(",")} multiple disabled={busy || images.length === maxImages} onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} />
        </label>
        <span className="text-xs text-base-content/50">{images.length}/4 images · {body.length}/500</span>
        <button className="btn btn-primary btn-sm ml-auto" disabled={busy || unfinished}>{busy ? "Publishing…" : reply ? "Reply" : "Publish"}</button>
      </div>
      <p className="text-xs text-base-content/50">JPEG, PNG, or WebP · 10 MB each · Images are public once published.</p>
      <noscript><p className="text-sm">Enable JavaScript to attach images.</p></noscript>
    </fetcher.Form>
  );
}
