// src/components/CsvEditorPane/CsvEditorPane.tsx
import React from 'react';
import {ActiveTable} from "active-table-react";
import {ActiveTable as ActiveTableCore} from 'active-table';
import {type CsvGrid, normalizeCsvGrid} from '../../utils/csv';
import './CsvEditorPane.css';


interface Props {
  readonly data: CsvGrid;
  readonly onChange: (data: CsvGrid) => void;
  readonly onSave: () => void;
  readonly fileName?: string;
}

/**
 * Renders an editable CSV grid using the ActiveTable web component.
 *
 * @param props - Component props containing table data and event callbacks.
 * @returns CSV editor pane with keyboard shortcuts and change tracking.
 */
export const CsvEditorPane: React.FC<Props> = ({data, onChange, onSave, fileName}) => {
  let activeTableRef: React.Ref<ActiveTableCore> = React.useRef(null);
  React.useEffect(() => {
    if (activeTableRef.current) {
      activeTableRef.current.data = data;
    }
  }, [data]);

  React.useEffect(() => {
    const table = activeTableRef.current;

    if (!table) {
      return undefined;
    }

    const notifyChange = (payload: unknown) => {
      const nextData = normalizeCsvGrid(payload);
      onChange(nextData);
    };

    const handleCustomEvent = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      notifyChange(detail);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        onSave();
      }
    };

    table.onDataUpdate = notifyChange;
    table.addEventListener('data-changed', handleCustomEvent as EventListener);
    table.addEventListener('at-data-change', handleCustomEvent as EventListener);
    table.addEventListener('keydown', handleKeyDown);

    let overflow = table._overflow;
    if (overflow) overflow.overflowContainer.style.height = "100%";

    return () => {
      table.onDataUpdate = () => {
      };
      table.removeEventListener('data-changed', handleCustomEvent as EventListener);
      table.removeEventListener('at-data-change', handleCustomEvent as EventListener);
      table.removeEventListener('keydown', handleKeyDown);
    };
  }, [onChange, onSave]);

  return (<div className="csv-editor" aria-label={fileName ? `${fileName} CSV editor` : 'CSV editor'}>
    <ActiveTable
      displayHeaderIcons={false}
      data={data}
      className="csv-editor__table"
      ref={activeTableRef}
      stickyHeader={true}
      overflow={{maxHeight: "100%", maxWidth: "100%"}}
      preserveNarrowColumns={true}

      tableStyle={{
        backgroundColor: "var(--table-bg-color)",
        color: "var(--table-text-color)",
        borderColor: "var(--table-border-color)",
        height: "100%"
      }}

      headerStyles={{
        default: {backgroundColor: "var(--header-bg-color)", color: "var(--header-text-color)", verticalAlign: "middle", fontWeight:"bold"},
        hoverColors: {backgroundColor: "var(--color-surface-hover)"}
      }}
      cellStyle={{
        color: "var(--table-text-color)", padding:"4px 6px", borderColor: "var(--cell-border-color)"
      }}
      frameComponentsStyles={{
        styles: {
          default: {
            backgroundColor: "var(--frame-component-bg-color)"
          }
        }
      }}
      auxiliaryStyle={`      
::-webkit-scrollbar {
    height: 8px;
    width: 8px;
}
::-webkit-scrollbar-thumb {
    border-radius:2px;
    background-color: rgba(255, 255, 255, 0.2);
}
::-webkit-scrollbar-track {
    background-color: transparent;
}
::-webkit-scrollbar-button {
    display: none;
}
::-webkit-scrollbar-corner {
    display: none;
}
      `}
    />
  </div>);
};
