// src/components/CsvEditorPane/CsvEditorPane.tsx
import React from 'react';
import Editor, {type OnMount} from '@monaco-editor/react';
import type * as monaco from 'monaco-editor';
import {
  CSV_DELIMITER,
  normalizeCsvGrid,
  parseCsvGrid,
  stringifyCsvGrid,
  type CsvGrid,
} from '../../utils/csv';
import './CsvEditorPane.css';

interface Props {
  readonly data: CsvGrid;
  readonly onChange: (data: CsvGrid) => void;
  readonly onSave: () => void;
  readonly fileName?: string;
}

interface ColumnRange {
  readonly startColumn: number;
  readonly endColumn: number;
}

/**
 * Safely parses CSV content into a normalized grid, gracefully falling back on loose parsing.
 *
 * @param content - Raw CSV text from the editor.
 * @returns Parsed CSV grid suitable for downstream consumers.
 */
function safeParseCsvContent(content: string): CsvGrid {
  try {
    return parseCsvGrid(content);
  } catch {
    const fallbackGrid = content.split(/\r?\n/).map(splitRowByDelimiter);
    return normalizeCsvGrid(fallbackGrid.map(row => row.map(unquoteCell)));
  }
}

/**
 * Splits a CSV row by the configured delimiter while honoring quoted segments.
 *
 * @param row - Raw CSV row string.
 * @returns Cell values exactly as typed, without trimming whitespace.
 */
function splitRowByDelimiter(row: string): string[] {
  const cells: string[] = [];
  let currentStart = 0;
  let inQuotes = false;

  for (let index = 0; index <= row.length; index += 1) {
    const character = row[index];
    const isQuote = character === '"';
    const isEscapedQuote = inQuotes && character === '"' && row[index + 1] === '"';

    if (isEscapedQuote) {
      index += 1;
      continue;
    }

    if (isQuote) {
      inQuotes = !inQuotes;
      continue;
    }

    const atDelimiter = !inQuotes && character === CSV_DELIMITER;
    const atEndOfRow = index === row.length;

    if (!atDelimiter && !atEndOfRow) {
      continue;
    }

    cells.push(row.slice(currentStart, index));
    currentStart = index + 1;
  }

  return cells;
}

/**
 * Removes wrapping quotes from a CSV cell and unescapes embedded quotes, preserving whitespace.
 *
 * @param cell - Raw cell content that may include surrounding quotes.
 * @returns Unescaped cell value ready for normalization.
 */
function unquoteCell(cell: string): string {
  const startsWithQuote = cell.startsWith('"');
  const endsWithQuote = cell.endsWith('"');

  if (!startsWithQuote || !endsWithQuote || cell.length < 2) {
    return cell;
  }

  return cell.slice(1, -1).replace(/""/g, '"');
}

/**
 * Calculates column ranges for a row, skipping delimiters while respecting quoted segments.
 *
 * @param row - Raw CSV row string.
 * @returns Column start and end pairs for each cell, excluding the delimiter itself.
 */
function mapColumnRanges(row: string): ColumnRange[] {
  const ranges: ColumnRange[] = [];
  let cellStartIndex = 0;
  let inQuotes = false;

  for (let index = 0; index <= row.length; index += 1) {
    const character = row[index];
    const isQuote = character === '"';
    const isEscapedQuote = inQuotes && character === '"' && row[index + 1] === '"';

    if (isEscapedQuote) {
      index += 1;
      continue;
    }

    if (isQuote) {
      inQuotes = !inQuotes;
      continue;
    }

    const atDelimiter = !inQuotes && character === CSV_DELIMITER;
    const atEndOfRow = index === row.length;

    if (!atDelimiter && !atEndOfRow) {
      continue;
    }

    const startColumn = cellStartIndex + 1;
    const endColumn = index + 1;

    if (endColumn > startColumn) {
      ranges.push({startColumn, endColumn});
    }

    cellStartIndex = index + 1;
  }

  return ranges;
}

/**
 * Generates alternating column decorations for the Monaco model to visually separate columns.
 *
 * @param monacoInstance - Monaco namespace instance.
 * @param content - Current editor content.
 * @returns Array of Monaco decorations representing column backgrounds.
 */
function buildColumnDecorations(
  monacoInstance: typeof monaco,
  content: string,
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

  const rows = content.split(/\r?\n/);

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
          inlineClassName: colors[cellIndex % colors.length],
        },
      });
    });

    return decorations;
  });
}

/**
 * Renders a Monaco-based CSV editor with rainbow column highlighting and save shortcut support.
 *
 * @param props - Component props.
 * @returns CSV editor pane backed by the Monaco code editor.
 */
export const CsvEditorPane: React.FC<Props> = ({data, onChange, onSave, fileName}) => {
  const editorRef = React.useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = React.useRef<typeof monaco | null>(null);
  const saveHandlerRef = React.useRef<() => void>(() => {});
  const decorationIds = React.useRef<string[]>([]);

  const [content, setContent] = React.useState<string>(() => stringifyCsvGrid(data));

  React.useEffect(() => {
    setContent(stringifyCsvGrid(data));
  }, [data]);

  React.useEffect(() => {
    saveHandlerRef.current = onSave;
  }, [onSave]);

  const applyDecorations = React.useCallback(
    (model: monaco.editor.ITextModel | null, value: string) => {
      if (!model || !monacoRef.current) {
        return;
      }

      decorationIds.current = model.deltaDecorations(
        decorationIds.current,
        buildColumnDecorations(monacoRef.current, value),
      );
    },
    [],
  );

  const handleEditorChange = React.useCallback(
    (value?: string) => {
      const nextContent = value ?? '';
      setContent(nextContent);
      onChange(safeParseCsvContent(nextContent));
      applyDecorations(editorRef.current?.getModel() ?? null, nextContent);
    },
    [applyDecorations, onChange],
  );

  const handleMount = React.useCallback<OnMount>((editor, monacoInstance) => {
    editorRef.current = editor;
    monacoRef.current = monacoInstance;
    const model = editor.getModel();

    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, () => {
      saveHandlerRef.current();
    });

    applyDecorations(model, content);
  }, [applyDecorations, content]);

  return (
    <div className="csv-editor" aria-label={fileName ? `${fileName} CSV editor` : 'CSV editor'}>
      <Editor
        height="100%"
        language="plaintext"
        theme="vs-dark"
        value={content}
        onChange={handleEditorChange}
        onMount={handleMount}
        options={{
          fontSize: 14,
          minimap: {enabled: false},
          automaticLayout: true,
          wordWrap: 'on',
        }}
      />
    </div>
  );
};
