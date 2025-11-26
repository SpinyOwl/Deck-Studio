import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  type CardRecord,
  defaultLayoutConfig,
  type Project,
  type ProjectConfig,
} from '../../types/project';

interface CardDimensions {
  readonly width: number;
  readonly height: number;
}

interface PointerOrigin {
  readonly x: number;
  readonly y: number;
  readonly scrollLeft: number;
  readonly scrollTop: number;
  readonly pointerId: number;
}

interface UseCardPreviewParams {
  readonly project: Project | null;
}

interface CardPreviewControls {
  hasProject: boolean;
  hasCards: boolean;
  selectedCard: {readonly card: CardRecord; readonly html: string} | null;
  cardOptions: Array<{ value: string; label: string }>;
  localeOptions: Array<{ value: string; label: string }>;
  hasLocalization: boolean;
  selectedLocale: string;
  safeSelectedCard: string;
  cardWidthPx: number;
  cardHeightPx: number;
  translateX: number;
  translateY: number;
  zoom: number;
  iframeDocument: string;
  scaledWidth: number;
  scaledHeight: number;
  isPanning: boolean;
  activeToolbarButton: 'original' | 'zoom-in' | 'zoom-out' | 'fit';
  viewportRef: React.RefObject<HTMLDivElement | null>;
  handleResetZoom(): void;
  handleZoomOut(): void;
  handleZoomIn(): void;
  handleToggleFit(): void;
  handlePanStart(event: React.PointerEvent<HTMLDivElement>): void;
  handlePanMove(event: React.PointerEvent<HTMLDivElement>): void;
  handlePanEnd(): void;
  setSelectedCardValue: React.Dispatch<React.SetStateAction<string>>;
}

/**
 * Generates the HTML document used inside the preview iframe.
 *
 * @param html - Raw HTML for a single card.
 * @returns Complete HTML document string.
 */
function buildPreviewDocument(html: string): string {
  return `<!doctype html>
<html>
<head>
  <style>
      html, body { margin: 0; padding: 0; width: 100%; height: 100%; }
      body { overflow: hidden; }
      * { box-sizing: border-box; }
  </style>
</head>
<body>${html}</body>
</html>`;
}

/**
 * Normalizes the CSV column names used for card sizing overrides.
 *
 * @param config - Project configuration containing custom column names.
 * @returns Normalized width and height column identifiers.
 */
function getDimensionColumns(config: ProjectConfig | null): {
  widthColumn: string;
  heightColumn: string;
} {
  return {
    widthColumn: config?.csv?.widthColumn?.trim() || 'cardWidth',
    heightColumn: config?.csv?.heightColumn?.trim() || 'cardHeight',
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
 * @returns Normalized card dimensions in pixels.
 */
function resolveCardDimensions(card: CardRecord | null, config: ProjectConfig | null): CardDimensions {
  const layout = {...defaultLayoutConfig, ...(config?.layout || {})};
  const columns = getDimensionColumns(config);
  const width = parseDimension(card?.[columns.widthColumn]) ?? layout.width ?? defaultLayoutConfig.width;
  const height = parseDimension(card?.[columns.heightColumn]) ?? layout.height ?? defaultLayoutConfig.height;

  return {
    width: width ?? defaultLayoutConfig.width!,
    height: height ?? defaultLayoutConfig.height!,
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
 * Provides card preview state and handlers for zooming, panning, and selection.
 *
 * @param params - Hook parameters.
 * @returns Preview state and callbacks for the card preview panel.
 */
export function useCardPreview({project}: UseCardPreviewParams): CardPreviewControls {
  const resolvedCards = useMemo(() => project?.resolvedCards ?? [], [project]);
  const [selectedCardValue, setSelectedCardValue] = useState('0');
  const [zoom, setZoom] = useState(1);
  const [fitToViewport, setFitToViewport] = useState(false);
  const [manualZoomMode, setManualZoomMode] = useState<'original' | 'zoom-in' | 'zoom-out'>('original');
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
  const cardWidthPx = dimensions.width;
  const cardHeightPx = dimensions.height;
  const iframeDocument = selectedCard ? buildPreviewDocument(selectedCard.html) : '';
  const scaledWidth = cardWidthPx * zoom;
  const scaledHeight = cardHeightPx * zoom;
  const translateX = Math.max((viewportSize.width - scaledWidth) / 2, 0);
  const translateY = Math.max((viewportSize.height - scaledHeight) / 2, 0);

  const clampZoom = useCallback((value: number): number => Math.min(4, Math.max(0.25, value)), []);

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

  const applyZoom = useCallback((next: number | ((value: number) => number), mode: 'original' | 'zoom-in' | 'zoom-out'): void => {
    setFitToViewport(false);
    setManualZoomMode(mode);
    setZoom(current => {
      const resolved = typeof next === 'function' ? next(current) : next;
      const clamped = clampZoom(resolved);

      return Number.parseFloat(clamped.toFixed(4));
    });
  }, [clampZoom]);

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

  const handleResetZoom = (): void => {
    applyZoom(1, 'original');
  };

  const handleZoomIn = (): void => {
    applyZoom(value => value + 0.05, 'zoom-in');
  };

  const handleZoomOut = (): void => {
    applyZoom(value => value - 0.05, 'zoom-out');
  };

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

    if (scaledWidth <= width) {
      viewport.scrollLeft = Math.max((viewport.scrollWidth - width) / 2, 0);
    }

    if (scaledHeight <= height) {
      viewport.scrollTop = Math.max((viewport.scrollHeight - height) / 2, 0);
    }
  }, [scaledHeight, scaledWidth]);

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
  const activeToolbarButton = fitToViewport ? 'fit' : manualZoomMode;

  return {
    hasProject,
    hasCards,
    selectedCard,
    cardOptions,
    localeOptions,
    hasLocalization,
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
  };
}
