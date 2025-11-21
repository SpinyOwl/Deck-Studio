// src/services/YamlParsingService.ts

import {parse} from 'yaml';

/**
 * Parses YAML content safely and returns typed objects.
 */
export class YamlParsingService {
  /**
   * Converts YAML text into a strongly typed object.
   *
   * @typeParam T - Expected type of the parsed object.
   * @param yamlText - YAML content to parse.
   * @returns Parsed YAML data.
   */
  public parse<T>(yamlText: string): T {
    if (!yamlText.trim()) {
      throw new Error('YAML content is empty.');
    }

    return parse(yamlText) as T;
  }
}

export const yamlParsingService = new YamlParsingService();
