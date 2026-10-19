import { Injectable } from '@angular/core';
import merge from 'lodash/merge';
import { Preferences } from '../models/workshop.models';

const PREFERENCES_KEY = 'workshop_preferences';

@Injectable({ providedIn: 'root' })
export class PreferencesService {
  load(): Preferences {
    const preferences: Preferences = { theme: 'light', showTips: true, compact: false };
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(PREFERENCES_KEY) || '{}');
      return merge(preferences, saved);
    } catch (error: unknown) {
      console.log('Preferences could not be loaded', error);
      return preferences;
    }
  }

  save(preferences: Preferences): void {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  }
}