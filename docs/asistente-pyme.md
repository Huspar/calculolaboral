# Asistente Laboral Pyme: plan técnico (v2, con base de datos Neon)

Versión 2 · 12-oct-2026 · reemplaza el plan externo `plan_asistente_laboral_pyme_v1.md` y la v1 de este documento (que guardaba los datos en el navegador).

## 1. Qué es y qué no es

Un panel con cuenta donde la pyme (hasta 5 trabajadores) ingresa **una vez** su empresa y su equipo, y desde ahí:

- emite la liquidación del mes de cada trabajador y las guarda por mes,
- emite 7 documentos con los datos ya puestos,
- abre los generadores de contrato, anexo de 42 horas y finiquito ya prellenados,
- ve los pendientes del mes y puede entrar desde cualquier equipo.

**Decisiones de fondo (tomadas el 12-oct-2026):**

1. **Base de datos Neon (Postgres 18), plan Launch, región São Paulo (`aws-sa-east-1`).** La región no se puede cambiar después de crear el proyecto. Creado el 12-oct-2026: organización "Calculo Laboral", proyecto `asistente-pyme` (`small-frost-55850621`), base `asistente`, ramas `production` (por defecto) y `pruebas` (sin borrado automático).
2. **Cuentas sin contraseña:** enlace de acceso por correo (Resend). Sin contraseñas que guardar ni filtrar.
3. **Datos sensibles cifrados por la aplicación** antes de llegar a la base (AES-256-GCM, clave en Vercel). Quien vea la base sin la clave no lee RUT, nombres ni sueldos.
4. **Pase Pyme de 3 y 12 meses** con el pago único de Flow ya construido. El pase queda **asociado a la cuenta** y lo valida el servidor. Cobro recurrente automático queda para más adelante.
5. **Reutiliza lo construido:** motor de liquidaciones, `CLCheckout`, `/api/checkout`, `/api/flow-confirm`, generadores de contrato, anexo y finiquito.
6. Los productos sueltos se siguen vendiendo igual.

## 2. Alcance

### Entra

| Módulo | Estado actual | Trabajo |
| :--- | :--- | :--- |
| Cuenta (enlace por correo, sesión, salir) | No existe | Nuevo |
| Empresa (razón social, RUT, giro, representante y su RUT, domicilio, comuna, logo) | Parcial en el navegador (`cl_liq_v1`) | Ficha en la base |
| Nómina (ficha del trabajador, hasta 5 activos) | Parcial en `cl_liq_v1` | Ficha en la base, con datos de contrato y vacaciones |
| Importación desde el navegador | — | Un clic: copia empresa y trabajadores de `cl_liq_v1` a la cuenta, con confirmación |
| Liquidación mensual | Construida | Datos del mes guardados en la cuenta; imprimir todas las del mes en un PDF |
| Pendientes del mes | No existe | Calculados al abrir el panel; sin correos en esta etapa |
| Comprobante de feriado (arts. 67 a 70) | Lógica parcial en `calculadora-vacaciones.html` | Módulo puro de vacaciones y registro de días tomados |
| Certificado de antigüedad | No existe | Plantilla |
| Certificado de remuneraciones | No existe | Plantilla (remuneración pactada; promedio líquido solo con liquidaciones guardadas) |
| Carta de término por vencimiento del plazo (art. 159 N°4) | No existe | Plantilla |
| Carta de despido por necesidades de la empresa (art. 161) | Guía y pack Word | Plantilla con hechos obligatorios e indemnizaciones (art. 169) |
| Amonestación escrita | No existe | Plantilla con hechos obligatorios |
| Anexo de protección de datos (Ley 21.719) | Instrumento del Kit 21.719 en Word | Plantilla tomada del kit |
| Contrato, anexo 42 h, finiquito | Generadores construidos | Prellenado desde la ficha (`?desde=pyme&t=<id>`) |
| Respaldo, exportación y borrado de la cuenta | No existe | Descarga en JSON; borrado definitivo a pedido |
| Pase Pyme 3 y 12 meses | No existe | Productos Flow + vigencia en la cuenta |

### Queda fuera

| Fuera | Motivo |
| :--- | :--- |
| "Total a pagar en Previred" | Un error hace que la pyme pague mal. Exige SIS, AFC del empleador, mutual y la cotización de la Ley 21.735 por etapas. Etapa 2, como estimación. |
| Cartas de despido por art. 160 | Requieren hechos probados e investigación (Ley Karin). Una plantilla de un clic induce despidos injustificados. El Pack de Cartas sigue aparte con su guía. |
| Renuncia generada por el empleador | Es la práctica de renuncias firmadas en blanco que la ley persigue. |
| Certificado de "honorabilidad" | El empleador no puede certificarla. |
| Citación a descargos | En Ley Karin va dentro del protocolo de investigación, no en una plantilla suelta. |
| Varios usuarios por empresa (contador, socio) | Etapa 2. En esta etapa, una cuenta por empresa. |
| Correos automáticos de recordatorio | Etapa 2 (la base lo permite, pero cada aviso es una decisión legal y de contenido). |
| Archivo para el Libro de Remuneraciones Electrónico | Etapa 2, para el plan de 5 trabajadores. |
| Cobro recurrente automático | Etapa 2, si el pase se vende. |
| Textos del plan externo | "Documentos oficiales", "Contrato Oficial", "imbatible", "siempre actualizados": chocan con AGENTS.md 2.1. |

## 3. Arquitectura

```
Navegador                         Vercel (/api)                     Neon (São Paulo)
─────────                         ─────────────                     ────────────────
asistente-pyme.html               api/pyme.js  (UNA función         tablas (sección 4)
 pyme_app.js  ──fetch JSON──►      con enrutador interno)  ──SQL──► datos sensibles
 pyme_docs.js (plantillas)         api/_pyme/*.js (módulos)          cifrados por la app
 pyme_pendientes.js                  auth, cifrado, rutas
 pyme_vacaciones.js, feriados_cl.js
 liquidacion_*.js (motor)         Flow ─► api/flow-confirm ─► crea o extiende el pase de la cuenta
```

- **Una sola función `api/pyme.js`** con enrutador interno (`?r=estado`, `?r=empresa`…). El proyecto tiene hoy 8 funciones; el plan Hobby de Vercel permite 12, y una sola función evita acercarse al límite.
- **Módulos puros** (sin DOM ni red): `pyme_docs`, `pyme_pendientes`, `pyme_vacaciones`, `feriados_cl`, y en el servidor `cifrado`, `tokens` y validaciones. Se prueban con Node.
- **Conexión a la base:** paquete `@neondatabase/serverless` (consultas por HTTP, pensado para funciones sin estado). Primera dependencia de ejecución del proyecto; se agrega a `package.json`.
- **Variables en Vercel** (las pone el propio dueño, nunca pasan por el chat): `DATABASE_URL` (la crea la integración de Vercel que se instala desde la consola de Neon, en el proyecto existente; no la del Marketplace de Vercel, que crearía otra cuenta de Neon facturada por Vercel), `PYME_DATA_KEY` (clave de cifrado, 32 bytes en base64) y `PYME_SESSION_SECRET`. Existentes: `FLOW_*`, `RESEND_API_KEY`.
- **Entornos:** la rama `main` del sitio usa la rama de Neon `production`; las pruebas usan la rama `pruebas` (el plan Launch incluye 10 ramas por proyecto), con datos ficticios. La integración puede crear una rama por cada vista previa de Vercel: se desactiva o se limita para no pasar de las 10 ramas incluidas.
- **PDF por impresión del navegador; Word** con el mismo método de los generadores actuales. Sin librerías de interfaz nuevas.

### 3.1 Cuenta y sesión

- **Entrar:** `POST ?r=entrar {email}` → siempre responde igual (no revela si el correo existe) → correo con enlace de un solo uso, válido 15 minutos. Se guarda solo el hash SHA-256 del token.
- **Verificar:** `GET /api/pyme?r=verificar&t=…` valida, consume el token, crea la sesión y redirige a `/asistente-pyme`.
- **Sesión:** cookie `HttpOnly; Secure; SameSite=Lax`, 30 días con renovación; en la base solo el hash del identificador de sesión. Cerrar sesión la revoca en el servidor.
- **CSRF:** toda escritura exige el encabezado `X-CL-Pyme: 1` y `Content-Type: application/json` (el navegador no los envía en formularios de otros sitios).
- **Límite de intentos:** máximo de enlaces pedidos por correo y por IP por hora (contadores en la tabla `intentos`).
- **Cuenta nueva:** se crea al verificar el primer enlace, o cuando `/api/flow-confirm` registra un pase para un correo nuevo (ese correo recibe el enlace de acceso junto con el comprobante).

### 3.2 Cifrado de datos

- Los datos personales de cada trabajador y de la empresa van en una columna `datos_cifrados` (JSON cifrado con AES-256-GCM, con vector aleatorio por registro y número de versión de la clave). Las columnas sin cifrar son solo identificadores, fechas de control y banderas (`activo`).
- **Implementado en `api/_pyme/cifrado.js` (23 pruebas en `tools/test_pyme_cifrado.js`).** Cada dato se cifra atado a un contexto (`trabajadores:<id>`): copiar el contenido cifrado a otro registro o a otra cuenta hace fallar el descifrado. Formato: vector de 12 bytes + etiqueta de 16 + texto cifrado; la versión de la clave va en `version_clave`. Claves de versiones siguientes: `PYME_DATA_KEY_2`…`_9` y `PYME_DATA_KEY_VERSION` para elegir con cuál se cifra. Los tokens y huellas están en `api/_pyme/tokens.js` (HMAC-SHA256 con `PYME_SESSION_SECRET`).
- Como cada cuenta tiene máximo 5 trabajadores, no hay búsquedas por RUT en la base: se descifra la lista de la cuenta en el servidor y se busca en memoria.
- **Rotación de clave:** `PYME_DATA_KEY` lleva versión; un script (`tools/pyme_rotar_clave.js`) recifra todo. La pérdida de la clave haría ilegibles los datos: se respalda fuera de Vercel (lo hace el dueño, un gestor de contraseñas).
- Los registros (logs) de las funciones no incluyen datos personales: solo identificadores internos y códigos de error.

### 3.3 Pase Pyme (cobro)

- `api/_flow.js`: productos `pyme3` (código `P3`, 92 días) y `pyme12` (código `P12`, 366 días), sin el desbloqueo firmado de 48 h: al confirmar el pago, `flow-confirm` registra el pase en la tabla `pases` (orden de Flow única) y suma los días a la vigencia de la cuenta (comprar de nuevo extiende).
- **Qué desbloquea:** el pase de 3 meses, liquidaciones de hasta 5 trabajadores, todos los documentos del panel y el contrato; el de 12 meses, además el finiquito.
- **Cuenta sin pase:** puede crear su ficha y ver pendientes, con 1 trabajador y vista previa con marca de agua. El servidor aplica el límite de trabajadores; la marca de agua la quita el navegador solo con pase vigente (misma limitación conocida que los generadores actuales: no protege contra quien edite el código de la página).
- **Precio propuesto:** `pyme3` $19.990 y `pyme12` $59.990, hasta 5 trabajadores. Textos según AGENTS.md 2.1: "equivale a $X al mes", sin "ahorras X %" ni precios tachados. Aviso de retracto con casilla (`CLCheckout.buyKit`).
- **Cuando vence:** la cuenta pasa a solo lectura y exportación durante 90 días; después se borran los datos, con aviso previo por correo. *Los plazos de retención se confirman con un abogado antes de lanzar.*

### 3.4 Prellenado de los generadores actuales

El panel abre `generador-…?desde=pyme&t=<id>`. Cada generador agrega una función pequeña `prefillDesdePyme()` que pide la ficha a la API y llena su formulario (si hay un borrador propio, pregunta si lo reemplaza). No se reescriben.

| Generador | Dónde guarda hoy | Cambio |
| :--- | :--- | :--- |
| Liquidación | `cl_liq_v1` (navegador) | Lee ficha y guarda meses en la cuenta; sin sesión sigue funcionando como hoy |
| Contrato | `contrato_builder_state` | `prefillDesdePyme()`; acepta el pase |
| Anexo 42 h (gratis) | — | `prefillDesdePyme()` |
| Finiquito | `fini_draft_payload` | `prefillDesdePyme()`; acepta el pase de 12 meses |

### 3.5 Pendientes del mes (`pyme_pendientes.js`)

Función pura `pendientes(estado, hoy, parametros)` → lista de `{ nivel, trabajadorId, texto, accion }`. Solo alertas con certeza de cálculo:

1. Liquidación del mes sin emitir, por trabajador.
2. Plazo de pago de cotizaciones del mes anterior (ver verificaciones).
3. Plazo fijo que vence en 30 días o menos; aviso de que la segunda renovación o seguir trabajando después del vencimiento lo convierte en indefinido.
4. Vacaciones: trabajador que se acerca a dos períodos acumulados (art. 70).
5. Trabajador que cumple 10 años para el feriado progresivo (art. 68).
6. Sueldo base bajo el ingreso mínimo del mes (proporcional a la jornada), con la vigencia de `liquidacion_parametros.js`.
7. Notas normativas del mes (`NOTAS_MES`).
8. Pase por vencer en 15 días.

### 3.6 Documentos (`pyme_docs.js`)

Cada plantilla declara sus campos obligatorios y no se puede emitir con campos vacíos (nada de corchetes en el documento final). Pie en todos: "Modelo de referencia basado en la normativa vigente; no constituye asesoría legal."

| Documento | Datos que pide además de la ficha | Reglas |
| :--- | :--- | :--- |
| Certificado de antigüedad | Destinatario | Antigüedad calculada a la fecha de emisión |
| Certificado de remuneraciones | Incluir o no el promedio líquido | Promedio solo con liquidaciones guardadas de los últimos 3 meses |
| Comprobante de feriado | Fecha de inicio y días hábiles | Sábado siempre inhábil (art. 69), feriados de `feriados_cl.js`, saldo antes y después, reintegro, firmas |
| Carta art. 159 N°4 | Fecha de término | Estado de cotizaciones; aviso de envío a la Inspección dentro de 3 días hábiles |
| Carta art. 161 | Hechos concretos (obligatorio, mínimo de caracteres), aviso o pago sustitutivo, fecha | Indemnizaciones (art. 169 a) con la lógica de `js/logic.js`; estado de cotizaciones; envío a la Inspección |
| Amonestación escrita | Hechos, fecha, obligación incumplida | Aviso: como sanción debe estar en el reglamento interno (art. 154 N°10) |
| Anexo de protección de datos | Finalidades que aplican | Texto tomado del Kit 21.719 |

## 4. Modelo de datos (Postgres)

```sql
cuentas        (id uuid pk, email text unique, creada timestamptz, ultimo_acceso timestamptz)
enlaces_acceso (id uuid pk, cuenta_email text, token_hash text unique, vence timestamptz, usado timestamptz)
sesiones       (id uuid pk, cuenta_id uuid fk, token_hash text unique, creada, vence, revocada timestamptz)
empresas       (id uuid pk, cuenta_id uuid fk unique, datos_cifrados bytea, version_clave int, actualizada)
trabajadores   (id uuid pk, empresa_id uuid fk, activo bool, datos_cifrados bytea, version_clave int, creado, actualizado)
vacaciones     (id uuid pk, trabajador_id uuid fk, datos_cifrados bytea, version_clave int)
meses          (id uuid pk, trabajador_id uuid fk, periodo text 'AAAA-MM', datos_cifrados bytea, version_clave int, unique(trabajador_id, periodo))
documentos     (id uuid pk, trabajador_id uuid fk, tipo text, emitido timestamptz)      -- registro sin el texto
pases          (id uuid pk, cuenta_id uuid fk, producto text, orden_flow text unique, desde timestamptz, vence timestamptz)
intentos       (clave text, ventana timestamptz, cuenta int)                             -- límite de solicitudes
auditoria      (id bigserial pk, cuenta_id uuid, evento text, ip_hash text, cuando timestamptz) -- entrar, salir, exportar, borrar
```

- Migraciones numeradas en `db/migrations/*.sql`, aplicadas por `tools/db_migrate.js` (idempotente, registra las ya aplicadas).
- `ON DELETE CASCADE` desde `cuentas`: borrar la cuenta elimina todo. Después se registra solo un evento de auditoría sin datos personales.
- Respaldo de Neon: historial de 7 días (plan Launch). Además, el usuario puede descargar su JSON cuando quiera.

## 5. Ley 21.719 y textos legales

Con datos de terceros en nuestros servidores, el sitio pasa a actuar como **encargado de tratamiento** de cada empresa cliente (la empresa es la responsable de los datos de sus trabajadores). Antes de lanzar:

- Actualizar **Privacidad** y **Términos**: qué datos se guardan, para qué, por cuánto tiempo, subencargados (Neon, Vercel, Resend, Flow) y ubicación (São Paulo, Brasil).
- Agregar una **cláusula de encargo de tratamiento** aceptada al crear la cuenta (casilla), con registro de la fecha de aceptación.
- **Borrado y exportación a pedido** dentro del panel, sin pasar por correo.
- **Aviso de filtraciones:** procedimiento escrito (qué se avisa, a quién, en qué plazo).
- **Transferencia internacional (Brasil):** revisar con un abogado qué exige la ley antes de lanzar.
- Pendiente para el dueño del sitio: decidir los plazos de retención y confirmarlos con un abogado.

## 6. Seguridad

- Tokens de enlace y de sesión de al menos 32 bytes aleatorios (`crypto.randomBytes`), guardados solo como hash.
- Consultas con parámetros (sin armar SQL con texto del usuario).
- Todas las rutas verifican que la sesión sea dueña del recurso (empresa → trabajador → mes).
- Respuestas de error genéricas; cabeceras de `vercel.json` ya vigentes (CSP, HSTS, `no-store` en `/api`).
- La CSP actual ya permite `connect-src 'self'`, así que el panel no necesita ampliarla.
- Pruebas de abuso en la fase 1: acceso a recursos de otra cuenta, token reutilizado, token vencido, sesión revocada, límite de intentos.

## 7. Fases

| Fase | Contenido | Se publica |
| :--- | :--- | :--- |
| 0. Base | Proyecto Neon (São Paulo) con ramas `produccion` y `pruebas`; integración con Vercel; `PYME_DATA_KEY` y `PYME_SESSION_SECRET`; migraciones y script; `feriados_cl.js` verificado 2026–2027; verificaciones de la sección 8 | No (sin cambios visibles) |
| 1. Cuentas | `api/pyme.js` con entrar, verificar, sesión y salir; cifrado; límites; pruebas de abuso; textos legales y cláusula de encargo | Solo si los textos legales están aprobados |
| 2. Panel | Empresa, nómina, importación desde el navegador, pendientes, exportación y borrado | Sí, gratis (1 trabajador) |
| 3. Liquidaciones | Meses guardados en la cuenta; imprimir todas las del mes | Sí |
| 4. Documentos | Las 7 plantillas con vista previa y marca de agua; prellenado de contrato, anexo y finiquito | Sí |
| 5. Pase Pyme | Productos Flow, vigencia en la cuenta, límite de trabajadores, correo, GA4, AGENTS.md 2.1; compra de prueba real | Sí |
| 6. Página y SEO | Contenido indexable, FAQ, JSON-LD, sitemap, enlaces desde `para-empleadores` y generadores, IndexNow | Sí |

### Estado al 12-oct-2026

| Fase | Estado |
| :--- | :--- |
| 0. Base | **Hecho.** Proyecto Neon y ramas, integración con Vercel, claves, migración `001` aplicada a la rama `pruebas` el 12-oct-2026 (12 tablas: las 11 más `schema_migraciones`; `production` sigue vacía a propósito), `tools/db_migrate.js`, cifrado, `feriados_cl.js`. |
| 1. Cuentas | Hecho en código; 29 pruebas sin base y 11 contra la base real de `pruebas` (consultas SQL, consumo atómico del enlace con dos solicitudes simultáneas, cifrado en `bytea`, borrado en cascada), todas correctas. Textos legales como **borrador** en `terminos.html` (sección 12) y `privacidad.html` (sección 10). **Falta:** revisión de los textos por un abogado, decidir la región de Vercel y la página `/asistente-pyme` con el formulario de entrada (fase 2). |
| 2. Panel | **Hecho en código y probado en el navegador (12-oct-2026).** `asistente-pyme.html` (privado, noindex; aún no enlazado desde el sitio): entrada con correo, ficha de empresa (con logo) y de trabajadores cifradas, límite de 1 trabajador activo sin pase y 5 con pase, avisos del mes (plazo fijo, feriado progresivo, ingreso mínimo, cotizaciones, pase, respaldo), traer los datos del generador de liquidaciones sin pisar la empresa existente, descargar y eliminar la cuenta. 28 pruebas de datos y rutas, 20 de pendientes y recorrido completo en el navegador con `node tools/dev_pyme.js` (base en memoria, sin correos). **Falta:** probar el panel contra la base real de pruebas, y publicar solo cuando los textos legales estén revisados. |
| 3. Liquidaciones | **Hecho en código y probado en el navegador (12-oct-2026).** Sección «Liquidaciones de sueldo» del panel: elegir el mes, preparar con valores base (días según ingreso y término de plazo fijo, gratificación según la ficha), editar horas extra, bonos, descuentos y demás con vista previa en vivo (mismo motor y documento del generador, ahora compartido en `js/liquidacion_documento.js`), guardar el mes cifrado en la cuenta (`PUT /api/pyme/mes`, `GET /api/pyme/meses`, hasta 120 meses por trabajador), imprimir todas las liquidaciones del mes de una vez (una hoja carta por trabajador) y marcarlas como emitidas. Sin pase llevan la marca «Vista previa»; con pase vigente salen sin marca. Aviso nuevo en pendientes: liquidaciones del mes sin emitir. La descarga de datos incluye los meses (formato versión 2). 40 pruebas de datos y rutas, 23 de pendientes, 7 de valores base y 5 del documento; todo lo anterior sigue en verde. **Falta:** correr `tools/test_pyme_almacen_db.js` (ampliada con los meses) contra la base real de pruebas, y publicar solo con los textos legales revisados. |

Pendientes que bloquean el lanzamiento de la fase 1:
- **Región de las funciones de Vercel: resuelto el 12-oct-2026.** Estaban en Washington D.C. (`iad1`); se fijó `gru1` (São Paulo) en la configuración del proyecto y se volvió a desplegar el mismo commit de producción (`2517516`). Comprobado con el encabezado `x-vercel-id: gru1::gru1` en `calculolaboral.cl`.
- **Retracto y reembolso del Pase.** Los Términos actuales excluyen el retracto para bienes digitales descargables. El Pase es un servicio con duración: qué corresponde lo debe definir un abogado antes de la fase 5. No quedó escrito en los Términos.
- **Revisión de los textos por un abogado** (Ley 21.719): rol de encargado, subencargados, transferencia a Brasil, aviso de incidentes y plazos de conservación (7 días de respaldo de Neon y 90 días en modo lectura tras vencer el pase).

Cada fase: rama propia, `node tools/test_pyme.js` y `node tools/test_liquidacion.js` en verde, pruebas de la API contra la rama `pruebas`, revisión en 1200 px y 390 px, y publicación solo tras "Sí, súbelo y mézclalo directo a main".

## 8. Verificaciones normativas antes de programar (fase 0)

Cada valor se confirma en la fuente y queda anotado en el código con su fecha de verificación, como en `liquidacion_parametros.js`.

| Tema | Qué confirmar | Fuente |
| :--- | :--- | :--- |
| Feriados 2026 y 2027 | Lista completa, con traslados a lunes (San Pedro y San Pablo, Encuentro de Dos Mundos) y el día de los Pueblos Indígenas de cada año | Leyes de feriados / sitio del Gobierno |
| Feriado legal | 15 días hábiles, 20 en zona extrema; sábado inhábil; acumulación máxima de dos períodos | CT arts. 67, 69 y 70 |
| Feriado progresivo | 1 día por cada 3 años nuevos sobre 10 años; tope de 10 años con empleadores anteriores | CT art. 68 |
| Plazo de pago de cotizaciones | Día 10 del mes siguiente, 13 por internet, corrimiento por fin de semana o festivo | DL 3.500 art. 19 y Previred |
| Plazo fijo | Duración máxima (1 año; 2 para gerentes o profesionales), efecto de la segunda renovación | CT art. 159 N°4 |
| Comunicación de término | Contenido obligatorio, plazo de 3 días hábiles, copia a la Inspección, aviso de 30 días o pago sustitutivo en art. 161 | CT arts. 161, 162 y 169 |
| Amonestación | Requisito del reglamento interno | CT art. 154 N°10 |
| Protección de datos | Obligaciones del encargado, transferencia internacional, aviso de filtraciones, plazos de retención | Ley 21.719 (a confirmar con un abogado) |

### Estado de las verificaciones (12-oct-2026)

| Tema | Estado | Detalle |
| :--- | :--- | :--- |
| Feriados 2026 | Confirmado | 16 feriados (10 en día de semana, 6 en fin de semana); listado coincidente en varios medios y en Chileestuyo.cl |
| Feriados 2027 | Calculado por ley; **confirmar el 20 o 21 de junio** | 17 feriados. Traslados de la Ley 19.668 (lunes 28-jun y 11-oct) y Ley 20.983 (viernes 17-sep, porque el 18 y 19 caen sábado y domingo). El solsticio de 2027 cae el 21-jun a las 14:11 UTC (10:11 en Chile) y por eso el día de los Pueblos Indígenas queda el lunes 21-jun; Calendario Chile publica el 20-jun, que no coincide con el cálculo. Confirmar con el calendario oficial del Gobierno cuando se publique. |
| Reglas de traslado de leyes | Comprobadas en años ya ocurridos | 2018, 2019, 2021, 2022, 2023, 2024 y 2025 (ver `tools/test_feriados.js`). La regla de las Iglesias Evangélicas (Ley 20.299) no se usa en 2026 ni 2027. |
| Plazo de pago de cotizaciones | Parcial, con fuentes secundarias | Declaración hasta el día 10 (si cae sábado, domingo o feriado, pasa al primer día hábil siguiente); pago electrónico hasta el día 13, que según AFP Habitat no se prorroga. Falta confirmarlo en Previred y en el D.L. 3.500, art. 19, antes de mostrarlo en el panel. |
| Arts. 67, 68, 69 y 70 del Código del Trabajo | Pendiente de cotejar el texto literal | Se usa el contenido conocido (15 días hábiles, 20 en zona extrema, progresivo, sábado inhábil, acumulación de dos períodos); falta citarlo desde la BCN o la DT. |
| Art. 159 N°4, 161, 162, 169 y 154 N°10 | Pendiente | Se verifican al construir las plantillas de la fase 4. |
| Ley 21.719 | Pendiente | Revisión con un abogado antes del lanzamiento. |

`js/feriados_cl.js` (24 pruebas en `tools/test_feriados.js`) solo calcula los años verificados (2026 y 2027) y falla para otros, para no tratar un feriado como día hábil por falta de datos. No incluye feriados locales ni los que una ley especial agregue.

## 9. Costos y medición

- **Neon Launch:** por uso, sin mínimo mensual (cómputo US$0,106 por CU-hora, almacenamiento US$0,35 por GB-mes). Con pocas cuentas, unos pocos dólares al mes (estimación; no hay consumo real aún). En la consola se activa la alerta de gasto mensual.
- **Vercel:** requiere plan Pro para uso comercial; se confirma antes del lanzamiento.
- **Resend:** el plan actual cubre los correos de acceso (cada acceso es un correo).
- **Eventos GA4:** `pyme_cuenta_creada`, `pyme_empresa_creada`, `pyme_trabajador_agregado`, `pyme_documento_vista`, `pyme_exportar`, más `begin_checkout` y `purchase` de los pases.
- **Decisión a los 60 días de publicar la fase 5:** etapa 2 (varios usuarios, correos de recordatorio, Libro de Remuneraciones, estimación de Previred, cobro recurrente) según cuentas activas y pases vendidos. Si no se vende nada, se exporta la base y se cierra el proyecto sin pérdida.

## 10. Encontrado al revisar el código

- `calculadora-vacaciones.html` cuenta el sábado como día hábil cuando la jornada es de 6 días; para el feriado el sábado es siempre inhábil (art. 69). Hay una tarea aparte en curso.
- La lista `CHILE_HOLIDAYS` de esa página tiene fechas de 2027 sin los traslados a lunes. La fase 0 la reemplaza por `feriados_cl.js` compartido.
