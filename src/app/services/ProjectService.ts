// src/services/ProjectService.ts
import {type Project} from '../types/project';
import {type FileNode} from '../types/files';
import {csvParser, CsvParser} from './CsvParser';
import {localizationService, LocalizationService} from './localizationService';
import {projectLoader, ProjectLoader} from './projectLoader';
import {templateRenderer, TemplateRenderer} from './templateRenderer';

/**
 * Coordinates project workflow by delegating to specialized services.
 */
export class ProjectService {
  public constructor(
    private readonly loader: ProjectLoader,
    private readonly localization: LocalizationService,
    private readonly renderer: TemplateRenderer,
    private readonly parser: CsvParser,
  ) {
  }

  /**
   * Opens the native folder picker, builds the project tree, and attempts to load the config.
   *
   * @returns Project metadata including parsed configuration when available.
   */
  public async selectProject(): Promise<Project | null> {
    const selection = await this.loader.selectProjectFolder();
    if (!selection) {
      return null;
    }

    return this.buildProject(selection);
  }

  /**
   * Reloads an existing project using its root path, rebuilding the tree and configuration data.
   *
   * @param rootPath - Absolute path to the project root.
   * @param localeOverride - Preferred locale to reload when available.
   * @returns Refreshed project metadata or null when loading fails.
   */
  public async reloadProject(rootPath: string, localeOverride?: string): Promise<Project | null> {
    const selection = await this.loader.loadProjectFolder(rootPath);
    if (!selection) {
      return null;
    }

    return this.buildProject(selection, localeOverride);
  }

  /**
   * Reloads localization for an existing project and re-renders card templates for the selected locale.
   *
   * @param project - Current project instance to update.
   * @param locale - Locale code selected by the user.
   * @returns Updated project with refreshed localization and resolved cards.
   */
  public async changeLocale(project: Project, locale: string): Promise<Project> {
    const localization = await this.localization.loadLocalization(
      project.rootPath,
      project.config,
      project.tree,
      locale,
    );
    const templateColumn = this.parser.getTemplateColumnName(project.config);
    const idColumn = this.parser.getIdColumnName(project.config);
    const resolvedCards = await this.renderer.resolveCardTemplates(
      project.cards,
      project.templates,
      templateColumn,
      idColumn,
      localization,
      project.rootPath,
    );

    return {
      ...project,
      localization,
      resolvedCards,
    };
  }

  private async buildProject(
    selection: { rootPath: string; tree: FileNode[] },
    localeOverride?: string,
  ): Promise<Project> {
    const configPath = this.loader.resolveProjectConfigPath(selection.rootPath);
    const config = await this.loader.loadProjectConfig(selection.rootPath);
    const cards = await this.loader.loadProjectCards(selection.rootPath);
    const localization = await this.localization.loadLocalization(
      selection.rootPath,
      config,
      selection.tree,
      localeOverride,
    );
    const templateColumn = this.parser.getTemplateColumnName(config);
    const idColumn = this.parser.getIdColumnName(config);
    const defaultTemplatePath = config?.templates?.default || config?.defaults?.template;
    const templates = await this.renderer.loadProjectTemplates(
      selection.rootPath,
      defaultTemplatePath,
      cards,
      templateColumn,
    );
    const resolvedCards = await this.renderer.resolveCardTemplates(
      cards,
      templates,
      templateColumn,
      idColumn,
      localization,
      selection.rootPath,
    );

    return {
      rootPath: selection.rootPath,
      tree: selection.tree,
      configPath,
      config,
      cards,
      templates,
      localization,
      resolvedCards,
    } satisfies Project;
  }
}

export const projectService = new ProjectService(
  projectLoader,
  localizationService,
  templateRenderer,
  csvParser,
);
