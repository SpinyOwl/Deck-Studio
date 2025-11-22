// src/services/LayoutService.ts
import {type LayoutState, type PanelLayout} from '../types/layout';

const DEFAULT_LAYOUT: LayoutState = {
  window: {
    width: 1200,
    height: 800,
    x: null,
    y: null,
    isMaximized: false,
  },
  panels: {
    sidebarWidth: 280,
    previewWidth: 360,
    logsHeight: 200,
    isProjectTreeCollapsed: false,
    isPreviewCollapsed: false,
    isLogsCollapsed: false,
  },
};

/**
 * Coordinates reading and persisting layout data through the Electron preload API.
 */
export class LayoutService {
  /**
   * Loads the latest layout state from disk, falling back to defaults on failure.
   *
   * @returns Persisted layout state for the current user.
   */
  public async loadLayout(): Promise<LayoutState> {
    try {
      return await window.api.loadLayoutState();
    } catch (error) {
      console.error('Unable to load layout state', error);
      return DEFAULT_LAYOUT;
    }
  }

  /**
   * Persists panel layout changes while leaving window bounds untouched.
   *
   * @param panels - Latest panel sizes and collapse states to persist.
   */
  public async savePanels(panels: PanelLayout): Promise<void> {
    await window.api.saveLayoutState({ panels });
  }
}

export const layoutService = new LayoutService();
