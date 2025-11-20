// src/components/LogsPanel.tsx
import React from 'react';

interface Props {
  readonly collapsed: boolean;
}

/**
 * Presents build, lint, and runtime logs in a dedicated panel.
 */
export const LogsPanel: React.FC<Props> = ({ collapsed }) => {
  return (
    <section className={`logs panel ${collapsed ? 'panel--collapsed' : 'panel--expanded'}`}>
      <div className="panel__header">Logs</div>
      <div className="panel__body">
        <div className="placeholder-text">Build, lint, and runtime logs will appear here.</div>
      </div>
    </section>
  );
};
