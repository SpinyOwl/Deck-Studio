// src/utils/csv.ts
export const CSV_DELIMITER = ',';

export interface CsvColumnRange {
  readonly startColumn: number;
  readonly endColumn: number;
}

/**
 * Calculates column ranges for a raw CSV row, respecting quoted segments and escaped quotes.
 *
 * @param row - Raw CSV row content.
 * @returns Column start and end indices for each cell.
 */
export function mapColumnRanges(row: string): CsvColumnRange[] {
  const ranges: CsvColumnRange[] = [];
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
 * Splits CSV content into rows while preserving empty trailing lines.
 *
 * @param content - Raw CSV text.
 * @returns Array of row strings.
 */
export function splitCsvRows(content: string): string[] {
  return content.split(/\r?\n/);
}
