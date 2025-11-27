import React from 'react';

interface ToolbarButtonProps {
  readonly icon: string;
  readonly label: string;
  readonly active?: boolean;
  onClick?(): void;
}

interface ToolbarSelectProps {
  readonly placeholder: string;
  readonly tooltip: string;
  readonly options: Array<{ value: string; label: string }>;
  readonly value: string;
  onChange(value: string): void;
}

interface CardPreviewToolbarProps {
  readonly activeMode: 'original' | 'zoom-in' | 'zoom-out' | 'fit';
  readonly localeOptions: Array<{ value: string; label: string }>;
  readonly selectedLocale: string;
  readonly cardOptions: Array<{ value: string; label: string }>;
  readonly selectedCard: string;
  onChangeLocale(value: string): void;
  onChangeCard(value: string): void;
  onResetZoom(): void;
  onZoomOut(): void;
  onZoomIn(): void;
  onFit(): void;
}

/**
 * Renders a toolbar button.
 *
 * @param props - Icon, label, and handlers for the button.
 * @returns Button element for the toolbar.
 */
const ToolbarButton: React.FC<ToolbarButtonProps> = ({icon, label, active = false, onClick}) => (<button
  type="button"
  className={`card-preview__icon-button${active ? ' card-preview__icon-button--active' : ''}`}
  aria-label={label}
  aria-pressed={active}
  title={label}
  onClick={onClick}
>
  <span aria-hidden className="material-symbols-outlined">{icon}</span>
</button>);

/**
 * Renders a select element used by the toolbar.
 *
 * @param props - Placeholder, tooltip, options, and change handler.
 * @returns Select element with provided options.
 */
const ToolbarSelect: React.FC<ToolbarSelectProps> = ({placeholder, tooltip, options, value, onChange}) => (<select
  className="card-preview__select"
  aria-label={tooltip}
  title={tooltip}
  value={value}
  onChange={(event) => onChange(event.target.value)}
  onWheel={(event) => handleSelectScroll(event, options, value, onChange)}
>
  <option value="" disabled hidden>
    {placeholder}
  </option>

  {options.map(option => (<option key={option.value} value={option.value}>
    {option.label}
  </option>))}
</select>);

/**
 * Handles scrolling interactions on toolbar select elements to navigate options.
 *
 * @param event - Wheel event triggered on the select element.
 * @param options - Available select options.
 * @param value - Currently selected option value.
 * @param onChange - Callback to update the selected value.
 */
function handleSelectScroll(
  event: React.WheelEvent<HTMLSelectElement>,
  options: Array<{ value: string; label: string }>,
  value: string,
  onChange: (nextValue: string) => void,
): void {
  if (options.length === 0) {
    return;
  }

  const direction = event.deltaY > 0 ? 1 : -1;
  const currentIndex = options.findIndex(option => option.value === value);

  if (currentIndex === -1) {
    return;
  }

  event.stopPropagation();

  const nextIndex = Math.min(Math.max(currentIndex + direction, 0), options.length - 1);

  if (nextIndex !== currentIndex) {
    onChange(options[nextIndex].value);
  }
}

/**
 * Toolbar for the card preview panel containing zoom controls and selectors.
 *
 * @param props - Toolbar configuration and callbacks.
 * @returns Toolbar element for the card preview panel.
 */
export const CardPreviewToolbar: React.FC<CardPreviewToolbarProps> = ({
  activeMode,
  localeOptions,
  selectedLocale,
  cardOptions,
  selectedCard,
  onChangeLocale,
  onChangeCard,
  onResetZoom,
  onZoomOut,
  onZoomIn,
  onFit,
}) => (<div className="card-preview__toolbar" aria-label="Card preview toolbar">

  <div className="row">
  <ToolbarButton
    icon="view_real_size"
    label="Original size"
    onClick={onResetZoom}
    active={activeMode === 'original'}
  />
  <ToolbarButton
    icon="zoom_out"
    label="Zoom out"
    onClick={onZoomOut}
    active={activeMode === 'zoom-out'}
  />
  <ToolbarButton
    icon="zoom_in"
    label="Zoom in"
    onClick={onZoomIn}
    active={activeMode === 'zoom-in'}
  />
  <ToolbarButton icon="fit_screen" label="Zoom to fit" onClick={onFit} active={activeMode === 'fit'} />
  </div>
  <div className="row">
  <ToolbarSelect
    placeholder="Language"
    tooltip="Language"
    options={localeOptions}
    value={selectedLocale}
    onChange={onChangeLocale}
  />

  <ToolbarSelect
    placeholder="Card"
    tooltip="Card"
    options={cardOptions}
    value={selectedCard}
    onChange={onChangeCard}
  />
  </div>
</div>);
