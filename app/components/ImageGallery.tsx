import { useEffect, useRef, useState } from "react";
import { imageUrl, type RecordImage } from "../services/media";

export function ImageGallery({ images = [] }: { images?: RecordImage[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const image = selected === null ? null : images[selected];
  useEffect(() => {
    if (image && !dialog.current?.open) dialog.current?.showModal();
    if (!image && dialog.current?.open) dialog.current.close();
  }, [image]);
  if (!images.length) return null;
  return (
    <div className="record-images">
      <div className={`record-image-grid ${images.length === 1 ? "record-image-single" : ""}`}>
        {images.map((item, index) => <button key={item.id} type="button" onClick={() => setSelected(index)} aria-label={item.alt ? `Open image: ${item.alt}` : `Open image ${index + 1} of ${images.length}`}>
          <img src={imageUrl(item.id)} alt={item.alt} width={item.width} height={item.height} loading="lazy" decoding="async" />
        </button>)}
      </div>
      <dialog ref={dialog} className="image-viewer" aria-label="Image viewer" onClose={() => setSelected(null)} onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }} onKeyDown={(event) => {
        if (selected === null) return;
        if (event.key === "ArrowRight") { event.preventDefault(); setSelected((selected + 1) % images.length); }
        if (event.key === "ArrowLeft") { event.preventDefault(); setSelected((selected + images.length - 1) % images.length); }
      }}>
        {image && <div className="image-viewer-content">
          <div className="image-viewer-toolbar"><span>Image {selected! + 1} of {images.length}</span><button className="btn btn-sm" type="button" onClick={() => dialog.current?.close()} autoFocus>Close</button></div>
          <img src={imageUrl(image.id, "full")} alt={image.alt} width={image.width} height={image.height} />
          {image.alt && <p>{image.alt}</p>}
          {images.length > 1 && <div className="image-viewer-toolbar"><button className="btn btn-sm" type="button" onClick={() => setSelected((selected! + images.length - 1) % images.length)}>Previous</button><button className="btn btn-sm" type="button" onClick={() => setSelected((selected! + 1) % images.length)}>Next</button></div>}
        </div>}
      </dialog>
    </div>
  );
}
