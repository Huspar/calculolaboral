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

