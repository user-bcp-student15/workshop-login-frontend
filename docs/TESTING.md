# Pruebas del flujo de autenticación y tareas

Ejecuciones del 2026-10-19 sobre [ENDPOINTS.md](ENDPOINTS.md). La ampliación inicial pasó de 71 a 123 pruebas sin cambiar producción. El cierre posterior de H-01 modifica únicamente SessionService y sus fixtures: token en memoria, purga legacy y login obligatorio tras recarga, excepción aprobada expresamente en [PLAN.md](../PLAN.md). La suite actual tiene 131 pruebas. Se usa Vitest 3.2.4 con V8 y el mínimo del 85% por archivo de [vitest.config.ts](../vitest.config.ts), conforme a [REGLAS.md](../REGLAS.md), sin cambios de dependencias ni gates.

## Matriz de casos

| flujo | caso | tipo | resultado esperado |
|---|---|---|---|
| Login → tareas → logout | Credenciales válidas, singleton compartido y respuesta con tareas | Camino feliz | Guardar token en memoria y metadatos antes de navegar; enviar Bearer; mostrar tareas visibles; logout vacía memoria, elimina usuario y conserva preferencias. Ejecutado. |
| Sesión | Nueva instancia, recarga o token legacy persistido | Caso borde / seguridad H-01 | No recuperar token de otra instancia; eliminar workshop_token sin leerlo; tras recarga volver a login sin GET y conservar usuario/preferencias. Ejecutado en unitarias y DOM con fixtures. |
| Sesión | Purga legacy bloqueada por almacenamiento | Error H-01 | Propagar el fallo sin afirmar borrado; al fallar clear, memoria ya vacía. Ejecutado con excepción simulada. |
| Login | Usuario o contraseña vacíos, espacios, null o undefined | Caso borde | No hacer HTTP ni navegar; mensaje de usuario tiene prioridad. Ejecutado mediante cuatro valores por campo. |
| Login | Body ausente, null, vacío, texto no JSON, arreglo o sin token truthy | Caso borde | Mostrar `El backend respondió sin token.`, no persistir ni navegar y terminar busy. Ejecutado, incluido arreglo vacío real. |
| Login | Usuario con espacios válidos para la comprobación | Caso borde | Enviar el valor original, sin trim en el body. Ejecutado. |
| Tareas | Token ausente y usuario parseable | Caso borde | Redirigir a login sin GET. Ejecutado. |
| Tareas | Propietario ausente o arreglo vacío | Caso borde | Enviar owner vacío cuando corresponde y terminar carga con lista vacía. Ejecutado; no es un error HTTP. |
| Tareas | ARCHIVED exacto, estados conocidos/desconocidos y prioridades de distintos tipos | Caso borde | Excluir solo ARCHIVED exacto, generar etiquetas y conservar el comparador documentado. Ejecutado. No se inventa un orden de negocio. |
| Login y tareas | Backend caído/conexión rechazada | Error | El transporte real rechaza con ECONNREFUSED; componentes muestran error, terminan busy/loading y no reintentan. Login no navega; tareas conserva sesión/ruta. Ejecutado contra puerto cerrado y con mocks de estado. |
| Login | HTTP 400, 401, 403, 429, 500 y 503 | Error | Priorizar response.data.message, después error.message y fallback; no persistir ni navegar por éxito ni borrar sesión anterior. Ejecutado. |
| Tareas | HTTP 400, 401, 403, 404, 429, 500 y 503 | Error | Priorizar detail, no message; terminar carga y conservar sesión/ruta. Ejecutado. |
| Tareas | Token inválido/expirado representado por rechazo 401/403 | Error | Mostrar detail y terminar carga, sin renovación, borrado ni redirección automáticos. Ejecutado con respuesta HTTP simulada; no demuestra validación criptográfica o caducidad real del servidor. |
| Login y tareas | ECONNRESET o ERR_NETWORK | Error | Mostrar error de transporte y terminar estado de carga. Ejecutado mediante rechazo simulado; ERR_NETWORK no demuestra CORS real del navegador. |
| Login | Servidor acepta pero no responde | Error | Axios aplica timeout real de 5000 ms y rechaza; el componente libera busy y muestra el detalle de error. Ejecutado en transporte real y mediante caso de componente. |
| Tareas | Rechazo ECONNABORTED/ETIMEDOUT de otra capa | Error | Terminar loading y mostrar error sin borrar sesión. Ejecutado con mocks; no se atribuye a un timeout propio inexistente. |
| Tareas | Petición todavía pendiente | Caso borde | Mantener loading; la llamada no configura timeout. Al rechazar la promesa controlada, mostrar error y finalizar carga. Ejecutado sin esperas arbitrarias. |
| Login y tareas | HTTP 204 sin contenido | Caso borde | Servicios entregan el body vacío; login lo maneja como falta de token y tareas como respuesta no utilizable. Transporte real y casos de componente ejecutados por separado. |
| Tareas | null, undefined, objeto contenedor, texto o elementos null/número | Error | Capturar el fallo de preparación, no presentar éxito ni lista vacía silenciosa, terminar carga y mantener sesión/ruta. Ejecutado. |
| Login | Falla escritura de usuario o preferencias | Error | Mostrar error y liberar busy sin navegar. No hay escritura persistente de token; se prueba que login funciona aunque esa escritura estuviera prohibida. No se afirma rollback. |
| Login | Promesa de navegación rechazada | Error | Mostrar error y liberar busy; el token ya asignado a memoria y los metadatos guardados permanecen. Ejecutado. |
| Login y tareas | Error sin detalle conocido | Error | Usar fallback de cada flujo. Ejecutado. |
| Login | Token truthy mal tipado o token sin usuario utilizable | Error / defecto conocido | El contrato documenta aceptación sin validación, no una recuperación correcta. La corrección y sus pruebas quedan pendientes; no se añadió una aserción verde que bendiga esa aceptación. |
| Tareas | JSON de usuario inválido o forma de usuario incompatible | Error / defecto conocido | La recuperación amigable no está implementada. Existe caracterización histórica del rechazo de JSON, pero no se presenta como prueba de corrección; pendiente de resolver. |
| Login | navigate resuelve false o falla una escritura después de otra exitosa | Error / defecto conocido | No hay manejo específico de false ni rollback. Se reporta aparte; no se inventa una recuperación que no consta en el contrato. |
| UI | Datos inválidos que llegan a plantilla o refresco del error asíncrono de login | Error / pendiente DOM | La suite Node no prueba esos resultados de renderizado. Falta automatización de navegador; no se confunde cobertura de clases con prueba del DOM. |

## Código de pruebas ejecutadas

Los siguientes bloques son extractos literales de tests ejecutados, no propuestas. Imports, beforeEach, servidor y el resto de casos están en los archivos ejecutables enlazados. No se duplicó una suite adicional ni se añadieron dependencias.

### Camino feliz completo

Fuente: [dashboard.component.spec.ts](../src/app/dashboard/dashboard.component.spec.ts). Componentes y servicios reales con Axios, router y almacenamiento simulados; no es una prueba de navegador ni de backends externos.

```ts
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
```

### Borde: respuesta sin token

Fuente: [login.component.spec.ts](../src/app/login/login.component.spec.ts). Cada payload se envuelve en un objeto para que Vitest no interprete `[]` como fila sin argumentos.

```ts
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
```

### Error: rechazo HTTP y token inválido

Fuente: [dashboard.component.spec.ts](../src/app/dashboard/dashboard.component.spec.ts). Los casos 401 y 403 representan el rechazo de token documentado; el mismo contrato aplica a otros rechazos HTTP.

```ts
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
```

### Error: backend caído con transporte real

Fuente: [auth.service.spec.ts](../src/app/services/auth.service.spec.ts). Se reserva y cierra un puerto efímero local; los servicios llaman con el Axios instalado. Ningún backend externo participa.

```ts
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
```

El beforeEach restaura las URLs del servidor simulado y afterAll devuelve environment a su valor original. No se modifica el archivo environment ni se abre un servicio persistente.

### Error: timeout real de login

Fuente: [auth.service.spec.ts](../src/app/services/auth.service.spec.ts). Con holdResponse=true, el servidor registra la petición pero no responde. No se usa sleep ni un error construido para fingir el timeout. El límite de 8000 ms pertenece al runner, no cambia los 5000 ms de la aplicación.

```ts
  it('applies the real 5000 ms login timeout when the server never responds', async () => {
    holdResponse = true;
    await expect(new AuthService().login('student', 'test-password')).rejects.toMatchObject({
      code: 'ECONNABORTED',
      config: { timeout: 5000 }
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe('/auth/login');
  }, 8000);
```

### Tareas pendientes: sin inventar timeout propio

Fuente: [dashboard.component.spec.ts](../src/app/dashboard/dashboard.component.spec.ts). La promesa se rechaza explícitamente al final para no dejar trabajo pendiente en el runner.

```ts
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
```

Código completo de los otros casos ejecutados: [login.component.spec.ts](../src/app/login/login.component.spec.ts), [dashboard.component.spec.ts](../src/app/dashboard/dashboard.component.spec.ts), [auth.service.spec.ts](../src/app/services/auth.service.spec.ts), [session.service.spec.ts](../src/app/services/session.service.spec.ts), [preferences.service.spec.ts](../src/app/services/preferences.service.spec.ts), [http-error.spec.ts](../src/app/utils/http-error.spec.ts) y [legacy-format.spec.ts](../src/app/utils/legacy-format.spec.ts).

## Comandos, directorio y resultados reales

Todas las ejecuciones se realizaron desde la raíz del componente:

```text
C:\Users\Usuario\Documents\S61731-leonardo-rospigliosi\reqflow-workspace\workshop-login-frontend
```

| Etapa | Comando ejecutado | Código de salida | Resultado |
|---|---|---:|---|
| Línea base, antes de ampliar | `npm test` | 0 | 71 pruebas aprobadas, 7 archivos. |
| Login ampliado | `npm test -- src/app/login/login.component.spec.ts` | 0 | 42 aprobadas; se repitió tras corregir la representación del payload [] y volvió a pasar. |
| Dashboard ampliado | `npm test -- src/app/dashboard/dashboard.component.spec.ts` | 0 | 37 aprobadas. |
| Transporte real ampliado | `npm test -- src/app/services/auth.service.spec.ts` | 0 | 11 aprobadas; timeout real aproximadamente 5010 ms. |
| Suite de ampliación, histórica | `npm run test:coverage -- --reporter=default --reporter=json --outputFile=coverage/testing-results.json` | 0 | 123 aprobadas en 7 archivos antes de H-01; cobertura aprobada. |
| H-01: caracterización previa | `npm test -- src/app/services/session.service.spec.ts src/app/login/login.component.spec.ts src/app/dashboard/dashboard.component.spec.ts` | 0 | 82 aprobadas: 3 sesión, 42 login y 37 dashboard. |
| H-01: expectativas nuevas antes de cambiar producción | `npm test -- src/app/services/session.service.spec.ts --reporter=json --outputFile=coverage/h01-red-results.json` | 1 | 5 fallos esperados y 4 aprobadas; demuestran persistencia y falta de purga en el servicio anterior. |
| H-01: corrección local | `npm test -- src/app/services/session.service.spec.ts --reporter=default --reporter=json --outputFile=coverage/h01-green-results.json` | 0 | Las mismas 9 expectativas pasan tras cambiar el servicio. |
| H-01: componentes con singleton compartido | `npm test -- src/app/login/login.component.spec.ts src/app/dashboard/dashboard.component.spec.ts` | 0 | 81 aprobadas: 42 login y 39 dashboard. |
| H-01: suite final y cobertura | `npm run test:coverage -- --reporter=default --reporter=json --outputFile=coverage/h01-results.json` | 0 | 131 aprobadas en 7 archivos, sin fallos ni omisiones; gate 85% cumplido. |
| H-01: compilación | `npm run build` | 0 | Código y plantillas estrictas aprobados; persiste el aviso CommonJS de lodash/merge. |

Salida relevante de la ejecución final:

```text
Test Files  7 passed (7)
      Tests  131 passed (131)
    Duration  6.40s
```

Desglose actual: login 42, dashboard 39, transporte real 11, sesión 9, preferencias 6, errores 8 y utilidad de tareas 16. La ampliación inicial añadió 52 casos hasta 123; H-01 aumenta el total neto en 8 hasta 131. No hubo fallos, omisiones ni pruebas todo en la ejecución final. Esto no corrige los defectos ajenos a H-01 enumerados debajo.

Evidencia actual: [h01-results.json](../coverage/h01-results.json), [coverage-summary.json](../coverage/coverage-summary.json), [reporte HTML](../coverage/index.html) y [resumen de resultados de herramienta](../coverage/h01-evidence.json). coverage es generada/ignorada; no se presupone que estos artefactos existan en un clon limpio. Vitest limpia coverage al medirla: los JSON rojo/verde anteriores se generaron realmente, pero la corrida final los eliminó. Sus contadores reales se conservan en h01-evidence.json, identificado como resumen y no como reporte original de aserciones. El comando final regenera su reporte JSON y cobertura, no ese resumen manual de herramientas.

## Cobertura obtenida

| Métrica | Cubiertos | Total | Porcentaje | Mínimo por archivo |
|---|---:|---:|---:|---:|
| Líneas | 224 | 224 | 100% | 85% |
| Sentencias | 224 | 224 | 100% | 85% |
| Funciones | 20 | 20 | 100% | 85% |
| Ramas | 70 | 70 | 100% | 85% |

Los nueve archivos ejecutables del alcance de cobertura mantienen 100% en cada métrica informada: login, dashboard, AuthService, TasksService, SessionService, PreferencesService, http-error, legacy-format y environment. Environment no contiene funciones ni ramas medibles. No se excluyó código adicional ni se redujeron umbrales.

En H-01 se modificaron SessionService, sus pruebas y documentación; la ampliación anterior solo modificaba specs/documentación. El porcentaje mide producción, no los propios tests, interfaces borradas, plantillas o toda la aplicación. El camino feliz unitario prueba clases; la comprobación DOM separada de H-01 se describe a continuación.

## H-01: diff y comprobación antes/después

Único ítem implementado del plan actual. Se obtuvo aprobación expresa para que una recarga u otra instancia exija login. No cambian endpoints, body, timeout, Bearer ni la política de 401/403.

Diff incremental de producción, respecto de la caracterización previa de este ítem:

```diff
-const TOKEN_KEY = 'workshop_token';
+const LEGACY_TOKEN_KEY = 'workshop_token';
 export class SessionService {
+  private activeToken: string | null = null;
+
+  constructor() {
+    localStorage.removeItem(LEGACY_TOKEN_KEY);
+  }
  token(): string | null {
-    return localStorage.getItem(TOKEN_KEY);
+    return this.activeToken;
  }
  save(token: string, user: WorkshopUser | undefined): void {
-    localStorage.setItem(TOKEN_KEY, token);
+    this.activeToken = token;
  }
  clear(): void {
-    localStorage.removeItem(TOKEN_KEY);
+    this.activeToken = null;
+    localStorage.removeItem(LEGACY_TOKEN_KEY);
  }
```

El bloque omite el manejo de usuario que no cambió; no pretende ser un patch completo aplicable. El [diff local completo de H-01](../coverage/h01-session.diff) se generó comparando el [snapshot previo](../coverage/h01-session.before.ts), validado byte a byte por su SHA-256 registrado antes del cambio, con el servicio actual. Es un artefacto local en coverage, no un diff contra main que mezcle la refactorización anterior. Login y dashboard de producción no se editaron; sus fixtures ahora comparten un SessionService por instancia de aplicación.

Las cinco expectativas que fallaron antes verifican no persistencia, no restauración entre instancias, purga sin lectura, propagación del fallo de purga inicial y memoria vacía aun si clear falla. Después pasan las nueve pruebas del servicio, incluidas las caracterizaciones de usuario que se conservan sin presentarlas como una corrección.

**Comprobación DOM ejecutada con HTTP interceptado en http://localhost:4201:**

- Residuo workshop_token eliminado al iniciar sin perder usuario ni preferencias.
- Login válido carga una tarea visible y ninguna archivada, con Bearer h01-browser-token y sin token persistido.
- Recarga vuelve a `/login`, conserva metadatos y no añade ningún GET de tareas.
- Segundo login vuelve a cargar tareas; logout deja token persistido y usuario nulos, token activo vacío y preferencias conservadas.
- Se observaron exactamente dos POST login y dos GET tareas, sin endpoint de logout.

La primera automatización por puntero agotó la espera de estabilidad del botón en una página oculta y no se contó como aprobada. La comprobación funcional posterior pasó con eventos click disparados desde el DOM, verificando antes que el botón estaba habilitado. Esto no certifica la estabilidad visual del puntero ni accesibilidad. Las respuestas fueron fixtures, no backends reales. Se retiraron las interceptaciones y se dejó la app en login sin mocks y sin token persistido.

El cierre H-01 se registra únicamente en [HALLAZGOS.md](../HALLAZGOS.md). Memoria evita persistencia del token, no un XSS activo. La limpieza bloqueada por permisos propaga el error y no garantiza borrar el residuo inaccesible; no se presenta esa prueba de fallo como una purga exitosa.

## Fallos y defectos separados

**Fallos de ejecución:** la ampliación previa terminó sin fallos. H-01 registró cinco fallos antes de implementar el requisito aprobado y terminó con 131/131 verdes. La automatización inicial por puntero tuvo timeout; la comprobación DOM posterior pasó con la limitación indicada. No se invirtieron expectativas para ocultar un bug; la restauración del token se sustituyó solo por la excepción aprobada.

**Defectos de aplicación conservados, no certificados como correctos por una suite verde:**

- Usuario persistido con JSON inválido: [session.service.ts:20](../src/app/services/session.service.ts#L20) puede lanzar antes del try en [dashboard.component.ts:46](../src/app/dashboard/dashboard.component.ts#L46). La prueba histórica que espera SyntaxError es caracterización de ese defecto, no una prueba de recuperación. No se adaptó ni se usa para afirmar que se corrigió.
- Login acepta token truthy sin validar tipo/usuario: [login.component.ts:49](../src/app/login/login.component.ts#L49). Guardar un usuario undefined produce el texto `undefined` en [session.service.ts:25](../src/app/services/session.service.ts#L25), que puede romper el siguiente parseo. No se añadió una prueba nueva que considere esa aceptación como éxito correcto.
- Escrituras no atómicas y navegación false sin tratamiento: [session.service.ts:23](../src/app/services/session.service.ts#L23) y [login.component.ts:55](../src/app/login/login.component.ts#L55). Se probó que las excepciones se informan; no se afirmó rollback ni recuperación del resultado false.
- Refresco tardío del error de login: el catch/finally asigna campos sin forzar detección de cambios en [login.component.ts:56](../src/app/login/login.component.ts#L56). Es un defecto ya documentado en [HALLAZGOS.md](../HALLAZGOS.md); no se reprodujo una prueba DOM en esta intervención ni se dio por corregido.

El estado y seguimiento de hallazgos permanecen únicamente en HALLAZGOS.md. Esta sección separa defectos de los resultados, no crea una segunda matriz de cierre.

## Pendientes y pruebas propuestas

**Pendientes de evidencia o decisión:** integración con los backends reales; política CORS real; expiración/revocación real de tokens; recuperación de JSON/usuario inválido; validación de token mal tipado; política ante navegación false y escrituras parciales. El contrato documenta los límites actuales, no define una corrección autorizada para todos ellos.

**Pruebas propuestas, no ejecutadas ni contabilizadas entre las 131:**

- Regresiones de recuperación de usuario/token inválidos y escrituras parciales, una vez acordado el resultado correcto y autorizada la corrección. Mantener la expectativa correcta al encontrar el fallo; no invertirla para producir verde.
- Suite de navegador que verifique actualización de mensajes, botón deshabilitado, estados vacío/error, texto HTML literal, navegación y anuncios accesibles. Requiere acordar su integración/herramienta; no se añadió una dependencia para simular DOM.
- Integración contra autenticación/API reales con usuarios de laboratorio y errores controlados, sin leer ni modificar otros componentes. Requiere coordinar disponibilidad y fixtures; las pruebas locales no la sustituyen.

Backend caído y timeout real de login sí se ejecutaron contra HTTP local. Los errores de CORS y timeouts externos de tareas se representaron con mocks: se probó la reacción del componente, no la causa externa. La falta de timeout propio de tareas se respetó, no se ocultó con una expectativa falsa de expiración.

## Documentos consultados

[ENDPOINTS.md](ENDPOINTS.md), [REGLAS.md](../REGLAS.md), [PLAN.md](../PLAN.md) y [HALLAZGOS.md](../HALLAZGOS.md), además de las suites, configuración, componentes y servicios enlazados. [resultados.md](../resultados.md) conserva el resumen histórico de 71 pruebas; el reporte h01-results.json respalda el total actual de 131.