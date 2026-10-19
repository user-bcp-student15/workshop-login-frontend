# Plan de corrección del frontend

Fecha: 2026-10-19. Selección confirmada por el usuario: únicamente H-01 de [HALLAZGOS.md](HALLAZGOS.md). Este documento sustituye el plan anterior de varios hallazgos; no traslada su aprobación de implementación a una nueva solución. La autorización anterior excluía expresamente cambiar la sesión persistente por memoria.

**Estado: implementación y excepción contractual aprobadas por el usuario el 2026-10-19**, mediante confirmación explícita en esta conversación: el token vivirá solo en memoria y recargar o abrir otra instancia exigirá login, manteniendo los contratos HTTP. Esta autorización es nueva y no se deduce de la aprobación del plan anterior. HALLAZGOS.md sigue siendo el único lugar de seguimiento.

Referencias: [docs/ENDPOINTS.md](docs/ENDPOINTS.md), [docs/GOOD_PRACTICES.md](docs/GOOD_PRACTICES.md) y [REGLAS.md](REGLAS.md). Los comandos y pruebas siguientes son trabajo futuro; no representan ejecuciones de esta planificación.

## Item: H-01 - Token de sesión persistido en localStorage

### Identificación y problema

H-01 está Pendiente y tiene severidad alta. SessionService ya centraliza la sesión, pero todavía escribe el token en localStorage y lo recupera desde allí. Puede leerlo JavaScript del mismo origen y persiste entre recargas. Evidencia: [session.service.ts:10](src/app/services/session.service.ts#L10) y [session.service.ts:18](src/app/services/session.service.ts#L18).

La centralización ya implementada no se vuelve a proponer como corrección. La prueba actual conserva token entre instancias de servicio, confirmando la persistencia: [session.service.spec.ts](src/app/services/session.service.spec.ts).

### Cambio propuesto

**Alternativa condicionada a aprobación:** guardar únicamente el token en un campo privado tipado de SessionService, registrado como singleton de Angular mediante providedIn root. Mantener la API pública token, user, save y clear, de modo que componentes y transporte no necesiten incorporar almacenamiento ni nuevas responsabilidades.

- No escribir el token en localStorage, sessionStorage, IndexedDB, URLs, preferencias ni logs. No añadir una copia persistida o cifrada recuperable por la propia app como supuesta solución frente a scripts del origen.
- Al iniciar la nueva instancia de aplicación, eliminar el residuo legacy workshop_token sin cargarlo en memoria ni reutilizarlo para autenticar. La clave permanece centralizada en el servicio únicamente para la limpieza de migración.
- Mantener el usuario en workshop_user y las preferencias en workshop_preferences como hoy, para no incluir una migración independiente de metadatos en este ítem. No almacenar contraseñas ni introducir secretos del servidor.
- Mantener el token disponible durante la navegación interna que comparte el singleton. Al cerrar sesión, vaciar el token en memoria y eliminar los residuos de credenciales que ya gestiona clear, conservando preferencias.
- No introducir dependencias, servicios duplicados, interceptores, renovación automática, cookies o endpoints de logout. No presentar sessionStorage como protección frente a XSS.

Esta alternativa reduce la persistencia y elimina la lectura del token desde almacenamiento web, pero no vuelve inmune la aplicación a un XSS activo: un script comprometido todavía puede interceptar peticiones o actuar con la sesión de la página.

### Límite contractual y condición de ejecución

El contrato actual permite recargar y recuperar el token persistido. El token solo en memoria deja de existir al reiniciar la aplicación: con usuario válido almacenado, dashboard redirigiría a login sin consultar tareas. También una pestaña nueva requeriría autenticación independiente.

**Excepción aprobada expresamente el 2026-10-19:** se autoriza perder la sesión al recargar/abrir otra instancia e implementar la alternativa en memoria, actualizando ENDPOINTS para reflejar únicamente ese cambio funcional. Hasta completar las pruebas y los gates, H-01 permanece Pendiente; la aprobación por sí sola no demuestra una corrección.

Si se exige restauración persistente y además una credencial inaccesible a JavaScript, habrá que acordar por separado una solución con el backend, como sesión con cookie HttpOnly. No puede implementarse unilateralmente aquí ni sustituye el contrato Bearer sin autorización. Esta coordinación no permite leer ni editar otros componentes.

En la alternativa propuesta se conservan método/URL/body/timeout del login, GET de tareas, query owner, Bearer, filtrado/etiquetas, mensajes, manejo de 401/403 y ausencia de llamada HTTP de logout. No se cambia la política de errores, la validación de respuestas, el parseo del usuario ni el refresco de la UI bajo este ítem.

### Archivos que se van a tocar

Solo después de aprobar la alternativa y su excepción contractual:

| Archivo | Alcance exclusivo de H-01 |
|---|---|
| [src/app/services/session.service.ts](src/app/services/session.service.ts) | Token en memoria, limpieza del token legacy y vaciado en clear. Conservar API pública y tratamiento del usuario. |
| [src/app/services/session.service.spec.ts](src/app/services/session.service.spec.ts) | Caracterización previa y pruebas de no persistencia, nueva instancia, migración y logout. |
| [src/app/login/login.component.spec.ts](src/app/login/login.component.spec.ts) | Probar éxito sin escritura del token; mantener usuario/preferencias y orden de navegación. |
| [src/app/dashboard/dashboard.component.spec.ts](src/app/dashboard/dashboard.component.spec.ts) | Compartir explícitamente la misma instancia de SessionService en el flujo de una app; probar nueva instancia sin token, Bearer y logout. |
| [docs/ENDPOINTS.md](docs/ENDPOINTS.md) | Solo tras la aprobación expresa: describir token en memoria, recarga y migración. No cambiar el contrato HTTP. |
| [docs/TESTING.md](docs/TESTING.md) | Registrar casos, comandos, resultados reales y límites de la migración aprobada. |
| [HALLAZGOS.md](HALLAZGOS.md) | Registrar decisión y evidencia; cerrar únicamente si se implementa y verifica la solución aprobada. |

No se prevé tocar componentes de producción ni AuthService/TasksService: deben seguir consumiendo la API existente. Si una prueba demuestra que hace falta cambiar otra superficie, detenerse y revisar el alcance antes de ampliarlo. No se prevén archivos ni paquetes nuevos.

### Prueba a escribir antes de modificar producción

**Primero, caracterización del contrato vigente:** reutilizar las suites de sesión, login y dashboard para fijar guardar antes de navegar, usuario/preferencias preservados, Bearer exacto, logout local y restauración entre instancias. Registrar los resultados antes del cambio. Esta prueba describe la persistencia actual, no demuestra que sea segura.

**Después de autorizar la excepción, escribir las expectativas de corrección antes de tocar el servicio:**

1. Login válido mantiene el token en la instancia compartida y permite consultar tareas con el mismo Bearer, sin escribir esa credencial en almacenamiento persistente.
2. Una nueva instancia de servicio/aplicación no recupera el token de la anterior. Con usuario persistido válido, dashboard navega a login y no hace GET. Complementar con recarga real de navegador usando respuestas simuladas.
3. Si existe workshop_token legacy, no se utiliza como sesión activa ni se copia en memoria; se elimina. Usuario y preferencias no se borran por esa limpieza. Si la limpieza falla, informar el resultado y no certificar eliminación del residuo.
4. Logout vacía la credencial activa, elimina residuos token/usuario, conserva preferencias y no agrega una petición HTTP.
5. Un 401/403 de tareas conserva el comportamiento actual: muestra error sin renovar token, redirigir o limpiar sesión automáticamente.

Los fixtures deben representar el singleton real: login y dashboard dentro de una misma aplicación comparten SessionService; una nueva instancia representa un reinicio. No crear dos servicios independientes y luego introducir persistencia para que el test pase. La prueba de restauración legacy se sustituye por la nueva expectativa solo tras aprobar y registrar el cambio de requisito, nunca para ocultar una regresión.

No añadir aserciones verdes que consideren correcto un usuario inválido o una escritura parcial. Esos defectos ya documentados quedan fuera de este ítem y deben reportarse aparte si aparecen; no se corrigen ni se silencian incidentalmente.

### Validación y cierre

Desde la raíz de workshop-login-frontend, ejecutar durante la implementación aprobada:

```bash
npm test -- src/app/services/session.service.spec.ts
npm test -- src/app/login/login.component.spec.ts src/app/dashboard/dashboard.component.spec.ts
npm run test:coverage
npm run build
```

Mantener al menos 85% de líneas, sentencias, funciones y ramas por archivo de producción modificado, sin reducir umbrales ni exclusiones para conseguir verde. Usar Vitest y utilidades existentes, tipos estrictos y métodos pequeños, con las claves y limpieza centralizadas. Guardar artefactos dentro del repositorio y registrar solo resultados realmente ejecutados.

La comprobación en navegador debe cubrir login → tareas → logout dentro de una instancia, recarga que exige login y preferencias conservadas. No confundir esa comprobación con integración del backend real ni con prueba de protección frente a XSS. No instalar un runner de navegador sin justificar y aprobar esa dependencia.

H-01 solo podrá marcarse Resuelto después de la aprobación explícita, ausencia de token persistido y residuos legacy en los casos probados, flujo Bearer intacto y gates aprobados, con nota del riesgo residual ante scripts activos. Si se mantiene la exigencia de persistencia tras recarga o no se puede limpiar el token legacy, permanece Pendiente. La aprobación del plan anterior no satisface esta condición.