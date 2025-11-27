// src/components/EditorPanel/EditorPanel.tsx
import React from 'react';
import {ImageViewer} from '../ImageViewer';
import {MonacoEditorPane} from '../MonacoEditorPane';
import './EditorPanel.css';

interface OpenFile {
  readonly path: string;
  readonly name: string;
  readonly content: string;
  readonly isDirty: boolean;
  readonly fileType: 'text' | 'image' | 'csv';
}

interface Props {
  readonly openFiles: OpenFile[];
  readonly activePath: string | null;
  readonly onSelectFile: (path: string) => void;
  readonly onCloseFile: (path: string) => void;
  readonly onChange: (value: string) => void;
  readonly onCsvChange: (value: string) => void;
  readonly onSave: () => void;
  readonly isVisible: boolean;
}

/**
 * Encapsulates the editor panel, renders open file tabs and hides it when no project is open.
 *
 * @param props - Editor panel props.
 * @returns Editor section containing tabs and the active file viewer.
 */
export const EditorPanel: React.FC<Props> = ({
  openFiles,
  activePath,
  onSelectFile,
  onCloseFile,
  onChange,
  onCsvChange,
  onSave,
  isVisible,
}) => {
  const tabRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const activeFile = openFiles.find(file => file.path === activePath);

  React.useEffect(() => {
    if (!activePath) {
      return;
    }

    const activeTab = tabRefs.current[activePath];

    if (activeTab) {
      activeTab.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [activePath]);

  return (
    <section className={`editor panel${isVisible ? '' : ' panel--hidden'}`}>
      <div className="panel__header panel__header--tabs" role="tablist" aria-label="Open files">
        {openFiles.length === 0 ? (
          <div className="editor__empty-state">Open a file from the tree to start editing.</div>
        ) : (
          openFiles.map(file => {
            const isActive = file.path === activePath;
            return (
              <div
                key={file.path}
                ref={(element) => {
                  tabRefs.current[file.path] = element;
                }}
                className={`editor__tab ${isActive ? 'is-active' : ''}`.trim()}
                role="tab"
                aria-selected={isActive}
                onClick={() => onSelectFile(file.path)}
              >
                <span className="editor__tab-label">{file.name}</span>
                <div className="editor__tab-actions">
                  {file.isDirty ? (
                    <span className="editor__tab-indicator" aria-label="Unsaved changes" />
                  ) : null}
                  <button
                    type="button"
                    className="editor__tab-close"
                    aria-label={`Close ${file.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onCloseFile(file.path);
                    }}
                  >
                    <span aria-hidden className="material-symbols-outlined editor__tab-close-icon">
                      close
                    </span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="panel__body panel__body--flush panel__body--editor">
        {activeFile ? (
          activeFile.fileType === 'image' ? (
            <div className="editor__viewer">
              <ImageViewer src={activeFile.content} alt={activeFile.name} />
            </div>
          ) : (
            <MonacoEditorPane
              path={activeFile.path}
              value={activeFile.content}
              onChange={activeFile.fileType === 'csv' ? onCsvChange : onChange}
              onSave={onSave}
            />
          )
        ) : (
          <div className="editor__empty-editor">Select a file to edit.</div>
        )}
      </div>
    </section>
  );
};
