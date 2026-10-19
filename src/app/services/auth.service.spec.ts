import '@angular/compiler';
import { createServer, Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { TasksService } from './tasks.service';

describe('real Axios transport characterization', () => {
  const originalEnvironment = { ...environment };
  const requests: { method: string | undefined; url: string | undefined; authorization: string | undefined; body: string }[] = [];
  let server: Server;
  let status = 200;
  let holdResponse = false;
  let baseUrl = '';

  beforeAll(async () => {
    server = createServer(async (request, response) => {
      request.setEncoding('utf8');
      let body = '';
      for await (const chunk of request) {
        body += chunk;
      }
      requests.push({ method: request.method, url: request.url, authorization: request.headers.authorization, body });
      if (holdResponse) {
        return;
      }
      response.writeHead(status, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(status !== 200 ? { message: 'Rejected', detail: 'Rejected tasks' }
        : request.url === '/auth/login' ? { token: 'transport-token', user: { username: 'student' } }
        : [{ title: 'Transport task', status: 'TODO' }]));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Expected an ephemeral TCP port');
    }
    baseUrl = 'http://127.0.0.1:' + address.port;
  });

  beforeEach(() => {
    requests.length = 0;
    status = 200;
    holdResponse = false;
    environment.authUrl = baseUrl + '/auth/login';
    environment.tasksUrl = baseUrl + '/api/tasks';
  });

  afterAll(async () => {
    Object.assign(environment, originalEnvironment);
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  it('sends login JSON and a Bearer task request with the actual installed client', async () => {
    const login = await new AuthService().login(' student ', 'test-password');
    expect(login?.token).toBe('transport-token');
    expect(await new TasksService().list('student', 'transport-token')).toEqual([{ title: 'Transport task', status: 'TODO' }]);
    expect(requests).toEqual([
      { method: 'POST', url: '/auth/login', authorization: undefined, body: JSON.stringify({ username: ' student ', password: 'test-password', client: 'angular-workshop' }) },
      { method: 'GET', url: '/api/tasks?owner=student', authorization: 'Bearer transport-token', body: '' }
    ]);
  });

  it.each([400, 401, 403, 404, 429, 500, 503])('retains HTTP %s error data with the actual client', async (errorStatus) => {
    status = errorStatus;
    await expect(new AuthService().login('student', 'test-password')).rejects.toMatchObject({
      response: { status: errorStatus, data: { message: 'Rejected' } }
    });
    await expect(new TasksService().list('', 'transport-token')).rejects.toMatchObject({
      response: { status: errorStatus, data: { detail: 'Rejected tasks' } }
    });
    expect(requests[1]?.url).toBe('/api/tasks?owner=');
  });

  it('surfaces an empty HTTP 204 payload instead of inventing token or tasks', async () => {
    status = 204;
    await expect(new AuthService().login('student', 'test-password')).resolves.toBe('');
    await expect(new TasksService().list('student', 'transport-token')).resolves.toBe('');
  });

  it('rejects both endpoints when the backend port is closed', async () => {
    const unavailableServer = createServer();
    await new Promise<void>((resolve) => unavailableServer.listen(0, '127.0.0.1', resolve));
    const address = unavailableServer.address();
    if (!address || typeof address === 'string') {
      unavailableServer.close();
      throw new Error('Expected a TCP address');
    }
    const unavailableUrl = 'http://127.0.0.1:' + address.port;
    await new Promise<void>((resolve, reject) => unavailableServer.close((error) => error ? reject(error) : resolve()));
    environment.authUrl = unavailableUrl + '/auth/login';
    environment.tasksUrl = unavailableUrl + '/api/tasks';
    await expect(new AuthService().login('student', 'test-password')).rejects.toMatchObject({ code: 'ECONNREFUSED' });
    await expect(new TasksService().list('student', 'transport-token')).rejects.toMatchObject({ code: 'ECONNREFUSED' });
  });

  it('applies the real 5000 ms login timeout when the server never responds', async () => {
    holdResponse = true;
    await expect(new AuthService().login('student', 'test-password')).rejects.toMatchObject({
      code: 'ECONNABORTED',
      config: { timeout: 5000 }
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe('/auth/login');
  }, 8000);
});