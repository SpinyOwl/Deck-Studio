import assert from 'node:assert/strict';
import {describe, test} from 'node:test';
import {DEFAULT_THEME_ID, DEFAULT_THEME_VARIABLES} from '../constants/themes';
import {ThemeStateService} from './ThemeStateService';

describe('ThemeStateService', () => {
  test('updates state and notifies subscribers when theme changes', () => {
    const service = new ThemeStateService();
    const updates: string[] = [];

    service.subscribe(state => {
      updates.push(state.themeId);
    });

    service.setTheme('custom', {
      ...DEFAULT_THEME_VARIABLES,
      'color-text-primary': '#ffffff',
    });

    assert.equal(service.getThemeId(), 'custom');
    assert.equal(updates[0], DEFAULT_THEME_ID);
    assert.equal(updates[1], 'custom');
    assert.equal(service.getThemeVariables()['color-text-primary'], '#ffffff');
  });

  test('merges missing variables with defaults and avoids duplicate notifications', () => {
    const service = new ThemeStateService();
    let notificationCount = 0;

    service.subscribe(() => {
      notificationCount += 1;
    });

    service.setTheme(DEFAULT_THEME_ID, {'color-text-primary': '#eeeeee'});
    service.setTheme(DEFAULT_THEME_ID, {'color-text-primary': '#eeeeee'});

    assert.equal(notificationCount, 2);
    assert.equal(
      service.getThemeVariables()['color-background'],
      DEFAULT_THEME_VARIABLES['color-background'],
    );
  });
});
