import React from 'react';

interface CardPreviewViewportProps {
  readonly cardWidthPx: number;
  readonly cardHeightPx: number;
  readonly zoom: number;
  readonly translateX: number;
  readonly translateY: number;
  readonly iframeDocument: string;
  readonly scaledWidth: number;
  readonly scaledHeight: number;
  readonly isPanning: boolean;
  readonly viewportRef: React.RefObject<HTMLDivElement | null>;
  onPanStart(event: React.PointerEvent<HTMLDivElement>): void;
  onPanMove(event: React.PointerEvent<HTMLDivElement>): void;
  onPanEnd(): void;
}

/**
 * Displays the preview of a single card using an iframe.
 *
 * @param props - Viewport rendering configuration.
 * @returns Viewport element.
 */
export const CardPreviewViewport: React.FC<CardPreviewViewportProps> = ({
  cardWidthPx,
  cardHeightPx,
  zoom,
  translateX,
  translateY,
  iframeDocument,
  scaledWidth,
  scaledHeight,
  isPanning,
  viewportRef,
  onPanStart,
  onPanMove,
  onPanEnd,
}) => (<div
  className={`card-preview__viewport${isPanning ? ' card-preview__viewport--panning' : ''}`}
  aria-label="Card preview area"
  ref={viewportRef}
  onPointerDown={onPanStart}
  onPointerMove={onPanMove}
  onPointerUp={onPanEnd}
  onPointerCancel={onPanEnd}
  onPointerLeave={onPanEnd}
>
  <div className="card-preview__canvas" style={{width: `${scaledWidth}px`, height: `${scaledHeight}px`}} aria-hidden />
  <div
    className="card-preview__frame"
    style={{
      width: `${cardWidthPx}px`,
      height: `${cardHeightPx}px`,
      transform: `translate(${translateX}px, ${translateY}px) scale(${zoom})`,
      transformOrigin: 'top left',
    }}
  >
    <iframe
      title="Card preview"
      className="card-preview__iframe"
      srcDoc={iframeDocument}
    />
  </div>
  <div className="card-preview__dimensions" aria-label="Card dimensions">
    <div className="card-preview__dimensions-row">
      <span className="card-preview__dimensions-label">Size:</span>
      <span>{Math.round(cardWidthPx)} × {Math.round(cardHeightPx)} px</span>
    </div>
    <div className="card-preview__dimensions-row">
      <span className="card-preview__dimensions-label">Zoom:</span>
      <span>{Math.round(zoom * 100)}%</span>
    </div>
  </div>
</div>);
