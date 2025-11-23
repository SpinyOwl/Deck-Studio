// src/types/project.ts
import {type FileNode} from './files';

/**
 * Represents a single row from the cards CSV file keyed by column name.
 */
export interface CardRecord {
  [column: string]: string;
}

/**
 * Configuration schema describing project metadata and rendering defaults.
 */
export interface ProjectConfig {
  project?: {
    id?: string;
    name?: string;
    version?: number | string;
  };

  paths?: {
    csv?: string;
    outputDir?: string;
  };

  layout?: CardLayoutConfig;

  templates?: {
    default?: string;
    wrapper?: string;
  };

  defaults?: {
    template?: string;
    image?: string;
    wrapper?: string;
  };

  localization?: {
    directory?: string;
    defaultLocale?: string;
  };

  csv?: {
    idColumn?: string;
    templateColumn?: string;
    imageColumn?: string;
    widthColumn?: string;
    heightColumn?: string;
    sizeUnitColumn?: string;
    countColumn?: string;
  };

  // Allow extra fields without type errors
  [key: string]: unknown;
}

/**
 * Captures a loaded project including its configuration and file tree.
 */
export interface Project {
  rootPath: string;
  configPath: string;
  tree: FileNode[];
  config: ProjectConfig | null;
  cards: CardRecord[] | null;
  templates: ProjectTemplates;
  localization: ProjectLocalization | null;
  resolvedCards: ResolvedCard[];
}

/**
 * Represents a loaded HTML template used to render cards.
 */
export interface LoadedTemplate {
  path: string;
  content: string;
}

/**
 * Captures default and per-card templates resolved from the project configuration and CSV.
 */
export interface ProjectTemplates {
  defaultTemplate?: LoadedTemplate;
  cardTemplates: Record<string, LoadedTemplate>;
}

/**
 * Represents a localization file containing translations grouped by namespaces.
 */
export interface LocalizationMessages {
  columns?: Record<string, string>;
  common?: Record<string, string>;
  cards?: Record<string, Record<string, string>>;
  [key: string]: unknown;
}

/**
 * Captures localization metadata loaded for a project.
 */
export interface ProjectLocalization {
  locale: string;
  availableLocales: string[];
  messages: LocalizationMessages;
}

/**
 * Captures the rendered HTML and source metadata for a single card.
 */
export interface ResolvedCard {
  index: number;
  html: string;
  templatePath: string;
  card: CardRecord;
}

export type DimensionUnit = 'mm' | 'cm' | 'inch' | 'px';

/**
 * Defines the layout configuration for card rendering including dimensions and DPI.
 */
export interface CardLayoutConfig {
  width?: number;
  height?: number;
  pageSize?: string;
  dpi?: number;
  unit?: DimensionUnit;
}

export const defaultLayoutConfig: CardLayoutConfig = {
  width: 2.5,
  height: 3.5,
  dpi: 300,
  pageSize: 'A4',
  unit: 'inch',
};

/**
 * Converts a size from a unit to pixels based on the provided DPI.
 *
 * @param value - Numeric value to convert.
 * @param unit - Unit the value is expressed in.
 * @param dpi - Dots per inch used for conversion.
 * @returns Pixel-equivalent measurement.
 */
export function toPixels(value: number, unit: 'inch' | 'mm' | 'cm', dpi: number): number {
  switch (unit) {
    case 'inch':
      return value * dpi;
    case 'mm':
      return (value / 25.4) * dpi; // 25.4 mm in an inch
    case 'cm':
      return (value / 2.54) * dpi; // 2.54 cm in an inch
    default:
      return value;
  }
}
