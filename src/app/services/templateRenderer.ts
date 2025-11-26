// src/services/templateRenderer.ts
import {
  type CardRecord,
  type LoadedTemplate,
  type LocalizationMessages,
  type ProjectLocalization,
  type ProjectTemplates,
  type ResolvedCard,
} from '../types/project';
import {logService} from './LogService';
import {fileService, type FileService} from './FileService';

/**
 * Loads templates and renders cards using provided data and localization.
 */
export class TemplateRenderer {
  public constructor(private readonly files: FileService) {}

  /**
   * Loads templates referenced by the project configuration and card entries.
   *
   * @param rootPath - Absolute path to the project root.
   * @param defaultTemplatePath - Path to the default template when configured.
   * @param cards - Parsed card entries when available.
   * @param templateColumn - Column name containing the template path reference.
   * @returns Loaded templates separated by default and per-card references.
   */
  public async loadProjectTemplates(
    rootPath: string,
    defaultTemplatePath: string | undefined,
    cards: CardRecord[] | null,
    templateColumn: string,
  ): Promise<ProjectTemplates> {
    const templates: ProjectTemplates = {cardTemplates: {}};
    const loadedTemplates = new Map<string, LoadedTemplate>();

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
      logService.info(`Loaded default template from ${templates.defaultTemplate.path}`);
    }

    const cardTemplateCount = Object.keys(templates.cardTemplates).length;
    if (cardTemplateCount > 0) {
      logService.info(`Loaded ${cardTemplateCount} card-specific template(s).`);
      for (const cardTemplatesKey in templates.cardTemplates) {
        logService.info(`  - ${cardTemplatesKey}`);
      }
    }

    return templates;
  }

  /**
   * Maps card entries to ready-to-render HTML using configured templates and fallbacks.
   *
   * @param cards - Parsed card entries from CSV.
   * @param templates - Loaded templates referenced by the project.
   * @param templateColumn - Column name used to locate a per-card template path.
   * @param idColumn - Column name containing the card identifier.
   * @param localization - Localization bundle to use for rendering.
   * @param rootPath - Absolute path to the project root for resolving relative assets.
   * @returns Collection of resolved cards containing rendered HTML.
   */
  public async resolveCardTemplates(
    cards: CardRecord[] | null,
    templates: ProjectTemplates,
    templateColumn: string,
    idColumn: string,
    localization: ProjectLocalization | null,
    rootPath: string,
  ): Promise<ResolvedCard[]> {
    if (!cards || cards.length === 0) {
      return [];
    }

    const resolved: ResolvedCard[] = [];

    for (const [index, card] of cards.entries()) {
      const rendered = await this.resolveCardTemplate(
        card,
        index,
        templates,
        templateColumn,
        idColumn,
        localization,
        rootPath,
      );
      if (rendered) {
        resolved.push(rendered);
      }
    }

    return resolved;
  }

  /**
   * Selects an appropriate template for a single card and renders its HTML content.
   *
   * @param card - Card data row from the CSV.
   * @param index - Zero-based index of the card in the source CSV.
   * @param templates - Loaded templates available for rendering.
   * @param templateColumn - Column name containing the template path reference.
   * @param idColumn - Column name containing the card identifier.
   * @param localization - Loaded localization bundle when available.
   * @param rootPath - Absolute path to the project root used to resolve relative assets.
   * @returns Resolved card metadata and HTML, or null when no template is available.
   */
  async resolveCardTemplate(
    card: CardRecord,
    index: number,
    templates: ProjectTemplates,
    templateColumn: string,
    idColumn: string,
    localization: ProjectLocalization | null,
    rootPath: string,
  ): Promise<ResolvedCard | null> {
    const requestedPath = card[templateColumn]?.trim();
    const cardTemplate = requestedPath ? templates.cardTemplates[requestedPath] : undefined;

    if (requestedPath && !cardTemplate && !templates.defaultTemplate) {
      logService.warning(
        `Unable to render card at row ${index + 1}: template "${requestedPath}" not found and no default template configured.`
      );

      return null;
    }

    if (requestedPath && !cardTemplate && templates.defaultTemplate) {
      logService.warning(
        `Template "${requestedPath}" missing for card at row ${index + 1}. Falling back to default template.`,
      );
    }

    const template = cardTemplate || templates.defaultTemplate;
    if (!template) {
      logService.warning(`Unable to render card at row ${index + 1}: no template available.`);

      return null;
    }

    const html = this.renderCardHtml(template.content, card, index, localization, idColumn);
    const resolvedHtml = await this.resolveRelativeLinks(html, rootPath);
    const templatePath = cardTemplate && requestedPath ? requestedPath : template.path;

    return {index, html: resolvedHtml, templatePath, card};
  }

  /**
   * Substitutes CSV fields and meta placeholders within a template to produce final card HTML.
   *
   * @param templateContent - Raw HTML fragment from the loaded template.
   * @param card - Card data row providing replacement values.
   * @param index - Zero-based index of the card for meta placeholders.
   * @param localization - Localization bundle used for translations.
   * @param idColumn - Column containing the identifier used for localization lookups.
   * @returns Rendered HTML string with placeholders replaced.
   */
  private renderCardHtml(
    templateContent: string,
    card: CardRecord,
    index: number,
    localization: ProjectLocalization | null,
    idColumn: string,
  ): string {
    const withLocalization = this.replaceLocalizationPlaceholders(
      templateContent,
      card,
      localization,
      idColumn,
    );
    const replacements: Record<string, string> = {
      index: String(index),
      index1: String(index + 1),
      row: String(index + 1),
      ...card,
    };

    const withReplacements = Object.entries(replacements).reduce(
      (rendered, [placeholder, value]) => this.replacePlaceholder(rendered, placeholder, value ?? ''),
      withLocalization,
    );

    return this.highlightMissingPlaceholders(withReplacements);
  }

  /**
   * Resolves relative asset references in rendered HTML to preview-safe URLs under the project root.
   *
   * @param html - Rendered HTML fragment that may contain relative src or href links.
   * @param rootPath - Absolute path to the project root where asset files are located.
   * @returns HTML with relative links replaced by project-scoped asset URLs.
   */
  private async resolveRelativeLinks(html: string, rootPath: string): Promise<string> {
    // Combined pattern for src/href attributes and url() in CSS
    const combinedPattern = /(?:(\b(?:src|href))=(["'])([^'"\s>]+)\2)|(?:url\((['"]?)([^)'"]+)\4\))/gi;
    const segments: string[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = combinedPattern.exec(html)) !== null) {
      const [fullMatch, attrName, attrQuote, attrValue, urlQuote, urlValue] = match;
      let resolved: string | null = null;
      let replacement: string = fullMatch;

      segments.push(html.slice(lastIndex, match.index));

      if (attrName && attrValue) { // It's a src/href attribute
        resolved = await this.resolveLocalAssetPath(attrValue, rootPath);
        if (resolved) {
          replacement = `${attrName}=${attrQuote}${resolved}${attrQuote}`;
        }
      } else if (urlValue) { // It's a url() in CSS
        resolved = await this.resolveLocalAssetPath(urlValue, rootPath);
        if (resolved) {
          replacement = `url(${urlQuote}${resolved}${urlQuote})`;
        }
      }
      // If resolved is null, replacement remains fullMatch, so no change.

      segments.push(replacement);
      lastIndex = match.index + fullMatch.length;
    }

    segments.push(html.slice(lastIndex));

    return segments.join('');
  }

  /**
   * Converts a relative asset path into a preview-safe URL anchored at the provided project root.
   *
   * @param value - Attribute value extracted from rendered HTML.
   * @param rootPath - Absolute path to the project root where assets reside.
   * @returns Asset URL string when the value is a relative path; otherwise null.
   */
  private async resolveLocalAssetPath(value: string, rootPath: string): Promise<string | null> {
    const trimmed = value.trim();

    if (!trimmed || this.isExternalUrl(trimmed) || this.isAbsolutePath(trimmed) || trimmed.startsWith('#')) {
      return null;
    }

    const normalized = trimmed.replace(/^\.\//, '');

    return window.api.resolveAssetUrl(rootPath, normalized);
  }

  /**
   * Detects absolute file system paths for common platforms.
   *
   * @param value - Candidate path string.
   * @returns True when the value represents an absolute path.
   */
  private isAbsolutePath(value: string): boolean {
    const normalized = value.trim();

    return normalized.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(normalized) || normalized.startsWith('\\\\');
  }

  /**
   * Determines whether an attribute value represents an external URL and should be left untouched.
   *
   * @param value - Attribute value extracted from rendered HTML.
   * @returns True when the value includes a URL scheme or protocol-relative path; otherwise false.
   */
  private isExternalUrl(value: string): boolean {
    const normalized = value.trim().toLowerCase();

    if (!normalized) {
      return false;
    }

    if (normalized.startsWith('//')) {
      return true;
    }

    return /^[a-z][a-z\d+.-]*:/.test(normalized);
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
   * Highlights unresolved card placeholders to make missing replacements visible in rendered output.
   *
   * @param rendered - Template content after applying known replacements.
   * @returns Template content with unresolved placeholders wrapped for visibility.
   */
  private highlightMissingPlaceholders(rendered: string): string {
    const placeholderPattern = /{{\s*([^{}]+?)\s*}}/g;

    return rendered.replace(placeholderPattern, match => this.renderMissingPlaceholder(match));
  }

  /**
   * Wraps an unresolved card placeholder in a red span to signal missing data.
   *
   * @param placeholder - Raw placeholder token that could not be replaced.
   * @returns Styled HTML preserving the original placeholder text.
   */
  private renderMissingPlaceholder(placeholder: string): string {
    return `<span style="color: red;">${placeholder}</span>`;
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
  private async loadTemplateContent(
    absolutePath: string,
    cache: Map<string, LoadedTemplate>,
  ): Promise<LoadedTemplate | null> {
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
      logService.warning(`Failed to load template at ${absolutePath}: ${reason}`);

      return null;
    }
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
}

export const templateRenderer = new TemplateRenderer(fileService);
