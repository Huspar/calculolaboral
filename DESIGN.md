---
version: alpha
name: Calculo-Laboral
description: Sistema de diseño de calculolaboral.cl, herramientas laborales para Chile. Fondo blanco limpio, verde bosque profundo como color de marca, ámbar dorado como acento cálido, y cifras financieras en Geist Mono. Tono sobrio, legal y confiable, no corporativo frío ni decorativo.

colors:
  forest: "#00382E"
  forest-hover: "#002820"
  forest-deep: "#00261F"
  amber: "#FFB703"
  amber-hover: "#FFAA00"
  canvas: "#F8FAF9"
  forest-50: "#EEF6F3"
  forest-100: "#D6EBE4"
  forest-600: "#0F5E4F"
  forest-700: "#064A3E"
  mint-bg: "#F4F7F6"
  card: "#FFFFFF"
  border: "#E5E7EB"
  ink: "#111827"
  muted: "#4B5563"
  emerald-success: "#047857"
  emerald-success-bg: "#ECFDF5"
  risk: "#E11D48"
  risk-bg: "#FFF1F2"
  risk-border: "#FECDD3"
  link: "#0F5E4F"
  on-forest: "#FFFFFF"
  on-amber: "#00382E"

typography:
  sans: "Geist, Inter, system-ui, sans-serif"
  mono: "Geist Mono, ui-monospace, monospace"
  weights: [400, 500, 600, 700, 800]

rounded:
  card: 16px
  control: 12px
  logo: 12px
  footer-top: 40px

spacing:
  container: 1200px
  gutter: 24px
  header-height: 64px
---

## Overview

CalculoLaboral es una suite de calculadoras y guías laborales chilenas. El diseño debe transmitir **precisión legal y confianza**: mucho blanco, jerarquía clara, cifras legibles. El verde bosque es la marca; el ámbar es un acento puntual, no un color de fondo.

Fuente de verdad en código: variables `--teal-*` en `index.html` y la paleta `brand` de `tailwind.config.js`. Las reglas operativas obligatorias (header, footer, indicadores, checklist) están en `AGENTS.md`; este archivo describe el sistema, `AGENTS.md` lo hace cumplir.

## Colors

| Rol | Valor | Uso |
|---|---|---|
| Marca | `#00382E` (forest) | Logo, footer, botones primarios de marca, fondos de énfasis |
| Marca hover / deep | `#002820` / `#00261F` | Estados hover y degradados oscuros |
| Acento | `#FFB703` (amber) | Isotipo sobre fondo verde, detalles de CTA, resaltados puntuales |
| Fondo | `#F8FAF9` (`bg-canvas`) en el body de todas las páginas; tarjetas y bandas en `#FFFFFF` | Lienzo único del sitio |
| Escala de marca | `forest-50` a `forest-950` en `tailwind.config.js` (800 = `#00382E`) | Tintes, enlaces, íconos y estados |
| Texto | `#111827` / `#4B5563` | Principal / secundario |
| Borde | `#E5E7EB` | Tarjetas e inputs |
| Éxito / certificación DT | emerald-700 sobre emerald-50 | Confirmaciones, sellos de conformidad |
| Riesgo | rose-600 sobre rose-50, borde rose-200 | Nulidad de despido, demandas, multas. Nunca en un botón de compra o CTA |
| Enlaces | `forest-600` (`#0F5E4F`) | Enlaces y acciones secundarias |

Reglas:
- Prohibidos celeste, azul, índigo, violeta, púrpura y naranja (`sky-*`, `blue-*`, `indigo-*`, `violet-*`, `purple-*`, `orange-*`). El equivalente es el mismo tono de `forest-*` (o `amber-*` para el naranja).
- Sin degradados de color salvo el panel verde `.cl-forest-panel` (`#00382E` a `#00261F`).
- No usar negro puro ni gris neutro: el texto va en `ink` y `muted`.
- Todo botón con fondo de color lleva `!text-white` (o `#ffffff !important`). Excepción: ámbar con `on-amber`.
- No colocar texto gris sobre fondos de color.
- El ámbar nunca cubre grandes superficies.

## Typography

- **Geist** para títulos, cuerpo y botones; Inter como respaldo.
- **Geist Mono** obligatoria para montos en CLP, porcentajes, fechas y cifras de cálculo, para alinear columnas y facilitar la lectura financiera.
- Títulos en peso 700 a 800 con `tracking-tight`; cuerpo en 400 a 500.
- Rótulos pequeños (indicadores): `text-[9px]` a `text-[9.5px]`, `font-semibold`, mayúsculas, `tracking-wider`, `whitespace-nowrap`.
- No usar tipografías serif ni decorativas.

## Layout

- Contenedor `max-w-[1200px] mx-auto px-6`. Footer interno hasta 1240px.
- Header sticky de 64px: `bg-white border-b border-slate-200 shadow-sm`, clase `no-print`.
- Barra de indicadores económicos bajo el header en toda calculadora (ver `AGENTS.md` sección C): carrusel de 1 fila en móvil, 3 columnas en tablet, 5 en escritorio.
- Verificar siempre en 1200px y 390px.

## Shapes

- Tarjetas `rounded-2xl`, controles `rounded-xl`, logo `rounded-xl` de 36px (`w-9 h-9`) en header.
- Footer con esquinas superiores curvas de 40px.
- Sombras suaves (`shadow-sm`); evitar sombras pesadas.

## Components

**Logo.** Isotipo SVG de balanza con monograma C y L (nunca el texto "CL").
- Header: contenedor `#00382E`, isotipo `#FFB703`, "Cálculo" en `text-slate-900` y "Laboral" en `#00382E`.
- Footer: contenedor `#FFB703`, isotipo `#00382E`, "Cálculo" en blanco y "Laboral" en `#FFB703`.

**Footer.** Clase `.teal-footer-curve`: fondo `#00382E`, texto blanco, esquinas superiores de 40px, 4 columnas (Marca, Calculadoras, Guías, Para Empresas) y barra legal inferior.

**Tarjetas.** `bg-white border border-slate-200 rounded-2xl`; las de resultado destacan con fondo verde `forest` o degradado `#00261F` a `#00382E`.

**Indicadores.** Micro-tarjetas `indicator-card` con borde `slate-200/90`, `rounded-xl`, rótulo no-wrap.

**Alertas.** Riesgo en rose, éxito o certificación DT en emerald. Siempre con icono y texto, nunca solo color.

**Botones de pago Flow.cl.** Mantener los tokens y precios vigentes ($12.990, $19.990, $29.990) sin alterar.

## Capa compartida y movimiento

Toda página enlaza, al final del `<head>`, `/assets/css/polish.css` y, antes de `</body>`, `/js/motion.js` (con `defer`). Ahí viven las superficies del navegador (selección ámbar, caret y foco verde, scrollbar, cifras tabulares) y el lenguaje de movimiento:

- **Marcador del titular** (`.cl-mark`): trazo de resaltador ámbar que se dibuja una vez al cargar, como quien subraya el dato clave de un documento. Es el único momento de autor; no repetirlo en cada sección.
- **Cifra que se asienta** (`.cl-settle`, automático): cuando un monto grande de resultado (26px o más) termina de cambiar, hace un fundido breve de 320ms para confirmar el nuevo valor.
- **Acordeones**: el contenido de `details` en `main` aparece con un fundido de 260ms.
- **Presión**: botones y pills bajan a `scale: 0.96` al presionar.
- Curvas: `cubic-bezier(0.16, 1, 0.3, 1)` para entradas y `cubic-bezier(0.2, 0, 0, 1)` para estados. Sin rebote.
- `prefers-reduced-motion: reduce` desactiva el marcador, el asentado y los acordeones animados.

## Plantillas (Fase 2)

- **Sin etiquetas sobre los títulos.** No se usan píldoras ni rótulos en mayúsculas encima de un `h1`/`h2`. Si el dato es normativo (artículo, ley, vigencia), va **debajo** del título como `<p class="cl-meta">` (línea ámbar corta + texto en `forest-700`, 13px). Si es decorativo, se elimina.
- **Calculadoras.** Debajo del texto introductorio va siempre la misma navegación `<nav class="cl-calcnav">` con las 9 calculadoras en el mismo orden y `aria-current="page"` en la actual. La publicidad nunca va dentro de la tarjeta de resultados: se usa `<aside class="cl-sponsor">` después de la grilla.
- **Guías y páginas legales.** `main.cl-reading` (46rem de ancho) y `<article class="cl-article">` sin tarjeta, así los avisos interiores no quedan como tarjetas anidadas. El sello DT usa `.cl-trust` (líneas finas arriba y abajo, sin caja).
- **Tipografía.** Piso de 12px (`text-xs`) para cualquier texto; párrafos de más de una línea en 14px (`text-sm`) o más. Sin mayúsculas en botones ni en textos de más de unas pocas palabras.
- **Avisos.** Sin franjas laterales gruesas (`border-l-4`): borde de 1px en el tono del aviso.

## Ilustraciones (Fase 3)

- Todas las portadas de guías y blog son SVG propios en `assets/covers/`, generados con `python scripts/build_covers.py`. No usar fotos de stock, renders 3D ni imágenes generadas por IA en el contenido.
- Lenguaje fijo: papel de libro contable `forest-50` con renglones `forest-100`, línea de margen ámbar, motivo dibujado con trazo de 7px redondeado en `#00382E`, papel blanco con sombra desplazada `forest-200` y acentos ámbar (incluido el trazo de resaltador). Formato 800 × 450 (16:9).
- Para una guía nueva: agregar una función `m_*` y su entrada en `COVERS`, regenerar y usar `<div class="cl-cover-frame"><img class="cl-cover" src="/assets/covers/…svg" width="800" height="450" alt="…"></div>`.
- Las imágenes `og:image` de redes sociales siguen siendo los JPG/PNG anteriores (los SVG no sirven para vista previa social).
- Blog: nota destacada (`.cl-feature`) + grilla `.cl-post-grid`; la categoría va como metadato (`.cl-post-meta`), nunca como insignia de color sobre la imagen. Patrocinios siempre como `.cl-sponsor`, fuera de la grilla.

Después de cambiar clases, recompilar con `npm run build:css` y subir el `?v=` de `style.css` en las páginas, porque `/assets/` se sirve con caché inmutable.

## Do's and Don'ts

Do:
- Mantener header, footer y logo idénticos a `index.html` en todas las páginas.
- Usar Geist Mono en toda cifra de cálculo.
- Dar contraste AA en texto sobre verde o ámbar.
- Añadir cada página nueva a `sitemap.xml`.

Don't:
- No usar una paleta crema, coral ni tipografías serif.
- No usar degradados morado a azul, Inter como única tipografía ni tarjetas anidadas en tarjetas.
- No usar iconos en cuadrado redondeado sobre cada título.
- No cambiar el logo ni inventar variantes.
- No usar easing con rebote.

## Responsive Behavior

- Móvil primero; menú móvil con `<details class="md:hidden">` igual al de `index.html`.
- Indicadores: carrusel con `scroll-snap` bajo 640px.
- Objetivos táctiles de al menos 44px; sin scroll horizontal de página.

## Known Gaps

- `AGENTS.md` contiene reglas desactualizadas que contradicen producción: la sección D describe un footer blanco con logo `bg-sky-500` y `ui_consistency.md` pide logo azul, pero 48 de 49 páginas usan footer y logo verde `#00382E`. Este archivo sigue la implementación real.
- La barra de indicadores (`indicators-carousel`) que exige `AGENTS.md` no está en ninguna página; la reemplaza la barra superior con UF, UTM e IMM. Falta decidir cuál de las dos queda como norma.
