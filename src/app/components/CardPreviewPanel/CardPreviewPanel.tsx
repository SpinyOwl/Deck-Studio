import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  type CardRecord,
  defaultLayoutConfig,
  type DimensionUnit,
  type Project,
  type ProjectConfig,
  toPixels,
} from '../../types/project';
import './CardPreviewPanel.css';

interface Props {
  readonly collapsed: boolean;
  readonly project: Project | null;
  onChangeLocale?(locale: string): void;
}

interface CardDimensions {
  readonly width: number;
  readonly height: number;
  readonly unit: DimensionUnit;
  readonly dpi: number;
}

interface PointerOrigin {
  readonly x: number;
  readonly y: number;
  readonly scrollLeft: number;
  readonly scrollTop: number;
  readonly pointerId: number;
}

/**
 * Generates the HTML document used inside the preview iframe.
 *
 * @param html - Raw HTML for a single card.
 * @returns Complete HTML document string.
 */
function buildPreviewDocument(html: string): string {
  return '<!doctype html>'
    + '<html>'
    + '<head>'
    + '<style>'
    + 'html, body { margin: 0; padding: 0; width: 100%; height: 100%; }'
    + '* { box-sizing: border-box; }'
    + 'body { display: flex; align-items: center; justify-content: center; background: transparent; }'
    + '</style>'
    + '</head>'
    + `<body>${html}</body>`
    + '</html>';
}

/**
 * Converts a dimension value to pixels based on the unit and DPI.
 *
 * @param value - Dimension value to convert.
 * @param unit - Unit of the provided value.
 * @param dpi - Dots per inch for physical units.
 * @returns Pixel value for the provided dimension.
 */
function convertToPixels(value: number, unit: DimensionUnit, dpi: number): number {
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
 * Normalizes the CSV column names used for card sizing overrides.
 *
 * @param config - Project configuration containing custom column names.
 * @returns Normalized width, height, and unit column identifiers.
 */
function getDimensionColumns(config: ProjectConfig | null): {
  widthColumn: string;
  heightColumn: string;
  sizeUnitColumn: string;
} {
  return {
    widthColumn: config?.csv?.widthColumn?.trim() || 'cardWidth',
    heightColumn: config?.csv?.heightColumn?.trim() || 'cardHeight',
    sizeUnitColumn: config?.csv?.sizeUnitColumn?.trim() || 'cardSizeUnit',
  };
}

/**
 * Parses a numeric dimension value from the card record.
 *
 * @param value - Raw value from the CSV.
 * @returns Parsed number or null when invalid.
 */
function parseDimension(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseFloat(value);

  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Resolves the card dimensions using per-card overrides and project defaults.
 *
 * @param card - Resolved card record.
 * @param config - Project configuration for layout fallbacks.
 * @returns Normalized card dimensions with unit and DPI.
 */
function resolveCardDimensions(card: CardRecord | null, config: ProjectConfig | null): CardDimensions {
  const layout = {...defaultLayoutConfig, ...(config?.layout || {})};
  const columns = getDimensionColumns(config);
  const width = parseDimension(card?.[columns.widthColumn]) ?? layout.width ?? defaultLayoutConfig.width;
  const height = parseDimension(card?.[columns.heightColumn]) ?? layout.height ?? defaultLayoutConfig.height;
  const normalizedUnit = card?.[columns.sizeUnitColumn]?.toLowerCase()?.trim();
  const unit: DimensionUnit = (normalizedUnit === 'px' || normalizedUnit === 'mm' || normalizedUnit === 'cm' || normalizedUnit === 'inch')
    ? normalizedUnit
    : layout.unit ?? defaultLayoutConfig.unit ?? 'inch';

  return {
    width: width ?? defaultLayoutConfig.width!,
    height: height ?? defaultLayoutConfig.height!,
    unit,
    dpi: layout.dpi ?? defaultLayoutConfig.dpi ?? 300,
  };
}

/**
 * Builds a readable label for the card selector.
 *
 * @param card - Card record with an optional identifier column.
 * @param index - Zero-based index in the resolved card list.
 * @param config - Project configuration to customize the ID column name.
 * @returns Display label for the selector option.
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
 * Renders a toolbar button.
 *
 * @param props - Icon, label, and handlers for the button.
 * @returns Button element for the toolbar.
 */
const ToolbarButton: React.FC<{ icon: string; label: string; active?: boolean; onClick?: () => void; }> = ({
  icon,
  label,
  active = false,
  onClick,
}) => (<button
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
 * Renders a select element used by the toolbar.
 *
 * @param props - Placeholder, tooltip, options, and change handler.
 * @returns Select element with provided options.
 */
const ToolbarSelect: React.FC<{ placeholder: string; tooltip: string; options: Array<{ value: string; label: string }>; value: string; onChange: (value: string) => void; }> = ({
  placeholder,
  tooltip,
  options,
  value,
  onChange,
}) => (<select
  className="card-preview__select"
  aria-label={tooltip}
  title={tooltip}
  value={value}
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
 * Displays the preview of a single card using an iframe.
 */
export const CardPreviewPanel: React.FC<Props> = ({collapsed, project, onChangeLocale}) => {
  const resolvedCards = useMemo(() => project?.resolvedCards ?? [], [project]);
  const [selectedCardValue, setSelectedCardValue] = useState('0');
  const [zoom, setZoom] = useState(1);
  const [fitToViewport, setFitToViewport] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const isPanningRef = useRef(false);
  const [viewportSize, setViewportSize] = useState({width: 0, height: 0});
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const panOriginRef = useRef<PointerOrigin | null>(null);

  const localeOptions = useMemo(() => {
    const locales = project?.localization?.availableLocales ?? [];

    return locales.map(locale => ({value: locale, label: locale}));
  }, [project?.localization?.availableLocales]);
  const selectedLocale = project?.localization?.locale ?? '';
  const hasLocalization = localeOptions.length > 0;

  const cardOptions = useMemo(() => resolvedCards.map((card, index) => ({
    value: `${index}`,
    label: getCardLabel(card.card, index, project?.config ?? null),
  })), [project?.config, resolvedCards]);

  const safeSelectedCard = useMemo(() => {
    if (cardOptions.length === 0) {
      return '';
    }

    const hasMatch = cardOptions.some(option => option.value === selectedCardValue);

    return hasMatch ? selectedCardValue : cardOptions[0].value;
  }, [cardOptions, selectedCardValue]);

  const selectedCard = useMemo(() => {
    if (!safeSelectedCard) {
      return null;
    }

    return resolvedCards[Number.parseInt(safeSelectedCard, 10)] ?? null;
  }, [resolvedCards, safeSelectedCard]);

  const dimensions = useMemo(() => resolveCardDimensions(selectedCard?.card ?? null, project?.config ?? null), [project?.config, selectedCard]);
  const cardWidthPx = useMemo(() => convertToPixels(dimensions.width, dimensions.unit, dimensions.dpi), [dimensions]);
  const cardHeightPx = useMemo(() => convertToPixels(dimensions.height, dimensions.unit, dimensions.dpi), [dimensions]);
  const iframeDocument = selectedCard ? buildPreviewDocument(selectedCard.html) : '';
  const scaledWidth = cardWidthPx * zoom;
  const scaledHeight = cardHeightPx * zoom;
  const translateX = Math.max((viewportSize.width - scaledWidth) / 2, 0);
  const translateY = Math.max((viewportSize.height - scaledHeight) / 2, 0);

  /**
   * Restricts zoom levels to a sensible range.
   *
   * @param value - Proposed zoom level.
   * @returns Clamped zoom level.
   */
  const clampZoom = useCallback((value: number): number => Math.min(4, Math.max(0.25, value)), []);

  /**
   * Computes the zoom value that would fit the card inside the viewport.
   *
   * @returns Zoom level or null when dimensions are unavailable.
   */
  const computeFitZoom = useCallback((): number | null => {
    const viewport = viewportRef.current;

    if (!viewport || cardWidthPx <= 0 || cardHeightPx <= 0) {
      return null;
    }

    const availableWidth = viewport.clientWidth;
    const availableHeight = viewport.clientHeight;

    if (availableWidth === 0 || availableHeight === 0) {
      return null;
    }

    const scale = Math.min(availableWidth / cardWidthPx, availableHeight / cardHeightPx);

    return clampZoom(Number.parseFloat(scale.toFixed(4)));
  }, [cardHeightPx, cardWidthPx, clampZoom]);

  /**
   * Applies a manual zoom value and disables fit-to-viewport mode.
   *
   * @param next - Target zoom value or updater.
   */
  const applyZoom = useCallback((next: number | ((value: number) => number)): void => {
    setFitToViewport(false);
    setZoom(current => {
      const resolved = typeof next === 'function' ? next(current) : next;
      const clamped = clampZoom(resolved);

      return Number.parseFloat(clamped.toFixed(4));
    });
  }, [clampZoom]);

  /**
   * Toggles fit-to-viewport mode for the preview.
   */
  const handleToggleFit = (): void => {
    if (fitToViewport) {
      setFitToViewport(false);

      return;
    }

    const fitZoom = computeFitZoom();

    if (fitZoom !== null) {
      setZoom(fitZoom);
      setFitToViewport(true);
    }
  };

  /**
   * Resets the preview zoom back to 100%.
   */
  const handleResetZoom = (): void => {
    applyZoom(1);
  };

  /**
   * Increases the preview zoom level.
   */
  const handleZoomIn = (): void => {
    applyZoom(value => value + 0.05);
  };

  /**
   * Decreases the preview zoom level.
   */
  const handleZoomOut = (): void => {
    applyZoom(value => value - 0.05);
  };

  /**
   * Handles the start of a panning gesture inside the viewport.
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
    isPanningRef.current = true;
    setIsPanning(true);
  };

  /**
   * Updates the viewport scroll while panning.
   */
  const handlePanMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    const viewport = viewportRef.current;
    const origin = panOriginRef.current;

    if (!viewport || !origin || origin.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - origin.x;
    const deltaY = event.clientY - origin.y;
    viewport.scrollLeft = origin.scrollLeft - deltaX;
    viewport.scrollTop = origin.scrollTop - deltaY;
  };

  /**
   * Ends an active panning gesture.
   */
  const handlePanEnd = (): void => {
    const viewport = viewportRef.current;
    const origin = panOriginRef.current;

    if (viewport && origin && viewport.hasPointerCapture(origin.pointerId)) {
      viewport.releasePointerCapture(origin.pointerId);
    }

    panOriginRef.current = null;
    isPanningRef.current = false;
    setIsPanning(false);
  };

  /**
   * Measures the viewport and recenters the preview content.
   */
  const recenterViewport = useCallback((): void => {
    const viewport = viewportRef.current;

    if (!viewport || isPanningRef.current) {
      return;
    }

    const width = viewport.clientWidth;
    const height = viewport.clientHeight;

    setViewportSize(previous => (previous.width === width && previous.height === height)
      ? previous
      : {width, height});
  }, []);

  useEffect(() => {
    if (!fitToViewport) {
      return undefined;
    }

    const applyFitZoom = (): void => {
      const fitZoom = computeFitZoom();

      if (fitZoom !== null) {
        setZoom(fitZoom);
      }
    };

    applyFitZoom();

    const viewport = viewportRef.current;

    if (!viewport) {
      return undefined;
    }

    const resizeObserver = new ResizeObserver(() => {
      applyFitZoom();
    });

    resizeObserver.observe(viewport);
    window.addEventListener('resize', applyFitZoom);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', applyFitZoom);
    };
  }, [computeFitZoom, fitToViewport]);

  useEffect(() => {
    const viewport = viewportRef.current;

    recenterViewport();

    if (!viewport) {
      return undefined;
    }

    const resizeObserver = new ResizeObserver(recenterViewport);
    resizeObserver.observe(viewport);

    return () => {
      resizeObserver.disconnect();
    };
  }, [recenterViewport]);

  useEffect(() => {
    recenterViewport();
  }, [cardHeightPx, cardWidthPx, recenterViewport, viewportSize.height, viewportSize.width, zoom]);

  const hasProject = Boolean(project);
  const hasCards = resolvedCards.length > 0;

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
              <span>{dimensions.width.toFixed(2)} × {dimensions.height.toFixed(2)} {dimensions.unit}</span>
            </div>
            <div className="card-preview__dimensions-row">
              <span className="card-preview__dimensions-label">Pixels:</span>
              <span>{Math.round(cardWidthPx)} × {Math.round(cardHeightPx)} px @ {dimensions.dpi} dpi</span>
            </div>
            <div className="card-preview__dimensions-row">
              <span className="card-preview__dimensions-label">Zoom:</span>
              <span>{Math.round(zoom * 100)}%</span>
            </div>
          </div>
        </div>

        <div className="card-preview__toolbar" aria-label="Card preview toolbar">
          <ToolbarButton icon="view_real_size" label="Original size" onClick={handleResetZoom} />
          <ToolbarButton icon="zoom_out" label="Zoom out" onClick={handleZoomOut} />
          <ToolbarButton icon="zoom_in" label="Zoom in" onClick={handleZoomIn} />
          <ToolbarButton icon="fit_screen" label="Zoom to fit" onClick={handleToggleFit} active={fitToViewport} />

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
            value={safeSelectedCard}
            onChange={(value) => setSelectedCardValue(value)}
          />
        </div>
      </>)}
    </div>
  </section>);
};
