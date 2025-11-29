import {defaultLayoutConfig, type CardRecord, type ProjectConfig} from '../types/project';

/**
 * Normalizes the CSV column names used for card sizing overrides.
 *
 * @param config - Project configuration containing custom column names.
 * @returns Normalized width and height column identifiers.
 */
export function getDimensionColumns(config: ProjectConfig | null): {
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
export function parseDimension(value: string | undefined): number | null {
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
export function resolveCardDimensions(card: CardRecord | null, config: ProjectConfig | null): {
  width: number;
  height: number;
} {
  const layout = {...defaultLayoutConfig, ...(config?.layout || {})};
  const columns = getDimensionColumns(config);
  const width = parseDimension(card?.[columns.widthColumn]) ?? layout.width ?? defaultLayoutConfig.width;
  const height = parseDimension(card?.[columns.heightColumn]) ?? layout.height ?? defaultLayoutConfig.height;

  return {
    width: width ?? defaultLayoutConfig.width!,
    height: height ?? defaultLayoutConfig.height!,
  };
}
