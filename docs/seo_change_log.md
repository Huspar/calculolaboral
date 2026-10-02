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


