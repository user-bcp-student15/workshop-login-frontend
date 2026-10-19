import '@angular/compiler';
import { Router } from '@angular/router';
import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginComponent } from './login.component';
import { AuthService } from '../services/auth.service';
import { PreferencesService } from '../services/preferences.service';
import { SessionService } from '../services/session.service';

vi.mock('axios', () => ({ default: { post: vi.fn() } }));
vi.mock('@angular/router', () => ({ Router: class {
  navigate = vi.fn().mockResolvedValue(true);
} }));

describe('LoginComponent characterization', () => {
  const storage = {
    getItem: vi.fn<(key: string) => string | null>(),
    setItem: vi.fn(),
    removeItem: vi.fn()
  };
  let router: Router;
  let component: LoginComponent;
  let session: SessionService;

  function createComponent(): LoginComponent {
    return new LoginComponent(router, new AuthService(), session, new PreferencesService());
  }

  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('localStorage', storage);
    storage.getItem.mockReturnValue(null);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    router = new Router();
    vi.mocked(router.navigate).mockResolvedValue(true);
    session = new SessionService();
    storage.removeItem.mockClear();
    component = createComponent();
    component.username = 'student';
    component.password = 'Workshop123!';
  });

  it.each([null, undefined, '', '   '])('rejects empty username %s before HTTP', async (username) => {
    Reflect.set(component, 'username', username);
    component.password = '';
    await component.login();
    expect(component.message).toContain('Ingrese un usuario.');
    expect(axios.post).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.busy).toBe(false);
  });

  it.each([null, undefined, '', '   '])('rejects empty password %s before HTTP', async (password) => {
    Reflect.set(component, 'password', password);
    await component.login();
    expect(component.message).toContain('Ingrese una contraseña.');
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('preserves request values and saves memory token and metadata before navigation', async () => {
    const user = { username: 'student', displayName: 'Student', extra: 'retained' };
    component.username = ' student ';
    vi.mocked(axios.post).mockResolvedValue({ data: { token: 'test-token', user } });
    vi.mocked(router.navigate).mockImplementation(async () => {
      expect(session.token()).toBe('test-token');
      expect(storage.setItem).not.toHaveBeenCalledWith('workshop_token', 'test-token');
      expect(storage.setItem).toHaveBeenCalledWith('workshop_user', JSON.stringify(user));
      expect(storage.setItem).toHaveBeenCalledWith('workshop_preferences', JSON.stringify(component.preferences));
      return true;
    });
    const pending = component.login();
    expect(component.busy).toBe(true);
    await pending;
    expect(axios.post).toHaveBeenCalledExactlyOnceWith('http://localhost:8080/auth/login', {
      username: ' student ', password: 'Workshop123!', client: 'angular-workshop'
    }, { timeout: 5000 });
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
    expect(component.busy).toBe(false);
  });

  it.each([
    {}, { token: '' }, { token: null }, undefined, null, '', 'not-json', [],
    { token: false }, { token: 0 }, { unexpected: 'payload' }
  ].map((data) => ({ data })))('does not persist or navigate without a token: $data', async ({ data }) => {
    vi.mocked(axios.post).mockResolvedValue({ data });
    await component.login();
    expect(component.message).toContain('El backend respondió sin token.');
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.busy).toBe(false);
  });

  it('handles an absent Axios response as missing token', async () => {
    vi.mocked(axios.post).mockResolvedValue(undefined);
    await component.login();
    expect(component.message).toBe('El backend respondió sin token.');
    expect(component.busy).toBe(false);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it.each([400, 401, 403, 429, 500, 503])('handles HTTP %s without retrying or deleting the previous session', async (status) => {
    vi.mocked(axios.post).mockRejectedValue({
      response: { status, data: { message: 'Authentication rejected', detail: 'Wrong field' } },
      message: 'HTTP failure'
    });
    await component.login();
    expect(component.message).toBe('No se pudo autenticar a student.');
    expect(component.messageDetail).toBe('Authentication rejected');
    expect(component.busy).toBe(false);
    expect(axios.post).toHaveBeenCalledOnce();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it.each([
    ['ECONNREFUSED', 'Connection refused'],
    ['ECONNRESET', 'Connection reset'],
    ['ERR_NETWORK', 'Network Error']
  ])('handles backend unavailable or transport failure %s', async (code, message) => {
    vi.mocked(axios.post).mockRejectedValue({ code, message });
    await component.login();
    expect(component.messageDetail).toBe(message);
    expect(component.busy).toBe(false);
    expect(axios.post).toHaveBeenCalledOnce();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it.each(['workshop_user', 'workshop_preferences'])('reports write failure for %s', async (failingKey) => {
    vi.mocked(axios.post).mockResolvedValue({ data: { token: 'test-token', user: { username: 'student' } } });
    storage.setItem.mockImplementation((key: string) => {
      if (key === failingKey) {
        throw new DOMException('Storage unavailable', 'QuotaExceededError');
      }
    });
    await component.login();
    expect(component.message).toBe('No se pudo autenticar a student.');
    expect(component.messageDetail).toBe('Storage unavailable');
    expect(component.busy).toBe(false);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('authenticates without attempting a persistent token write', async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { token: 'test-token', user: { username: 'student' } } });
    storage.setItem.mockImplementation((key: string) => {
      if (key === 'workshop_token') {
        throw new Error('Token persistence is forbidden');
      }
    });
    await component.login();
    expect(session.token()).toBe('test-token');
    expect(component.message).toBe('');
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
    expect(storage.setItem).not.toHaveBeenCalledWith('workshop_token', expect.anything());
  });

  it.each([
    [{ response: { data: { message: 'Backend detail' } }, message: 'Transport' }, 'Backend detail'],
    [{ message: 'timeout of 5000ms exceeded' }, 'timeout of 5000ms exceeded'],
    [{}, 'Error desconocido']
  ])('preserves error precedence and clears busy', async (error, detail) => {
    vi.mocked(axios.post).mockRejectedValue(error);
    await component.login();
    expect(component.message).toContain('No se pudo autenticar a student.');
    expect(component.messageDetail).toContain(detail);
    expect(component.busy).toBe(false);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('clears busy when navigation rejects after persistence', async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { token: 'test-token', user: {} } });
    vi.mocked(router.navigate).mockRejectedValue(new Error('Navigation failed'));
    await component.login();
    expect(component.messageDetail).toContain('Navigation failed');
    expect(component.busy).toBe(false);
    expect(session.token()).toBe('test-token');
    expect(storage.setItem).not.toHaveBeenCalledWith('workshop_token', expect.anything());
  });

  it.each([
    ['{}', { theme: 'light', showTips: true, compact: false }],
    ['{"showTips":false}', { theme: 'light', showTips: false, compact: false }],
    ['{"theme":null,"nested":{"value":1}}', { theme: null, showTips: true, compact: false, nested: { value: 1 } }],
    ['null', { theme: 'light', showTips: true, compact: false }]
  ])('characterizes persisted preferences %s', (saved, expected) => {
    storage.getItem.mockReturnValue(saved);
    expect(createComponent().preferences).toEqual(expected);
  });

  it('retains defaults when saved preferences are invalid JSON', () => {
    storage.getItem.mockReturnValue('{');
    expect(createComponent().preferences).toEqual({ theme: 'light', showTips: true, compact: false });
  });
});