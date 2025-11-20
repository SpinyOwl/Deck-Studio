// src/components/EditorPanel.tsx
import React from 'react';
import {MonacoEditorPane} from './MonacoEditorPane';

interface Props {
  readonly path?: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly isVisible: boolean;
}

/**
 * Encapsulates the editor panel and hides it when no project is open.
 */
export const EditorPanel: React.FC<Props> = ({ path, value, onChange, isVisible }) => {
  return (
    <section className={`editor panel${isVisible ? '' : ' panel--hidden'}`}>
      <div className="panel__body panel__body--flush">
        <MonacoEditorPane path={path} value={value} onChange={onChange} />
      </div>
    </section>
  );
};
