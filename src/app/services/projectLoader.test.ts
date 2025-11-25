import assert from 'node:assert/strict';
import {describe, test} from 'node:test';
import {PROJECT_CONFIG_FILENAME} from '../constants/project';
import {type FileService} from './FileService';
import {ProjectLoader} from './projectLoader';
import {type CsvParser} from './CsvParser';
import {type YamlParsingService} from './YamlParsingService';

const createLoader = (options: {
  files?: Partial<FileService>;
  yaml?: Partial<YamlParsingService>;
  parser?: Partial<CsvParser>;
} = {}): ProjectLoader => {
  const files = options.files ?? {};
  const yaml = options.yaml ?? {};
  const parser = options.parser ?? {};

  return new ProjectLoader(
    files as FileService,
    yaml as YamlParsingService,
    parser as CsvParser,
  );
};

describe('ProjectLoader', () => {
  test('resolves file paths with platform separators', () => {
    const loader = createLoader();

    assert.equal(loader.resolveProjectFilePath('/root/app', 'file.txt'), '/root/app/file.txt');
    const windowsRoot = String.raw`C:\root`;
    const windowsPath = loader.resolveProjectFilePath(windowsRoot, 'file.txt');

    assert.ok(windowsPath.startsWith(String.raw`C:\root`));
    assert.ok(windowsPath.endsWith(String.raw`\file.txt`));
  });

  test('loads project configuration through YAML parser', async () => {
    let requestedPath = '';
    const loader = createLoader({
      files: {
        readTextFile: async path => {
          requestedPath = path;

          return 'name: demo';
        },
      },
      yaml: {
        parse: <T>() => ({name: 'demo'} as T),
      },
    });

    const config = await loader.loadProjectConfig('/projects/demo');

    assert.equal(requestedPath.endsWith(PROJECT_CONFIG_FILENAME), true);
    assert.deepEqual(config, {name: 'demo'});
  });

  test('loads project cards using the CSV parser', async () => {
    const loader = createLoader({
      files: {
        readTextFile: async () => 'id,template\n1,card.html',
      },
      parser: {
        parse: () => [{id: '1', template: 'card.html'}],
      },
    });

    const cards = await loader.loadProjectCards('/projects/demo');

    assert.deepEqual(cards, [{id: '1', template: 'card.html'}]);
  });
});
