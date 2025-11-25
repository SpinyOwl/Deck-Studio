// src/types/settings.ts

/**
 * Describes autosave configuration options.
 */
export interface AutosaveSettingsConfig {
  enabled?: boolean;
  intervalSeconds?: number;
}

/**
 * Represents application settings loaded from the YAML file.
 */
export interface AppSettings {
  theme?: string;
  autosave?: boolean | AutosaveSettingsConfig;
  editor?: {
    fontSize?: number;
    wordWrap?: string;
    tabSize?: number;
  };
  recentProjects?: string[];
  [key: string]: unknown;
}
