// src/services/MonacoThemeService.ts
import type {editor} from 'monaco-editor';
import {DEFAULT_THEME_ID, DEFAULT_THEME_VARIABLES} from '../constants/themes';
import {type ThemeVariableName, type ThemeVariables} from '../types/theme';

const LIGHT_BASE_THEME = 'vs';
const DARK_BASE_THEME = 'vs-dark';

/**
 * Computes Monaco editor theme definitions derived from Deck Studio theme variables.
 */
export class MonacoThemeService {
  /**
   * Safely resolves a theme variable with a fallback to the default theme values.
   *
   * @param variables - Active theme variables.
   * @param name - Variable name to resolve.
   * @returns The resolved color string.
   */
  private resolveVariable(variables: ThemeVariables, name: ThemeVariableName): string {
    return variables[name] ?? DEFAULT_THEME_VARIABLES[name] ?? '#000000';
  }

  /**
   * Normalizes hex color strings to RGB components.
   *
   * @param value - Color string to parse.
   * @returns RGB components when the value is parsable, otherwise null.
   */
  private parseHexColor(value?: string): {r: number; g: number; b: number} | null {
    if (!value) {
      return null;
    }

    const normalized = value.trim().replace('#', '');

    if (!(normalized.length === 3 || normalized.length === 6)) {
      return null;
    }

    const expanded = normalized.length === 3
      ? normalized.split('').map(char => char + char).join('')
      : normalized;

    const r = Number.parseInt(expanded.slice(0, 2), 16);
    const g = Number.parseInt(expanded.slice(2, 4), 16);
    const b = Number.parseInt(expanded.slice(4, 6), 16);

    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
      return null;
    }

    return {r, g, b};
  }

  /**
   * Calculates the relative luminance of an RGB color using the WCAG formula.
   *
   * @param color - RGB components representing the target color.
   * @returns Relative luminance between 0 and 1.
   */
  private calculateRelativeLuminance(color: {r: number; g: number; b: number}): number {
    const normalizeChannel = (value: number) => {
      const scaled = value / 255;
      return scaled <= 0.03928 ? scaled / 12.92 : Math.pow((scaled + 0.055) / 1.055, 2.4);
    };

    return (
      0.2126 * normalizeChannel(color.r) +
      0.7152 * normalizeChannel(color.g) +
      0.0722 * normalizeChannel(color.b)
    );
  }

  /**
   * Determines whether the theme should be treated as light or dark within Monaco.
   *
   * @param variables - Active theme variables merged with defaults.
   * @returns Monaco base theme identifier.
   */
  public inferBaseTheme(variables: ThemeVariables): typeof LIGHT_BASE_THEME | typeof DARK_BASE_THEME {
    const background = this.resolveVariable(variables, 'color-background');
    const parsed = this.parseHexColor(background);

    if (!parsed) {
      return DARK_BASE_THEME;
    }

    const luminance = this.calculateRelativeLuminance(parsed);

    return luminance >= 0.5 ? LIGHT_BASE_THEME : DARK_BASE_THEME;
  }

  /**
   * Builds a Monaco theme definition from the provided theme variables.
   *
   * @param themeId - Identifier of the active theme.
   * @param variables - Resolved theme variables.
   * @returns Theme name and Monaco theme data.
   */
  public buildTheme(
    themeId: string,
    variables: ThemeVariables,
  ): {name: string; definition: editor.IStandaloneThemeData} {
    const base = this.inferBaseTheme(variables);
    const effectiveThemeId = themeId?.trim() || DEFAULT_THEME_ID;
    const name = `deckstudio-${effectiveThemeId}`;
    const background = this.resolveVariable(variables, 'color-surface');
    const contrast = this.resolveVariable(variables, 'color-surface-contrast');
    const hover = this.resolveVariable(variables, 'color-surface-hover');
    const border = this.resolveVariable(variables, 'color-border');
    const activeBorder = this.resolveVariable(variables, 'color-focus');
    const accent = this.resolveVariable(variables, 'color-accent');
    const foreground = this.resolveVariable(variables, 'color-text-primary');
    const muted = this.resolveVariable(variables, 'color-text-muted');
    const placeholder = this.resolveVariable(variables, 'color-text-placeholder');
    const selection = this.resolveVariable(variables, 'color-tree-selection');
    const selectionText = this.resolveVariable(variables, 'color-tree-selection-text');

    const colors: editor.IColors = {
      'editor.background': background,
      'editor.foreground': foreground,
      'editor.lineHighlightBackground': hover,
      'editorLineNumber.foreground': muted,
      'editorLineNumber.activeForeground': selectionText,
      'editorCursor.foreground': activeBorder,
      'editor.selectionBackground': selection,
      'editor.inactiveSelectionBackground': selection,
      'editor.selectionHighlightBackground': selection,
      'editor.selectionForeground': selectionText,
      'editorWhitespace.foreground': border,
      'editorIndentGuide.background': border,
      'editorIndentGuide.activeBackground': activeBorder,
      'editorGutter.background': background,
      'editorGutter.modifiedBackground': accent,
      'editorGutter.addedBackground': accent,
      'editorGutter.deletedBackground': activeBorder,
      'editorRuler.foreground': border,
      'editorHoverHighlight.background': contrast,
      'editorLink.activeForeground': accent,
      'editorSuggestWidget.background': contrast,
      'editorSuggestWidget.foreground': foreground,
      'editorSuggestWidget.selectedBackground': selection,
      'editorSuggestWidget.highlightForeground': activeBorder,
      'editorWidget.background': contrast,
      'input.placeholderForeground': placeholder,
      'scrollbarSlider.background': border,
      'scrollbarSlider.hoverBackground': activeBorder,
      'minimap.background': background,
    };

    return {
      name,
      definition: {
        base,
        inherit: true,
        rules: [],
        colors,
      },
    };
  }

  /**
   * Registers and activates the Monaco theme derived from the provided variables.
   *
   * @param monacoInstance - Monaco namespace instance.
   * @param themeId - Identifier of the active theme.
   * @param variables - Resolved theme variables.
   * @returns Name of the applied Monaco theme.
   */
  public applyTheme(
    monacoInstance: typeof import('monaco-editor'),
    themeId: string,
    variables: ThemeVariables,
  ): string {
    const {name, definition} = this.buildTheme(themeId, variables);

    monacoInstance.editor.defineTheme(name, definition);
    monacoInstance.editor.setTheme(name);

    return name;
  }
}

export const monacoThemeService = new MonacoThemeService();
