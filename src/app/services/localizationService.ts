// src/services/localizationService.ts
import {type FileNode} from '../types/files';
import {type LocalizationMessages, type ProjectConfig, type ProjectLocalization} from '../types/project';
import {fileService, FileService} from './FileService';
import {logService} from './LogService';
import {yamlParsingService, YamlParsingService} from './YamlParsingService';

/**
 * Handles discovery and loading of localization bundles.
 */
export class LocalizationService {
  public constructor(
    private readonly files: FileService,
    private readonly yamlParser: YamlParsingService,
  ) {
  }

  /**
   * Loads a localization bundle for the requested or default locale.
   *
   * @param rootPath - Absolute project root path.
   * @param config - Parsed project configuration when available.
   * @param tree - Project tree used to discover available locales.
   * @param localeOverride - Explicit locale requested by the user.
   * @returns Loaded localization data or null on failure.
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
   * Normalizes path separators to forward slashes for consistent comparisons.
   *
   * @param path - File system path to normalize.
   * @returns Path string using forward slashes only.
   */
  private normalizePathSeparators(path: string): string {
    return path.replace(/\\/g, '/');
  }
}

export const localizationService = new LocalizationService(fileService, yamlParsingService);
