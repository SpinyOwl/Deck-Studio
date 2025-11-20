// src/components/CardPreviewPanel.tsx
import React from 'react';

/**
 * Displays the card preview container with a placeholder for future content.
 */
export const CardPreviewPanel: React.FC = () => {
  return (
    <section className="card-preview panel">
      <div className="panel__header">Card preview</div>
      <div className="panel__body">
        <div className="placeholder-text">Select a card file to see a preview.</div>
      </div>
    </section>
  );
};
