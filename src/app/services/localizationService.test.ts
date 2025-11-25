import assert from 'node:assert/strict';
import {describe, test} from 'node:test';
import {type FileNode} from '../types/files';
import {LocalizationService} from './localizationService';
import {type FileService} from './FileService';
import {type YamlParsingService} from './YamlParsingService';

describe('LocalizationService', () => {
  test('loads localization and reports available locales', async () => {
    const tree: FileNode[] = [
      {
        type: 'dir',
        name: 'i18n',
        path: '/project/i18n',
        children: [
          {type: 'file', name: 'en.yml', path: '/project/i18n/en.yml'},
          {type: 'file', name: 'es.yaml', path: '/project/i18n/es.yaml'},
        ],
      },
    ];

    const service = new LocalizationService(
      {
        readTextFile: async () => 'greeting: Hello',
      } as Partial<FileService> as FileService,
      {
        parse: () => ({greeting: 'Hello'}),
      } as Partial<YamlParsingService> as YamlParsingService,
    );

    const localization = await service.loadLocalization(
      '/project',
      {localization: {defaultLocale: 'en', directory: 'i18n'}} as never,
      tree,
    );

    assert.ok(localization);
    assert.equal(localization?.locale, 'en');
    assert.deepEqual(localization?.messages, {greeting: 'Hello'});
    assert.deepEqual(localization?.availableLocales, ['en', 'es']);
  });
});
