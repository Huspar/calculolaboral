# Registro de Cambios SEO (SEO Change Log)

Este documento registra todas las intervenciones SEO realizadas en la plataforma para permitir la correlación de rendimiento con métricas de Google Analytics (GA4) y Google Search Console (GSC).

## Febrero 2026 - Sprint de Optimización On-Page y E-E-A-T

| Fecha | URL Modificada | Cambio Específico | Hipótesis / Métrica Esperada a Mover |
| :--- | :--- | :--- | :--- |
| 2026-02-18 | `/index.html` | Restauración del archivo index.html | Recuperar la indexación base (Impresiones en GSC). |
| 2026-02-18 | `/index.html`, `/finiquito_calculator.html`, `/sueldo_liquido.html` | Optimización de `<title>` y `<meta description>`. Adición del año "2026" y propuesta de valor ("Gratis", "Exacto"). | Aumento en el CTR (Click-Through Rate) en GSC. |
| 2026-02-18 | `/sueldo_liquido.html`, `/finiquito_calculator.html` | Inyección de contenido explicativo profundo sobre la base legal y algorítmica de los cálculos. | Aumento en "Time on Page" (GA4) y ranking para keywords de cola larga (GSC). Prevención de penalización por "Thin Content". |
| 2026-02-18 | `/sobre-nosotros.html` | Adición de la sección "Metodología de Cálculo y Revisión (E-E-A-T)". | Mejora de señales de confianza para el evaluador de calidad de Google. Potencial mejora global en rankings. |

## Abril 2026 - Auditoría Técnica y Correcciones Críticas

| Fecha | URL Modificada | Cambio Específico | Hipótesis / Métrica Esperada a Mover |
| :--- | :--- | :--- | :--- |
| 2026-04-05 | `/index.html` | Añadido Google Analytics GA4 (`G-9Y03F1WB8J`). Estaba ausente desde el lanzamiento. | Recuperar datos de sesiones/rebote/tiempo de la homepage (la página más visitada). |
| 2026-04-05 | `/index.html` | Añadido `<link rel="canonical">` apuntando a `https://calculolaboral.cl/`. | Evitar contenido duplicado entre `/` y `/index.html`. Consolidar señales de ranking. |
| 2026-04-05 | `/index.html` | Añadido Open Graph completo (`og:title`, `og:description`, `og:image`, `og:url`, `og:locale`, `og:site_name`). | Mejorar CTR en redes sociales. Imagen OG ahora existe como `/assets/og-image.png`. |
| 2026-04-05 | `/index.html` | Añadido `hreflang="es-CL"`. | Señal de geotargeting para Google. Mejorar relevancia en búsquedas desde Chile. |
| 2026-04-05 | `/blog.html` | Corregido canonical de `/blog.html` a `/blog` (consistente con Vercel clean URLs). | Evitar señal contradictoria al crawler. Consolidar ranking en URL limpia. |
| 2026-04-05 | `/blog.html` | Corregido `og:url` de `/blog.html` a `/blog`. Añadido `hreflang="es-CL"`. | Consistencia de señales sociales + geotargeting. |
| 2026-04-05 | `/sitemap.xml` | Actualizado `lastmod` de homepage y blog a `2026-04-05`. Añadido `changefreq` y `priority` a todas las URLs. | Señal a Google de contenido fresco. Priorizar rastreo de calculadoras vs páginas legales. |
| 2026-04-05 | `/assets/og-image.png` | Creada imagen OG para compartir en redes sociales. | Mejorar apariencia al compartir en WhatsApp/Facebook/Twitter. |

## Junio 2026 - Pivote a Guía Financiera del Trabajador + Lead Magnet

| Fecha | URL/Recurso | Cambio Específico | Hipótesis / Métrica Esperada a Mover |
| :--- | :--- | :--- | :--- |
| 2026-06-29 | `/Articulos/lead-magnet-finiquito.pdf` | Creación del lead magnet "Qué hago con mi finiquito" (6 páginas A4, simulaciones con $2.880.000). NO se indexa en sitemap (recurso descargable, no compite en SERPs). | Crecimiento de lista de emails + tráfico referido desde WhatsApp/social. Métrica a trackear: descargas desde `/finiquito_calculator`. |
| 2026-06-29 | `/como-calcular-sueldo-liquido-paso-a-paso`, `/como-calcular-finiquito-chile`, `/guia-vacaciones-proporcionales`, `/despido-necesidades-empresa-articulo-161`, `/que-hacer-si-no-te-pagan-el-finiquito` | Optimización de `<title>` y `<meta description>` con números concretos (ej: "\$1.500.000 bruto → \$1.187.000 líquido", "\$2.880.000 con 3 años", "plazo 10 días + recargo 30%"). | +50-100% CTR en GSC para queries long-tail de finiquito, sueldo líquido, vacaciones, art. 161 y no me pagaron. Detalle en `AUDITORIA-SEO-2026-06-29.md`. |

## Septiembre 2026 - Optimización de CTR, Monetización Responsiva y Telemetría GA4

| Fecha | URL/Recurso | Cambio Específico | Hipótesis / Métrica Esperada a Mover |
| :--- | :--- | :--- | :--- |
| 2026-09-18 | `/ley-40-horas-chile-2026` | Optimización de `<title>` (`¿Cuánto Vale la Hora de Trabajo en Chile 2026? Ley 40 Horas`) y `<meta description>` con cifras oficiales ($3.075 ordinaria, $4.613 extra, $18.452 día) + Quick Answer Box destacado para Posición Cero. | Triplicar CTR en GSC (de 0.4% a 1.5%+) capturando las más de 7.100 impresiones mensuales en queries como "valor hora de trabajo en chile 2026" y "a cuanto esta la hora de trabajo". |
| 2026-09-18 | `/calculadora-horas-extras`, `/fondos-generacionales-afp-chile`, `/calculadora-vacaciones-proporcionales` | Integración de banners responsivos patrocinados contextuales (Banco Itaú y Abakos Chile) con `rel="sponsored nofollow noopener"` y carga lazy sin impacto en Core Web Vitals. | Monetización del 60% del tráfico no aprovechado (las páginas con más sesiones del sitio). Cero penalizaciones SEO. |
| 2026-09-18 | `/js/ad_tracker.js`, `/js/indicators.js` | Sistema centralizado de telemetría de clics en anuncios (`ad_click`) con envío vía Beacon API hacia GA4. | Medición del 100% de clics en campañas de monetización (Soicos/Itaú/Abakos) directamente en GA4. |
| 2026-09-18 | `/js/salary_ui.js`, `/calculadora-horas-extras`, `/calculadora-vacaciones-proporcionales`, `/calculadora-sueldo-part-time` | Integración de eventos de telemetría con debounce (`calculate_sueldo`, `calculate_horas_extras`, `calculate_vacaciones`, `calculate_part_time`). | Conteo en tiempo real del volumen total de simulaciones laborales en toda la plataforma. |
| 2026-09-18 | `/compra-exitosa`, `/index.html`, `/calculadora-horas-extras`, `/sueldo_liquido`, `/finiquito_calculator`, `/generador-anexo-40-horas` | Activación integral del Funnel B2B Kit Blindaje Pyme ($19.990 CLP): tracking e-commerce `purchase` en GA4, callout cards de blindaje laboral en calculadoras principales, enlaces permanentes en menú/footer y upsell post-generación de anexo 40h. | Romper la barrera de 0 conversiones canalizando a empleadores, contadores y encargados de RRHH que utilizan las calculadoras directamente a la solución comercial de blindaje DT sin intrusión ni impacto en SEO/CLS. |

## Octubre 2026 - Medición del embudo de los generadores pagados

| Fecha | URL/Recurso | Cambio Específico | Hipótesis / Métrica Esperada a Mover |
| :--- | :--- | :--- | :--- |
| 2026-10-08 | `/generador-finiquito-chile`, `/generador-contrato-trabajo-chile`, kits y pack, `/js/checkout_consent.js` | Medición del embudo GA4 con una sola tabla de productos (`GA_ITEMS`: mismo `item_id` e `item_name` en los tres eventos para los seis productos de pago). `view_item` al cargar los generadores de finiquito y contrato; `begin_checkout` al aceptar el aviso de retracto, ahora desde `CLCheckout.buyKit` para todos (se quitaron los tres bloques duplicados de las páginas de kits y pack); `purchase` de los generadores al validar el desbloqueo, una vez por orden. | Sin cambio de tráfico ni ventas: es medición. Métrica: embudo `view_item` → `begin_checkout` → `purchase` por producto en GA4 (línea base 90 días: 11 sesiones a `generador-finiquito-chile`; 1 venta en el sitio, el Kit Ley 21.719). |

## Octubre 2026 - T2: canibalización de finiquito y CTR de valor hora

Línea base: Search Console, 11 jul a 8 oct 2026 (3 meses), consultas que contienen «finiquito». Con el tráfico actual (unas 2.200 sesiones al mes) las comparaciones a 4 semanas son ruidosas: se reportan tendencias y números absolutos, no conclusiones estadísticas.

| Fecha | URL/Recurso | Cambio Específico | Hipótesis / Métrica Esperada a Mover |
| :--- | :--- | :--- | :--- |
| 2026-10-08 | `/` (index.html) | El encabezado de la sección «Calculadora de finiquito 2026» pasa a «Tu finiquito, concepto por concepto». La meta description (y og/twitter) y la descripción del JSON-LD dejan de abrir con «Calcula finiquito». Se mantienen todos los enlaces a la calculadora con su texto (`Abrir la calculadora de finiquito`, `Calcular finiquito`, etc.). | Hoy la home se lleva 3.004 impresiones y 71 clics de las consultas con «finiquito» y `/finiquito_calculator` solo 36 impresiones y 11 clics; las consultas «calculadora finiquito» (662 imp.), «calculadora de finiquito» (558) y «simulador de finiquito» (718) las responde la home en posiciones 10,8 a 11,7. Hipótesis: sin un encabezado propio para esa frase, Google deja de preferir la home y muestra la calculadora. Métrica a 4 semanas: qué URL rankea para esas 10 consultas, y posición y CTR de la calculadora. |
| 2026-10-08 | `/finiquito_calculator` | Title: «Calculadora de Finiquito Chile 2026: Cálculo y Simulador Gratis». Meta description: «Calcula tu finiquito 2026 gratis…». Se incorpora «cálculo» y «calcular», que la página no usaba. | Consultas sin cobertura en el título: «cálculo de finiquito» (326 imp., pos. 17,6), «calcular finiquito» (126, pos. 35), «calculo finiquito» (31, pos. 40). Métrica: posición e impresiones de la calculadora en esas consultas. |
| 2026-10-08 | `/calculadora-sueldo-part-time`, `/ley-40-horas-chile-2026` | Title y meta de la calculadora con «30 y 20 horas». En la guía de 40 horas, enlace con ese texto desde la lista de trabajadores part-time. | «sueldo part time 30 horas chile 2026» (968 imp., pos. 5,8, CTR 0,8%) y «20 horas» (196 imp.) las responde la guía de 40 horas, no la calculadora (2 impresiones en total). Métrica: qué URL rankea y CTR de esas consultas. |
| 2026-10-08 | `/sitemap.xml` | `lastmod` de las cuatro páginas anteriores a 2026-10-08. | Recrawl más rápido de los cambios. |
| 2026-10-08 | `/ley-40-horas-chile-2026` (sin cambios) | No se toca el title ni la meta de valor hora: ya se reescribieron en la Fase 0 y Search Console solo informa hasta el 5 de octubre. | «a cuánto está la hora de trabajo en chile»: 1.175 imp., pos. 5,1, CTR 0,26%. Línea base de los últimos 28 días (hasta el 5 oct): 4.886 impresiones, 30 clics, CTR 0,61%, posición 4,97 en las consultas de valor hora. Si a 4 semanas del cambio de Fase 0 el CTR sigue bajo 1%, reescribir de nuevo con la pregunta exacta. |

## Octubre 2026 - T4: llamados a la acción en las calculadoras con más tráfico

Línea base (GA4 y Search Console, 11 jul a 8 oct 2026): `ley-40-horas` 751 sesiones y `calculadora-horas-extras` 738, las dos mayores entradas después de la home; `generador-finiquito-chile` 11 sesiones y ninguna página de kit entre las 30 principales. Hasta hoy ninguno de estos llamados a la acción tenía evento de clic, así que no había forma de saber cuánta gente los usa. Con unas 2.200 sesiones al mes se reportan tendencias y números absolutos, no conclusiones estadísticas.

| Fecha | URL/Recurso | Cambio Específico | Hipótesis / Métrica Esperada a Mover |
| :--- | :--- | :--- | :--- |
| 2026-10-08 | `/js/checkout_consent.js` (v1.3.0) | Evento GA4 `select_promotion` al hacer clic (o clic central) en cualquier `<a data-cta="producto" data-cta-slot="lugar">`: `promotion_id` (item_id de `GA_ITEMS` o identificador libre como `anexo-40h`), `promotion_name`, `creative_slot`, `location_id` (ruta de la página) y, para productos de pago, `items` con el mismo `item_id` e `item_name` que `view_item`/`begin_checkout`/`purchase`. Envío por `beacon` para no perder el clic al cambiar de página. | Poder medir el embudo completo por página: sesión, clic en el CTA, `begin_checkout`, `purchase`. Métrica: clics por `creative_slot` y por producto en GA4 (Informes > Monetización > Promociones). |
| 2026-10-08 | `/ley-40-horas-chile-2026` | Bloque nuevo tras el aviso del pacto 4×3: «¿Tienes personas a cargo?» hacia el Kit Blindaje (`#comprar-kit`), con lo que el kit trae según AGENTS.md 2.1. Etiquetados los 3 botones del anexo gratuito (`anexo-40h`) para compararlos con el CTA de pago. | La guía tenía 4 llamados al generador de anexo gratuito y ninguno a un producto de pago, aunque el Kit incluye los anexos de jornada de 42 horas. Métrica: clics a `blindaje` desde `guia-seccion-4` frente a clics a `anexo-40h`; `begin_checkout` de `blindaje` con origen en esta página. |
| 2026-10-08 | `/calculadora-vacaciones` | Bloque nuevo bajo los resultados: «¿Calculas las vacaciones por término de contrato?» hacia el generador de finiquito ($12.990), que incluye la indemnización por feriado proporcional (Art. 67 y 73). Texto aclara que es un modelo de referencia. | La página solo enlazaba a la calculadora de finiquito gratuita. Métrica: clics a `finiquito` desde `bajo-resultado`; `view_item` y `begin_checkout` de `finiquito` con origen en esta página. |
| 2026-10-08 | `/calculadora-horas-extras`, `/sueldo_liquido` | Sin cambio visual: se etiquetan los CTA que ya existían (Kit Blindaje, anexo 40h, calculadora de costo empresa y Portal Empleadores). En `sueldo_liquido` el texto de venta del kit «Conforme DT & Ley Karin» pasa a «Basado en el Código del Trabajo y la Ley Karin» (AGENTS.md 2.1: no prometer conformidad). | Medir antes de cambiar: clics por `creative_slot` en las dos páginas antes de decidir si mover el bloque o cambiar el texto. |
| 2026-10-08 | `/sitemap.xml` y 13 páginas que cargan el script | `lastmod` de las páginas tocadas; `checkout_consent.js?v=1.3.0` en todas las que lo cargan (ahora también `ley-40-horas` y `calculadora-vacaciones`). | Que el navegador tome el script nuevo. |
| 2026-10-08 | `/ley-40-horas-chile-2026` | La etiqueta de la tarjeta del anexo gratuito pasa de «Modelo Conforme a la Dirección del Trabajo (DT)» a «Modelo de referencia basado en el Código del Trabajo». | Sin efecto SEO esperado: es una corrección de texto comercial (AGENTS.md 2.1: no sugerir que la DT aprobó un documento propio). |

Comparación a 4 semanas de mezclar: conversión de `blindaje` y `finiquito` con origen en estas páginas (`begin_checkout` y `purchase`) contra la línea base de cero eventos de clic previos; si un CTA tiene clics pero no `begin_checkout`, revisar el flujo de pago (T1).
