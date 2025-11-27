import React from 'react';
import {type Project} from '../../types/project';
import './CardPreviewPanel.css';
import {CardPreviewToolbar} from './CardPreviewToolbar';
import {CardPreviewViewport} from './CardPreviewViewport';
import {useCardPreview} from './useCardPreview';

interface Props {
  readonly collapsed: boolean;
  readonly project: Project | null;
  readonly exportProgress: number | null;

  onChangeLocale?(locale: string): void;
}

/**
 * Displays the card preview panel with toolbar controls and viewport.
 *
 * @param props - Panel configuration and callbacks.
 * @returns Card preview panel element.
 */
export const CardPreviewPanel: React.FC<Props> = ({collapsed, project, exportProgress, onChangeLocale}) => {
  const {
    hasProject,
    hasCards,
    selectedCard,
    cardOptions,
    localeOptions,
    selectedLocale,
    safeSelectedCard,
    cardWidthPx,
    cardHeightPx,
    translateX,
    translateY,
    zoom,
    iframeDocument,
    scaledWidth,
    scaledHeight,
    isPanning,
    activeToolbarButton,
    viewportRef,
    handleResetZoom,
    handleZoomOut,
    handleZoomIn,
    handleToggleFit,
    handlePanStart,
    handlePanMove,
    handlePanEnd,
    setSelectedCardValue,
  } = useCardPreview({project});

  return (<section className={`card-preview panel ${collapsed ? 'panel--collapsed' : 'panel--expanded'}`}>
    <div className="panel__header">
      <div className="title">Card preview</div>
      <div className="card-preview__dimensions" aria-label="Card dimensions">
          <span title="Size" aria-label="Size">{Math.round(cardWidthPx)} × {Math.round(cardHeightPx)} px</span>
          <span title="Zoom" aria-label="Zoom">{Math.round(zoom * 100)}%</span>
      </div>
    </div>
    <div className="panel__body">
      {exportProgress !== null && (
        <div className="card-preview__progress-bar">
          <div className="card-preview__progress-bar-fill" style={{ width: `${exportProgress * 100}%` }}></div>
        </div>
      )}
      {!hasProject && (<div className="placeholder-text">Open a project to see a live card preview.</div>)}
      {hasProject && !hasCards && (<div className="placeholder-text">No cards found in the loaded project.</div>)}
      {hasProject && hasCards && selectedCard && (<CardPreviewViewport
          cardWidthPx={cardWidthPx}
          cardHeightPx={cardHeightPx}
          zoom={zoom}
          translateX={translateX}
          translateY={translateY}
          iframeDocument={iframeDocument}
          scaledWidth={scaledWidth}
          scaledHeight={scaledHeight}
          isPanning={isPanning}
          viewportRef={viewportRef}
          onPanStart={handlePanStart}
          onPanMove={handlePanMove}
          onPanEnd={handlePanEnd}
        />)}


      <CardPreviewToolbar
        activeMode={activeToolbarButton}
        localeOptions={localeOptions}
        selectedLocale={selectedLocale}
        cardOptions={cardOptions}
        selectedCard={safeSelectedCard}
        onChangeLocale={(value) => {
          onChangeLocale?.(value);
        }}
        onChangeCard={(value) => setSelectedCardValue(value)}
        onResetZoom={handleResetZoom}
        onZoomOut={handleZoomOut}
        onZoomIn={handleZoomIn}
        onFit={handleToggleFit}
      />
    </div>
  </section>);
};
