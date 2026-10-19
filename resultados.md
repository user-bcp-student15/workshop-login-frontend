# Resultados de pruebas del frontend

Fecha de las ejecuciones resumidas: 2026-10-19.

Este documento resume las pruebas ya realizadas durante la ejecución del plan. No se volvieron a ejecutar para redactar este informe. La fuente de cobertura es [coverage/coverage-summary.json](coverage/coverage-summary.json), generado por Vitest con V8 mediante `npm run test:coverage`. El seguimiento de hallazgos permanece exclusivamente en [HALLAZGOS.md](HALLAZGOS.md).

## Resumen

| Comprobación | Resultado real |
|---|---|
| Caracterización previa, antes de modificar producción | 42 pruebas aprobadas en 3 archivos. |
| Caracterización después de extraer responsabilidades | Las mismas 42 pruebas aprobadas. |
| Suite ampliada antes y después de actualizar dependencias | 71 pruebas aprobadas en 7 archivos, sin fallos. |
| Cobertura del código de producción modificado | 100% en líneas, sentencias, funciones y ramas. |
| Umbral mínimo configurado | 85% por archivo en las cuatro métricas; cumplido. |
| Compilación estricta de código y plantillas | `npm run build` aprobado. |
| Flujo en navegador con HTTP interceptado | Login, consulta de tareas, recarga autenticada y logout comprobados. |
| Auditoría final de dependencias | No aprobada: código de salida 1 y 25 alertas residuales. |

## Pruebas automatizadas

| Archivo | Pruebas aprobadas | Comportamiento comprobado |
|---|---:|---|
| [src/app/login/login.component.spec.ts](src/app/login/login.component.spec.ts) | 21 | Validación de campos vacíos/nulos, prioridad de mensajes, petición exacta, persistencia antes de navegar, respuesta sin token, precedencia de errores, timeout simulado, recuperación de busy, fallo de navegación y preferencias. |
| [src/app/dashboard/dashboard.component.spec.ts](src/app/dashboard/dashboard.component.spec.ts) | 15 | Redirección sin token, recuperación de sesión, Bearer, propietario vacío, filtrado de archivadas, etiquetas, traducción de estados, resultados vacíos, errores, actualización de vista, JSON inválido y logout local. |
| [src/app/services/auth.service.spec.ts](src/app/services/auth.service.spec.ts) | 2 | Transporte Axios real contra servidor HTTP local: login JSON sin Bearer, GET de tareas con Bearer y conservación de respuestas de error 401. También ejercita TasksService. |
| [src/app/services/session.service.spec.ts](src/app/services/session.service.spec.ts) | 3 | Sesión persistente entre instancias, conservación de campos adicionales y preferencias, borrado de credenciales, JSON inválido y comportamiento previo cuando falta usuario. |
| [src/app/services/preferences.service.spec.ts](src/app/services/preferences.service.spec.ts) | 6 | Preferencias ausentes, vacías, parciales, falsas, nulas, anidadas y JSON inválido; guardado compatible. |
| [src/app/utils/http-error.spec.ts](src/app/utils/http-error.spec.ts) | 8 | Precedencia de mensaje del backend, mensaje de transporte y fallback; uso de detail para tareas. |
| [src/app/utils/legacy-format.spec.ts](src/app/utils/legacy-format.spec.ts) | 16 | Etiquetas y valores por defecto, filtrado exacto de ARCHIVED, conservación de objetos y comparador previo con prioridades de distintos tipos. |
| **Total** | **71** | **7 archivos de pruebas aprobados.** |

## Code Coverage

| Métrica | Cubierto | Total medido | Porcentaje |
|---|---:|---:|---:|
| Líneas | 219 | 219 | 100% |
| Sentencias | 219 | 219 | 100% |
| Funciones | 19 | 19 | 100% |
| Ramas | 65 | 65 | 100% |

Desglose del reporte por archivo:

| Archivo de producción | Líneas | Sentencias | Funciones | Ramas |
|---|---:|---:|---:|---:|
| [src/app/login/login.component.ts](src/app/login/login.component.ts) | 100% | 100% | 100% | 100% |
| [src/app/dashboard/dashboard.component.ts](src/app/dashboard/dashboard.component.ts) | 100% | 100% | 100% | 100% |
| [src/app/services/auth.service.ts](src/app/services/auth.service.ts) | 100% | 100% | 100% | 100% |
| [src/app/services/tasks.service.ts](src/app/services/tasks.service.ts) | 100% | 100% | 100% | 100% |
| [src/app/services/session.service.ts](src/app/services/session.service.ts) | 100% | 100% | 100% | 100% |
| [src/app/services/preferences.service.ts](src/app/services/preferences.service.ts) | 100% | 100% | 100% | 100% |
| [src/app/utils/http-error.ts](src/app/utils/http-error.ts) | 100% | 100% | 100% | 100% |
| [src/app/utils/legacy-format.ts](src/app/utils/legacy-format.ts) | 100% | 100% | 100% | 100% |
| [src/environments/environment.ts](src/environments/environment.ts) | 100% | 100% | 100%* | 100%* |

*La configuración de environment no contiene funciones ni ramas; V8 informa 100% con cero elementos medibles en esas dos métricas.*

El porcentaje corresponde únicamente a los nueve archivos ejecutables modificados incluidos en [vitest.config.ts](vitest.config.ts), no a toda la aplicación. Los modelos de tipos se borran al compilar y las plantillas no forman parte de esta medición V8. Su validación se realizó mediante build estricto y, para los comportamientos descritos abajo, mediante navegador. Una cobertura del 100% no garantiza ausencia de errores o vulnerabilidades.

## Comprobaciones en navegador

- Antes del cambio, un detalle con `<em>Detalle de prueba</em>` generaba un elemento em; después se mostró literalmente, sin crear elementos em.
- Login envió el cuerpo esperado; la consulta de tareas envió el Bearer y propietario correctos.
- Se mostró una tarea visible con etiqueta `HIGH · STUDENT` y se excluyó la tarea ARCHIVED.
- La recarga conservó la sesión y volvió a consultar tareas.
- Logout eliminó token y usuario, conservó preferencias y regresó al login, sin petición HTTP de logout.
- Se comprobaron el estado vacío y un error de tareas que finaliza la carga sin borrar sesión ni redirigir.

Estas comprobaciones usaron respuestas HTTP simuladas mediante la herramienta de navegador. No son pruebas contra los backends reales ni forman parte automática de `npm test`. El transporte real de Axios se verificó por separado con un servidor local simulado en puerto efímero.

## Seguridad y límites

La auditoría pasó de 27 alertas iniciales a 25 finales: 6 críticas, 10 altas y 9 moderadas. La ejecución final no informó avisos para Axios 1.20.0 ni Lodash 4.18.1, pero el gate global de seguridad sigue fallando por otras dependencias. No se equipara cobertura con seguridad.

Persisten los riesgos documentados en HALLAZGOS: token en localStorage, posible divulgación de detalles del backend, JSON de usuario inválido y actualización tardía del error de login observada antes de los cambios. La sesión en memoria y la redacción de errores no estaban autorizadas. El build conserva un aviso CommonJS para lodash/merge.

No se comprobaron autorización por propietario, caducidad/revocación del token ni políticas del servidor. Los resultados son una fotografía de las ejecuciones indicadas, no una garantía sobre futuras modificaciones.

## Reproducción

Desde la carpeta del frontend:

```bash
npm test
npm run test:coverage
npm run build
npm run audit:workshop
```

La cobertura genera sus artefactos dentro de la carpeta coverage del repositorio. La auditoría puede terminar con código distinto de cero mientras existan las alertas residuales; ese resultado no debe ocultarse.