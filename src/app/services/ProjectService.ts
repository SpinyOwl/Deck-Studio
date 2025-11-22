// src/services/ProjectService.ts

import {type Project, type ProjectConfig} from '../types/project';
import {fileService, FileService} from './FileService';
import {logService} from './LogService';
import {yamlParsingService, YamlParsingService} from './YamlParsingService';

const PROJECT_CONFIG_FILENAME = 'card-deck-project.yml';

/**
 * Coordinates project-specific operations such as selection and configuration loading.
 */
export class ProjectService {
  public constructor(
    private readonly files: FileService,
    private readonly yamlParser: YamlParsingService,
  ) {}

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

    return {
      rootPath: selection.rootPath,
      tree: selection.tree,
      configPath,
      config,
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
   * Builds the absolute path to the project configuration file for the given root directory.
   *
   * @param rootPath - Absolute path to the project root directory.
   * @returns Absolute path to the configuration file.
   */
  public resolveProjectConfigPath(rootPath: string): string {
    const usesBackslashSeparator = rootPath.includes('\\');
    const separator = usesBackslashSeparator ? '\\' : '/';
    const normalizedRoot = rootPath.endsWith(separator)
      ? rootPath
      : `${rootPath}${separator}`;

    return `${normalizedRoot}${PROJECT_CONFIG_FILENAME}`;
  }
}

export const projectService = new ProjectService(fileService, yamlParsingService);
