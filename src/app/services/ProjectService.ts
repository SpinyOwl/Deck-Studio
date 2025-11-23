// src/services/ProjectService.ts

import Papa from 'papaparse';
import {
  type CardRecord,
  type LocalizationMessages,
  type LoadedTemplate,
  type Project,
  type ProjectConfig,
  type ProjectLocalization,
  type ProjectTemplates,
  type ResolvedCard,
} from '../types/project';
import {type FileNode} from '../types/files';
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

    return this.buildProject(selection);
  }

  /**
   * Reloads an existing project using its root path, rebuilding the tree and configuration data.
   *
   * @param rootPath - Absolute path to the project root.
   * @returns Refreshed project metadata or null when loading fails.
   */
  public async reloadProject(rootPath: string): Promise<Project | null> {
    if (!rootPath || !rootPath.trim()) {
      logService.add('Cannot reload a project without a valid root path.', 'warning');
      return null;
    }

    const selection = await window.api.loadProjectFolder(rootPath);
    if (!selection) {
      logService.add(`Unable to reload project at ${rootPath}. It may have been removed.`, 'error');
      return null;
    }

    return this.buildProject(selection);
  }

  /**
   * Reloads localization for an existing project and re-renders card templates for the selected locale.
   *
   * @param project - Current project instance to update.
   * @param locale - Locale code selected by the user.
   * @returns Updated project with refreshed localization and resolved cards.
   */
  public async changeLocale(project: Project, locale: string): Promise<Project> {
    const localization = await this.loadLocalization(project.rootPath, project.config, project.tree, locale);
    const templateColumn = this.getTemplateColumnName(project.config);
    const resolvedCards = this.resolveCardTemplates(
      project.cards,
      project.templates,
      templateColumn,
      localization,
      project.config,
    );

    return {
      ...project,
      localization,
      resolvedCards,
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
   * Loads localization messages for the configured default locale when available.
   *
   * @param rootPath - Absolute path to the project root.
   * @param config - Parsed project configuration providing localization settings.
   * @param tree - Project file tree used to discover available locales.
   * @param localeOverride - Locale requested by the user when different from the default.
   * @returns Loaded localization metadata or null when missing.
   */
  public async loadLocalization(
    rootPath: string,
    config: ProjectConfig | null,
    tree?: FileNode[],
    localeOverride?: string,
  ): Promise<ProjectLocalization | null> {

    const directory = config?.localization?.directory?.trim() || 'i18n';
    const availableLocales = this.collectAvailableLocales(tree ?? [], rootPath, directory);
    const requestedLocale = localeOverride?.trim() || config?.localization?.defaultLocale?.trim() || 'en';
    const locale = requestedLocale || availableLocales[0] || 'en';
    const localizationPath = this.resolveProjectFilePath(rootPath, `${directory}/${locale}.yml`);

    try {
      const content = await this.files.readTextFile(localizationPath);
      const messages = this.yamlParser.parse<LocalizationMessages>(content);
      logService.add(`Loaded localization for locale "${locale}" from ${localizationPath}`);

      return {locale, messages, availableLocales};
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      logService.add(`Failed to load localization from ${localizationPath}: ${reason}`, 'warning');

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
  public async loadProjectTemplates(rootPath: string, config: ProjectConfig | null, cards: CardRecord[] | null): Promise<ProjectTemplates> {
    const templates: ProjectTemplates = {cardTemplates: {}};
    const templateColumn = this.getTemplateColumnName(config);
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
   * Identifies available localization bundles within the configured directory.
   *
   * @param tree - Project file tree to search for localization files.
   * @param rootPath - Absolute project root for path normalization.
   * @param localizationDirectory - Relative directory containing localization YAML files.
   * @returns Sorted list of locale codes derived from localization filenames.
   */
  private collectAvailableLocales(tree: FileNode[], rootPath: string, localizationDirectory: string): string[] {
    const locales = new Set<string>();
    const normalizedDirectory = this.normalizePathSeparators(
      this.resolveProjectFilePath(rootPath, localizationDirectory),
    );
    const normalizedDirectoryWithSlash = `${normalizedDirectory}/`;

    const traverse = (nodes: FileNode[]) => {
      nodes.forEach(node => {
        const normalizedPath = this.normalizePathSeparators(node.path);

        if (
          node.type === 'file'
          && (normalizedPath.endsWith('.yml') || normalizedPath.endsWith('.yaml'))
          && normalizedPath.startsWith(normalizedDirectoryWithSlash)
        ) {
          const locale = node.name.replace(/\.ya?ml$/i, '');
          if (locale.trim()) {
            locales.add(locale.trim());
          }

          return;
        }

        if (node.children && node.children.length > 0) {
          traverse(node.children);
        }
      });
    };

    traverse(tree);

    return Array.from(locales).sort();
  }

  /**
   * Normalizes path separators to forward slashes for consistent comparisons.
   *
   * @param path - File system path to normalize.
   * @returns Path string using forward slashes only.
   */
  private normalizePathSeparators(path: string): string {
    return path.replace(/\\/g, '/');
  }

  /**
   * Builds a fully hydrated project instance from a folder selection.
   *
   * @param selection - Selected project root and file tree.
   * @returns Hydrated project metadata including config, cards, and templates.
   */
  private async buildProject(selection: { rootPath: string; tree: FileNode[] }): Promise<Project> {
    const configPath = this.resolveProjectConfigPath(selection.rootPath);
    const config = await this.loadProjectConfig(selection.rootPath);
    const cards = await this.loadProjectCards(selection.rootPath);
    const localization = await this.loadLocalization(selection.rootPath, config, selection.tree);
    const templates = await this.loadProjectTemplates(selection.rootPath, config, cards);
    const templateColumn = this.getTemplateColumnName(config);
    const resolvedCards = this.resolveCardTemplates(cards, templates, templateColumn, localization, config);

    return {
      rootPath: selection.rootPath,
      tree: selection.tree,
      configPath,
      config,
      cards,
      templates,
      localization,
      resolvedCards,
    };
  }

  /**
   * Resolves a template column name using project configuration defaults.
   *
   * @param config - Parsed project configuration when available.
   * @returns Normalized template column identifier.
   */
  private getTemplateColumnName(config: ProjectConfig | null): string {
    return config?.csv?.templateColumn?.trim() || 'template';
  }

  /**
   * Resolves the column name containing card identifiers for localization lookups.
   *
   * @param config - Parsed project configuration when available.
   * @returns Normalized identifier column name.
   */
  private getIdColumnName(config: ProjectConfig | null): string {
    return config?.csv?.idColumn?.trim() || 'id';
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
   * Maps card entries to ready-to-render HTML using configured templates and fallbacks.
   *
   * @param cards - Parsed card entries from CSV.
   * @param templates - Loaded templates referenced by the project.
   * @param templateColumn - Column name used to locate a per-card template path.
   * @returns Collection of resolved cards containing rendered HTML.
   */
  private resolveCardTemplates(
    cards: CardRecord[] | null,
    templates: ProjectTemplates,
    templateColumn: string,
    localization: ProjectLocalization | null,
    config: ProjectConfig | null,
  ): ResolvedCard[] {
    if (!cards || cards.length === 0) {
      return [];
    }

    const resolved: ResolvedCard[] = [];

    cards.forEach((card, index) => {
      const rendered = this.resolveCardTemplate(card, index, templates, templateColumn, localization, config);
      if (rendered) {
        resolved.push(rendered);
      }
    });

    return resolved;
  }

  /**
   * Selects an appropriate template for a single card and renders its HTML content.
   *
   * @param card - Card data row from the CSV.
   * @param index - Zero-based index of the card in the source CSV.
   * @param templates - Loaded templates available for rendering.
   * @param templateColumn - Column name containing the template path reference.
   * @returns Resolved card metadata and HTML, or null when no template is available.
   */
  private resolveCardTemplate(
    card: CardRecord,
    index: number,
    templates: ProjectTemplates,
    templateColumn: string,
    localization: ProjectLocalization | null,
    config: ProjectConfig | null,
  ): ResolvedCard | null {
    const requestedPath = card[templateColumn]?.trim();
    const cardTemplate = requestedPath ? templates.cardTemplates[requestedPath] : undefined;

    if (requestedPath && !cardTemplate && !templates.defaultTemplate) {
      logService.add(
        `Unable to render card at row ${index + 1}: template "${requestedPath}" not found and no default template configured.`,
        'warning',
      );

      return null;
    }

    if (requestedPath && !cardTemplate && templates.defaultTemplate) {
      logService.add(
        `Template "${requestedPath}" missing for card at row ${index + 1}. Falling back to default template.`,
        'warning',
      );
    }

    const template = cardTemplate || templates.defaultTemplate;
    if (!template) {
      logService.add(`Unable to render card at row ${index + 1}: no template available.`, 'warning');

      return null;
    }

    const html = this.renderCardHtml(template.content, card, index, localization, config);
    const templatePath = cardTemplate && requestedPath ? requestedPath : template.path;

    return {index, html, templatePath, card};
  }

  /**
   * Substitutes CSV fields and meta placeholders within a template to produce final card HTML.
   *
   * @param templateContent - Raw HTML fragment from the loaded template.
   * @param card - Card data row providing replacement values.
   * @param index - Zero-based index of the card for meta placeholders.
   * @returns Rendered HTML string with placeholders replaced.
   */
  private renderCardHtml(
    templateContent: string,
    card: CardRecord,
    index: number,
    localization: ProjectLocalization | null,
    config: ProjectConfig | null,
  ): string {
    const withLocalization = this.replaceLocalizationPlaceholders(
      templateContent,
      card,
      localization,
      this.getIdColumnName(config),
    );
    const replacements: Record<string, string> = {
      index: String(index),
      index1: String(index + 1),
      row: String(index + 1),
      ...card,
    };

    return Object
      .entries(replacements)
      .reduce((rendered, [placeholder, value]) => this.replacePlaceholder(rendered, placeholder, value ?? ''), withLocalization);
  }

  /**
   * Resolves localization placeholders within a template, using card metadata for card-specific keys.
   *
   * @param template - Template content potentially containing localization placeholders.
   * @param card - Card data providing IDs and CSV fallbacks.
   * @param localization - Loaded localization bundle when available.
   * @param idColumn - Column name that holds card identifiers.
   * @returns Template content with localization placeholders replaced or gracefully downgraded.
   */
  private replaceLocalizationPlaceholders(
    template: string,
    card: CardRecord,
    localization: ProjectLocalization | null,
    idColumn: string,
  ): string {
    const cardId = card[idColumn]?.trim();
    const messages = localization?.messages;
    const pattern = /{{\s*(?:t|i18n):([^}]+)\s*}}/g;

    return template.replace(pattern, (_match, rawKey: string) => {
      const trimmedKey = rawKey.trim();
      const normalizedKey = this.normalizeLocalizationKey(trimmedKey, cardId);
      if (messages) {
        const localized = this.lookupLocalizationValue(messages, normalizedKey);
        if (localized !== undefined) {
          return localized;
        }
      }

      const fallback = this.resolveLocalizationFallback(trimmedKey, card);

      return fallback ?? this.renderMissingLocalizationPlaceholder(trimmedKey);
    });
  }

  /**
   * Converts shorthand localization keys into their fully qualified form.
   *
   * @param key - Raw localization key from the template placeholder.
   * @param cardId - Identifier for the current card, when present.
   * @returns Normalized localization lookup key.
   */
  private normalizeLocalizationKey(key: string, cardId?: string): string {
    const [namespace, ...segments] = key.split('.');

    if (namespace === 'card' && segments.length > 0 && cardId) {
      const remainder = segments.join('.');

      return `cards.${cardId}.${remainder}`;
    }

    return key;
  }

  /**
   * Retrieves a localized value using a dotted lookup path.
   *
   * @param messages - Root localization messages object.
   * @param key - Dotted path representing the localization lookup key.
   * @returns Matching localized string when found.
   */
  private lookupLocalizationValue(messages: LocalizationMessages, key: string): string | undefined {
    const segments = key.split('.');
    let current: unknown = messages;

    for (const segment of segments) {
      if (!segment || typeof current !== 'object' || current === null) {
        return undefined;
      }

      current = (current as Record<string, unknown>)[segment];
    }

    return typeof current === 'string' ? current : undefined;
  }

  /**
   * Provides a CSV fallback value when localization cannot be resolved.
   *
   * @param rawKey - Original localization key from the template.
   * @param card - Card data row used for fallback values.
   * @returns Value from the CSV or an empty string when unavailable.
   */
  private resolveLocalizationFallback(rawKey: string, card: CardRecord): string | null {
    const fallbackField = this.getFallbackFieldName(rawKey);

    if (!fallbackField) {
      return null;
    }

    const fallbackValue = card[fallbackField];

    return fallbackValue === undefined || fallbackValue === null ? null : fallbackValue;
  }

  /**
   * Extracts a field name from a localization key for CSV fallback usage.
   *
   * @param rawKey - Localization key referencing a card or namespace field.
   * @returns Field name suitable for CSV lookup when present.
   */
  private getFallbackFieldName(rawKey: string): string | null {
    const segments = rawKey.split('.');
    const lastSegment = segments[segments.length - 1]?.trim();

    if (!lastSegment) {
      return null;
    }

    return lastSegment;
  }

  /**
   * Wraps an unresolved localization placeholder in a highlighted span for visibility.
   *
   * @param rawKey - Original localization key from the template.
   * @returns Styled HTML preserving the placeholder for debugging.
   */
  private renderMissingLocalizationPlaceholder(rawKey: string): string {
    const placeholder = `{{t:${rawKey}}}`;

    return `<span style="color: red; text-shadow: 0 0 2px white;">${placeholder}</span>`;
  }

  /**
   * Replaces a placeholder token with its corresponding value in a template string.
   *
   * @param template - Template content where replacements should be applied.
   * @param placeholder - Placeholder token to replace.
   * @param value - Replacement value for the placeholder.
   * @returns Template content with the placeholder substituted.
   */
  private replacePlaceholder(template: string, placeholder: string, value: string): string {
    const pattern = new RegExp(`{{\\s*${this.escapeForRegex(placeholder)}\\s*}}`, 'g');

    return template.replace(pattern, value);
  }

  /**
   * Escapes a string so it can be safely used within a regular expression.
   *
   * @param value - Raw string to escape.
   * @returns Regex-safe escaped string.
   */
  private escapeForRegex(value: string): string {
    const specialCharactersPattern = /[.*+?^${}()|[\]\\]/g;

    return value.replace(specialCharactersPattern, match => `\\${match}`);
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
