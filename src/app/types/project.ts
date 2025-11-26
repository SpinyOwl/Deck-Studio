// src/types/project.ts
import {type FileNode} from './files';

/**
 * Represents a single row from the cards CSV file keyed by column name.
 */
export interface CardRecord {
  [column: string]: string;
}

/**
 * Describes the configuration for the dashed border around exported cards.
 */
export interface PdfBorderConfig {
  thickness?: number;
  color?: string;
}

/**
 * Describes PDF export configuration including page size and orientation.
 */
export interface PdfExportConfig {
  pageSize?: string;
  orientation?: "p" | "portrait" | "l" | "landscape";
  border?: PdfBorderConfig;
  margin?: number
}

/**
 * Defines export settings for generated assets.
 */
export interface ExportConfig {
  dpi?: number;
  pdf?: PdfExportConfig;
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

  export?: ExportConfig;

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

/**
 * Defines the layout configuration for card rendering including dimensions and DPI.
 */
export interface CardLayoutConfig {
  width?: number;
  height?: number;
}

export const defaultLayoutConfig: CardLayoutConfig = {
  width: 750,
  height: 1050,
};
