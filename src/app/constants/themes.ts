// src/constants/themes.ts
import {type ThemeDefinition, type ThemeVariableName, type ThemeVariables} from '../types/theme';

/**
 * Identifier for the built-in dark theme shipped with the application.
 */
export const DEFAULT_THEME_ID = 'dark';

/**
 * Supported CSS custom properties that can be themed.
 */
export const THEME_VARIABLE_KEYS: ThemeVariableName[] = [
  'color-background',
  'color-surface',
  'color-surface-contrast',
  'color-surface-raised',
  'color-surface-muted',
  'color-surface-accent',
  'color-surface-hover',
  'color-surface-pressed',
  'color-surface-disabled',
  'color-border',
  'color-border-subtle',
  'color-resize',
  'color-shadow',
  'color-text-primary',
  'color-text-strong',
  'color-text-secondary',
  'color-text-muted',
  'color-text-disabled',
  'color-text-placeholder',
  'color-text-contrast',
  'color-icon-muted',
  'color-icon-collapsed',
  'color-tree-selection',
  'color-tree-selection-text',
  'color-tree-icon',
  'color-tree-chevron',
  'color-tree-dir-icon',
  'color-tree-file-icon',
  'color-accent',
  'color-focus',
];

/**
 * Fallback variables for the default dark theme.
 */
export const DEFAULT_THEME_VARIABLES: ThemeVariables = {
  'color-background': '#050505',
  'color-surface': '#0f0f0f',
  'color-surface-contrast': '#0d0d0d',
  'color-surface-raised': '#1f1f1f',
  'color-surface-muted': '#171717',
  'color-surface-accent': '#242424',
  'color-surface-hover': '#2c2c2c',
  'color-surface-pressed': '#2b2b2b',
  'color-surface-disabled': '#141414',
  'color-border': '#1f1f1f',
  'color-border-subtle': '#2c2c2c',
  'color-resize': '#1f1f1f',
  'color-shadow': '#0a0a0a',
  'color-text-primary': '#f5f5f5',
  'color-text-strong': '#e6e6e6',
  'color-text-secondary': '#c9c9c9',
  'color-text-muted': '#9d9d9d',
  'color-text-disabled': '#6a6a6a',
  'color-text-placeholder': '#7f7f7f',
  'color-text-contrast': '#ffffff',
  'color-icon-muted': '#808080',
  'color-icon-collapsed': '#a6a6a6',
  'color-tree-selection': '#2e3b4e',
  'color-tree-selection-text': '#ffffff',
  'color-tree-icon': '#cfd8e3',
  'color-tree-chevron': '#9ca3af',
  'color-tree-dir-icon': '#fbbf24',
  'color-tree-file-icon': '#a5b4fc',
  'color-accent': '#5c7cfa',
  'color-focus': '#3b82f6',
};

/**
 * Complete fallback theme definition used when no theme files are available.
 */
export const DEFAULT_THEME_DEFINITION: ThemeDefinition = {
  id: DEFAULT_THEME_ID,
  name: 'Dark',
  description: 'Default high-contrast dark theme.',
  variables: DEFAULT_THEME_VARIABLES,
};
