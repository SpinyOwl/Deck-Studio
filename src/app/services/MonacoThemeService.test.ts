import assert from 'node:assert/strict';
import {describe, test} from 'node:test';
import {DEFAULT_THEME_VARIABLES} from '../constants/themes';
import {monacoThemeService} from './MonacoThemeService';

describe('MonacoThemeService', () => {
  test('infers dark base theme for low-luminance colors', () => {
    const base = monacoThemeService.inferBaseTheme({
      ...DEFAULT_THEME_VARIABLES,
      'color-background': '#0a0a0a',
    });

    assert.equal(base, 'vs-dark');
  });

  test('infers light base theme for bright palettes', () => {
    const base = monacoThemeService.inferBaseTheme({
      ...DEFAULT_THEME_VARIABLES,
      'color-background': '#fefefe',
    });

    assert.equal(base, 'vs');
  });

  test('builds a Monaco theme with editor colors derived from variables', () => {
    const themeVariables = {
      ...DEFAULT_THEME_VARIABLES,
      'color-surface': '#121212',
      'color-tree-selection': '#336699',
      'color-tree-selection-text': '#fafafa',
    };

    const {name, definition} = monacoThemeService.buildTheme('custom', themeVariables);

    assert.equal(name, 'deckstudio-custom');
    assert.equal(definition.base, 'vs-dark');
    assert.equal(definition.colors?.['editor.background'], '#121212');
    assert.equal(definition.colors?.['editor.selectionBackground'], '#336699');
    assert.equal(definition.colors?.['editorLineNumber.activeForeground'], '#fafafa');
  });
});
