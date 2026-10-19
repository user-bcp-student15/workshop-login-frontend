import '@angular/compiler';
import 'zone.js';
import { ChangeDetectorRef, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardComponent } from './dashboard.component';
import { SessionService } from '../services/session.service';
import { TasksService } from '../services/tasks.service';
import { AuthService } from '../services/auth.service';
import { PreferencesService } from '../services/preferences.service';
import { LoginComponent } from '../login/login.component';

vi.mock('axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('@angular/router', () => ({ Router: class {
  navigate = vi.fn().mockResolvedValue(true);
} }));

class TestChangeDetector extends ChangeDetectorRef {
  markForCheck = vi.fn();
  detach = vi.fn();
  detectChanges = vi.fn();
  checkNoChanges = vi.fn();
  reattach = vi.fn();
}

describe('DashboardComponent characterization', () => {
  const storage = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() };
  let router: Router;
  let detector: TestChangeDetector;
  let zone: NgZone;
  let component: DashboardComponent;
  let session: SessionService;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('localStorage', storage);
    storage.getItem.mockReturnValue('{"username":"student","displayName":"Student"}');
    router = new Router();
    detector = new TestChangeDetector();
    zone = new NgZone({ enableLongStackTrace: false });
    session = new SessionService();
    session.save('test-token', { username: 'student', displayName: 'Student' });
    storage.removeItem.mockClear();
    component = new DashboardComponent(router, detector, zone, session, new TasksService());
  });

  it('redirects without a token and makes no request', async () => {
    session.clear();
    storage.removeItem.mockClear();
    storage.getItem.mockReturnValue(null);
    await component.ngOnInit();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('uses the active memory session, labels and filters tasks, and refreshes the view', async () => {
    const tasks = [
      { title: 'Low', status: 'TODO', priority: 'LOW', owner: 'student' },
      { title: 'Hidden', status: 'ARCHIVED', priority: 'HIGH' },
      { title: 'High', status: 'DONE', priority: 'Z', owner: 'student' },
      { title: 'Lowercase', status: 'archived' }
    ];
    vi.mocked(axios.get).mockResolvedValue({ data: tasks });
    const pending = component.ngOnInit();
    expect(component.loading).toBe(true);
    await pending;
    expect(axios.get).toHaveBeenCalledExactlyOnceWith('http://localhost:8000/api/tasks?owner=student', {
      headers: { Authorization: 'Bearer test-token' }
    });
    expect(component.tasks).toBe(tasks);
    expect(component.visibleTasks).toHaveLength(3);
    expect(component.visibleTasks.some((task) => task.title === 'Hidden')).toBe(false);
    expect(component.visibleTasks.find((task) => task.title === 'Low')?.label).toBe('LOW · STUDENT');
    expect(component.user.displayName).toBe('Student');
    expect(component.loading).toBe(false);
    expect(detector.detectChanges).toHaveBeenCalledOnce();
  });

  it('uses an empty owner and renders an empty result', async () => {
    storage.getItem.mockReturnValue('{}');
    vi.mocked(axios.get).mockResolvedValue({ data: [] });
    await component.ngOnInit();
    expect(axios.get).toHaveBeenCalledWith('http://localhost:8000/api/tasks?owner=', expect.any(Object));
    expect(component.visibleTasks).toEqual([]);
    expect(component.loading).toBe(false);
  });

  it('completes login, memory session, task loading and local logout with a shared singleton', async () => {
    const saved = new Map<string, string>();
    storage.getItem.mockImplementation((key: string) => saved.get(key) ?? null);
    storage.setItem.mockImplementation((key: string, value: string) => saved.set(key, value));
    storage.removeItem.mockImplementation((key: string) => saved.delete(key));
    session = new SessionService();
    component = new DashboardComponent(router, detector, zone, session, new TasksService());
    vi.mocked(axios.post).mockResolvedValue({ data: { token: 'flow-token', user: { username: 'student' } } });
    vi.mocked(axios.get).mockResolvedValue({ data: [
      { title: 'Visible task', status: 'TODO', priority: 'HIGH', owner: 'student' },
      { title: 'Archived task', status: 'ARCHIVED' }
    ] });
    const login = new LoginComponent(router, new AuthService(), session, new PreferencesService());
    login.username = 'student';
    login.password = 'test-password';
    await login.login();
    expect(session.token()).toBe('flow-token');
    expect(saved.has('workshop_token')).toBe(false);
    expect(saved.has('workshop_user')).toBe(true);
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
    await component.ngOnInit();
    expect(axios.get).toHaveBeenCalledExactlyOnceWith('http://localhost:8000/api/tasks?owner=student', {
      headers: { Authorization: 'Bearer flow-token' }
    });
    expect(component.visibleTasks).toEqual([
      { title: 'Visible task', status: 'TODO', priority: 'HIGH', owner: 'student', label: 'HIGH · STUDENT' }
    ]);
    expect(component.error).toBe('');
    expect(component.loading).toBe(false);
    await component.logout();
    expect(session.token()).toBeNull();
    expect(saved.has('workshop_token')).toBe(false);
    expect(saved.has('workshop_user')).toBe(false);
    expect(saved.has('workshop_preferences')).toBe(true);
    expect(router.navigate).toHaveBeenLastCalledWith(['/login']);
  });

  it('requires login after restarting even while the previous instance has an active token', async () => {
    const restarted = new SessionService();
    const reloadedDashboard = new DashboardComponent(router, detector, zone, restarted, new TasksService());
    expect(session.token()).toBe('test-token');
    await reloadedDashboard.ngOnInit();
    expect(restarted.token()).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('never uses a legacy stored token to call tasks after restarting', async () => {
    storage.getItem.mockImplementation((key: string) => key === 'workshop_token' ? 'legacy-token' : '{"username":"student"}');
    const restarted = new SessionService();
    const reloadedDashboard = new DashboardComponent(router, detector, zone, restarted, new TasksService());
    await reloadedDashboard.ngOnInit();
    expect(storage.removeItem).toHaveBeenCalledWith('workshop_token');
    expect(storage.getItem).not.toHaveBeenCalledWith('workshop_token');
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
    expect(axios.get).not.toHaveBeenCalled();
  });

  it.each([400, 401, 403, 404, 429, 500, 503])('handles HTTP %s without clearing session, retrying or redirecting', async (status) => {
    vi.mocked(axios.get).mockRejectedValue({
      response: { status, data: { detail: 'Tasks rejected', message: 'Wrong field' } },
      message: 'HTTP failure'
    });
    await component.ngOnInit();
    expect(component.error).toBe('Tasks rejected');
    expect(component.loading).toBe(false);
    expect(session.token()).toBe('test-token');
    expect(axios.get).toHaveBeenCalledOnce();
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(detector.detectChanges).toHaveBeenCalledOnce();
  });

  it.each([
    ['ECONNREFUSED', 'Connection refused'],
    ['ECONNRESET', 'Connection reset'],
    ['ERR_NETWORK', 'Network Error'],
    ['ECONNABORTED', 'Upstream request timed out'],
    ['ETIMEDOUT', 'Connection timed out']
  ])('handles transport rejection %s and ends loading', async (code, message) => {
    vi.mocked(axios.get).mockRejectedValue({ code, message });
    await component.ngOnInit();
    expect(component.error).toBe(message);
    expect(component.loading).toBe(false);
    expect(axios.get).toHaveBeenCalledOnce();
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(detector.detectChanges).toHaveBeenCalledOnce();
  });

  it.each([null, undefined, {}, { tasks: [] }, '', 'not-json', [null], [1]].map((data) => ({ data })))('reports unusable task response $data instead of success', async ({ data }) => {
    vi.mocked(axios.get).mockResolvedValue({ data });
    await expect(component.ngOnInit()).resolves.toBeUndefined();
    expect(component.error).not.toBe('');
    expect(component.loading).toBe(false);
    expect(component.tasks).toEqual([]);
    expect(component.visibleTasks).toEqual([]);
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('keeps loading while a request is pending without configuring an application timeout', async () => {
    let rejectRequest: ((error: Error) => void) | undefined;
    vi.mocked(axios.get).mockReturnValue(new Promise((_resolve, reject) => {
      rejectRequest = reject;
    }));
    const pending = component.ngOnInit();
    expect(component.loading).toBe(true);
    expect(component.error).toBe('');
    expect(axios.get).toHaveBeenCalledWith('http://localhost:8000/api/tasks?owner=student', {
      headers: { Authorization: 'Bearer test-token' }
    });
    expect(detector.detectChanges).not.toHaveBeenCalled();
    if (!rejectRequest) {
      throw new Error('Request was not initialized');
    }
    rejectRequest(new Error('Connection closed'));
    await pending;
    expect(component.loading).toBe(false);
    expect(component.error).toBe('Connection closed');
  });

  it.each([
    [{ response: { data: { detail: 'Backend detail' } }, message: 'Transport' }, 'Backend detail'],
    [{ message: 'Transport' }, 'Transport'],
    [{}, 'No se pudo cargar el dashboard']
  ])('preserves task error precedence without clearing session or navigating', async (error, expected) => {
    vi.mocked(axios.get).mockRejectedValue(error);
    await component.ngOnInit();
    expect(component.error).toBe(expected);
    expect(component.loading).toBe(false);
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(detector.detectChanges).toHaveBeenCalledOnce();
  });

  it('leaves invalid user JSON outside the request error handler', async () => {
    storage.getItem.mockReturnValue('{');
    await expect(component.ngOnInit()).rejects.toThrow(SyntaxError);
    expect(axios.get).not.toHaveBeenCalled();
  });

  it.each([
    ['TODO', 'Por hacer'], ['in_progress', 'En progreso'], ['DONE', 'Completado'],
    ['RESUELTO', 'Resuelto'], ['COMPLETED', 'Completado'], ['OTHER', 'OTHER'], ['', '']
  ])('translates %s', (status, expected) => {
    expect(component.statusLabel(status)).toBe(expected);
  });

  it('logs out locally, retaining preferences', async () => {
    await component.logout();
    expect(storage.removeItem.mock.calls).toEqual([['workshop_token'], ['workshop_user']]);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
    expect(axios.get).not.toHaveBeenCalled();
  });
});