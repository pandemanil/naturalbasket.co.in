import { useState } from 'react';

/** Shows the product photo, or a clean placeholder when no image exists or it fails to load. */
export default function ProductImage({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="img-placeholder" role="img" aria-label={`${alt} (no photo yet)`}>
        <span aria-hidden="true">🌿</span>
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} />;
}
