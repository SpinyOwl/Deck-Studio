// src/services/projectLoader.ts
import {type FileNode} from '../types/files';
import {type CardRecord, type ProjectConfig} from '../types/project';
import {CARDS_FILENAME, CsvParser, csvParser} from './CsvParser';
import {fileService, FileService} from './FileService';
import {logService} from './LogService';
import {notificationService} from './NotificationService'; // Import the new service
import {yamlParsingService, YamlParsingService} from './YamlParsingService';
import {PROJECT_CONFIG_FILENAME} from '../constants/project';

/**
 * Handles project selection and data loading from the filesystem.
 */
export class ProjectLoader {
  public constructor(
    private readonly files: FileService,
    private readonly yamlParser: YamlParsingService,
    private readonly csvParser: CsvParser,
  ) {
  }

  private async validateProjectFolder(folder: { rootPath: string; tree: FileNode[] }): Promise<boolean> {
    logService.add(`validating ${folder.rootPath}`, 'info')
    let validProjectFolder = folder.tree.some(node => node.type === 'file' && node.name === PROJECT_CONFIG_FILENAME);
    if (!validProjectFolder) {
      const message = `The selected folder is not a valid project. Missing ${PROJECT_CONFIG_FILENAME}.`;
      logService.add(message, 'warning');
      notificationService.showWarning(message); // Use the new notification service
      return false;
    }
    return true;
  }

  /**
   * Opens a native picker dialog to select a project directory.
   *
   * @returns Project root selection with the discovered tree when available.
   */
  public async selectProjectFolder(): Promise<{ rootPath: string; tree: FileNode[] } | null> {
    const selection = await window.api.selectProjectFolder();

    if (!selection) {
      const message = 'Project selection cancelled or failed.';
      logService.add(message, 'warning');
      notificationService.showWarning(message); // Use the new notification service
      return null;
    }
    logService.add(`Opening ${selection.rootPath}`, 'info')

    if (!(await this.validateProjectFolder(selection))) {
      return null;
    }

    return selection;
  }

  /**
   * Attempts to load a project folder using the provided root path.
   *
   * @param rootPath - Absolute path to the project root.
   * @returns Project root selection when available; otherwise null.
   */
  public async loadProjectFolder(rootPath: string): Promise<{ rootPath: string; tree: FileNode[] } | null> {
    if (!rootPath?.trim()) {
      const message = 'Cannot reload a project without a valid root path.';
      logService.add(message, 'warning');
      notificationService.showWarning(message); // Use the new notification service
      return null;
    }

    const selection = await window.api.loadProjectFolder(rootPath);
    if (!selection) {
      const message = `Unable to reload project at ${rootPath}. It may have been removed.`;
      logService.add(message, 'error');
      notificationService.showError(message); // Use the new notification service, changed to showError
      return null;
    }

    if (!(await this.validateProjectFolder(selection))) {
      return null;
    }

    return selection;
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
  public resolveProjectFilePath(rootPath: string, filename: string): string {
    const usesBackslashSeparator = rootPath.includes('\\');
    const separator = usesBackslashSeparator ? '\\' : '/';
    const normalizedRoot = rootPath.endsWith(separator) ? rootPath : `${rootPath}${separator}`;

    return `${normalizedRoot}${filename}`;
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

      return this.csvParser.parse(content);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      logService.add(`Failed to load ${CARDS_FILENAME}: ${reason}`, 'warning');

      return null;
    }
  }
}

export const projectLoader = new ProjectLoader(fileService, yamlParsingService, csvParser);
