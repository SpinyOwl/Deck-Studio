// src/services/ProjectService.ts

import Papa from 'papaparse';
import {
  type CardRecord, type LoadedTemplate, type Project, type ProjectConfig, type ProjectTemplates,
} from '../types/project';
import {fileService, FileService} from './FileService';
import {logService} from './LogService';
import {yamlParsingService, YamlParsingService} from './YamlParsingService';

const PROJECT_CONFIG_FILENAME = 'card-deck-project.yml';
const CARDS_FILENAME = 'cards.csv';

/**
 * Coordinates project-specific operations such as selection and configuration loading.
 */
export class ProjectService {
  public constructor(private readonly files: FileService, private readonly yamlParser: YamlParsingService,) {
  }

  /**
   * Opens the native folder picker, builds the project tree, and attempts to load the config.
   *
   * @returns Project metadata including parsed configuration when available.
   */
  public async selectProject(): Promise<Project | null> {
    const selection = await window.api.selectProjectFolder();
    if (!selection) {
      return null;
    }

    const configPath = this.resolveProjectConfigPath(selection.rootPath);
    const config = await this.loadProjectConfig(selection.rootPath);
    const cards = await this.loadProjectCards(selection.rootPath);
    const templates = await this.loadProjectTemplates(selection.rootPath, config, cards);

    return {
      rootPath: selection.rootPath, tree: selection.tree, configPath, config, cards, templates,
    };
  }

  /**
   * Loads and parses the project configuration file when present.
   *
   * @param rootPath - Absolute path to the project root.
   * @returns Parsed project configuration or null when the file is missing or invalid.
   */
  public async loadProjectConfig(rootPath: string): Promise<ProjectConfig | null> {
    const configPath = this.resolveProjectConfigPath(rootPath);
    try {
      const content = await this.files.readTextFile(configPath);

      return this.yamlParser.parse<ProjectConfig>(content);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      logService.add(`Failed to load ${PROJECT_CONFIG_FILENAME}: ${reason}`, 'warning');

      return null;
    }
  }

  /**
   * Loads and parses the cards CSV file into records indexed by header names.
   *
   * @param rootPath - Absolute path to the project root.
   * @returns Parsed card entries or null when loading fails.
   */
  public async loadProjectCards(rootPath: string): Promise<CardRecord[] | null> {
    const cardsPath = this.resolveProjectFilePath(rootPath, CARDS_FILENAME);
    try {
      const content = await this.files.readTextFile(cardsPath);

      return this.parseCsv(content);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      logService.add(`Failed to load ${CARDS_FILENAME}: ${reason}`, 'warning');

      return null;
    }
  }

  /**
   * Loads templates referenced by the project configuration and card entries.
   *
   * @param rootPath - Absolute path to the project root.
   * @param config - Parsed project configuration when available.
   * @param cards - Parsed card entries when available.
   * @returns Loaded templates separated by default and per-card references.
   */
  public async loadProjectTemplates(rootPath: string, config: ProjectConfig | null, cards: CardRecord[] | null,): Promise<ProjectTemplates> {
    const templates: ProjectTemplates = {cardTemplates: {}};
    const templateColumn = config?.csv?.templateColumn?.trim() || 'template';
    const loadedTemplates = new Map<string, LoadedTemplate>();

    const defaultTemplatePath = config?.templates?.default || config?.defaults?.template;
    if (defaultTemplatePath) {
      const absolutePath = this.resolveProjectFilePath(rootPath, defaultTemplatePath);
      const loaded = await this.loadTemplateContent(absolutePath, loadedTemplates);
      if (loaded) {
        templates.defaultTemplate = loaded;
      }
    }

    if (!cards) {
      return templates;
    }

    const uniqueTemplatePaths = new Map<string, string>();
    cards.forEach(card => {
      const rawPath = card[templateColumn];
      if (!rawPath) {
        return;
      }

      const normalizedPath = rawPath.trim();
      if (!normalizedPath) {
        return;
      }

      const absolutePath = this.resolveProjectFilePath(rootPath, normalizedPath);
      uniqueTemplatePaths.set(absolutePath, normalizedPath);
    });

    for (const [absolutePath, relativePath] of uniqueTemplatePaths.entries()) {
      const loaded = await this.loadTemplateContent(absolutePath, loadedTemplates);
      if (loaded) {
        templates.cardTemplates[relativePath] = loaded;
      }
    }

    if (templates.defaultTemplate) {
      logService.add(`Loaded default template from ${templates.defaultTemplate.path}`);
    }

    const cardTemplateCount = Object.keys(templates.cardTemplates).length;
    if (cardTemplateCount > 0) {
      logService.add(`Loaded ${cardTemplateCount} card-specific template(s).`);
      for (const cardTemplatesKey in templates.cardTemplates) {
        logService.add(`  - ${cardTemplatesKey}`);
      }
    }

    return templates;
  }

  /**
   * Builds the absolute path to the project configuration file for the given root directory.
   *
   * @param rootPath - Absolute path to the project root directory.
   * @returns Absolute path to the configuration file.
   */
  public resolveProjectConfigPath(rootPath: string): string {
    return this.resolveProjectFilePath(rootPath, PROJECT_CONFIG_FILENAME);
  }

  /**
   * Normalizes a root path and appends the provided filename using the correct separator.
   *
   * @param rootPath - Absolute root directory for the project.
   * @param filename - File name to append to the root path.
   * @returns Normalized absolute path for the requested file.
   */
  private resolveProjectFilePath(rootPath: string, filename: string): string {
    const usesBackslashSeparator = rootPath.includes('\\');
    const separator = usesBackslashSeparator ? '\\' : '/';
    const normalizedRoot = rootPath.endsWith(separator) ? rootPath : `${rootPath}${separator}`;

    return `${normalizedRoot}${filename}`;
  }

  /**
   * Parses CSV content into a collection of card records using the header row for keys.
   *
   * @param content - Raw CSV content to parse.
   * @returns Parsed card records.
   */
  private parseCsv(content: string): CardRecord[] {
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
   * Loads a template file from disk, using a cache to prevent duplicate reads.
   *
   * @param absolutePath - Absolute file system path to the template.
   * @param cache - Cache of previously loaded templates keyed by absolute path.
   * @returns Loaded template metadata, or null when the file cannot be read.
   */
  private async loadTemplateContent(absolutePath: string, cache: Map<string, LoadedTemplate>,): Promise<LoadedTemplate | null> {
    const cached = cache.get(absolutePath);
    if (cached) {
      return cached;
    }

    try {
      const content = await this.files.readTextFile(absolutePath);
      const loadedTemplate: LoadedTemplate = {path: absolutePath, content};
      cache.set(absolutePath, loadedTemplate);

      return loadedTemplate;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      logService.add(`Failed to load template at ${absolutePath}: ${reason}`, 'warning');

      return null;
    }
  }
}

export const projectService = new ProjectService(fileService, yamlParsingService);
