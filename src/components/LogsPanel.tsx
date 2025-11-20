// src/components/LogsPanel.tsx
import React from 'react';

/**
 * Presents build, lint, and runtime logs in a dedicated panel.
 */
export const LogsPanel: React.FC = () => {
  return (
    <section className="logs panel">
      <div className="panel__header">Logs</div>
      <div className="panel__body">
        <div className="placeholder-text">Build, lint, and runtime logs will appear here.</div>
      </div>
    </section>
  );
};
