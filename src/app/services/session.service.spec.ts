import '@angular/compiler';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionService } from './session.service';

describe('SessionService', () => {
  let values: Map<string, string>;

  beforeEach(() => {
    values = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, String(value)),
      removeItem: (key: string) => values.delete(key)
    });
  });

  it('keeps the active token only in the current instance without persisting it', () => {
    const user = { username: 'student', additionalField: { retained: true } };
    const session = new SessionService();
    session.save('session-token', user);
    expect(session.token()).toBe('session-token');
    expect(session.user()).toEqual(user);
    expect(values.has('workshop_token')).toBe(false);
    expect([...values.values()].some((value) => value.includes('session-token'))).toBe(false);
  });

  it('does not restore the token in a new application instance but preserves the user', () => {
    new SessionService().save('session-token', { username: 'student' });
    const restarted = new SessionService();
    expect(restarted.token()).toBeNull();
    expect(restarted.user()).toEqual({ username: 'student' });
  });

  it('purges a legacy token without reading or reusing it and preserves metadata', () => {
    values.set('workshop_token', 'legacy-token');
    values.set('workshop_user', '{"username":"student"}');
    values.set('workshop_preferences', '{"theme":"light"}');
    const read = vi.spyOn(localStorage, 'getItem');
    const session = new SessionService();
    expect(session.token()).toBeNull();
    expect(values.has('workshop_token')).toBe(false);
    expect(session.user()).toEqual({ username: 'student' });
    expect(values.get('workshop_preferences')).toBe('{"theme":"light"}');
    expect(read).not.toHaveBeenCalledWith('workshop_token');
  });

  it('clears active memory and user while retaining preferences', () => {
    values.set('workshop_preferences', '{"theme":"light"}');
    const session = new SessionService();
    session.save('session-token', { username: 'student' });
    session.clear();
    expect(session.token()).toBeNull();
    expect(session.user()).toEqual({});
    expect(values.has('workshop_token')).toBe(false);
    expect(values.get('workshop_preferences')).toBe('{"theme":"light"}');
  });

  it('also removes legacy residue added while the application was running', () => {
    const session = new SessionService();
    session.save('session-token', { username: 'student' });
    values.set('workshop_token', 'legacy-residue');
    session.clear();
    expect(session.token()).toBeNull();
    expect(values.has('workshop_token')).toBe(false);
    expect(values.has('workshop_user')).toBe(false);
  });

  it('reports constructor cleanup failure instead of silently accepting a legacy token', () => {
    values.set('workshop_token', 'legacy-token');
    vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {
      throw new Error('Legacy cleanup denied');
    });
    expect(() => new SessionService()).toThrow('Legacy cleanup denied');
    expect(values.get('workshop_token')).toBe('legacy-token');
  });

  it('clears the active memory even when removing legacy residue throws', () => {
    const session = new SessionService();
    session.save('session-token', { username: 'student' });
    values.set('workshop_token', 'legacy-residue');
    vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {
      throw new Error('Legacy cleanup denied');
    });
    expect(() => session.clear()).toThrow('Legacy cleanup denied');
    expect(session.token()).toBeNull();
    expect(values.get('workshop_token')).toBe('legacy-residue');
  });

  it('does not silently repair invalid persisted users', () => {
    values.set('workshop_user', '{');
    expect(() => new SessionService().user()).toThrow(SyntaxError);
  });

  it('preserves the legacy storage coercion when the response has no user', () => {
    new SessionService().save('session-token', undefined);
    expect(values.get('workshop_user')).toBe('undefined');
  });
});