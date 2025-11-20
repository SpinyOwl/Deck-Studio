// src/components/CardPreviewPanel.tsx
import React from 'react';
import './CardPreviewPanel.css';

interface Props {
  readonly collapsed: boolean;
}

/**
 * Displays the card preview container with a placeholder for future content.
 */
export const CardPreviewPanel: React.FC<Props> = ({ collapsed }) => {

  return (
    <section className={`card-preview panel ${collapsed ? 'panel--collapsed' : 'panel--expanded'}`}>
      <div className="panel__header">Card preview</div>
      <div className="panel__body">
        <div className="placeholder-text">Select a card file to see a preview.</div>
      </div>
    </section>
  );
};
