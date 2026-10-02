# Cálculo Laboral

Calculadoras, simuladores y documentos laborales para Chile: [calculolaboral.cl](https://calculolaboral.cl).

Sitio estático en HTML + Tailwind, desplegado en Vercel. Las funciones serverless de `api/` manejan leads, pagos con Flow y entrega de kits.

## Estructura

| Ruta | Contenido |
|---|---|
| `*.html` (raíz) | Páginas del sitio. La URL es el nombre del archivo sin `.html` (`cleanUrls`). |
| `js/` | Lógica de calculadoras, generadores de documentos e indicadores (UF, UTM). |
| `assets/css/` | `style.css` (Tailwind compilado), `polish.css` y estilos de componentes. |
| `assets/covers/`, `assets/og/` | Portadas SVG de artículos e imágenes para redes sociales. |
| `api/` | Funciones de Vercel: `send-lead`, `checkout` y retorno de Flow, `download`, `send-finiquito`. |
| `api/assets/` | Kits pagados (solo accesibles vía `api/download` tras pago confirmado). |
| `descargas/` | Modelos gratuitos (cartas de despido, solicitud de vacaciones). |
| `scripts/`, `tools/` | Scripts de mantenimiento (regenerar kits, portadas, auditorías). No se publican. |
| `docs/` | Auditorías SEO y registro de cambios SEO. No se publican. |

## Reglas de diseño

- `AGENTS.md`: reglas obligatorias de header, footer, logo y checklist antes de publicar.
- `DESIGN.md`: sistema de diseño (colores, tipografía, componentes).
- `_template.html`: plantilla base para páginas nuevas.

## Desarrollo

```bash
npm install
npm run build:css
```

Para probar en local: `python -m http.server 5500` y abrir `http://127.0.0.1:5500/index.html`.

Archivos que no se publican: ver `.vercelignore`.
