import '@angular/compiler';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PreferencesService } from './preferences.service';

describe('PreferencesService merge compatibility', () => {
  const storage = { getItem: vi.fn(), setItem: vi.fn() };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('localStorage', storage);
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it.each([
    [null, { theme: 'light', showTips: true, compact: false }],
    ['{}', { theme: 'light', showTips: true, compact: false }],
    ['{"compact":true,"showTips":false}', { theme: 'light', showTips: false, compact: true }],
    ['{"theme":null,"nested":{"items":[1,2]}}', { theme: null, showTips: true, compact: false, nested: { items: [1, 2] } }],
    ['null', { theme: 'light', showTips: true, compact: false }],
    ['{', { theme: 'light', showTips: true, compact: false }]
  ])('retains characterized merge semantics for %s', (saved, expected) => {
    storage.getItem.mockReturnValue(saved);
    const preferences = new PreferencesService().load();
    expect(preferences).toEqual(expected);
    new PreferencesService().save(preferences);
    expect(storage.setItem).toHaveBeenCalledWith('workshop_preferences', JSON.stringify(expected));
  });
});