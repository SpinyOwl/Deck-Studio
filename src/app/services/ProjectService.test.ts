import assert from 'node:assert/strict';
import {describe, test} from 'node:test';
import {type CsvParser} from './CsvParser';
import {type LocalizationService} from './localizationService';
import {ProjectService} from './ProjectService';
import {type ProjectLoader} from './projectLoader';
import {type TemplateRenderer} from './templateRenderer';

interface ServiceOverrides {
  loader?: Partial<ProjectLoader>;
  localization?: Partial<LocalizationService>;
  renderer?: Partial<TemplateRenderer>;
  parser?: Partial<CsvParser>;
}

/**
 * Builds a ProjectService instance using lightweight test doubles.
 *
 * @param overrides - Optional overrides for service dependencies.
 * @returns ProjectService instance paired with configured doubles.
 */
const createProjectService = (overrides: ServiceOverrides = {}) => {
  const loader: Partial<ProjectLoader> = {
    selectProjectFolder: async () => null,
    loadProjectFolder: async rootPath => ({rootPath, tree: []}),
    resolveProjectConfigPath: rootPath => `${rootPath}/deck.yaml`,
    loadProjectConfig: async () => ({localization: {defaultLocale: 'en'}}),
    loadProjectCards: async () => [{id: '1', template: 'card.html'}],
    ...overrides.loader,
  };

  const localization: Partial<LocalizationService> = {
    loadLocalization: async (_rootPath, _config, _tree, localeOverride) => ({
      locale: localeOverride ?? 'en',
      availableLocales: ['en', 'fr'],
      messages: {},
    }),
    clearCache: () => {},
    ...overrides.localization,
  };

  const renderer: Partial<TemplateRenderer> = {
    loadProjectTemplates: async () => ({cardTemplates: {}}),
    resolveCardTemplates: async () => [],
    clearResolvedCache: () => {},
    ...overrides.renderer,
  };

  const parser: Partial<CsvParser> = {
    getTemplateColumnName: () => 'template',
    getIdColumnName: () => 'id',
    ...overrides.parser,
  };

  const service = new ProjectService(
    loader as ProjectLoader,
    localization as LocalizationService,
    renderer as TemplateRenderer,
    parser as CsvParser,
  );

  return {service, loader, localization, renderer, parser};
};

describe('ProjectService', () => {
  test('reloads project while preserving requested locale', async () => {
    let requestedLocale: string | undefined;
    const {service} = createProjectService({
      localization: {
        loadLocalization: async (_rootPath, _config, _tree, localeOverride) => {
          requestedLocale = localeOverride;

          return {
            locale: localeOverride ?? 'en',
            availableLocales: ['en', 'fr'],
            messages: {},
          };
        },
      },
    });

    const project = await service.reloadProject('/projects/demo', 'fr');

    assert.equal(requestedLocale, 'fr');
    assert.equal(project?.localization?.locale, 'fr');
  });

  test('reloads project using default locale when none is provided', async () => {
    let requestedLocale: string | undefined = 'fr';
    const {service} = createProjectService({
      localization: {
        loadLocalization: async (_rootPath, _config, _tree, localeOverride) => {
          requestedLocale = localeOverride;

          return {
            locale: localeOverride ?? 'en',
            availableLocales: ['en', 'fr'],
            messages: {},
          };
        },
      },
    });

    const project = await service.reloadProject('/projects/demo');

    assert.equal(requestedLocale, undefined);
    assert.equal(project?.localization?.locale, 'en');
  });

  test('clears localization cache before reloading project', async () => {
    let cleared = false;
    const {service} = createProjectService({
      localization: {
        clearCache: () => {
          cleared = true;
        },
      },
    });

    await service.reloadProject('/projects/demo');

    assert.ok(cleared);
  });
});
