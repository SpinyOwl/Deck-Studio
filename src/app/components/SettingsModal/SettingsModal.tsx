// src/components/SettingsModal/SettingsModal.tsx
import {MonacoEditorPane} from '../MonacoEditorPane';
import './SettingsModal.css';
import type {ThemeVariables} from "../../types/theme.ts";

interface SettingsModalProps {
  readonly isOpen: boolean;
  readonly content: string;
  readonly path: string;
  readonly error: string | null;
  readonly isSaving: boolean;
  onChange(value: string): void;
  onClose(): void;
  onSave(): void;
  themeId: string;
  themeVariables: ThemeVariables;
}

/**
 * Presents the application settings inside a Monaco editor overlay.
 */
export function SettingsModal({
  isOpen,
  content,
  path,
  error,
  isSaving,
  onChange,
  onClose,
  onSave,
  themeId,
  themeVariables,
}: SettingsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="settings-overlay" role="dialog" aria-modal="true" aria-labelledby="settings-editor-title">
      <section className="settings-editor" aria-labelledby="settings-editor-title">
        <header className="settings-editor__header">
          <div className="settings-editor__heading">
            <p className="settings-editor__eyebrow">Application settings</p>
            <h2 id="settings-editor-title" className="settings-editor__title">
              settings.yml
            </h2>
            <p className="settings-editor__path" title={path}>
              {path}
            </p>
          </div>
          <div className="settings-editor__toolbar">
            <button type="button" className="button button--ghost" onClick={onClose}>
              Close
            </button>
            <button type="button" className="button" onClick={onSave} disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save settings'}
            </button>
          </div>
        </header>

        <div className="settings-editor__body">
          <MonacoEditorPane path={path || 'settings.yml'} value={content} onChange={onChange} onSave={onSave}
                            themeId={themeId}
                            themeVariables={themeVariables} />
        </div>

        {error ? <p className="settings-editor__error">{error}</p> : null}
      </section>
    </div>
  );
}
