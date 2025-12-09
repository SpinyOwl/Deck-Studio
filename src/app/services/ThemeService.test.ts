import assert from 'node:assert/strict';
import {afterEach, describe, test} from 'node:test';
import {DEFAULT_THEME_DEFINITION, DEFAULT_THEME_VARIABLES} from '../constants/themes';
import {type ThemeDefinition} from '../types/theme';
import {themeService} from './ThemeService';

describe('ThemeService', () => {
  let originalDocument: typeof globalThis.document = globalThis.document;

  const customTheme: ThemeDefinition = {
    id: 'custom',
    name: 'Custom Theme',
    description: 'Overrides background',
    variables: {
      'color-background': '#111111',
      'color-text-primary': '#fafafa',
    },
  };

  afterEach(() => {
    globalThis.document = originalDocument;
  });

  test('resolves requested theme when available', () => {
    const resolved = themeService.resolveTheme('custom', [customTheme, DEFAULT_THEME_DEFINITION]);

    assert.equal(resolved.id, 'custom');
  });

  test('falls back to default theme when preferred id is missing', () => {
    const resolved = themeService.resolveTheme('missing', [customTheme, DEFAULT_THEME_DEFINITION]);

    assert.equal(resolved.id, DEFAULT_THEME_DEFINITION.id);
  });

  test('merges theme variables with defaults', () => {
    const merged = themeService.mergeVariables(customTheme);

    assert.equal(merged['color-background'], '#111111');
    assert.equal(merged['color-text-primary'], '#fafafa');
    assert.equal(merged['color-border'], DEFAULT_THEME_VARIABLES['color-border']);
  });

  test('applies variables to the document root when available', () => {
    const attributes: Record<string, string> = {};
    const styleMap: Record<string, string> = {};
    originalDocument = globalThis.document;
    globalThis.document = {
      documentElement: {
        style: {
          setProperty: (name: string, value: string) => {
            styleMap[name] = value;
          },
        },
        setAttribute: (name: string, value: string) => {
          attributes[name] = value;
        },
      },
    } as unknown as Document;

    const merged = themeService.applyTheme(customTheme);

    assert.equal(attributes['data-theme'], 'custom');
    assert.equal(styleMap['--color-background'], '#111111');
    assert.equal(merged['color-border'], DEFAULT_THEME_VARIABLES['color-border']);
  });
});
