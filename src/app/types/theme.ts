// src/types/theme.ts

/**
 * Enumerates the allowed CSS custom properties supported by a theme definition.
 */
export type ThemeVariableName =
  | 'color-background'
  | 'color-surface'
  | 'color-surface-contrast'
  | 'color-surface-raised'
  | 'color-surface-muted'
  | 'color-surface-accent'
  | 'color-surface-hover'
  | 'color-surface-pressed'
  | 'color-surface-disabled'
  | 'color-border'
  | 'color-border-subtle'
  | 'color-resize'
  | 'color-shadow'
  | 'color-text-primary'
  | 'color-text-strong'
  | 'color-text-secondary'
  | 'color-text-muted'
  | 'color-text-disabled'
  | 'color-text-placeholder'
  | 'color-text-contrast'
  | 'color-icon-muted'
  | 'color-icon-collapsed'
  | 'color-tree-selection'
  | 'color-tree-selection-text'
  | 'color-tree-icon'
  | 'color-tree-chevron'
  | 'color-tree-dir-icon'
  | 'color-tree-file-icon'
  | 'color-accent'
  | 'color-focus';

/**
 * Maps known theme variables to their configured values.
 */
export type ThemeVariables = Partial<Record<ThemeVariableName, string>>;

/**
 * Describes a theme loaded from disk and ready to be applied to the UI.
 */
export interface ThemeDefinition {
  id: string;
  name: string;
  description?: string;
  variables: ThemeVariables;
}
