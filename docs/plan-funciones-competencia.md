# Plan: funciones nuevas del Asistente frente a Buk, Talana, Nubox y Rex+ (13-oct-2026)

Pedido del dueño: construir lo propuesto en el escaneo de la competencia, apegado al marco legal, sin prometer lo que no podemos cumplir y comparando los resultados con otros software que hacen lo mismo.

Base: escaneo del 13-oct-2026 (tabla de Buk Starter/Basic/Advanced entregada por el dueño, páginas de Nubox, Talana y Rex+, comparativa de Laudus de agosto de 2026) y la tercera revisión (`docs/revision-producto-asistente.md` §7).

---

## 1. Reglas que aplican a todas las funciones

1. **Norma primero.** Cada función parte por leer la norma y la doctrina en la fuente oficial (bcn.cl, dt.gob.cl, sii.cl, spensiones.cl, suseso.gob.cl, previred.com). Se anota en el código y en `docs/` qué artículo o dictamen respalda cada regla. Si una regla no se puede confirmar en la fuente oficial, no se construye o se deja como dato que ingresa el dueño.
2. **Lo que no prometemos.** Las cifras se rotulan como estimación («confirma el monto en Previred / el SII / Mi DT antes de pagar o declarar»). Nunca: «oficial», «certificado por», «validado por la DT/SII», «evita multas», «100 % conforme». Sí: «basado en el Código del Trabajo», «reduce el riesgo».
3. **No hacemos trámites a nombre del dueño.** No subimos nada a Mi DT, Previred ni al SII: entregamos el archivo o la hoja con los datos y el dueño lo carga con su clave. Tampoco firmamos por nadie.
4. **Datos sensibles al mínimo (Ley 19.628 y Ley 21.719 desde el 1-dic-2026).** Licencias médicas: solo fechas, días y tipo de entidad; nunca diagnóstico. Ley Karin: solo constancias de entrega, nunca denuncias. Todo dentro de la ficha cifrada que ya existe.
5. **La página pública y los Términos se actualizan al final**, solo con lo que ya está construido y comparado. Nada se anuncia antes.
6. **Parámetros con fecha.** Toda tasa o tope nuevo va en `js/liquidacion_parametros.js` (o su par) con vigencia desde/hasta y fuente. Si un mes no tiene el valor cargado, se avisa en pantalla (como ya se hace con el SIS de nov-dic 2026).
7. **Flujo de publicación:** rama del asistente → pruebas → comparación → commit → aviso al dueño → «Sí, súbelo» → push. Nunca correos por cambios del repo.

## 2. Cómo se compara con otros software (Fase 0, antes de construir)

Se arma un **banco de casos de referencia** (`tools/casos_referencia/*.json` + `tools/test_casos_referencia.js`): cada caso trae los datos de entrada, el resultado esperado y **de dónde sale ese resultado** (la fuente). Se corre junto a las pruebas que ya existen.

| Fuente de comparación | Qué se compara | Quién la usa |
|---|---|---|
| Ejemplos de la autoridad (dictámenes de la DT, instructivos del SII, Superintendencia de Pensiones, Suseso) | Reglas y ejemplos numéricos publicados | Yo, al construir |
| Simuladores públicos de la autoridad (simulador de boletas del SII, tabla del impuesto único, indicadores de Previred) | Impuesto, retención, tasas del mes | Yo, en el navegador integrado |
| Calculadoras públicas gratuitas de Buk, Talana y Nubox (sin cuenta) | Sueldo líquido, semana corrida, costo empleador, finiquito | Yo, en el navegador integrado |
| Nuestras calculadoras del sitio (ya revisadas) | Que el asistente dé lo mismo que el sitio | Yo, automático |
| **Buk Starter con una empresa de prueba** (opcional) | Liquidaciones, archivo Previred, LRE, certificado de renta con los mismos 3 trabajadores ficticios de la demo | **El dueño crea la cuenta** (yo no creo cuentas); después puedo cargar los datos en su navegador con su permiso. Revisar antes los términos de uso de Buk. |
| Portales reales (Previred, Mi DT, banco) | Que el archivo se acepte | **El dueño**, con su clave, deteniéndose antes de «declarar», «pagar» o «autorizar» |

**Criterio de aceptación:** cero diferencias, o diferencias de $1 por redondeo explicadas en el caso. Si otro software da distinto, se investiga cuál sigue la norma; el resultado y la razón quedan anotados en el caso (no se copia al otro software si está mal).

## Estado

| Paso | Estado | Detalle |
|---|---|---|
| Fase 0 · banco de casos | Hecho (13-oct-2026) | `tools/casos_referencia/*.json` + `node tools/test_casos_referencia.js` |
| 1.1 · Semana corrida | Hecho (13-oct-2026) | `js/semana_corrida.js`; 11 casos de referencia, entre ellos el ejemplo publicado por Buk (mayo de 2022 con licencia → $40.000) y el de calcular.cl ($50.000), ambos iguales. Licencias y permisos con fechas en el mes; vacaciones registradas se descuentan solas. Festivo en sábado con jornada de lunes a viernes: no se paga (criterio de Buk y calcular.cl; sin dictamen específico, se informa en pantalla). Método mensual como Buk/Talana; la pantalla advierte que la DT lo calcula semana a semana. Pendiente: el generador público de liquidaciones aún no la calcula. |
| 1.2 · Bonos fijos en la ficha | Hecho (13-oct-2026) | Hasta 8 por trabajador; imponibles con nombre libre y como no imponibles solo pérdida de caja y desgaste de herramientas (art. 41 inc. 2). Se proponen en cada mes nuevo; editar la ficha sin la lista (anexo) los conserva. |
| 1.3 · F29 y boletas de honorarios | Hecho (13-oct-2026) | Panel «Para el Formulario 29» en Liquidaciones: código 48 (impuesto único de las liquidaciones guardadas; el motor ya coincide con la calculadora del sitio en 35 casos) y código 151 (retención de boletas). `js/pyme_honorarios.js` con 6 casos de referencia (SII: $100.000 en 2026 → $15.250). Boletas cifradas por empresa y mes en la tabla nueva `honorarios` (**migración 002: aplicarla en `pruebas` y correr `test_pyme_almacen_db.js` antes de producción**). |
| 1.4 · Importar desde planilla | Hecho (13-oct-2026) | Plantilla CSV con punto y coma (Excel en Chile), `js/pyme_importar.js` (fechas dd-mm-aaaa, montos con puntos y $, AFP sin «AFP», Windows-1252 como respaldo), revisión fila por fila con errores en palabras simples, omite RUT existentes y avisa el cupo del plan; el servidor vuelve a validar con `/api/pyme/importar`. Hasta 50 filas. |
| 1.5 · Proyección del costo | Hecho (13-oct-2026) | Panel «Cómo cambiará el costo de tu equipo» en Liquidaciones con el calendario oficial de la Ley 21.735 (Subsecretaría de Previsión Social: 3,5% ago-2026 … 8,5% ago-2033, SIS incluido; advierte la posible extensión a 11 años desde 2029) sobre las liquidaciones guardadas del mes. Hora extra con 40 h desde el 26-abr-2028 (factores DT 0,0083333 y 0,00875, iguales a la calculadora de horas extras del sitio). 3 casos de referencia. |
| 1.6 · Ingreso mínimo y reajustes | Hecho (13-oct-2026) | El aviso del mínimo ahora usa el mismo criterio que el motor (proporcional solo en jornada parcial de hasta 30 h, art. 40 bis; antes era proporcional bajo 42 h) y ofrece «Preparar anexo». Aviso anticipado cuando el mínimo de uno de los dos meses siguientes ya está cargado y sube. Reajuste por IPC pactado en la ficha (semestral o anual, con su mes): aviso ese mes, sin calcular el IPC (remite al INE). |
| 1.7 · Hoja guía para Mi DT | Hecho (13-oct-2026) | Botón «Datos para Mi DT» en la carpeta del trabajador y en el aviso de registro: los datos de la ficha en el orden de las 4 etapas del formulario de la DT (guía rápida de ene-2024), lo que falta marcado, plazos del art. 9 bis (15 días corridos para ir seguro; la DT indica 15 hábiles), término e imputación del seguro de cesantía. Imprimible. **Falta que el dueño confirme una vez en su Mi DT que el orden coincide.** De paso se corrigió un error: la base no admitía registrar el anexo de contrato ni el pacto de horas extra (migración 003). |
| 1.8 · Libro del mes para el contador | Hecho (13-oct-2026) | En Liquidaciones: «Libro del mes para el contador (Excel)» (CSV con punto y coma) e «Imprimir libro» (hoja horizontal). 20 columnas por trabajador con totales, recalculadas con el motor; cada fila cuadra (prueba automática). El archivo dice que no reemplaza al LRE de la DT (obligatorio desde 5 trabajadores). |
| 1.9 · Ley Karin en la ficha | Hecho (13-oct-2026) | Fecha en que se dio a conocer el protocolo (art. 211-A; Circular Suseso 3813: elaborar, poner en conocimiento e implementar) y constancia firmada marcada como recomendada, no obligatoria. Un aviso agrupado con quienes no lo tienen anotado. Enlace al Kit Blindaje para quien no tiene protocolo. No se afirma una obligación de capacitar (no se pudo confirmar). |
| 2.1 · Licencias médicas y permisos | Hecho (14-oct-2026) | Pestaña «Licencias y permisos» en la carpeta (licencia, permiso con goce, sin goce; solo tipo y fechas). Cada mes toma los suyos: días a pagar en mes comercial de 30 días (licencia y sin goce rebajan; el permiso con goce no), días de licencia en la liquidación, y fuera del promedio de la semana corrida. Plazo de 3 días hábiles para tramitar la licencia (art. 13 DS 3/1984; sábado contado como hábil para ir seguro) en avisos y calendario; carencia de 3 días en licencias de 10 o menos (art. 14 DFL 44, Suseso), sin afirmar que el empleador deba pagarlos. 7 casos de referencia. |

**Cierre de la Fase 1 (13-oct-2026):** Privacidad §10 ya dice que se guardan los datos de quienes emiten boletas a la empresa, las fechas de licencias y permisos sin diagnóstico y la entrega del protocolo de la Ley Karin; la página pública describe solo lo construido y aclara lo que no hace (no genera el LRE, no llena el F29, no registra en Mi DT).

**Lo que falta para dar la Fase 1 por cerrada (requiere al dueño):**
1. Aplicar las migraciones 002 (honorarios) y 003 (tipos de documento) en la rama `pruebas` de Neon y correr `tools/test_pyme_almacen_db.js` contra ella (cadena por portapapeles, como siempre).
2. Mirar una vez en Mi DT que la hoja guía sigue el orden del formulario.
3. Decidir si el generador público de liquidaciones ($2.990) también calcula la semana corrida (hoy solo el asistente).

## 3. Fases y funciones

### Fase 1: esfuerzo bajo, antes del lanzamiento

| # | Función | Marco legal y fuente | Qué NO prometemos | Comparación |
|---|---|---|---|---|
| 1.1 | **Semana corrida** para remuneración variable (comisiones, tratos, bonos de producción diarios): promedio diario de lo devengado en la semana × domingos y festivos del mes; avisa si el sueldo es mixto. | Art. 45 CT; dictámenes DT 3262/66, 319 (2020), 3654 (2019) y jurisprudencia 2026 (bono de producción). | Que sirva para esquemas no estándar (turnos, metas semanales con condiciones): ahí avisa «revisa con tu contador». | Ejemplos de dictámenes + calculadoras públicas de Buk/Talana si existen + 10 casos propios (lun-vie y lun-sáb, meses con festivos, semana sin meta). |
| 1.2 | **Bonos y asignaciones fijas en la ficha** (imponibles o no), propuestos solos en cada liquidación nueva. | Arts. 41 y 42 CT. | — | Mismos casos de liquidación ya comparados con `salary_logic.js`. |
| 1.3 | **Impuesto único retenido del mes** (total para el F29) y **registro de boletas de honorarios** con su retención (15,25 % en 2026, 16 % en 2027, 17 % en 2028). | Ley de la Renta arts. 42 N°1, 43 y 74; Ley 21.133; SII. | Que el F29 quede listo: solo el monto a revisar. No llenamos el F29. | Tabla del SII de cada mes + simulador de boletas del SII + nuestra calculadora de impuesto único. |
| 1.4 | **Importar trabajadores desde una planilla Excel/CSV** con plantilla descargable y revisión fila por fila antes de guardar. | — (datos de la ficha). | — | Pruebas con planillas mal formadas (RUT inválido, fechas, montos). |
| 1.5 | **Proyección del costo de cada trabajador**: hoy, desde agosto de 2027 y siguientes tramos de la Ley 21.735; efecto de las 40 horas desde el 26-abr-2028 en el valor de la hora extra. | Ley 21.735 y Superintendencia de Pensiones; Ley 21.561. | Solo tramos ya fijados por ley; la tasa del SIS futura se muestra como supuesto. Rotulado «proyección». | Tablas de la Superintendencia de Pensiones + nuestra calculadora de costo del empleador. |
| 1.6 | **Aviso del ingreso mínimo y reajustes**: cuando cambia el IMM, lista quién queda bajo el mínimo (proporcional en jornada parcial) y ofrece el anexo; reajuste IPC si el dueño lo marcó en el contrato. | Art. 44 CT; leyes de reajuste del IMM; art. 40 bis (jornada parcial). | No adivinamos el próximo IMM: se avisa cuando la ley se publica y lo cargamos. | Casos con jornada completa y parcial contra nuestra calculadora de sueldo part-time. |
| 1.7 | **Hoja guía para Mi DT**: los datos del contrato, anexo o término ordenados como los pide el registro de la DT, con el plazo (15 días del art. 9 bis; plazos de término de los arts. 159-162) y enlace a Mi DT. | Art. 9 bis CT (Ley 21.327); manuales de Mi DT. | No registramos nada: lo hace el dueño con su Clave Única. | Campos contrastados con el manual público de la DT; el dueño confirma una vez en su Mi DT que el orden coincide. |
| 1.8 | **Libro de remuneraciones del mes para el contador** (Excel y PDF) con haberes, descuentos, aportes del empleador e impuesto. | Art. 62 CT. | No reemplaza al LRE cuando es obligatorio (5 o más trabajadores): lo dice el mismo archivo. | Suma cuadrada contra las liquidaciones guardadas (prueba automática). |
| 1.9 | **Ley Karin en la ficha**: fecha de entrega del protocolo, de la información de riesgos y de la capacitación; aviso si falta. Enlaza al Kit Blindaje. | Ley 21.643; arts. 211-A y siguientes CT; DS 2/2024. | No es canal de denuncias ni investigación. No guarda denuncias. | Lista contrastada con la guía de la DT sobre Ley Karin. |

### Fase 2: esfuerzo medio

| # | Función | Marco legal y fuente | Qué NO prometemos | Comparación |
|---|---|---|---|---|
| 2.1 | **Licencias médicas, permisos y ausencias**: ajustan los días trabajados de la liquidación, aparecen en el calendario y avisan el plazo de 3 días hábiles para tramitar la licencia. Informa que en licencias de menos de 11 días los 3 primeros no los cubre el subsidio (no que los pague el empleador, salvo que se haya pactado). | Arts. 13 y 56 DS 3/1984; DFL 44/1978; Compendio de la Suseso. | No tramitamos la licencia ni calculamos el subsidio que paga la Compin/Isapre (solo aviso). | Ejemplos de la Suseso + casos de días trabajados contra nuestro motor. |
| 2.2 | **Certificado anual de remuneraciones** (modelo N° 6 del SII) por trabajador y **guía de la DDJJ 1887** con los montos anuales cuadrados contra el impuesto de cada mes. | Ley de la Renta; resolución SII vigente del formato 1887. | **No generamos el archivo de la DDJJ 1887:** el formato del SII pide el código de una casa de software autorizada. Damos los montos para el formulario en línea o para el contador. | Instructivo del SII; cuadratura con 1.3; certificado de renta de Buk Starter si el dueño abre la cuenta de prueba. |
| 2.3 | **Avisos por correo** antes de cada vencimiento (plazo fijo, cotizaciones, Mi DT, licencias, IMM), con opción de apagarlos. | Ley 19.628/21.719 (consentimiento y baja). | Que el aviso llegue siempre: se dice «además del panel». | Prueba real con Resend en producción (requiere el «sí, envíalo» del dueño la primera vez). |
| 2.4 | **Liquidación al trabajador por enlace** con registro de cuándo la abrió. | Art. 54 CT (comprobante de pago). | No es firma ni aceptación: es constancia de entrega. | — |

### Fase 3: esfuerzo alto, con validación en los portales reales

| # | Función | Marco legal y fuente | Qué NO prometemos | Comparación |
|---|---|---|---|---|
| 3.1 | **Archivo para Previred** (formato de 105 campos por separador). | Formato publicado por Previred; DL 3.500; Ley 19.728. | «Archivo para revisar y cargar en Previred», no «declaración lista». | Archivo de Buk Starter con la empresa de prueba + carga real del dueño en Previred, deteniéndose antes de declarar. |
| 3.2 | **Archivo del LRE** (CSV según el suplemento técnico de la DT). | Art. 62 CT; Ley 21.327; Dictamen 1583/027. | Igual que 3.1. Nunca se sube un archivo de prueba como declaración real. | Columnas contra el suplemento técnico + el LRE de Buk Starter + primera carga real del dueño con datos reales. |
| 3.3 | **Nómina de pago al banco**: planilla genérica y, después, los formatos de los bancos que se puedan confirmar con su documentación pública. | — | Solo los bancos cuyo formato se confirmó. | Carga del dueño en su banco sin autorizar el pago. |

### Fase 4: estudio antes de decidir

- **Trabajadoras de casa particular**: reglas propias (indemnización a todo evento del 4,11 %, art. 163; Ley 20.786). Es otro público; requiere su propio estudio legal y de demanda.
- **Plan para contadores con varias empresas.**
- **Soporte humano por correo**: decisión del dueño (tiempo de respuesta que pueda cumplir). Si se ofrece, se dice el plazo real.

### Lo que no se construye

Control de asistencia (exige certificación de la DT), firma electrónica avanzada, canal de denuncias propio, app nativa, IA que responda dudas legales sin revisión, y subir datos por el dueño a cualquier portal.

## 4. Orden de trabajo de cada función

1. Leer la norma en la fuente oficial y anotar las reglas.
2. Escribir los casos de referencia (con fuente) **antes** del código.
3. Construir con pruebas automáticas.
4. Comparar con las fuentes de la tabla de la sección 2 y anotar el resultado en el caso.
5. Revisar los textos de pantalla contra la sección 1 (sin promesas, rótulos de estimación).
6. Probar en el navegador con los datos de demo.
7. Commit en la rama; avisar al dueño con lo que cambió y lo que se comparó.

Al cerrar cada fase: correr todas las baterías, la prueba contra Neon `pruebas` si cambió el almacenamiento, y actualizar la página pública y los Términos solo con lo construido.

## 5. Lo que se necesita del dueño

| Cuándo | Qué |
|---|---|
| Ahora | Aprobar el plan (o cambiar el orden). |
| Opcional, antes de la Fase 2 | Abrir una cuenta gratuita de Buk Starter para la empresa de prueba (Claude no crea cuentas), si quiere esa comparación. |
| Fase 1.7 | Mirar una vez en su Mi DT que la hoja guía sigue el orden del formulario. |
| Fase 2.3 | Autorizar el primer correo real («sí, envíalo»). |
| Fase 3 | Cargar los archivos en Previred, Mi DT y el banco con su clave, deteniéndose antes de declarar o pagar. |
| Fase 4 | Decidir si se estudia el segmento de casa particular y el soporte. |

## Fuentes del escaneo

- Buk Starter: https://www.buk.cl/starter · DDJJ 1887 en Starter: https://www.buk.cl/blog/como-buk-starter-proceso-ddjj-1887
- Nubox Remuneraciones: https://www.nubox.com/software-remuneraciones
- Rex+ precios: https://rexmas.com/precios/
- Talana: https://web.talana.com/llms.txt · https://web.talana.com/software-de-firma-digital-y-gestion-de-documentos
- Comparativa Laudus (ago-2026): https://laudus.cl/contenidos/remuneraciones/softwares-de-remuneraciones/
- SII, boletas de honorarios 2026: https://www.sii.cl/destacados/boletas_honorarios/
- SII, propuesta DJ 1887: https://www.sii.cl/destacados/renta/2025/propuesta_dj_1887.html
- Suseso, plazo del empleador en licencias: https://www.suseso.gob.cl/612/w3-article-31580.html
- DT, LRE: https://dt.gob.cl/legislacion/1624/w3-article-81821.html
- DT, semana corrida: https://dt.gob.cl/legislacion/1624/w3-propertyvalue-170581.html
