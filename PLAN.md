# Plan de corrección del frontend

## Alcance y selección

Propuesta documental para los ocho hallazgos pendientes seleccionados por el usuario: H-01 a H-08 de [HALLAZGOS.md](HALLAZGOS.md). H-09 queda excluido porque figura como «No encontrado». No se modifica código, configuración, dependencias, contratos ni estados de seguimiento en esta etapa. Esta propuesta no es una segunda matriz: los avances y resultados se registrarán únicamente en HALLAZGOS.md.

La base de la propuesta es [docs/ENDPOINTS.md](docs/ENDPOINTS.md), [docs/GOOD_PRACTICES.md](docs/GOOD_PRACTICES.md) y [REGLAS.md](REGLAS.md). No se han ejecutado pruebas, auditorías, instalaciones ni servicios externos para elaborar este plan. Las rutas nuevas indicadas a continuación son propuestas; aún no existen. No se confirma ningún CVE por el solo número de versión.

| Hallazgo | Motivo de selección |
|---|---|
| H-01 | Riesgo alto de exposición y persistencia de la credencial de sesión. |
| H-02 | Axios participa en las dos llamadas críticas; requiere evaluación documentada antes de actualizarlo. |
| H-03 | Dependencia usada para mezclar preferencias persistidas; conviene delimitar comportamiento y necesidad. |
| H-04 | Cambio acotado para dejar de interpretar mensajes dinámicos como HTML. |
| H-05 | Separar HTTP, almacenamiento y presentación permite corregir los demás hallazgos sin replicar lógica. |
| H-06 | Tipar los límites y el estado permite detectar incompatibilidades antes de ejecución. |
| H-07 | Las pruebas de flujo son condición previa a una refactorización transversal. |
| H-08 | Simplificación local de validaciones con bajo alcance y comprobación directa. |

## Invariantes y decisiones previas

- Mantener `POST http://localhost:8080/auth/login`, el cuerpo con `username`, `password` y `client: 'angular-workshop'`, el timeout de 5000 ms y la ausencia de Bearer en login. No recortar los valores enviados por aplicar `trim()` en la validación.
- Mantener `GET http://localhost:8000/api/tasks?owner=` con la concatenación actual del propietario y `Authorization: Bearer <token>`. No agregar timeout, reintentos, nueva codificación del parámetro ni interceptores que alteren otras llamadas sin una propuesta separada.
- Mantener la respuesta consumida, las rutas de navegación y la ausencia de una llamada HTTP de logout. Un error de tareas no debe borrar la sesión ni redirigir automáticamente.
- Mantener la exclusión exacta de `ARCHIVED`, las etiquetas, traducciones de estados, saludo y estados de carga/error/vacío. Caracterizar el comparador existente sin inventar un orden de negocio ni corregir empates en esta tanda.
- Mantener inicialmente persistencia y claves actuales: token, usuario y preferencias se guardan tras autenticar; logout elimina token y usuario, no preferencias. No presentar una extracción a servicio como si eliminara el riesgo de H-01.
- Conservar la precedencia de extracción de errores: `response.data.message` en login o `response.data.detail` en tareas, luego `error.message` y finalmente el fallback actual. No atribuir a un refactor un cambio silencioso de mensajes.
- No retirar `NgZone.run` ni `detectChanges()` sin caracterizar la actualización de la vista. No corregir silenciosamente el parseo de usuario fuera del `try`, los datos de respuesta inválidos u otros comportamientos no seleccionados.
- La meta de cobertura del código modificado será al menos 85%, con comprobación explícita del alcance medido. No reducir controles existentes ni ocultar alertas. Usar funciones pequeñas, retornos anticipados y nombres de dominio; compartir únicamente responsabilidades realmente comunes.

**Decisión de sesión:** una sesión solo en memoria es una alternativa acotada sin cambios HTTP, pero no preserva la restauración tras recargar descrita en el contrato. Por tanto, se propone como segunda fase condicionada a aprobar expresamente esa excepción funcional. Mientras se exija el contrato intacto, solo se centraliza la persistencia actual y H-01 no se considera corregido.

**Decisión de errores:** la interpolación evita interpretar HTML, pero no elimina la posible exposición de detalles internos. No es posible garantizar que cualquier texto arbitrario de un backend sea seguro para mostrar y a la vez conservar su reproducción actual. Clasificar errores y sustituir mensajes no reconocidos por mensajes públicos exige aprobar ese cambio de presentación. Hasta entonces se preservan la extracción y el texto actuales; esa limitación de la convención de errores queda explícita, sin cambiar el contrato ni declarar una corrección completa de la divulgación de información.

## H-01: token en localStorage

**Hallazgo y problema.** H-01 de HALLAZGOS.md, severidad alta. El login persiste el token y dashboard lo recupera para el Bearer. Un script del mismo origen puede leerlo y la credencial sobrevive a recargas. Evidencia: [src/app/login/login.component.ts:47](src/app/login/login.component.ts#L47), [src/app/dashboard/dashboard.component.ts:36](src/app/dashboard/dashboard.component.ts#L36).

**Cambio propuesto.** Primero extraer toda lectura, escritura y borrado de sesión a un único `SessionService`, con constantes privadas para las claves y usuario tipado. Los componentes solo consumen sus operaciones. Esta fase conserva almacenamiento y comportamiento; prepara H-05, pero no mitiga por sí sola H-01. Como alternativa posterior, proponer token y usuario solo en memoria durante la vida de la aplicación, conservar únicamente preferencias no sensibles en almacenamiento y eliminar residuos de las claves antiguas. No migrar el token viejo automáticamente ni afirmar que memoria impide un XSS activo. No sustituir localStorage por sessionStorage como supuesta protección frente a scripts. No proponer cookies HttpOnly sin participación del backend: cambiaría el contrato de autenticación y queda fuera del ámbito.

**Archivos a tocar al implementar.** [src/app/login/login.component.ts](src/app/login/login.component.ts), [src/app/dashboard/dashboard.component.ts](src/app/dashboard/dashboard.component.ts). Nuevos propuestos: `src/app/services/session.service.ts` y `src/app/services/session.service.spec.ts`. Reutilizar los modelos y las pruebas de componentes compartidos con H-05/H-06/H-07.

**Prueba de caracterización antes de modificar producción.** Con almacenamiento y router simulados, verificar que un login válido guarda token, usuario y preferencias antes de navegar; una nueva instancia de dashboard recupera la sesión y envía el mismo Bearer; sin token no consulta tareas; logout elimina solo token y usuario y vuelve a login. Registrar explícitamente que la sesión sobrevive a una nueva instancia/recarga con el almacenamiento persistido.

**Comprobación de corrección propuesta.** Para la extracción, repetir esas pruebas sin cambios de resultado. Solo si se autoriza la alternativa en memoria, añadir primero pruebas del nuevo requisito: ningún token/usuario queda persistido, una aplicación reiniciada pide login, logout vacía la memoria y las preferencias permanecen. Esas pruebas de seguridad son expectativas nuevas, no caracterización del comportamiento actual. No ejecutar esa fase mientras el contrato funcional deba permanecer intacto.

## H-02: Axios 0.31.0

**Hallazgo y problema.** H-02, severidad media. La versión declarada realiza autenticación y consulta de tareas; no se ha demostrado aquí un CVE aplicable al navegador. Evidencia: [package.json:19](package.json#L19), [src/app/login/login.component.ts:41](src/app/login/login.component.ts#L41), [src/app/dashboard/dashboard.component.ts:43](src/app/dashboard/dashboard.component.ts#L43).

**Cambio propuesto.** Aislar primero las dos llamadas en `AuthService` y `TasksService` con sus tipos. Antes de elegir versión, ejecutar la auditoría disponible y contrastar los avisos con el uso en navegador, la versión resuelta y la compatibilidad del proyecto. Preferir una actualización dirigida de Axios ya utilizado, sin añadir librerías ni migrar simultáneamente a otro cliente HTTP. No fijar aquí una versión supuestamente segura ni usar una actualización forzada de todo el árbol. Distinguir vulnerabilidades del paquete, uso afectado y riesgos de herramientas de desarrollo.

**Archivos a tocar al implementar.** [package.json](package.json) y [package-lock.json](package-lock.json), conservando el contenido existente ajeno al cambio. Nuevos propuestos compartidos con H-05: `src/app/services/auth.service.ts`, `src/app/services/tasks.service.ts` y sus correspondientes `.spec.ts`. Los componentes solo se adaptan en el paso de extracción de H-05, no se implementa un segundo cliente.

**Prueba de caracterización antes de modificar producción.** Simular `axios.post` y `axios.get` para capturar URL, método, cuerpo, cabecera, opciones y cantidad de llamadas. Comprobar timeout de login, ausencia de timeout explícito en tareas, propietario vacío y precedencia de errores `message`/`detail`. Cubrir éxito, rechazo, timeout de login y respuesta sin token. Al actualizar, añadir una prueba del adaptador/cliente real contra un servidor HTTP simulado local, sin depender de los servicios externos, para no confiar exclusivamente en un mock de Axios.

**Comprobación de corrección propuesta.** Ejecutar `npm run audit:workshop`, pruebas y build antes/después en la fase de implementación. Una auditoría fallida o una alerta restante se registra en HALLAZGOS.md, no se oculta. Si la evidencia no indica una actualización necesaria o no existe versión compatible verificada, registrar la decisión sin afirmar que se corrigió una vulnerabilidad confirmada.

## H-03: Lodash y mezcla de preferencias

**Hallazgo y problema.** H-03, severidad media. `merge` combina preferencias por defecto con JSON de almacenamiento local. Una sustitución superficial puede cambiar el comportamiento para propiedades desconocidas, valores nulos o estructuras anidadas. No se confirma contaminación de prototipos. Evidencia: [src/app/login/login.component.ts:24](src/app/login/login.component.ts#L24), [src/app/login/login.component.ts:25](src/app/login/login.component.ts#L25), [package.json:20](package.json#L20).

**Cambio propuesto.** Mover carga/guardado y mezcla de preferencias a `PreferencesService`, separado de la credencial de sesión. Auditar primero los avisos aplicables a Lodash. Con el contrato intacto, preferir una actualización compatible y verificada si procede; no sustituir `merge` ciegamente por propagación de objetos. Eliminar Lodash solo si la caracterización demuestra equivalencia para las entradas admitidas y se confirma que no quedan otros usos. Restringir claves, descartar datos persistidos o cambiar reglas de mezcla sería un cambio funcional adicional y requiere aprobación, no una consecuencia implícita del tipado.

**Archivos a tocar al implementar.** [src/app/login/login.component.ts](src/app/login/login.component.ts), [package.json](package.json), [package-lock.json](package-lock.json). Nuevos propuestos: `src/app/services/preferences.service.ts` y `src/app/services/preferences.service.spec.ts`. Si se elimina Lodash por completo y se confirma que no se necesita, retirar también su paquete de tipos; no hacerlo anticipadamente.

**Prueba de caracterización antes de modificar producción.** Capturar preferencias sin almacenamiento, objeto vacío, preferencias parciales, valores falsos, `null`, estructuras anidadas, propiedades adicionales y JSON inválido. Comprobar que un fallo de parseo conserva valores por defecto y permite continuar, que las preferencias se guardan tras login válido y que logout no las elimina. Usar esas pruebas para decidir si una alternativa nativa es realmente equivalente.

**Comprobación de corrección propuesta.** Repetir pruebas de preferencias y login, auditoría y build. Actualización o eliminación solo con evidencia; no prometer ausencia de CVEs ni modificar el contrato de preferencias sin autorización.

## H-04: mensajes dinámicos con innerHTML

**Hallazgo y problema.** H-04, severidad media. Se concatena usuario y error del backend dentro de cadenas HTML que consume la plantilla. Angular sanitiza el enlace actual; no se ha demostrado un bypass. Evidencia: [src/app/login/login.component.ts:55](src/app/login/login.component.ts#L55), [src/app/login/login.component.html:39](src/app/login/login.component.html#L39).

**Cambio propuesto.** Sustituir el enlace por interpolación de texto. Separar mensaje principal y detalle en estado tipado; poner el énfasis y el salto de línea como estructura estática de plantilla, no como etiquetas en cadenas. No usar `bypassSecurityTrustHtml`, no añadir sanitizadores ni dependencias. Conservar validaciones, mensajes de negocio y precedencia de extracción de errores. La política de redacción de detalles arbitrarios queda sujeta a la decisión previa de errores; mostrar texto literalmente no garantiza que no contenga información interna.

**Archivos a tocar al implementar.** [src/app/login/login.component.ts](src/app/login/login.component.ts), [src/app/login/login.component.html](src/app/login/login.component.html). Nuevo propuesto y compartido con H-07/H-08: `src/app/login/login.component.spec.ts`. Cambiar CSS solo si una prueba visual demuestra que la estructura estática lo necesita, no como rediseño.

**Prueba de caracterización antes de modificar producción.** Cubrir mensajes por usuario vacío, contraseña vacía, respuesta sin token y error de autenticación; verificar precedencia del detalle, estado `busy` y ausencia de navegación ante rechazo. Para la plantilla, comprobar en navegador el texto visible y que un detalle con marcado inocuo se interpreta actualmente como HTML. Esta prueba registra el comportamiento a reemplazar, no una explotación.

**Comprobación de corrección propuesta.** Añadir antes del cambio una expectativa nueva de renderizado literal: un usuario o detalle con `<em>texto</em>` se muestra como texto, no crea un elemento `em`. Mantener la estructura visual estática, sin crear HTML a partir de datos. Ejecutar la comprobación de DOM en navegador, no atribuírsela al entorno Node de Vitest.

## H-05: separación de responsabilidades

**Hallazgo y problema.** H-05, severidad media. Los componentes realizan HTTP, almacenan sesión, conocen URLs y coordinan navegación. Evidencia: [src/app/login/login.component.ts:41](src/app/login/login.component.ts#L41), [src/app/dashboard/dashboard.component.ts:35](src/app/dashboard/dashboard.component.ts#L35), [src/app/dashboard/dashboard.component.ts:74](src/app/dashboard/dashboard.component.ts#L74).

**Cambio propuesto.** Extraer `AuthService` para la llamada de login y `TasksService` para la consulta; `SessionService` concentra sesión y `PreferencesService` preferencias. Los componentes conservan solo estado/presentación y coordinación de navegación. Las URLs van a `src/environments/environment.ts`, como indica GOOD_PRACTICES; las claves pertenecen al servicio de almacenamiento y el identificador de cliente y timeout a constantes nombradas junto a su uso propietario. No introducir configuración remota, servicios genéricos, interceptores ni una jerarquía adicional. Extraer la proyección de tareas a una función pura solo porque permite probar filtrado, etiquetas y comparador separadamente, no por una duplicación inexistente. Centralizar la lectura tipada de errores en un helper con campo esperado `message` o `detail`, sin alterar la precedencia ni redacción sin autorización.

**Archivos a tocar al implementar.** [src/app/login/login.component.ts](src/app/login/login.component.ts), [src/app/dashboard/dashboard.component.ts](src/app/dashboard/dashboard.component.ts) y, solo si cambia la representación del estado, sus plantillas. Nuevos propuestos: los cuatro servicios y pruebas descritos en H-01/H-02/H-03, `src/environments/environment.ts`, `src/app/utils/http-error.ts`, `src/app/utils/http-error.spec.ts`, `src/app/utils/task-presentation.ts` y `src/app/utils/task-presentation.spec.ts`. Evitar archivos adicionales si una función encaja claramente en una utilidad existente. No tocar rutas ni agregar un guard en este alcance.

**Prueba de caracterización antes de modificar producción.** En las pruebas compartidas de componentes, fijar el orden autenticar → guardar → navegar y recuperar sesión → consultar → proyectar → actualizar vista. Probar falta de token, tareas archivadas/visibles, arreglo vacío, etiquetas con fallback, traducción de estados, comparador actual y errores sin borrado de sesión. Simular router, almacenamiento, `NgZone` y `ChangeDetectorRef`; completar con comprobación en navegador de que carga, resultado y error realmente se renderizan tras una promesa.

**Comprobación de corrección propuesta.** Repetir las mismas pruebas después de cada extracción; verificar que no quedan llamadas Axios ni accesos a localStorage dentro de componentes y que no se duplican claves o lógica de errores. Mantener los servicios reutilizables y métodos pequeños. No mover navegación al cliente HTTP ni mezclar preferencias con credenciales.

## H-06: tipado estricto

**Hallazgo y problema.** H-06, severidad media. Estado, respuestas y utilidad usan `any`; además la configuración actual no activa modo estricto. Evidencia: [src/app/login/login.component.ts:16](src/app/login/login.component.ts#L16), [src/app/dashboard/dashboard.component.ts:23](src/app/dashboard/dashboard.component.ts#L23), [src/app/utils/legacy-format.ts:1](src/app/utils/legacy-format.ts#L1), [tsconfig.json:7](tsconfig.json#L7).

**Cambio propuesto.** Definir interfaces de solicitud/respuesta de login, usuario consumido, tarea, preferencias y estado de presentación. Tipar cadenas y booleanos del componente; usar `unknown` para errores y límites externos y estrecharlos mediante comprobaciones pequeñas. No asumir campos obligatorios o enumeraciones del backend que no constan en ENDPOINTS. No usar conversiones forzadas, aserciones no nulas ni `any` para silenciar errores. Conservar valores adicionales del usuario mediante campos de tipo `unknown`, sin descartarlos al persistirlo. No presentar una interfaz TypeScript como validación en ejecución. Caracterizar entradas anómalas antes de decidir rechazos nuevos.

**Archivos a tocar al implementar.** [src/app/login/login.component.ts](src/app/login/login.component.ts), [src/app/dashboard/dashboard.component.ts](src/app/dashboard/dashboard.component.ts), [src/app/utils/legacy-format.ts](src/app/utils/legacy-format.ts), [src/app/utils/legacy-format.spec.ts](src/app/utils/legacy-format.spec.ts), servicios y pruebas compartidos. Nuevo propuesto: `src/app/models/workshop.models.ts`. Revisar [tsconfig.json](tsconfig.json) para activar `strict` y los controles de TypeScript pertinentes, y `strictTemplates`/controles de inyección de Angular tras corregir los errores del alcance. No desactivar otros controles para conseguir build verde.

**Prueba de caracterización antes de modificar producción.** Ampliar la utilidad existente con tarea ausente, prioridad/propietario omitidos y valores falsos admitidos hoy; capturar los campos consumidos de respuestas simuladas y la conservación de campos extra del usuario. Mantener las comprobaciones de validación nula/vacía del login como casos de borde, usando `unknown` en el adaptador de prueba si no son valores de la entrada normal del formulario. No inventar fixtures que se presenten como esquemas oficiales del backend.

**Comprobación de corrección propuesta.** Ejecutar pruebas y `npm run build`, incluida compilación de plantillas. Corregir errores dentro del alcance sin debilitar opciones. Comprobar que tipos, servicios y componentes tocados no contienen `any`; mantener firmas de transporte y comportamiento. Un cambio de aceptación de datos inválidos requiere decisión explícita, no se oculta en una conversión de tipos.

## H-07: pruebas de flujo y negocio

**Hallazgo y problema.** H-07, severidad media. Solo existe una prueba de la utilidad; Vitest está configurado en Node y no demuestra renderizado de plantillas. Evidencia: [src/app/utils/legacy-format.spec.ts:4](src/app/utils/legacy-format.spec.ts#L4), [vitest.config.ts:5](vitest.config.ts#L5).

**Cambio propuesto.** Escribir primero las pruebas compartidas que caracterizan login, sesión, tareas y logout antes de una extracción amplia. Usar Vitest ya instalado, `vi.mock` para Axios y dobles pequeños del router, almacenamiento, zona y detector de cambios. Instanciar clases de componente directamente con esos dobles cuando sea suficiente; no llamar a esto una prueba de DOM. Reutilizar los mismos archivos para los casos de H-01 a H-08, no crear una suite paralela por hallazgo. Probar después los servicios y las funciones puras extraídas.

**Archivos a tocar al implementar.** [src/app/utils/legacy-format.spec.ts](src/app/utils/legacy-format.spec.ts) y los `.spec.ts` de componentes, servicios y utilidades ya propuestos. Nuevo propuesto: `src/app/dashboard/dashboard.component.spec.ts`. [vitest.config.ts](vitest.config.ts) solo para declarar medición explícita de los archivos modificados y umbrales verificables; no excluir funciones difíciles para inflar la cobertura. Si aparecen dobles realmente repetidos, compartir un helper mínimo de pruebas, no crear una infraestructura anticipada.

**Prueba de caracterización antes de modificar producción.** Suite base: validaciones y falta de token sin HTTP indebido; solicitud de login exacta; persistencia previa a navegación; respuesta sin token; rechazo y recuperación de `busy`; sesión recuperada; consulta y Bearer exactos; filtrado/etiquetado/estados; carga, error y arreglo vacío; logout sin HTTP y con preferencias preservadas. Usar promesas controlables para comprobar estados intermedios, no esperas arbitrarias. Ejecutarla contra el código actual y guardar el resultado real en HALLAZGOS.md antes de refactorizar.

**Comprobación de corrección propuesta.** Ejecutar `npm test`, `npm run test:coverage` y `npm run build`; comprobar al menos 85% de líneas, funciones, ramas y sentencias del código modificado, sin afirmar que el gate existe hoy. Para H-04 y actualización real de vista, comprobar el DOM en un navegador disponible con respuestas HTTP simuladas. No añadir jsdom, Playwright ni otro paquete silenciosamente: si el navegador disponible no permite automatizarlo, documentar la comprobación manual y pedir autorización para incorporar una herramienta antes de prometer un gate de DOM reproducible.

## H-08: simplificación del login

**Hallazgo y problema.** H-08, severidad baja. Las validaciones anidadas envuelven la petición, la comprobación de token y sus salidas. Evidencia: [src/app/login/login.component.ts:33](src/app/login/login.component.ts#L33), [src/app/login/login.component.ts:36](src/app/login/login.component.ts#L36), [src/app/login/login.component.ts:46](src/app/login/login.component.ts#L46).

**Cambio propuesto.** Aplicar retornos anticipados para usuario inválido, contraseña inválida y respuesta sin token. Extraer una comprobación pequeña de campo vacío únicamente si evita la repetición real entre ambas validaciones, conservando null/undefined y `String(valor).trim()` donde corresponde. Dejar una sola sección `try/catch/finally` para la operación asíncrona y un único lugar que restablezca `busy`. El componente coordina el servicio de H-05; no duplicar HTTP ni sesión para esta corrección. Mantener prioridad del mensaje de usuario sobre contraseña y no añadir una política nueva de concurrencia.

**Archivos a tocar al implementar.** [src/app/login/login.component.ts](src/app/login/login.component.ts) y el `src/app/login/login.component.spec.ts` compartido con H-04/H-07. Ningún archivo nuevo adicional solo para reducir anidamiento.

**Prueba de caracterización antes de modificar producción.** Parametrizar usuario y contraseña vacíos, espacios, null/undefined, ambos inválidos, datos válidos, respuesta sin token, rechazo y fallo de navegación. Verificar el mensaje que prevalece, cuántas peticiones se hacen, que no se navega en validaciones fallidas y que `busy` termina en falso en todas las salidas asíncronas. Mantener los valores originales del request aunque la validación use `trim()`.

**Comprobación de corrección propuesta.** Ejecutar las mismas pruebas tras aplanar el método. Confirmar que la ruta válida sigue siendo autenticar → guardar → navegar y que no se añadieron valores mágicos, métodos genéricos o nuevas responsabilidades.

## Secuencia de implementación y riesgos

1. Implementar primero H-07 como caracterización del código actual y ampliar la utilidad. Registrar resultados reales en HALLAZGOS.md; no pasar de etapa con fallos sin explicar. Las expectativas nuevas de seguridad se distinguen de las que describen el comportamiento vigente.
2. Aplicar H-04 y H-08 como cambios acotados, conservando reglas de negocio. Comprobar el renderizado literal y las salidas del login. No mezclar aquí la política pendiente de redacción de errores.
3. Extraer H-05 por responsabilidad, aplicando los tipos de H-06 en cada archivo tocado: primero transporte/configuración, después persistencia/preferencias y por último presentación/errores. Ejecutar pruebas enfocadas después de cada paso y el conjunto antes de activar las opciones estrictas restantes.
4. Evaluar H-02 y H-03 sobre esa base caracterizada. Elegir versiones solo con evidencia de auditoría y compatibilidad. No actualizar dependencias no relacionadas ni sustituir la mezcla de preferencias sin equivalencia demostrada.
5. Ejecutar H-01 solo hasta la fase compatible de centralización mientras el contrato sea inmutable. La alternativa en memoria y la redacción de errores quedan sin implementar hasta aprobación explícita de sus excepciones funcionales. H-01 sigue pendiente si no se elimina su riesgo; no declarar todos los hallazgos resueltos por completar las extracciones.
6. Verificar peticiones y flujo completo con dobles; para una comprobación integrada, coordinar servicios externos sin leer ni editar sus repositorios. No añadir un endpoint, cambiar CORS o hacer revocación remota desde este ámbito. Actualizar únicamente las filas correspondientes de HALLAZGOS.md con evidencia y resultados de cada intervención.

Riesgos principales: perder la sesión al recargar; cambiar por accidente el Bearer, propietario o timeout al extraer HTTP; alterar preferencias al reemplazar `merge`; dejar de actualizar la vista al tocar la zona de Angular; modificar mensajes o `busy` al aplanar login; aceptar como contrato un esquema inventado; y obtener pruebas verdes porque un mock oculta diferencias de la dependencia real. Las caracterizaciones y decisiones anteriores están dirigidas a esos riesgos.

## Validación y cierre de esta propuesta

La única escritura de esta etapa es PLAN.md. ENDPOINTS, HALLAZGOS, código y dependencias deben permanecer intactos. La validación documental debe comprobar que hay un apartado para cada ID seleccionado, que todos están pendientes en la matriz, que cada apartado contiene problema, propuesta, archivos y caracterización previa, y que los enlaces de evidencia resuelven dentro del repositorio.

Las órdenes de pruebas, cobertura, build y auditoría anteriores son pasos futuros: no representan resultados obtenidos. Un hallazgo se dará por corregido solo cuando su implementación y las comprobaciones aplicables aporten evidencia; las decisiones funcionales aún no aprobadas no se confunden con tareas ya autorizadas.