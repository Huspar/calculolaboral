# Asistente Laboral Pyme: plan técnico de la etapa 1

Versión 1 · 12-oct-2026 · reemplaza el plan externo `plan_asistente_laboral_pyme_v1.md`.

## 1. Qué es y qué no es

Un panel en el navegador donde la pyme (hasta 5 trabajadores) ingresa **una vez** su empresa y su equipo, y desde ahí:

- emite la liquidación del mes de cada trabajador (generador ya construido),
- emite documentos con los datos ya puestos (certificados, vacaciones, cartas de término, amonestación, anexo de datos),
- abre los generadores actuales (contrato, anexo 42 horas, finiquito) ya prellenados,
- ve los pendientes del mes (liquidaciones, cotizaciones, plazos fijos, vacaciones).

**Decisiones de fondo:**

1. **Los datos viven en el navegador** (`localStorage`), igual que el generador de liquidaciones. El servidor no guarda trabajadores. Así no hay cuentas con contraseña, no hay base de datos y calculolaboral.cl no pasa a ser encargado de tratamiento según la Ley 21.719 (rige el 1-dic-2026). Respaldo y traspaso con un archivo JSON.
2. **El cobro es un pase prepagado** (3 o 12 meses) con el pago único de Flow que ya funciona. El servidor solo firma el derecho de acceso, como el desbloqueo de 48 h actual pero con otra duración. Nada de cobro recurrente en esta etapa.
3. **Se reutiliza lo construido**: motor de liquidaciones, `CLCheckout`, `/api/checkout`, `/api/flow-confirm`, `/api/unlock`, generadores de contrato, anexo y finiquito.
4. Los productos sueltos se siguen vendiendo igual.

## 2. Alcance

### Entra en la etapa 1

| Módulo | Estado actual | Trabajo |
| :--- | :--- | :--- |
| Empresa (razón social, RUT, representante y su RUT, domicilio, comuna, giro, logo) | Parcial en `cl_liq_v1` | Ficha única compartida |
| Nómina (ficha del trabajador) | Parcial en `cl_liq_v1` | Ficha única + datos de contrato y vacaciones |
| Liquidación mensual | Construida | Leer la ficha compartida; imprimir todas las del mes en un solo PDF |
| Pendientes del mes | No existe | Calculados en el navegador al abrir el panel (sin correos) |
| Comprobante de feriado (art. 67 a 70) | Lógica parcial en `calculadora-vacaciones.html` | Módulo puro de vacaciones + registro de días tomados |
| Certificado de antigüedad | No existe | Plantilla |
| Certificado de remuneraciones | No existe | Plantilla (remuneración pactada; promedio líquido solo si hay liquidaciones guardadas) |
| Carta de término por vencimiento del plazo (art. 159 N°4) | No existe | Plantilla |
| Carta de despido por necesidades de la empresa (art. 161) | Guía y pack Word | Plantilla con hechos obligatorios y monto de indemnizaciones (art. 169) |
| Amonestación escrita | No existe | Plantilla con hechos obligatorios |
| Anexo de protección de datos (Ley 21.719) | Instrumento del Kit 21.719 en Word | Plantilla tomada del kit |
| Contrato, anexo 42 h, finiquito | Generadores construidos | Prellenado desde la ficha (`?desde=pyme&t=<id>`) |
| Pase Pyme 3 y 12 meses | No existe | Productos Flow + desbloqueo de larga duración |

### Queda fuera (no se puede cumplir bien o es riesgoso ofrecerlo)

| Fuera | Motivo |
| :--- | :--- |
| "Total a pagar en Previred" | Un error hace que la pyme pague mal (multas e intereses). Exige SIS, AFC del empleador, mutual y la cotización de la Ley 21.735 por etapas. Candidato a etapa 2, solo como estimación. |
| Cartas de despido por art. 160 | Requieren hechos probados e investigación (Ley Karin). Una plantilla de un clic induce despidos injustificados con recargo. El Pack de Cartas sigue vendiéndose aparte con su guía. |
| Renuncia generada por el empleador | Es la práctica de renuncias firmadas en blanco que la ley persigue. La guía de renuncia sigue siendo pública para trabajadores. |
| Certificado de "honorabilidad" | El empleador no puede certificarla. |
| Citación a descargos | Sin obligación general; en Ley Karin va dentro del protocolo de investigación, no en una plantilla suelta. |
| Datos en la nube, cuentas, varios usuarios por empresa | Ley 21.719, seguridad y soporte. Se evalúa solo si el pase se vende. |
| Correos automáticos de recordatorio | Exigen guardar datos en el servidor. Etapa 2. |
| Archivo para el Libro de Remuneraciones Electrónico | Etapa 2, para el plan de 5 trabajadores. |
| Cobro recurrente automático (suscripción Flow) | Etapa 2, si el pase se vende. |
| Textos del plan externo | "Documentos oficiales", "Contrato Oficial", "imbatible", "siempre actualizados": chocan con AGENTS.md 2.1. |

## 3. Arquitectura

```
asistente-pyme.html  ── pyme_app.js (interfaz)
                          │
          ┌───────────────┼──────────────────┬───────────────────┐
          ▼               ▼                  ▼                   ▼
   pyme_store.js   pyme_docs.js      pyme_pendientes.js   pyme_vacaciones.js
   (datos, respaldo, (plantillas:     (alertas del mes)    (saldo de feriado,
    migración)       datos → HTML)                          días hábiles)
          │                                                       │
          │                                               feriados_cl.js
          ▼
   localStorage 'cl_pyme_v1'  ◄── leído también por liquidación, contrato, anexo y finiquito

   Cobro: CLCheckout.buyKit('pyme3' | 'pyme12') → /api/checkout → Flow → /api/flow-confirm
          → correo con enlace firmado por la duración del pase → CLCheckout.unlockFromUrl('pyme…')
```

Reglas de código (las mismas del generador de liquidaciones):

- Los módulos `pyme_store`, `pyme_docs`, `pyme_pendientes`, `pyme_vacaciones` y `feriados_cl` son **puros** (sin DOM) y exportan para Node, para probarlos con `tools/test_pyme.js`.
- PDF por impresión del navegador; Word con el mismo método de los generadores actuales (HTML con BOM como `application/msword`).
- Marca de agua "Vista previa" hasta que haya pase vigente o compra suelta.
- Sin librerías nuevas.

### 3.1 Datos (`cl_pyme_v1`)

```js
{
  v: 1,
  empresa: { razonSocial, rut, giro, representante, rutRepresentante, domicilio, comuna, ciudad, logo },
  trabajadores: [{
    id, nombre, rut, nacionalidad, fechaNacimiento, domicilio, comuna, cargo,
    fechaIngreso, contrato: 'indefinido' | 'plazo_fijo' | 'obra',
    fechaTerminoPlazo, renovaciones,            // plazo fijo
    jornadaHoras, distribucion: '5' | '6',      // días por semana
    sueldoBase, colacion, movilizacion, gratificacion: 'legal' | 'ninguna' | 'pactada',
    afp, salud, isapreNombre, isaprePlanUF,
    zonaExtrema,                                // feriado de 20 días (art. 67 inc. 2)
    aniosOtrosEmpleadores,                      // feriado progresivo (art. 68), con certificado
    vacaciones: [{ desde, hasta, diasHabiles, tipo: 'legal' | 'progresivo' }],
    activo, fechaEgreso
  }],
  documentos: [{ id, tipo, trabajadorId, fecha, resumen }],  // registro de lo emitido (sin el texto)
  respaldo: { ultimo }                                       // fecha del último archivo descargado
}
```

- **Migración:** si existe `cl_liq_v1` y no `cl_pyme_v1`, se copia empresa y trabajadores. El generador de liquidaciones pasa a leer la ficha desde `cl_pyme_v1` y conserva en `cl_liq_v1` solo los meses (`meses`) y los pagos. Prueba obligatoria: un usuario con datos en el generador actual no pierde nada.
- **Límite:** 5 trabajadores activos en el panel (el pase cubre hasta 5).
- **Respaldo:** exportar e importar JSON de todo el panel; aviso en el panel si pasaron más de 30 días desde el último respaldo o si nunca se hizo.

### 3.2 Pendientes del mes (`pyme_pendientes.js`)

Función pura `pendientes(estado, hoy, parametros)` → lista de `{ nivel, trabajadorId, texto, accion }`. Solo alertas que se pueden calcular con certeza:

1. Liquidación del mes sin emitir, por trabajador.
2. Cotizaciones del mes anterior: plazo legal de pago (ver verificaciones).
3. Plazo fijo que vence en 30 días o menos; aviso de que la segunda renovación o seguir trabajando después del vencimiento lo convierte en indefinido.
4. Vacaciones: trabajador que se acerca a dos períodos acumulados (art. 70).
5. Trabajador que cumple 10 años de antigüedad para el feriado progresivo (art. 68).
6. Sueldo base bajo el ingreso mínimo del mes (proporcional a la jornada), con la vigencia de `liquidacion_parametros.js`.
7. Notas normativas del mes (`NOTAS_MES`), por ejemplo un reajuste del ingreso mínimo.
8. Respaldo pendiente.

### 3.3 Documentos (`pyme_docs.js`)

Cada plantilla declara sus campos obligatorios y no se puede emitir con campos vacíos (nada de corchetes en el documento final).

| Documento | Datos que pide además de la ficha | Reglas |
| :--- | :--- | :--- |
| Certificado de antigüedad | Destinatario (a quien corresponda o institución) | Antigüedad calculada a la fecha de emisión |
| Certificado de remuneraciones | Incluir o no el promedio líquido | Promedio solo con liquidaciones guardadas de los últimos 3 meses; si no, solo remuneración pactada |
| Comprobante de feriado | Fecha de inicio y días hábiles | Sábado siempre inhábil (art. 69), feriados de `feriados_cl.js`, saldo antes y después, fecha de reintegro, firmas |
| Carta art. 159 N°4 | Fecha de término | Estado de cotizaciones; aviso de envío a la Inspección dentro de 3 días hábiles (portal DT) |
| Carta art. 161 | Hechos concretos (texto libre obligatorio, mínimo de caracteres), aviso o pago sustitutivo, fecha | Monto total de indemnizaciones (art. 169 a), con la lógica de `js/logic.js`; estado de cotizaciones; envío a la Inspección |
| Amonestación escrita | Hechos, fecha de los hechos, obligación incumplida | Aviso en pantalla: como sanción debe estar en el reglamento interno (art. 154 N°10) |
| Anexo de protección de datos | Finalidades que aplican | Texto tomado del instrumento del Kit 21.719 |

Cada documento lleva el pie: "Modelo de referencia basado en la normativa vigente; no constituye asesoría legal."

### 3.4 Prellenado de los generadores actuales

El panel abre `generador-…?desde=pyme&t=<id>`. Cada generador agrega una función pequeña `prefillDesdePyme()` que lee `cl_pyme_v1` y llena su formulario si el usuario no tiene un borrador propio, o le pregunta si lo reemplaza. No se reescriben los generadores.

| Generador | Dónde guarda hoy | Cambio |
| :--- | :--- | :--- |
| Liquidación | `cl_liq_v1` | Lee la ficha de `cl_pyme_v1` (sección 3.1) |
| Contrato | `contrato_builder_state` | `prefillDesdePyme()` + acepta el pase |
| Anexo 42 h (gratis) | — | `prefillDesdePyme()` |
| Finiquito | `fini_draft_payload` | `prefillDesdePyme()` + acepta el pase de 12 meses |

### 3.5 Pase Pyme (cobro)

- **`api/_flow.js`:** productos `pyme3` (código `P3`) y `pyme12` (código `P12`), con `unlock: true` y una duración propia (`ttlDays: 92` y `ttlDays: 366`). `downloadQuery` usa la duración del producto en vez de las 48 h fijas. El correo de `deliverUnlock` cambia el texto: el enlace sirve durante todo el pase y en cualquier navegador; los datos se traspasan con el respaldo.
- **`js/checkout_consent.js`:** `GA_ITEMS` con los dos pases y una función `paseVigente(nivel)` que revisa `cl_unlock_pyme3` y `cl_unlock_pyme12`.
- **Qué desbloquea:**
  - `pyme3`: liquidaciones de hasta 5 trabajadores, todos los documentos del panel, contrato.
  - `pyme12`: lo anterior más el finiquito.
- **El enlace del correo es la recuperación del acceso**: no hace falta inicio de sesión. Límite conocido: el enlace se puede reenviar a otra persona, igual que hoy; se acepta en esta etapa.
- **Precio propuesto:** `pyme3` $19.990 y `pyme12` $59.990, hasta 5 trabajadores. Comparación: tres liquidaciones mensuales sueltas por 3 meses suman $26.910. Textos según AGENTS.md 2.1: "equivale a $X al mes", sin "ahorras X %" ni precios tachados.
- Aviso de retracto con casilla, como todo cobro (`buyKit`).

## 4. Fases

| Fase | Contenido | Se publica |
| :--- | :--- | :--- |
| 0. Base | `feriados_cl.js` verificado 2026–2027; módulo de vacaciones con sábado inhábil; verificaciones normativas de la sección 5 | Junto con la fase 1 |
| 1. Panel gratis | `pyme_store` + migración + empresa y nómina + pendientes + respaldo + liquidación leyendo la ficha + imprimir todas las liquidaciones del mes | Sí, gratis (las liquidaciones siguen a $2.990 sueltas) |
| 2. Documentos | Las 7 plantillas con vista previa y marca de agua + prellenado de contrato, anexo y finiquito | Sí; descarga con compra suelta donde ya existe, el resto espera la fase 3 |
| 3. Pase Pyme | Productos Flow, duración, correo, `paseVigente` en el panel y en los generadores, términos y AGENTS.md 2.1, GA4 | Sí, con compra de prueba real en producción |
| 4. Página y SEO | Contenido indexable, FAQ, JSON-LD, sitemap, enlaces desde `para-empleadores` y generadores, IndexNow | Sí |

Cada fase: rama propia, `node tools/test_pyme.js` y `node tools/test_liquidacion.js` en verde, revisión en 1200 px y 390 px, y publicación solo tras "Sí, súbelo y mézclalo directo a main".

## 5. Verificaciones normativas antes de programar (fase 0)

Cada valor se confirma en la fuente y queda anotado en el código con su fecha de verificación, como en `liquidacion_parametros.js`.

| Tema | Qué confirmar | Fuente |
| :--- | :--- | :--- |
| Feriados 2026 y 2027 | Lista completa, con traslados a lunes (San Pedro y San Pablo, Encuentro de Dos Mundos) y el día de los Pueblos Indígenas de cada año | Leyes de feriados / sitio del Gobierno |
| Feriado legal | 15 días hábiles, 20 en zona extrema; sábado inhábil; acumulación máxima de dos períodos | CT arts. 67, 69 y 70 |
| Feriado progresivo | 1 día por cada 3 años nuevos sobre 10 años; tope de 10 años con empleadores anteriores | CT art. 68 |
| Plazo de pago de cotizaciones | Día 10 del mes siguiente, 13 por internet, corrimiento por fin de semana o festivo | DL 3.500 art. 19 y Previred |
| Plazo fijo | Duración máxima (1 año; 2 años para gerentes o profesionales), efecto de la segunda renovación y de seguir trabajando | CT art. 159 N°4 |
| Comunicación de término | Contenido obligatorio, plazo de 3 días hábiles, copia a la Inspección por el portal DT, aviso de 30 días o pago sustitutivo en art. 161 | CT arts. 161, 162 y 169 |
| Amonestación | Requisito del reglamento interno | CT art. 154 N°10 |

## 6. Medición y siguiente decisión

Eventos GA4 nuevos: `pyme_panel_abierto`, `pyme_empresa_creada`, `pyme_trabajador_agregado`, `pyme_documento_vista`, `pyme_respaldo`; más `begin_checkout` y `purchase` de los pases.

A los 60 días de publicar la fase 3 se decide la etapa 2 (correos de recordatorio, archivo del Libro de Remuneraciones Electrónico, estimación de Previred, cobro recurrente) según cuántas empresas usan el panel y cuántos pases se venden.

## 7. Encontrado al revisar el código

- `calculadora-vacaciones.html` cuenta el sábado como día hábil cuando la jornada es de 6 días; para el feriado el sábado es siempre inhábil (art. 69).
- La lista `CHILE_HOLIDAYS` de esa página tiene fechas de 2027 sin los traslados a lunes. La fase 0 la reemplaza por `feriados_cl.js` compartido.
