// src/components/MonacoEditorPane/MonacoEditorPane.tsx
import React from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import type * as monaco from 'monaco-editor';
import './MonacoEditorPane.css';

interface Props {
  path?: string;
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
}

/**
 * Infers the Monaco language identifier based on the file extension.
 *
 * @param path - Optional file path to inspect.
 * @returns Monaco language identifier or plaintext as a fallback.
 */
function inferLanguage(path?: string): string | undefined {
  if (!path) return 'plaintext';
  if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'typescript';
  if (path.endsWith('.js') || path.endsWith('.jsx')) return 'javascript';
  if (path.endsWith('.json')) return 'json';
  if (path.endsWith('.css')) return 'css';
  if (path.endsWith('.html')) return 'html';
  if (path.endsWith('.md')) return 'markdown';
  if (path.endsWith('.yml') || path.endsWith('.yaml')) return 'yaml';
  return 'plaintext';
}

/**
 * Renders the Monaco editor configured for the active file and binds common shortcuts.
 *
 * @param props - Monaco editor pane props.
 * @returns Monaco editor instance wrapped in a flex container.
 */
export const MonacoEditorPane: React.FC<Props> = ({ path, value, onChange, onSave }) => {
  const editorRef = React.useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const saveHandlerRef = React.useRef<() => void>(() => {});

  React.useEffect(() => {
    saveHandlerRef.current = onSave;
  }, [onSave]);

  const handleEditorMount = React.useCallback<OnMount>((editor, monacoInstance) => {
    editorRef.current = editor;
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, () => {
      saveHandlerRef.current();
    });
  }, []);

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <Editor
        height="100%"
        language={inferLanguage(path)}
        theme="vs-dark"
        value={value}
        onChange={(val) => onChange(val ?? '')}
        onMount={handleEditorMount}
        className={`${path ? 'editor-visible' : 'editor-hidden'}`}
        options={{
          fontSize: 14,
          minimap: { enabled: false },
          automaticLayout: true
        }}
      />
    </div>
  );
};
