// src/components/MonacoEditorPane/MonacoEditorPane.tsx
import React from 'react';
import Editor, {type OnMount} from '@monaco-editor/react';
import type * as monaco from 'monaco-editor';
import {mapColumnRanges, splitCsvRows} from '../../utils/csv';
import './MonacoEditorPane.css';

interface Props {
  path?: string;
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
}

/**
 * Determines whether the provided path references a CSV document.
 *
 * @param path - Optional file path.
 * @returns True when the path points to a CSV file.
 */
function isCsvPath(path?: string): boolean {
  return Boolean(path && path.toLowerCase().endsWith('.csv'));
}

/**
 * Infers the Monaco language identifier based on the file extension.
 *
 * @param path - Optional file path to inspect.
 * @returns Monaco language identifier or plaintext as a fallback.
 */
function inferLanguage(path?: string): string | undefined {
  if (!path) return 'plaintext';
  if (isCsvPath(path)) return 'plaintext';
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
 * Generates alternating column decorations for the Monaco model to visually separate columns.
 *
 * @param monacoInstance - Monaco namespace instance.
 * @param content - Current editor content.
 * @param activeColumn - Currently highlighted column index.
 * @returns Array of Monaco decorations representing column backgrounds.
 */
function buildColumnDecorations(
  monacoInstance: typeof monaco,
  content: string,
  activeColumn: number | null,
): monaco.editor.IModelDeltaDecoration[] {
  const colors = [
    'csv-column-color-0',
    'csv-column-color-1',
    'csv-column-color-2',
    'csv-column-color-3',
    'csv-column-color-4',
    'csv-column-color-5',
    'csv-column-color-6',
    'csv-column-color-7',
    'csv-column-color-8',
    'csv-column-color-9',
    'csv-column-color-10',
    'csv-column-color-11',
    'csv-column-color-12',
    'csv-column-color-13',
    'csv-column-color-14',
    'csv-column-color-15',
    'csv-column-color-16',
    'csv-column-color-17',
    'csv-column-color-18',
    'csv-column-color-19',
  ];

  const rows = splitCsvRows(content);

  return rows.flatMap((row, rowIndex) => {
    const decorations: monaco.editor.IModelDeltaDecoration[] = [];
    const columnRanges = mapColumnRanges(row);

    columnRanges.forEach((range, cellIndex) => {
      decorations.push({
        range: new monacoInstance.Range(
          rowIndex + 1,
          range.startColumn,
          rowIndex + 1,
          range.endColumn,
        ),
        options: {
          inlineClassName: `${colors[cellIndex % colors.length]}${
            activeColumn === cellIndex ? ' csv-column-active' : ''
          }`,
        },
      });
    });

    return decorations;
  });
}

/**
 * Derives the CSV column index from a Monaco position and model content.
 *
 * @param model - Monaco text model backing the editor.
 * @param position - Current cursor position within the model.
 * @returns Zero-based column index or null when no column is found.
 */
function resolveColumnIndex(
  model: monaco.editor.ITextModel,
  position: monaco.Position,
): number | null {
  const rowContent = model.getLineContent(position.lineNumber);
  const columnRanges = mapColumnRanges(rowContent);
  const targetIndex = columnRanges.findIndex(
    (range) => position.column >= range.startColumn && position.column < range.endColumn,
  );

  return targetIndex >= 0 ? targetIndex : null;
}

/**
 * Renders the Monaco editor configured for the active file and binds common shortcuts.
 *
 * @param props - Monaco editor pane props.
 * @returns Monaco editor instance wrapped in a flex container.
 */
export const MonacoEditorPane: React.FC<Props> = ({ path, value, onChange, onSave }) => {
  const editorRef = React.useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = React.useRef<typeof monaco | null>(null);
  const saveHandlerRef = React.useRef<() => void>(() => {});
  const decorationIds = React.useRef<string[]>([]);

  const [activeColumn, setActiveColumn] = React.useState<number | null>(null);
  const [content, setContent] = React.useState<string>(() => value);

  const isCsv = React.useMemo(() => isCsvPath(path), [path]);

  React.useEffect(() => {
    setContent(value);
  }, [value]);

  React.useEffect(() => {
    saveHandlerRef.current = onSave;
  }, [onSave]);

  const applyDecorations = React.useCallback(
    (model: monaco.editor.ITextModel | null, nextValue: string, highlightedColumn: number | null) => {
      if (!model || !monacoRef.current) {
        return;
      }

      decorationIds.current = model.deltaDecorations(
        decorationIds.current,
        isCsv ? buildColumnDecorations(monacoRef.current, nextValue, highlightedColumn) : [],
      );
    },
    [isCsv],
  );

  const handleEditorChange = React.useCallback(
    (nextValue?: string) => {
      const updatedValue = nextValue ?? '';
      setContent(updatedValue);
      onChange(updatedValue);

      if (isCsv) {
        applyDecorations(editorRef.current?.getModel() ?? null, updatedValue, activeColumn);
      }
    },
    [activeColumn, applyDecorations, isCsv, onChange],
  );

  const handleEditorMount = React.useCallback<OnMount>((editor, monacoInstance) => {
    editorRef.current = editor;
    monacoRef.current = monacoInstance;
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, () => {
      saveHandlerRef.current();
    });

    if (!isCsv) {
      return;
    }

    const model = editor.getModel();

    const updateActiveColumn = (position: monaco.Position) => {
      if (!model) {
        setActiveColumn(null);
        return;
      }

      setActiveColumn(resolveColumnIndex(model, position));
    };

    const initialPosition = editor.getPosition();
    if (initialPosition) {
      updateActiveColumn(initialPosition);
    }

    editor.onDidChangeCursorPosition(({position}) => {
      updateActiveColumn(position);
    });

    editor.onDidChangeCursorSelection(({selection}) => {
      updateActiveColumn(selection.getPosition());
    });

    applyDecorations(model, content, activeColumn);
  }, [activeColumn, applyDecorations, content, isCsv]);

  React.useEffect(() => {
    if (!isCsv) {
      const model = editorRef.current?.getModel() ?? null;
      decorationIds.current = model?.deltaDecorations(decorationIds.current, []) ?? [];
      setActiveColumn(null);
      return;
    }

    const model = editorRef.current?.getModel() ?? null;
    applyDecorations(model, content, activeColumn);
  }, [activeColumn, applyDecorations, content, isCsv]);

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <Editor
        height="100%"
        language={inferLanguage(path)}
        theme="vs-dark"
        path={path}
        value={content}
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
