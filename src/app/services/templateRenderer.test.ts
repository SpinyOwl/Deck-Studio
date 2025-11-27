import assert from 'node:assert/strict';
import {after, before, beforeEach, describe, test} from 'node:test';
import {TemplateRenderer} from './templateRenderer';
import {type FileService} from './FileService';
import {logService} from './LogService';

describe('TemplateRenderer', () => {
  const templateContents = new Map<string, string>([
    ['/project/templates/default.html', '<div>{{name}}</div>'],
    ['/project/templates/special.html', '<h1>{{t:card.name}}</h1><img src="./image.png">'],
    ['/project/templates/multiline.html', '<div style="white-space: pre">{{description}}</div>'],
  ]);
  const files = {
    readTextFile: async (path: string) => templateContents.get(path) ?? '',
  } as Partial<FileService> as FileService;
  const renderer = new TemplateRenderer(files);
  const originalWindow = globalThis.window;
  const originalLog = logService.info;

  before(() => {
    globalThis.window = {
      api: {
        resolveAssetUrl: async (rootPath: string, relative: string) => `${rootPath}/${relative}`,
      },
    } as unknown as typeof globalThis.window;
    logService.info = () => undefined;
  });

  beforeEach(() => {
    renderer.clearResolvedCache();
  });

  after(() => {
    globalThis.window = originalWindow as typeof globalThis.window;
    logService.info = originalLog;
  });

  test('loads templates from disk and caches them', async () => {
    const templates = await renderer.loadProjectTemplates(
      '/project',
      'templates/default.html',
      [{template: 'templates/special.html'}],
      'template',
    );

    assert.equal(templates.defaultTemplate?.content, '<div>{{name}}</div>');
    assert.ok(templates.cardTemplates['templates/special.html']);
  });

  test('renders cards with localization and resolved assets', async () => {
    const templates = await renderer.loadProjectTemplates(
      '/project',
      'templates/default.html',
      [{template: 'templates/special.html'}],
      'template',
    );

    const resolved = await renderer.resolveCardTemplates([
      {
        id: '123',
        name: 'Fallback',
        template: 'templates/special.html',
      },
    ], templates, 'template', 'id', {
      locale: 'en', availableLocales: ['en'], messages: {cards: {123: {name: 'Localized Name'}}},
    }, '/project');

    assert.equal(resolved.length, 1);
    assert.match(resolved[0]!.html, /Localized Name/);
    assert.match(resolved[0]!.html, /\/project\/image.png/);
  });

  test('falls back to card index for localization when id is missing', async () => {
    const templates = await renderer.loadProjectTemplates(
      '/project',
      'templates/default.html',
      [{template: 'templates/special.html'}],
      'template',
    );

    const resolved = await renderer.resolveCardTemplates([
      {
        name: 'CSV Fallback',
        template: 'templates/special.html',
      },
    ], templates, 'template', 'id', {
      locale: 'en', availableLocales: ['en'], messages: {cards: {1: {name: 'Indexed Name'}}},
    }, '/project');

    assert.equal(resolved.length, 1);
    assert.match(resolved[0]!.html, /Indexed Name/);
  });

  test('renders escaped new line characters for preformatted text', async () => {
    const templates = await renderer.loadProjectTemplates(
      '/project',
      undefined,
      [{template: 'templates/multiline.html'}],
      'template',
    );

    const resolved = await renderer.resolveCardTemplates(
      [
        {
          id: 'multi',
          description: 'First line\\nSecond line',
          template: 'templates/multiline.html',
        },
      ],
      templates,
      'template',
      'id',
      null,
      '/project',
    );

    assert.equal(resolved.length, 1);
    assert.match(resolved[0]!.html, /First line\nSecond line/);
  });

  test('caches resolved HTML per card and locale until project reload', async () => {
    renderer.clearResolvedCache();
    const templates = await renderer.loadProjectTemplates(
      '/project',
      'templates/default.html',
      [{template: 'templates/special.html'}],
      'template',
    );

    const cards = [{id: '123', name: 'Name', template: 'templates/special.html'}];
    const localization = {
      locale: 'en',
      availableLocales: ['en'],
      messages: {cards: {123: {name: 'Localized Name'}}},
    };
    await renderer.resolveCardTemplates(cards, templates, 'template', 'id', localization, '/project');

    let resolveCalls = 0;
    globalThis.window = {
      api: {
        resolveAssetUrl: async (rootPath: string, relative: string) => {
          resolveCalls++;

          return `${rootPath}/${relative}`;
        },
      },
    } as unknown as typeof globalThis.window;

    const resolved = await renderer.resolveCardTemplates(cards, templates, 'template', 'id', localization, '/project');

    assert.equal(resolveCalls, 0);
    assert.match(resolved[0]!.html, /Localized Name/);

    renderer.clearResolvedCache();
  });
});
