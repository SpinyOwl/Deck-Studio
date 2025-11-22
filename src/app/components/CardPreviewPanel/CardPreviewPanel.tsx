// src/components/CardPreviewPanel/CardPreviewPanel.tsx
import React from 'react';
import './CardPreviewPanel.css';

interface Props {
  readonly collapsed: boolean;
}

interface ToolbarButtonProps {
  readonly icon: string;
  readonly label: string;
}

interface ToolbarSelectProps {
  readonly placeholder: string;
  readonly tooltip: string;
  readonly options: string[];
}

/**
 * Renders an icon button for the preview toolbar.
 *
 * @param props - Icon glyph and label configuration for the button.
 * @returns Toolbar button element.
 */
const ToolbarButton: React.FC<ToolbarButtonProps> = ({icon, label}) => (<button
    type="button"
    className="card-preview__icon-button"
    aria-label={label}
    title={label}
  >
    <span aria-hidden className="material-symbols-outlined">{icon}</span>
  </button>);

/**
 * Renders a select input with a placeholder entry for the preview toolbar.
 *
 * @param props - Select placeholder, tooltip, and option labels.
 * @returns Toolbar select element.
 */
const ToolbarSelect: React.FC<ToolbarSelectProps> = ({placeholder, tooltip, options}) => (<select
    className="card-preview__select"
    aria-label={tooltip}
    title={tooltip}
    defaultValue=""
  >
    <option value="" disabled hidden>
      {placeholder}
    </option>
    {options.map(option => (<option key={option} value={option}>
        {option}
      </option>))}
  </select>);

/**
 * Displays the card preview container with toolbar controls and placeholder content.
 */
export const CardPreviewPanel: React.FC<Props> = ({collapsed}) => {
  const languages = ['English', 'Español', 'Deutsch'];
  const cards = ['Card A', 'Card B', 'Card C'];

  return (<section className={`card-preview panel ${collapsed ? 'panel--collapsed' : 'panel--expanded'}`}>
      <div className="panel__header">Card preview</div>
      <div className="panel__body">
        <div className="placeholder-text">Select a card file to see a preview.</div>
        <div className="card-preview__toolbar" aria-label="Card preview toolbar">
          <ToolbarButton icon="view_real_size" label="Original size"/>
          <ToolbarButton icon="zoom_out" label="Zoom out"/>
          <ToolbarButton icon="zoom_in" label="Zoom in"/>
          <ToolbarButton icon="fit_screen" label="Zoom to fit"/>
          <ToolbarSelect
            placeholder="Language"
            tooltip="Language"
            options={languages}
          />
          <ToolbarSelect
            placeholder="Card"
            tooltip="Card"
            options={cards}
          />
        </div>
      </div>
    </section>);
};
