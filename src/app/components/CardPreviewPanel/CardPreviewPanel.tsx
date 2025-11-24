// src/components/CardPreviewPanel/CardPreviewPanel.tsx
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  type CardRecord, defaultLayoutConfig, type DimensionUnit, type Project, type ProjectConfig, toPixels,
} from '../../types/project';
import './CardPreviewPanel.css';

interface Props {
  readonly collapsed: boolean;
  readonly project: Project | null;

  onChangeLocale?(locale: string): void;
}

interface ToolbarButtonProps {
  readonly icon: string;
  readonly label: string;
  readonly onClick?: () => void;
  readonly active?: boolean;
}

interface ToolbarSelectProps {
  readonly placeholder: string;
  readonly tooltip: string;
  readonly options: Array<{ value: string; label: string }>;
  readonly onChange: (value: string) => void;
  readonly value: string;
}

interface DimensionColumns {
  readonly widthColumn: string;
  readonly heightColumn: string;
  readonly sizeUnitColumn: string;
}

interface CardDimensions {
  readonly width: number;
  readonly height: number;
  readonly unit: DimensionUnit;
  readonly dpi: number;
}

/**
 * Renders an icon button for the preview toolbar.
 *
 * @param props - Icon glyph and label configuration for the button.
 * @returns Toolbar button element.
 */
const ToolbarButton: React.FC<ToolbarButtonProps> = ({icon, label, onClick, active = false}) => (<button
  type="button"
  className={`card-preview__icon-button${active ? ' card-preview__icon-button--active' : ''}`}
  aria-label={label}
  aria-pressed={active}
  title={label}
  onClick={onClick}
>
  <span aria-hidden className="material-symbols-outlined">{icon}</span>
</button>);

/**
 * Renders a select input with a placeholder entry for the preview toolbar.
 *
 * @param props - Select placeholder, tooltip, and option labels.
 * @returns Toolbar select element.
 */
const ToolbarSelect: React.FC<ToolbarSelectProps> = ({placeholder, tooltip, options, onChange, value}) => (<select
  className="card-preview__select"
  aria-label={tooltip}
  title={tooltip}
  value={value}
  defaultValue=""
  onChange={(event) => onChange(event.target.value)}
>
  <option value="" disabled hidden>
    {placeholder}
  </option>

  {options.map(option => (<option key={option.value} value={option.value}>
    {option.label}
  </option>))}
</select>);


/**
 * Normalizes the CSV column names used for dimension lookups.
 *
 * @param config - Project configuration containing CSV overrides.
 * @returns Normalized column identifiers for width, height, and unit.
 */
function getDimensionColumns(config: ProjectConfig | null): DimensionColumns {
  return {
    widthColumn: config?.csv?.widthColumn?.trim() || 'cardWidth',
    heightColumn: config?.csv?.heightColumn?.trim() || 'cardHeight',
    sizeUnitColumn: config?.csv?.sizeUnitColumn?.trim() || 'cardSizeUnit',
  };
}

/**
 * Parses a numeric dimension value from a card record field.
 *
 * @param value - Raw string value from the CSV.
 * @returns Parsed number or null when empty/invalid.
 */
function parseDimension(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseFloat(value);

  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Converts a dimension into pixels using the provided unit and DPI.
 *
 * @param value - Numeric dimension value.
 * @param unit - Unit used for the dimension.
 * @param dpi - Dots per inch for conversion when relevant.
 * @returns Pixel-equivalent dimension.
 */
function toPixelDimension(value: number, unit: DimensionUnit, dpi: number): number {
  switch (unit) {
    case 'px':
      return value;
    case 'inch':
    case 'mm':
    case 'cm':
      return toPixels(value, unit, dpi);
    default:
      return value;
  }
}

/**
 * Resolves the effective card dimensions using per-card overrides or project defaults.
 *
 * @param card - Card record containing optional dimension overrides.
 * @param config - Project configuration providing layout defaults.
 * @returns Normalized card dimensions including unit and DPI.
 */
function getCardDimensions(card: CardRecord | null, config: ProjectConfig | null): CardDimensions {
  const layout = {...defaultLayoutConfig, ...(config?.layout || {})};
  const columns = getDimensionColumns(config);
  const width = parseDimension(card?.[columns.widthColumn]) ?? layout.width ?? defaultLayoutConfig.width;
  const height = parseDimension(card?.[columns.heightColumn]) ?? layout.height ?? defaultLayoutConfig.height;
  const rawUnit = card?.[columns.sizeUnitColumn]?.toLowerCase()?.trim();
  const unit: DimensionUnit = (rawUnit === 'mm' || rawUnit === 'cm' || rawUnit === 'inch' || rawUnit === 'px') ? rawUnit : layout.unit ?? defaultLayoutConfig.unit ?? 'inch';

  return {
    width: width ?? defaultLayoutConfig.width!,
    height: height ?? defaultLayoutConfig.height!,
    unit,
    dpi: layout.dpi ?? defaultLayoutConfig.dpi ?? 300,
  };
}

/**
 * Wraps card HTML in a minimal document suitable for iframe rendering.
 *
 * @param html - Resolved card HTML fragment.
 * @returns Complete HTML document string.
 */
function buildSrcDoc(html: string): string {
  return `<!doctype html><html><head>  <style>
    /* Provide a neutral base; templates can override */
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
    }
    * { box-sizing: border-box; }
    body {
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
    }
  </style></head><body>${html}</body></html>`;
}

/**
 * Generates a friendly label for the card selector.
 *
 * @param card - Card record providing optional identifier metadata.
 * @param index - Zero-based index of the card in the CSV.
 * @param config - Project configuration specifying the ID column name.
 * @returns Readable label for the card selector dropdown.
 */
function getCardLabel(card: CardRecord, index: number, config: ProjectConfig | null): string {
  const idColumn = config?.csv?.idColumn?.trim() || 'id';
  const idValue = card[idColumn];

  if (idValue && idValue.trim().length > 0) {
    return `${idValue}`;
  }

  return `Card ${index + 1}`;
}

/**
 * Displays the card preview container with toolbar controls and iframe-rendered HTML.
 */
export const CardPreviewPanel: React.FC<Props> = ({collapsed, project, onChangeLocale}) => {
  const resolvedCards = useMemo(() => project?.resolvedCards ?? [], [project]);
  const [selectedCardIndex, setSelectedCardIndex] = useState('0');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [manualZoom, setManualZoom] = useState(1);
  const [isFitToViewport, setIsFitToViewport] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [viewportSize, setViewportSize] = useState<{ width: number; height: number }>({width: 0, height: 0});
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const panOriginRef = useRef<{
    readonly x: number;
    readonly y: number;
    readonly scrollLeft: number;
    readonly scrollTop: number;
    readonly pointerId: number;
  } | null>(null);
  const localeOptions = useMemo(() => {
    const locales = project?.localization?.availableLocales ?? [];

    return locales.map(locale => ({value: locale, label: locale}));
  }, [project?.localization?.availableLocales]);
  const selectedLocale = project?.localization?.locale ?? '';
  const hasLocalization = localeOptions.length > 0;

  const cardOptions = useMemo(() => resolvedCards.map((card, index) => ({
    value: `${index}`, label: getCardLabel(card.card, index, project?.config ?? null),
  })), [project?.config, resolvedCards]);

  const safeSelectedValue = useMemo(() => {
    if (cardOptions.length === 0) {
      return '';
    }

    const hasExactMatch = cardOptions.some(option => option.value === selectedCardIndex);

    return hasExactMatch ? selectedCardIndex : cardOptions[0].value;
  }, [cardOptions, selectedCardIndex]);

  const selectedCard = useMemo(() => {
    if (!safeSelectedValue) {
      return null;
    }

    return resolvedCards[Number.parseInt(safeSelectedValue, 10)] ?? null;
  }, [resolvedCards, safeSelectedValue]);

  const dimensions = useMemo(() => getCardDimensions(selectedCard?.card ?? null, project?.config ?? null), [selectedCard, project?.config],);

  const widthPx = useMemo(() => toPixelDimension(dimensions.width, dimensions.unit, dimensions.dpi), [dimensions],);

  const heightPx = useMemo(() => toPixelDimension(dimensions.height, dimensions.unit, dimensions.dpi), [dimensions],);

  const iframeContent = selectedCard ? buildSrcDoc(selectedCard.html) : '';

  const hasProject = Boolean(project);
  const hasCards = resolvedCards.length > 0;

  /**
   * Ensures the zoom level remains within a sensible range.
   *
   * @param value - Proposed zoom value.
   * @returns Clamped zoom value.
   */
  const clampZoom = useCallback((value: number): number => Math.min(4, Math.max(0.25, value)), []);

  /**
   * Applies a zoom level update and ensures fit-to-viewport mode is disabled for manual adjustments.
   *
   * @param nextValue - Target zoom value or updater function.
   */
  const applyManualZoom = useCallback((nextValue: number | ((value: number) => number)): void => {
    setIsFitToViewport(false);
    setManualZoom(current => {
      const resolvedValue = typeof nextValue === 'function' ? nextValue(current) : nextValue;
      const clamped = clampZoom(Number.parseFloat(resolvedValue.toFixed(2)));

      setZoomLevel(clamped);

      return clamped;
    });
  }, [clampZoom]);

  /**
   * Calculates a zoom value that fits the card within the viewport bounds.
   *
   * @returns Scaled zoom ratio or null when unavailable.
   */
  const calculateFitZoom = useCallback((): number | null => {
    const viewport = viewportRef.current;

    if (!viewport || widthPx <= 0 || heightPx <= 0) {
      return null;
    }

    const availableWidth = viewport.clientWidth;
    const availableHeight = viewport.clientHeight;

    if (availableWidth === 0 || availableHeight === 0) {
      return null;
    }

    const scale = Math.min(availableWidth / widthPx, availableHeight / heightPx);

    return clampZoom(Number.parseFloat(scale.toFixed(2)));
  }, [clampZoom, heightPx, widthPx]);

  /**
   * Resets the preview to its original scale.
   */
  const handleOriginalSize = (): void => {
    applyManualZoom(1);
  };

  /**
   * Increases the preview zoom level.
   */
  const handleZoomIn = (): void => {
    applyManualZoom(current => current + 0.1);
  };

  /**
   * Decreases the preview zoom level.
   */
  const handleZoomOut = (): void => {
    applyManualZoom(current => current - 0.1);
  };

  /**
   * Calculates and applies a zoom level that fits the card inside the viewport.
   */
  const handleZoomToFit = (): void => {
    const fitZoom = calculateFitZoom();

    if (fitZoom === null) {
      return;
    }

    if (isFitToViewport) {
      setIsFitToViewport(false);
      setZoomLevel(manualZoom);

      return;
    }

    setIsFitToViewport(true);
    setZoomLevel(fitZoom);
  };

  /**
   * Starts a pointer-driven panning gesture within the viewport.
   *
   * @param event - Pointer down event.
   */
  const handlePanStart = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) {
      return;
    }

    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    viewport.setPointerCapture(event.pointerId);
    panOriginRef.current = {
      x: event.clientX,
      y: event.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
      pointerId: event.pointerId,
    };
    setIsPanning(true);
  };

  /**
   * Updates viewport scroll while panning.
   *
   * @param event - Pointer move event.
   */
  const handlePanMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    const viewport = viewportRef.current;
    const origin = panOriginRef.current;

    if (!viewport || !origin || !isPanning) {
      return;
    }

    event.preventDefault();

    const deltaX = event.clientX - origin.x;
    const deltaY = event.clientY - origin.y;

    viewport.scrollLeft = origin.scrollLeft - deltaX;
    viewport.scrollTop = origin.scrollTop - deltaY;
  };

  /**
   * Ends the active panning gesture.
   */
  const handlePanEnd = (): void => {
    const viewport = viewportRef.current;
    const origin = panOriginRef.current;

    if (viewport && origin && viewport.hasPointerCapture(origin.pointerId)) {
      viewport.releasePointerCapture(origin.pointerId);
    }

    panOriginRef.current = null;
    setIsPanning(false);
  };

  /**
   * Keeps the zoom level synchronized while fit-to-viewport is active.
   */
  useEffect(() => {
    if (!isFitToViewport) {
      return undefined;
    }

    const applyFitZoom = (): void => {
      const fitZoom = calculateFitZoom();

      if (fitZoom !== null) {
        setZoomLevel(fitZoom);
      }
    };

    applyFitZoom();

    const viewport = viewportRef.current;

    if (!viewport) {
      return undefined;
    }

    const resizeObserver = new ResizeObserver(applyFitZoom);
    resizeObserver.observe(viewport);
    window.addEventListener('resize', applyFitZoom);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', applyFitZoom);
    };
  }, [calculateFitZoom, isFitToViewport]);

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return undefined;
    }

    const updateViewportSize = (): void => {
      setViewportSize({
        width: viewport.clientWidth,
        height: viewport.clientHeight,
      });
    };

    updateViewportSize();

    const resizeObserver = new ResizeObserver(updateViewportSize);
    resizeObserver.observe(viewport);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const scaledWidth = widthPx * zoomLevel;
  const scaledHeight = heightPx * zoomLevel;
  const translateX = Math.max((viewportSize.width - scaledWidth) / 2, 0);
  const translateY = Math.max((viewportSize.height - scaledHeight) / 2, 0);

  return (<section className={`card-preview panel ${collapsed ? 'panel--collapsed' : 'panel--expanded'}`}>
    <div className="panel__header">Card preview</div>
    <div className="panel__body">
      {!hasProject && (<div className="placeholder-text">Open a project to see a live card preview.</div>)}
      {hasProject && !hasCards && (<div className="placeholder-text">No cards found in the loaded project.</div>)}
      {hasProject && hasCards && selectedCard && (<>
        <div
          className={`card-preview__viewport${isPanning ? ' card-preview__viewport--panning' : ''}`}
          aria-label="Card preview area"
          ref={viewportRef}
          onPointerDown={handlePanStart}
          onPointerMove={handlePanMove}
          onPointerUp={handlePanEnd}
          onPointerCancel={handlePanEnd}
          onPointerLeave={handlePanEnd}
        >
          <div className="card-preview__viewport-size-guard" style={{width: `${scaledWidth}px`, height: `${scaledHeight}px`}} aria-hidden />
          <div
            className="card-preview__viewport-scale"
            style={{
              width: `${widthPx - 16}px`,
              height: `${heightPx - 16}px`,
              transform: `translate(${translateX}px, ${translateY}px) scale(${zoomLevel})`,
              transformOrigin: 'top left',
            }}
          >
            <div
              className="card-preview__viewport-content"
              style={{width: `${widthPx}px`, height: `${heightPx}px`}}
            >
              <iframe
                title="Card preview"
                className="card-preview__iframe"
                srcDoc={iframeContent}
              />
            </div>
          </div>
          <div className="card-preview__dimensions" aria-label="Card dimensions">
            <div className="card-preview__dimensions-row">
              <span className="card-preview__dimensions-label">Size:</span>
              <span>{dimensions.width.toFixed(2)} × {dimensions.height.toFixed(2)} {dimensions.unit}</span>
            </div>
            <div className="card-preview__dimensions-row">
              <span className="card-preview__dimensions-label">Pixels:</span>
              <span>{Math.round(widthPx)} × {Math.round(heightPx)} px @ {dimensions.dpi} dpi</span>
            </div>
          </div>
        </div>
        <div className="card-preview__toolbar" aria-label="Card preview toolbar">
          <ToolbarButton icon="view_real_size" label="Original size" onClick={handleOriginalSize}/>
          <ToolbarButton icon="zoom_out" label="Zoom out" onClick={handleZoomOut}/>
          <ToolbarButton icon="zoom_in" label="Zoom in" onClick={handleZoomIn}/>
          <ToolbarButton icon="fit_screen" label="Zoom to fit" onClick={handleZoomToFit} active={isFitToViewport}/>
          {hasLocalization && (<ToolbarSelect
            placeholder="Language"
            tooltip="Language"
            options={localeOptions}
            value={selectedLocale}
            onChange={(value) => {
              onChangeLocale?.(value);
            }}
          />)}
          <ToolbarSelect
            placeholder="Card"
            tooltip="Card"
            options={cardOptions}
            value={safeSelectedValue}
            onChange={setSelectedCardIndex}
          />
        </div>
      </>)}
    </div>
  </section>);
};
