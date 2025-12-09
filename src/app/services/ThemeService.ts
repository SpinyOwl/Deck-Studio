// src/services/ThemeService.ts
import {DEFAULT_THEME_DEFINITION, DEFAULT_THEME_ID, DEFAULT_THEME_VARIABLES, THEME_VARIABLE_KEYS} from '../constants/themes';
import {type ThemeDefinition, type ThemeVariables} from '../types/theme';

/**
 * Handles loading and applying theme definitions to the document root.
 */
export class ThemeService {
  /**
   * Chooses the most appropriate theme based on the requested identifier.
   *
   * @param preferredId - Theme identifier from the settings file.
   * @param availableThemes - Themes discovered on disk.
   * @returns Resolved theme to apply. Defaults to the built-in dark theme when none match.
   */
  public resolveTheme(preferredId: string | null, availableThemes: ThemeDefinition[]): ThemeDefinition {
    const sanitizedId = preferredId?.trim();
    const requestedTheme = sanitizedId
      ? availableThemes.find(theme => theme.id === sanitizedId)
      : undefined;

    if (requestedTheme) {
      return requestedTheme;
    }

    const defaultTheme = availableThemes.find(theme => theme.id === DEFAULT_THEME_ID);
    if (defaultTheme) {
      return defaultTheme;
    }

    return availableThemes[0] ?? DEFAULT_THEME_DEFINITION;
  }

  /**
   * Combines the fallback theme values with the selected theme variables.
   *
   * @param theme - Theme selected for the session.
   * @returns Merged variables including fallbacks for missing keys.
   */
  public mergeVariables(theme: ThemeDefinition | null): ThemeVariables {
    return {
      ...DEFAULT_THEME_VARIABLES,
      ...(theme?.variables ?? {}),
    };
  }

  /**
   * Applies the provided theme to the document root, updating CSS custom properties.
   *
   * @param theme - Theme to apply.
   * @returns Effective variables after merging with defaults.
   */
  public applyTheme(theme: ThemeDefinition | null): ThemeVariables {
    const resolvedTheme = theme ?? DEFAULT_THEME_DEFINITION;
    const mergedVariables = this.mergeVariables(resolvedTheme);

    if (typeof document === 'undefined') {
      return mergedVariables;
    }

    const root = document.documentElement;
    root.setAttribute('data-theme', resolvedTheme.id);

    for (const variable of THEME_VARIABLE_KEYS) {
      const value = mergedVariables[variable];
      if (typeof value === 'string') {
        root.style.setProperty(`--${variable}`, value);
      }
    }

    return mergedVariables;
  }
}

export const themeService = new ThemeService();
