// src/services/CsvParser.ts
import Papa from 'papaparse';
import {type CardRecord, type ProjectConfig} from '../types/project';

export const CARDS_FILENAME = 'cards.csv';

/**
 * Handles CSV parsing and column resolution for project data files.
 */
export class CsvParser {
  /**
   * Parses CSV content into a collection of card records using the header row for keys.
   *
   * @param content - Raw CSV content to parse.
   * @returns Parsed card records.
   */
  public parse(content: string): CardRecord[] {
    const {data, errors} = Papa.parse<CardRecord>(content, {
      header: true, skipEmptyLines: 'greedy', transformHeader: header => header.trim(),
    });

    if (errors.length > 0) {
      const [{message, row}] = errors;
      const errorDetails = row !== undefined ? `${message} (row ${row})` : message;

      throw new Error(`Unable to parse ${CARDS_FILENAME}: ${errorDetails}`);
    }

    return data
      .filter(record => Object.values(record).some(value => value !== undefined))
      .map(record => {
        const normalized: CardRecord = {};

        Object.entries(record).forEach(([key, value]) => {
          if (!key) {
            return;
          }

          normalized[key] = value !== undefined && value !== null ? String(value).trim() : '';
        });

        return normalized;
      });
  }

  /**
   * Resolves a template column name using project configuration defaults.
   *
   * @param config - Parsed project configuration when available.
   * @returns Normalized template column identifier.
   */
  public getTemplateColumnName(config: ProjectConfig | null): string {
    return config?.csv?.templateColumn?.trim() || 'template';
  }

  /**
   * Resolves the column name containing card identifiers for localization lookups.
   *
   * @param config - Parsed project configuration when available.
   * @returns Normalized identifier column name.
   */
  public getIdColumnName(config: ProjectConfig | null): string {
    return config?.csv?.idColumn?.trim() || 'id';
  }
}

export const csvParser = new CsvParser();
