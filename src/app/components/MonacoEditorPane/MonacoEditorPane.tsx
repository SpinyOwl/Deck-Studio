// src/components/MonacoEditorPane/MonacoEditorPane.tsx
import React from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type * as monaco from 'monaco-editor';
import './MonacoEditorPane.css';
import { logService } from '../../services/LogService';

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
  const isInternalChange = React.useRef(false);
  const latestValueRef = React.useRef(value);

  React.useEffect(() => {
    saveHandlerRef.current = onSave;
  }, [onSave]);

  latestValueRef.current = value;

  // Log when the value prop changes from outside
  React.useEffect(() => {
    if (latestValueRef.current !== value) {
      logService.warning(`MonacoEditorPane: Value prop changed externally. Old length: ${latestValueRef.current.length}, New length: ${value.length}`, true);
      latestValueRef.current = value;
    }

    return () => {
      isInternalChange.current = false;
    };
  }, [value, isInternalChange]);

  const handleEditorMount = React.useCallback<OnMount>((editor, monacoInstance) => {
    editorRef.current = editor;
    logService.debug('MonacoEditorPane: Editor mounted.');

    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, () => {
      logService.debug('MonacoEditorPane: Save command executed.');
      saveHandlerRef.current();
    });

    editor.onDidChangeCursorPosition(e => {
      const position = e.position;
      const model = editor.getModel();
      if (model) {
        const lastLine = model.getLineCount();
        const lastColumn = model.getLineMaxColumn(lastLine);
        const isAtEnd = position.lineNumber === lastLine && position.column === lastColumn;
        logService.debug(`MonacoEditorPane: Cursor position changed to Line: ${position.lineNumber}, Col: ${position.column}. Is at end: ${isAtEnd}`);
      }
    });

    editor.onDidChangeModelContent(e => {
      logService.debug(`MonacoEditorPane: Model content changed. Changes: ${e.changes.length}`);
      // You can inspect e.changes for more details if needed
    });

  }, []);

  const handleEditorChange = React.useCallback((val: string | undefined) => {
    const newValue = val ?? '';
    if (latestValueRef.current !== newValue) {
      logService.debug(`MonacoEditorPane: Editor content changed by user. Old length: ${latestValueRef.current.length}, New length: ${newValue.length}`);
      latestValueRef.current = newValue;
      isInternalChange.current = true;
      onChange(newValue);
    }
  }, [onChange]);

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <Editor
        height="100%"
        language={inferLanguage(path)}
        theme="vs-dark"
        path={path}
        value={value}
        onChange={handleEditorChange}
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
