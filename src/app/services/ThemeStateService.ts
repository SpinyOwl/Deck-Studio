// src/services/ThemeStateService.ts
import {useEffect, useState} from 'react';
import {DEFAULT_THEME_ID, DEFAULT_THEME_VARIABLES, THEME_VARIABLE_KEYS} from '../constants/themes';
import {type ThemeVariables} from '../types/theme';

interface ThemeState {
  themeId: string;
  themeVariables: ThemeVariables;
}

type ThemeStateListener = (state: ThemeState) => void;

/**
 * Centralized store for the current theme identifier and resolved variables.
 * Provides subscription-based updates so components can react without prop drilling.
 */
export class ThemeStateService {
  private themeId: string = DEFAULT_THEME_ID;

  private themeVariables: ThemeVariables = {...DEFAULT_THEME_VARIABLES};

  private listeners = new Set<ThemeStateListener>();

  /**
   * Retrieves the current theme identifier.
   *
   * @returns The active theme id.
   */
  public getThemeId(): string {
    return this.themeId;
  }

  /**
   * Returns the resolved theme variables.
   *
   * @returns Current theme variables merged with defaults.
   */
  public getThemeVariables(): ThemeVariables {
    return this.cloneVariables(this.themeVariables);
  }

  /**
   * Obtains a snapshot of the active theme state.
   *
   * @returns Theme identifier and variables.
   */
  public getState(): ThemeState {
    return {
      themeId: this.themeId,
      themeVariables: this.getThemeVariables(),
    };
  }

  /**
   * Updates the active theme data and notifies subscribers when changes occur.
   *
   * @param themeId - Identifier of the active theme.
   * @param variables - Resolved theme variables to expose.
   */
  public setTheme(themeId: string, variables: ThemeVariables): void {
    const sanitizedThemeId = themeId?.trim() || DEFAULT_THEME_ID;
    const mergedVariables = this.mergeWithDefaults(variables);
    const hasChanged = sanitizedThemeId !== this.themeId || this.hasVariableChanges(mergedVariables);

    if (!hasChanged) {
      return;
    }

    this.themeId = sanitizedThemeId;
    this.themeVariables = mergedVariables;
    this.notify();
  }

  /**
   * Subscribes to theme updates and immediately invokes the listener with the current state.
   *
   * @param listener - Callback to invoke on changes.
   * @returns Function to unsubscribe.
   */
  public subscribe(listener: ThemeStateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());

    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const state = this.getState();
    this.listeners.forEach(listener => listener(state));
  }

  private mergeWithDefaults(variables: ThemeVariables): ThemeVariables {
    return {
      ...DEFAULT_THEME_VARIABLES,
      ...variables,
    };
  }

  private hasVariableChanges(next: ThemeVariables): boolean {
    return THEME_VARIABLE_KEYS.some(key => this.themeVariables[key] !== next[key]);
  }

  private cloneVariables(variables: ThemeVariables): ThemeVariables {
    return {...variables};
  }
}

export const themeStateService = new ThemeStateService();

/**
 * React hook that exposes the active theme state from the singleton service.
 *
 * @returns Current theme identifier and variables.
 */
export function useThemeState(): ThemeState {
  const [themeState, setThemeState] = useState<ThemeState>(() => themeStateService.getState());

  useEffect(() => themeStateService.subscribe(setThemeState), []);

  return themeState;
}
