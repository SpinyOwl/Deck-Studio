// src/components/ImageViewer/ImageViewer.tsx
import React from 'react';
import './ImageViewer.css';

interface Props {
  readonly src: string;
  readonly alt: string;
}

/**
 * Presents an image inside the editor pane with containment and safe alt text.
 *
 * @param props - Component props containing the source URL and alt text.
 * @returns Centered image viewer element.
 */
export const ImageViewer: React.FC<Props> = ({ src, alt }) => {
  return (
    <div className="image-viewer" role="img" aria-label={alt}>
      <img src={src} alt={alt} className="image-viewer__image" />
    </div>
  );
};
