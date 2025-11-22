// src/app/types/layout.ts

/**
 * Represents the persisted window size and position on disk.
 */
export type WindowLayout = {
  width: number;
  height: number;
  x: number | null;
  y: number | null;
  isMaximized: boolean;
};

/**
 * Describes panel sizes and collapsed state for the resizable layout.
 */
export type PanelLayout = {
  sidebarWidth: number;
  previewWidth: number;
  logsHeight: number;
  isProjectTreeCollapsed: boolean;
  isPreviewCollapsed: boolean;
  isLogsCollapsed: boolean;
};

/**
 * Combines window and panel layout details for persistence.
 */
export type LayoutState = {
  window: WindowLayout;
  panels: PanelLayout;
};
