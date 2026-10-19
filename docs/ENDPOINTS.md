# Contrato de consumo de endpoints del frontend

Actualizado el 2026-10-19 según el código refactorizado, incluida la excepción funcional de H-01 aprobada expresamente en [PLAN.md](../PLAN.md): token solo en memoria y nuevo login tras recarga u otra instancia. Este documento describe al consumidor Angular, no un esquema de servidor certificado. No se inspeccionaron ni llamaron los backends. Los ejemplos reproducen fixtures verificables de las pruebas existentes: no son capturas de respuestas reales ni credenciales para utilizar los servicios.

Existen dos llamadas externas, login y tareas. Logout es local, no un tercer endpoint. Las URLs actuales están en [src/environments/environment.ts](../src/environments/environment.ts). El transporte usa Axios 1.20.0, declarado en [package.json:19](../package.json#L19).

Se verificaron los defaults del Axios instalado: Accept admite JSON/texto, validateStatus acepta los estados 200 a 299 y timeout vale 0 salvo que la llamada lo cambie. Los servicios no configuran interceptores, reintentos, renovación de token, validateStatus ni withCredentials. Los headers documentados son los funcionales; el navegador puede agregar otros, como Origin.

## Login: POST http://localhost:8080/auth/login

### 1. Quién lo llama

`LoginComponent.login()` llama a `AuthService.login(username, password)` al pulsar «Ingresar». El componente valida campos, maneja estado, coordina persistencia y navega; AuthService realiza HTTP.

Antes de llamar, rechaza usuario o contraseña null, undefined o vacíos al comprobar `String(valor).trim()`. Solo valida: no recorta los valores enviados. El mensaje de usuario vacío prevalece sobre el de contraseña vacía. Durante la petición busy=true deshabilita el botón y muestra «Ingresando...».

Evidencia: [login.component.ts:35](../src/app/login/login.component.ts#L35), [auth.service.ts:11](../src/app/services/auth.service.ts#L11) y [login.component.html:34](../src/app/login/login.component.html#L34).

### 2. Qué envía

| Parte | Nombre | Valor o regla | Fuente |
|---|---|---|---|
| Método y URL | POST | `http://localhost:8080/auth/login` | environment.authUrl y AuthService. |
| Header | Accept | `application/json, text/plain, */*` | Default de Axios; no se redefine. |
| Header | Content-Type | `application/json` al serializar el objeto del body | Transformación de Axios; no se escribe explícitamente en el servicio. |
| Header | Authorization | No se agrega | AuthService solo pasa la opción timeout. |
| Body JSON | username | string; valor original del formulario | LoginRequest y argumento del servicio. |
| Body JSON | password | string; valor original del formulario | LoginRequest y argumento del servicio. |
| Body JSON | client | Literal `angular-workshop` | Constante CLIENT_ID. |
| Query params | Ninguno | No se construye query ni se pasa params | AuthService. |
| Opción de transporte | timeout | 5000 ms; no es un campo del body | Constante LOGIN_TIMEOUT_MS. |

Los campos y la petición se definen en [workshop.models.ts:1](../src/app/models/workshop.models.ts#L1) y [auth.service.ts:6](../src/app/services/auth.service.ts#L6).

Ejemplo verificable: el fixture de transporte envía el usuario con sus espacios originales.

```http
POST http://localhost:8080/auth/login
Accept: application/json, text/plain, */*
Content-Type: application/json

{"username":" student ","password":"test-password","client":"angular-workshop"}
```

El body y la ausencia de Bearer se comprueban en [auth.service.spec.ts](../src/app/services/auth.service.spec.ts). Esa prueba sustituye la URL por un servidor local en puerto efímero; arriba se muestra la URL configurada realmente para la app.

### 3. Qué espera recibir en éxito

**Código de estado:** el componente no exige 200 en particular; Axios resuelve las respuestas 2xx por defecto. Además exige `response.token` truthy. Un 2xx sin token no es éxito de autenticación para la UI. El 200 del ejemplo está probado en el fixture; el código exacto del backend real es una pregunta abierta.

| Campo de response.data | Tipo declarado en frontend | Uso y condiciones reales |
|---|---|---|
| token | string, null u omitido | Un valor truthy se guarda solo en memoria y permite navegar. No hay validación runtime de tipo, formato, firma o caducidad. |
| user | WorkshopUser u omitido | Se guarda completo con JSON.stringify. Login no comprueba que exista antes de navegar; dashboard necesita poder recuperar un usuario utilizable. |
| user.username | string opcional | Dashboard lo envía como owner o usa cadena vacía si es falsy; también es fallback del saludo. |
| user.displayName | string opcional | Se prefiere en el saludo; si es falsy se utiliza username. |
| Otros campos de user | unknown | Se conservan al serializar, sin otros consumos específicos en esta UI. |

Las interfaces no validan JSON en ejecución: [workshop.models.ts:7](../src/app/models/workshop.models.ts#L7). Token en memoria y persistencia del usuario: [session.service.ts:23](../src/app/services/session.service.ts#L23). Uso del usuario: [dashboard.component.ts:44](../src/app/dashboard/dashboard.component.ts#L44) y [dashboard.component.html:6](../src/app/dashboard/dashboard.component.html#L6).

Ejemplo de éxito exacto del fixture de transporte:

```http
HTTP/1.1 200 OK
Content-Type: application/json

{"token":"transport-token","user":{"username":"student"}}
```

Fuente: [auth.service.spec.ts](../src/app/services/auth.service.spec.ts). `transport-token` es un valor artificial opaco, no un JWT ni una credencial real.

Con ese contenido, el componente guarda el token en un campo privado de SessionService, persiste solo el usuario en workshop_user, guarda preferencias con PreferencesService y navega a `/dashboard`, en ese orden. El finally restablece busy=false. Estos servicios no almacenan la contraseña.

SessionService es singleton del injector raíz: la navegación interna comparte el token activo. Recargar o abrir otra instancia crea un servicio sin token, aunque el usuario y las preferencias sigan en localStorage. Su constructor elimina workshop_token legacy sin leerlo ni restaurarlo. No existe restauración automática de autenticación tras recarga.

### 4. Cómo reacciona ante errores

Las excepciones de la operación asíncrona comparten un catch, sin ramas por status. Se establece `No se pudo autenticar a <usuario>.`; el detalle toma el primer valor truthy entre `error.response.data.message`, `error.message` y `Error desconocido`, convertido a string. Se registra el error completo con console.error. El finally restablece busy, incluso si falla la persistencia o la navegación.

| Caso | Qué hace la UI y la sesión |
|---|---|
| Usuario vacío/nulo/indefinido | No hace POST. Establece `Ingrese un usuario.` y no navega. |
| Contraseña vacía/nula/indefinida con usuario válido | No hace POST. Establece `Ingrese una contraseña.` y no navega. |
| Rechazo HTTP: incluidos 400, 401, 403, 429 o 5xx | Aplica el catch y la precedencia anterior. No interpreta el código, renueva credenciales ni reintenta. No navega por éxito ni limpia una sesión anterior. Son categorías rechazadas por Axios, no códigos garantizados del backend. |
| Credenciales inválidas o token inválido indicado por el servidor | No hay tratamiento diferenciado. Login no envía Bearer. Si el servidor rechaza la llamada, aplica el catch; si entrega 2xx y token truthy, el frontend lo acepta sin comprobar autenticidad. |
| Timeout de login | Configurado a 5000 ms. Si Axios rechaza, usa el catch; sin mensaje de backend, el detalle procede de error.message. No reintenta y busy vuelve a false. La prueba simula `timeout of 5000ms exceeded`. |
| Red, CORS u otro fallo de transporte | Si la promesa rechaza, mismo catch; sin response usa error.message o fallback. No se promete un texto de navegador concreto. No navega ni borra sesión. |
| 2xx sin body útil o token falsy, vacío, null u omitido | Establece `El backend respondió sin token.`; no guarda nuevos datos ni navega. Incluye 204 sin contenido útil. Finalmente busy=false. |
| 2xx con token truthy de tipo inesperado | No hay validador runtime ni mensaje específico. Lo asigna a memoria e intenta navegar; la construcción posterior del Bearer puede convertirlo a texto. No se guarda en localStorage ni se valida su autenticidad. |
| 2xx con token pero sin user | Guarda token en memoria y el texto `undefined` como usuario persistido, e intenta navegar. Luego el parseo en dashboard puede fallar antes de su try, sin recuperación amigable. |
| JSON/esquema inesperado | Si el dato entregado por Axios no tiene token truthy, muestra el mensaje sin token. Si hay una excepción de transformación/transporte, usa el catch. No rechaza aquí una forma inválida de user; puede fallar al cargar/renderizar dashboard. |
| Excepción al guardar usuario o preferencias | Mismo catch; no continúa hacia la navegación. No hay rollback: el token ya asignado a memoria y las escrituras previas pueden permanecer. Ya no hay escritura persistente del token. |
| Rechazo de la promesa de navegación | Mismo catch; la sesión ya guardada permanece. Si router.navigate resuelve false sin rechazar, no examina ese resultado ni crea un mensaje específico. |
| Falla la purga legacy al construir SessionService | La creación del servicio propaga la excepción antes de login(); no hay mensaje de recuperación controlada ni garantía de borrar el residuo inaccesible. No restaura el token legacy. |

Ejemplo de error verificable: el fixture devuelve HTTP 401 con `{"message":"Rejected","detail":"Rejected tasks"}`. Para usuario student, login toma message y establece `No se pudo autenticar a student.` con detalle `Rejected`; no usa detail. Fuente: [auth.service.spec.ts](../src/app/services/auth.service.spec.ts).

Evidencia del manejo: [login.component.ts:35](../src/app/login/login.component.ts#L35), [http-error.ts:5](../src/app/utils/http-error.ts#L5) y [login.component.spec.ts](../src/app/login/login.component.spec.ts). Login no fuerza NgZone ni detectChanges en catch/finally; el refresco tardío tras un rechazo ya se observó y está registrado en [HALLAZGOS.md](../HALLAZGOS.md). Los cambios de estado descritos no garantizan un refresco visual inmediato que el código no asegura.

### 5. Notas de seguridad relevantes

- El token vive solo en el campo privado activeToken de SessionService; no se escribe en almacenamiento web. workshop_token se usa únicamente para eliminar residuos legacy al iniciar y al cerrar sesión. El usuario sigue en workshop_user. Memoria reduce persistencia, pero no evita que un XSS activo intercepte peticiones o actúe con la sesión. Evidencia: [session.service.ts:9](../src/app/services/session.service.ts#L9).
- Preferencias se cargan/mezclan y guardan aparte en PreferencesService, bajo `workshop_preferences`; no se envían en el body de login. Evidencia: [preferences.service.ts](../src/app/services/preferences.service.ts).
- Ya no se usa `[innerHTML]` en mensajes. strong/br son estáticos y mensaje/detalle se interpolan como texto. Esto no redacta información interna contenida en errores. Evidencia: [login.component.html:39](../src/app/login/login.component.html#L39).
- La URL es HTTP local; no se presupone TLS, despliegue en producción, cookies HttpOnly ni renovación de token.
- Logout llama a SessionService.clear y navega a `/login`: vacía el token en memoria, intenta eliminar workshop_token legacy y workshop_user, conserva preferencias y no llama al servidor. Si removeItem falla, la memoria ya está vacía, pero clear propaga el error y la navegación puede no completarse. No demuestra revocación remota. Evidencia: [session.service.ts:28](../src/app/services/session.service.ts#L28) y [dashboard.component.ts:68](../src/app/dashboard/dashboard.component.ts#L68).

**Preguntas abiertas:** ¿qué códigos exactos devuelve el servidor para éxito/errores? ¿Qué campos de user garantiza? ¿Qué formato, duración y mecanismo de revocación tiene el token? ¿Cuál es la política CORS y de redacción de mensajes del backend? El consumidor y los fixtures no lo confirman.

## Tareas: GET http://localhost:8000/api/tasks

### 1. Quién lo llama

`DashboardComponent.ngOnInit()` llama a `TasksService.list(owner, token)` al inicializar el componente. La plantilla no ofrece actualización, paginación ni polling.

Antes del GET recupera el token de la instancia activa en memoria y parsea el usuario persistido mediante SessionService. Sin token, si el parseo termina correctamente, navega a `/login` y no consulta tareas. Esta es también la reacción tras recargar o abrir otra instancia: el usuario persistido no restituye autenticación. El parseo es anterior al try de la petición: JSON inválido interrumpe esa secuencia, incluso si falta token.

Evidencia: [dashboard.component.ts:44](../src/app/dashboard/dashboard.component.ts#L44), [session.service.ts:15](../src/app/services/session.service.ts#L15) y [tasks.service.ts:8](../src/app/services/tasks.service.ts#L8).

### 2. Qué envía

| Parte | Nombre | Valor o regla | Fuente |
|---|---|---|---|
| Método y URL base | GET | `http://localhost:8000/api/tasks` | environment.tasksUrl y TasksService. |
| Header | Accept | `application/json, text/plain, */*` | Default de Axios; no se redefine. |
| Header | Authorization | `Bearer ` concatenado con token activo en memoria | TasksService recibe el valor de SessionService. |
| Header | Content-Type | El servicio no lo establece; no hay body | Solo se pasan URL y header Authorization. |
| Query param | owner | `user.username` o cadena vacía si es falsy | Dashboard lo pasa al servicio, que concatena `?owner=` y el valor, sin codificación explícita mediante params o encodeURIComponent. |
| Body | Ninguno | No se envía JSON de solicitud | Llamada axios.get. |
| Opción de transporte | timeout | No se configura; default actual 0, sin límite propio de Axios | No impide que la red o el servidor cierren una conexión. |

Evidencia: [dashboard.component.ts:52](../src/app/dashboard/dashboard.component.ts#L52), [tasks.service.ts:8](../src/app/services/tasks.service.ts#L8) y [src/environments/environment.ts](../src/environments/environment.ts).

Ejemplo verificable con el token y usuario del fixture de transporte:

```http
GET http://localhost:8000/api/tasks?owner=student
Accept: application/json, text/plain, */*
Authorization: Bearer transport-token
```

La prueba comprueba método, URL, Bearer y body vacío; también prueba `/api/tasks?owner=`. Fuente: [auth.service.spec.ts](../src/app/services/auth.service.spec.ts). No se añaden filtros de estado/prioridad ni parámetros de paginación.

### 3. Qué espera recibir en éxito

**Código de estado:** Axios acepta 2xx; dashboard no exige un código exacto. Además espera que response.data sea directamente un arreglo utilizable, no un contenedor `{ tasks: [...] }`. El 200 del ejemplo es el fixture probado, no una garantía del backend. Un 204 sin arreglo útil no satisface el contrato de datos del consumidor.

| Campo de response.data | Tipo declarado en frontend | Uso y condiciones reales |
|---|---|---|
| Raíz | WorkshopTask[] | Arreglo directo, incluido `[]`; no hay validador runtime. |
| Cada elemento | WorkshopTask | Debe permitir acceder a sus campos; null u objetos incompatibles pueden causar errores. |
| status | string, null u omitido | Oculta solo `ARCHIVED` exacto; para presentación compara el estado en mayúsculas y usa minúsculas en la clase CSS. |
| priority | string, number, boolean, null u omitido | Se usa en etiqueta/comparador; no hay enum ni orden de negocio declarado. |
| owner | unknown opcional | Si es truthy, etiqueta con String(owner).toUpperCase(); si no, SIN-ASIGNAR. No es una decisión de autorización. |
| title | string opcional | Encabezado de tarea mediante interpolación. |
| description | string opcional | Descripción mediante interpolación. |
| label | string opcional en el modelo | El frontend lo sobrescribe para las tareas visibles; no se requiere al servidor. |
| Otros campos | unknown | No se muestran expresamente; permanecen en los objetos originales. |

Definición: [workshop.models.ts:18](../src/app/models/workshop.models.ts#L18). Transformación: [legacy-format.ts:3](../src/app/utils/legacy-format.ts#L3). Presentación: [dashboard.component.html:20](../src/app/dashboard/dashboard.component.html#L20).

Ejemplo de éxito exacto del fixture, que omite campos opcionales:

```http
HTTP/1.1 200 OK
Content-Type: application/json

[{"title":"Transport task","status":"TODO"}]
```

Fuente: [auth.service.spec.ts](../src/app/services/auth.service.spec.ts). Demuestra comportamiento con un fixture mínimo, no que el servidor garantice un esquema con todos esos campos opcionales.

La tarea del ejemplo es visible y recibe etiqueta `NORMAL · SIN-ASIGNAR`; muestra título `Transport task`, descripción vacía y estado `Por hacer`. El saludo proviene de la sesión, no de GET tareas.

Dashboard conserva la respuesta en tasks y construye visibleTasks: excluye ARCHIVED exacto, agrega label a los objetos visibles y ordena sus referencias. Si ambas prioridades son strings las compara lexicográficamente; en los demás casos compara Number(prioridad). Devuelve -1 si la izquierda es mayor y 1 en caso contrario, incluso para empates. No es un orden semántico HIGH/MEDIUM/LOW.

La etiqueta usa prioridad truthy en mayúsculas o NORMAL, seguida de ` · ` y propietario. Traduce TODO → Por hacer, IN_PROGRESS → En progreso, DONE/COMPLETED → Completado y RESUELTO → Resuelto; otros estados conservan su texto. Con `[]` o sin tareas visibles muestra `No hay tareas para mostrar todavía.`. Resultado y loading=false se aplican con NgZone.run y detectChanges.

Evidencia: [legacy-format.ts:12](../src/app/utils/legacy-format.ts#L12), [dashboard.component.ts:10](../src/app/dashboard/dashboard.component.ts#L10), [dashboard.component.ts:54](../src/app/dashboard/dashboard.component.ts#L54), [dashboard.component.html:27](../src/app/dashboard/dashboard.component.html#L27) y [legacy-format.spec.ts](../src/app/utils/legacy-format.spec.ts).

### 4. Cómo reacciona ante errores

Las excepciones del GET o de la preparación dentro del try toman el primer valor truthy entre `error.response.data.detail`, `error.message` y `No se pudo cargar el dashboard`, convertido a string. No se usa response.data.message. Dentro de NgZone.run establece error y loading=false y llama a detectChanges. La plantilla muestra el error; la sección de tareas exige `!loading && !error`.

| Caso | Qué hace la UI y la sesión |
|---|---|
| Token ausente, con usuario parseable | Redirige a `/login`, sin GET. No es una respuesta HTTP. |
| Recarga u otra instancia con usuario persistido válido | No hay token en memoria; redirige a login sin GET, aunque hubiera un token legacy, que se intenta eliminar sin reutilizarlo. Es la excepción funcional aprobada de H-01. |
| Token inválido/expirado y rechazo 401/403 del servidor | Mismo catch que otros rechazos: muestra detail, error.message o fallback y termina la carga. No borra sesión, renueva token, reintenta ni redirige automáticamente. No detecta caducidad por sí mismo. |
| Otros rechazos HTTP, incluidos 400, 404, 429 y 5xx | Mismo manejo, sin mensajes diferenciados por código. No se afirma que el backend emita todos esos estados. |
| Red, CORS o conexión interrumpida que rechaza la promesa | Muestra la extracción indicada, termina carga y conserva sesión/ruta. No hay texto de navegador garantizado. |
| Servidor sin responder y promesa pendiente | Sin timeout propio, loading puede permanecer true y los esqueletos de carga siguen mientras no se resuelva/rechace. No hay cancelación/reintento automático. |
| Timeout/excepción de transporte originado por otra capa | Si Axios rechaza, mismo catch y loading=false. No existe una rama especial de timeout ni un límite de aplicación diferente del default 0. |
| 2xx con contenedor, null u otro dato que no soporta filter | prepareTasks puede lanzar y el catch muestra error.message o fallback; termina carga. No adapta un campo tasks ni convierte la respuesta inválida a `[]`. Incluye 204 sin arreglo útil. |
| Arreglo con elementos inválidos | Excepciones al filtrar/etiquetar/ordenar caen en el catch. No hay validación individual con un mensaje de negocio. Valores que llegan a plantilla pueden causar errores de renderizado; no se garantiza fallback para cualquier esquema. |
| JSON persistido de usuario inválido | SessionService.user lanza antes del try; no asigna error ni loading=false por ese camino. No hay recuperación controlada ni redirección garantizada. |
| Usuario parseable pero incompatible | No hay validación runtime. Si acceder a username lanza dentro del try, usa el catch; una forma inválida también puede provocar errores de plantilla. No se promete una pantalla válida para esos datos. |

Ejemplo verificable: el fixture HTTP 401 contiene `{"message":"Rejected","detail":"Rejected tasks"}`. Dashboard usa detail y muestra `Rejected tasks`, termina la carga y conserva sesión. El rechazo de transporte y la política de UI se comprueban respectivamente en [auth.service.spec.ts](../src/app/services/auth.service.spec.ts) y [dashboard.component.spec.ts](../src/app/dashboard/dashboard.component.spec.ts).

Evidencia del manejo: [dashboard.component.ts:44](../src/app/dashboard/dashboard.component.ts#L44), [http-error.ts:5](../src/app/utils/http-error.ts#L5), [session.service.ts:20](../src/app/services/session.service.ts#L20) y [dashboard.component.html:18](../src/app/dashboard/dashboard.component.html#L18). Si falla la purga legacy durante la construcción del servicio, también se propaga antes de este flujo; no se afirma que se haya borrado el residuo en ese escenario.

### 5. Notas de seguridad relevantes

- El Bearer sale del token en memoria de SessionService; no se valida ni descifra antes de enviarlo. Tener un token solo habilita el intento de GET, no demuestra autorización. El token no sobrevive a recarga ni se recupera de localStorage. Evidencia: [tasks.service.ts:9](../src/app/services/tasks.service.ts#L9) y [session.service.ts:15](../src/app/services/session.service.ts#L15).
- owner proviene de usuario persistido modificable en el navegador. El consumidor no demuestra autorización por propietario en el servidor; debe verificarse externamente, no inferirse de esa query.
- La concatenación de owner no aplica codificación explícita. Caracteres especiales pueden cambiar la interpretación de la URL; no se presenta como un parámetro escapado ni una barrera de acceso.
- Título, descripción, saludo, etiqueta y error se interpolan, sin `[innerHTML]`. detail todavía puede divulgar datos internos porque no se redacta. Evidencia: [dashboard.component.html](../src/app/dashboard/dashboard.component.html).
- Logout vacía token activo y elimina residuos legacy/usuario cuando el almacenamiento lo permite; vuelve a login sin petición HTTP ni prueba de revocación remota y conserva preferencias. Un fallo de borrado se propaga, no se oculta. Evidencia: [session.service.ts:28](../src/app/services/session.service.ts#L28) y [dashboard.component.ts:68](../src/app/dashboard/dashboard.component.ts#L68).

**Preguntas abiertas:** ¿qué códigos de éxito/error garantiza la API? ¿Cuál es el esquema obligatorio y el catálogo oficial de estados/prioridades? ¿Cómo aplica autorización al owner? ¿Qué hace ante tokens expirados/revocados? ¿Hay paginación, límites o timeouts en servidor? ¿Qué CORS permite Authorization entre orígenes? El frontend no confirma esas garantías.

## Documentos y fuentes consultados

- Documento de partida: versión legacy anterior de este contrato. La observación previa del refresco de login y el seguimiento de riesgos se consultaron en [HALLAZGOS.md](../HALLAZGOS.md); no se trasladó aquí su seguimiento.
- Configuración/tipos: [package.json](../package.json), [src/environments/environment.ts](../src/environments/environment.ts), [workshop.models.ts](../src/app/models/workshop.models.ts) y defaults del Axios 1.20.0 instalado, inspeccionados sin peticiones externas.
- Implementación: AuthService, TasksService, SessionService, PreferencesService, LoginComponent, DashboardComponent, sus plantillas y utilidades http-error/legacy-format enlazados en cada apartado.
- Ejemplos y comportamiento: [auth.service.spec.ts](../src/app/services/auth.service.spec.ts), [login.component.spec.ts](../src/app/login/login.component.spec.ts), [dashboard.component.spec.ts](../src/app/dashboard/dashboard.component.spec.ts) y [legacy-format.spec.ts](../src/app/utils/legacy-format.spec.ts).