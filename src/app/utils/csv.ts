// src/utils/csv.ts
import Papa from 'papaparse';

export type CsvGrid = string[][];

/**
 * Normalizes a grid of CSV values into a string matrix, coercing values to strings.
 *
 * @param data - Arbitrary matrix-like data received from the CSV editor.
 * @returns Matrix of string values safe for serialization.
 */
export function normalizeCsvGrid(data: unknown): CsvGrid {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map(row => {
    if (!Array.isArray(row)) {
      return [''];
    }

    return row.map(cell => (cell ?? '').toString());
  });
}

/**
 * Parses raw CSV content into a normalized matrix suitable for the editor.
 *
 * @param content - Raw CSV text content.
 * @returns Parsed matrix of string values.
 * @throws When parsing fails or the CSV is malformed.
 */
export function parseCsvGrid(content: string): CsvGrid {
  const {data, errors} = Papa.parse<string[]>(content, {
    skipEmptyLines: false,
  });

  if (errors.length > 0) {
    const [{message, row}] = errors;
    const errorDetails = row !== undefined ? `${message} (row ${row})` : message;
    throw new Error(`Unable to parse CSV file: ${errorDetails}`);
  }

  return normalizeCsvGrid(data);
}

/**
 * Serializes a CSV matrix back into string content.
 *
 * @param data - Matrix of string values to serialize.
 * @returns CSV text representing the provided matrix.
 */
export function stringifyCsvGrid(data: CsvGrid): string {
  if (data.length === 0) {
    return '';
  }

  let result = '';

  for (const element of data) {
    for (let j = 0; j < element.length; j++) {
      result += element[j];
      if (j < element.length - 1) result += ',';
    }
    result += '\n';
  }

  return result;
}
