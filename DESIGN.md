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
  # Software /app (Asistente Laboral Pyme): solo en assets/css/app.css
  app-sidebar: "#00261F"
  app-side-muted: "#A9C7BD"
  app-ink-2: "#374151"
  app-faint: "#6B7280"
  app-line: "#E3E8E5"
  app-line-2: "#CFD8D4"
  app-surface-2: "#F3F6F4"
  app-hover: "#F6F9F7"
  app-scrollbar: "#C7D2CD"
  app-progress-preparada: "#8FB9AB"
  app-amber-ink: "#7A4F00"
  app-amber-bg: "#FFF7E0"
  app-warning-icon: "#B07800"
  app-risk: "#BE123C"
  app-risk-ink: "#9F1239"
  app-ok-ink: "#065F46"

typography:
  sans: "Geist, Inter, system-ui, sans-serif"
  mono: "Geist Mono, ui-monospace, monospace"
  weights: [400, 500, 600, 700, 800]

rounded:
  card: 16px
  control: 12px
  logo: 12px
  footer-top: 40px
  app-panel: 12px
  app-control: 10px
  app-item: 8px
  app-sello: 6px

spacing:
  container: 1200px
  gutter: 24px
  header-height: 64px
  app-sidebar: 248px
  app-topbar: 56px
  app-row: 52px
  app-detail: 340px
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

## Jerarquía de botones y precios (Fase 4)

- **Una sola acción principal por página o grupo**, siempre `btn-yellow-pill` (ámbar con texto `#111827`). En el portal de empleadores es el Kit Ley 21.719; en cada kit, el botón de compra.
- Acciones secundarias: `btn-outline-pill`. Acciones terciarias: enlace de texto subrayado (`.cl-quicklinks`).
- `btn-dark-pill` (verde bosque) solo para acciones de apoyo dentro de bloques oscuros o formularios; nunca compite con el ámbar en la misma vista.
- Grupos de precios: título de grupo `.cl-group-title`, una sola tarjeta destacada con borde `forest-800` y la etiqueta `.cl-recommend` ("Recomendado"). El resto de las etiquetas de producto son `.cl-tag` (texto, sin fondo).
- Nunca rojo/rose en botones de compra ni en cajas de venta cruzada: el rojo es solo para riesgo (multas, nulidad).
- No modificar los enlaces ni tokens de Flow.cl al cambiar estilos.

## Documentos imprimibles

- **Informes** (finiquito, sueldo líquido, costo empresa): usan `js/print_brand.js` (`CLPrint.css()` y `CLPrint.header()`): logo oficial, Geist / Geist Mono, filetes finos y el total con trazo de resaltador ámbar. Meta: **una hoja A4**.
- **Documentos legales** firmados por las partes (finiquito notarial, contrato, anexo 40 h, carta de renuncia): sin logo ni publicidad, solo un pie discreto con calculolaboral.cl. Cuerpo en serif (Newsreader / Times), partes de formulario en Geist. Meta: anexo y carta en **una hoja**, finiquito notarial en **dos**; el contrato es largo por naturaleza (4 hojas con el anexo Ley Karin).
- Verificar el número de hojas imprimiendo a PDF antes de publicar cambios en estos generadores.
- Imágenes para redes (`og:image`): PNG de 1200 × 630 en `assets/og/`, con logo, título corto y la ilustración de la guía. Por defecto: `assets/og/default.png`.

Después de cambiar clases, recompilar con `npm run build:css` y subir el `?v=` de `style.css` en las páginas, porque `/assets/` se sirve con caché inmutable.

## Software /app (Asistente Laboral Pyme)

> Excepción documentada a la regla de encabezado y pie (ver `AGENTS.md`, sección 1). Todo lo de esta sección vale **solo** para `app.html` (servido en `/app` y `/app/*`), `assets/css/app.css` y `js/app_pyme.js`. El resto del sitio sigue las reglas anteriores sin cambios. Fuente de verdad: las variables de `:root` en `assets/css/app.css` (tokens `app-*` del frontmatter). Contrato de diseño: `.impeccable/surfaces/app-html.md`.

### Overview

**Creative North Star: "El libro de remuneraciones en pantalla"**

El mes laboral es la pantalla. Inicio es la planilla de cierre del mes: una fila por trabajador, su estado y lo que falta, con la acción al costado sin cambiar de vista. Es una herramienta de trabajo, densa y tranquila: filetes de 1px en vez de tarjetas, cifras en Geist Mono tabular, estados como sellos de texto. No hay tablero de tarjetas con métricas, ni gráficos decorativos, ni íconos en cuadrados de color.

**Key Characteristics:**
- Marco propio: menú lateral verde bosque profundo, barra superior blanca, sin el header, la franja de indicadores ni el footer del sitio.
- Contenido blanco sobre lienzo `canvas`, separado por filetes `app-line`.
- Cifras, fechas, RUT y montos siempre en Geist Mono tabular.
- Ámbar solo para lo activo y lo que vence pronto; rose solo para riesgo legal.

### Colors

- **Menú lateral** (`app-sidebar`, igual a `forest-deep`): fondo del menú y `theme-color` de la página. Texto blanco; rótulos de grupo, íconos inactivos y datos secundarios en `app-side-muted`.
- **Superficies:** contenido en blanco sobre `canvas`; cabeceras de tabla, botones al pasar el cursor y fondos neutros en `app-surface-2`; fila al pasar el cursor en `app-hover`; fila seleccionada en `forest-50`.
- **Filetes:** `app-line` para toda división (tablas, paneles, franja de cifras, barra superior); `app-line-2` para el borde de botones secundarios, campos y el sello "Preparada".
- **Texto:** `ink` principal, `app-ink-2` para valores y etiquetas de formulario, `muted` para texto de apoyo, `app-faint` para vacíos, opcionales y marcadores de posición.
- **Ámbar:** `amber` en el ícono del ítem activo del menú, el punto de "vence pronto", el punto del Pase por vencer y el anillo de foco dentro del menú. Texto de vencimiento en `app-amber-ink`; avisos y eventos de plazo sobre `app-amber-bg` (borde `#F8DE9C`); ícono de aviso en `app-warning-icon`.
- **Rose (riesgo legal):** `app-risk` en el ícono de aviso urgente, botones de peligro (eliminar cuenta), errores de campo y enlaces destructivos; `app-risk-ink` para texto vencido, saldo negativo y mensajes de error, sobre `risk-bg` con borde `risk-border`. En la app el rose es un tono más oscuro que el del sitio (`#BE123C` en vez de `#E11D48`) para llegar a AA sobre los fondos con tinte.
- **Éxito:** `app-ok-ink` para el mensaje de guardado correcto.
- **Línea de avance:** segmentos `app-line` (sin preparar), `app-progress-preparada` (preparada) y `forest-600` (emitida).
- **Scrollbar:** pulgar `app-scrollbar` de 10px con radio completo y pista transparente.

**La Regla del Ámbar Activo.** El ámbar marca solo dos cosas: dónde estás (ícono del ítem activo) y lo que vence pronto. Nunca rellena botones ni superficies dentro de la app.

**La Regla del Rose Legal.** El rose aparece solo cuando hay riesgo legal o una acción destructiva: plazos vencidos, avisos urgentes, eliminar datos. Nunca como acento ni en una acción de compra.

### Typography

- **Geist** (`--sans`, respaldo Inter y system-ui) para todo el texto de pantalla; cuerpo base de 14px con interlineado 1.5.
- **Geist Mono** (`--mono`) con `font-variant-numeric: tabular-nums` en columnas numéricas (alineadas a la derecha), fechas, RUT, montos de los campos de pesos, UF y números, cifras de la franja, saldo de vacaciones, números del calendario y contadores del menú. Las cabeceras de columnas numéricas siguen en Geist.
- **Jerarquía:** título de vista 24px peso 700, tracking -0.015em (21px bajo 900px); título de sección y de panel 15px peso 650; título del panel de detalle y del editor 16px peso 650; cifras de la franja 22px Mono peso 600; saldo grande 28px Mono peso 600; cabeceras de tabla y rótulos de cifras 12.5px peso 600 o 400 en `muted`; texto de ayuda 13px; piso de 11.5px solo para la barra inferior y los eventos del calendario.
- Sin mayúsculas en la pantalla: rótulos, botones y grupos del menú van en mayúscula inicial.

### Layout

- **Marco:** grilla de dos columnas, menú lateral fijo (sticky) de **248px** y contenido flexible. Barra superior sticky de **56px** con el selector de mes (anterior, mes, siguiente), estado del Pase y cuenta. Contenido con relleno de 28px arriba y 32px a los lados.
- **Cierre del mes:** encabezado con título, subtítulo y línea de avance segmentada (un segmento por trabajador, 6px de alto, hasta 380px); a la derecha las acciones. Debajo, franja de tres cifras; luego la columna izquierda (grilla del mes y avisos) y el **panel de detalle de 340px** a la derecha, sticky a 76px del borde superior.
- **Tabla:** cabecera de 40px, filas de **52px**, 16px de relleno horizontal.
- **Editor de liquidaciones y documentos:** formulario (mín. 360px) y vista previa en proporción 0.8 / 1.2, la vista previa sticky.
- **Calendario:** grilla de 7 columnas con días de 108px de alto mínimo y una lista lateral de 320px.
- **Puntos de quiebre** (todos `@media screen`):
  - **1240px:** el panel de detalle baja a 300px; el editor pasa a una columna y la vista previa deja de ser sticky.
  - **1080px:** el cierre queda en una columna en el orden grilla, detalle, avisos; el calendario y las vistas de dos columnas también pasan a una.
  - **900px:** el menú lateral se vuelve un cajón (máx. 280px u 86vw) que entra desde la izquierda en 220ms con velo `rgba(0, 38, 31, 0.45)`; aparece la **barra inferior** fija de cinco botones (Cierre, Personas, Liquidaciones, Calendario y **Más**, que abre el cajón), de 52px de alto mínimo y con margen para el área segura. La franja de cifras se apila con filetes horizontales, se ocultan columnas secundarias de la tabla y sus datos pasan bajo el nombre, el calendario muestra solo un punto bajo los días con eventos.

**La Regla del Mes en Pantalla.** Elegir una fila (clic o flechas arriba y abajo) abre su detalle al costado; nunca se navega a otra pantalla para ver el estado de un trabajador en el cierre.

### Elevation & Depth

Plana. La profundidad se da con filetes y tintes, no con sombras. Las únicas sombras son funcionales: el cajón del menú abierto en móvil (`8px 0 24px rgba(15, 23, 42, 0.18)`) y la hoja de vista previa del documento, que imita un papel (`0 1px 2px rgba(15,23,42,.06), 0 10px 30px -18px rgba(15,23,42,.35)`) sobre un marco `#E9EEEC`.

**La Regla del Libro.** La franja de cifras es una fila de tres valores separados por filetes verticales de 1px, con filetes arriba y abajo, sin cajas ni fondos. Los paneles con borde existen para contener tablas, listas y formularios, nunca para aislar una métrica.

### Shapes

Esquinas suaves y pequeñas: paneles, tablas y opciones de Pase a 12px; botones, campos y avisos a 10px; ítems del menú, botones chicos y botones de ícono a 8px; sellos a 6px; eventos del calendario a 5px; segmentos de avance a 2px. Círculos para el punto de estado, el día de hoy y los pasos numerados.

### Components

**Logo.** En el menú, la versión de pie de página: isotipo de balanza en `forest` sobre contenedor ámbar de 32px (radio 10px), "Cálculo" en blanco y "Laboral" en ámbar, 17px peso 700. En la pantalla de entrada (fondo claro), la versión de header: contenedor `forest`, isotipo ámbar, "Cálculo" en `ink` y "Laboral" en `forest`.

**Menú lateral.** Ítems de 38px con ícono de 19px; al pasar el cursor, blanco al 6%; el activo con fondo blanco al 10%, texto blanco peso 600 e ícono ámbar. Grupos (Personas, Mes, Herramientas, Configuración) en 12px `app-side-muted`. Pie del menú separado por filete blanco al 10%, con enlaces de 34px.

**Botones.** Alto 38px, relleno 0 14px, 14px peso 600. Secundario: blanco con borde `app-line-2`. Primario: `forest` con texto blanco (hover `forest-hover`); uno por vista ("Imprimir todas", "Revisar la liquidación"). Peligro: `app-risk` con texto blanco. Chico: 32px. De texto: `forest-600` subrayado con el subrayado al 35%. Al presionar bajan a `scale: .97`; deshabilitados al 45% de opacidad.

**Sellos de estado.** Texto en una cápsula de 24px, 12.5px peso 600, sin íconos:
- **Emitida · fecha:** `forest-700` sobre `forest-50`, borde `forest-100`.
- **Preparada:** `app-ink-2` sobre blanco, borde `app-line-2`.
- **Sin preparar:** `muted` sobre transparente, borde punteado `#AEBDB7`.
- **No corresponde:** solo texto `app-faint`. **Inactivo:** `muted` sobre `app-surface-2`.

**Tabla del mes.** Cabecera en `app-surface-2`, filas de 52px con filete inferior, nombre en peso 600 con el cargo debajo en 12.5px; fila seleccionada en `forest-50` con el nombre en `forest`; foco de fila con contorno interior de 2px. "Vence pronto" en `app-amber-ink` peso 600 con un punto ámbar de 7px; "Vencido" en `app-risk-ink`.

**Panel de detalle.** 340px, lista de pares etiqueta/valor separados por filetes, aviso del trabajador y botones a ancho completo. Al cambiar de fila el contenido se desvanece y se desplaza 6px en **180ms** con `cubic-bezier(0.16, 1, 0.3, 1)`.

**Avisos del mes.** Lista con filetes, ícono de 18px, título peso 600 y explicación en 13px; acción como botón de texto a la derecha. Niveles por color del ícono: **urgente** en `app-risk`, **aviso** en `app-warning-icon`, **info** en `forest-600`. Los avisos en caja (`lq-aviso`) usan borde de 1px en su tono: info sobre `forest-50`, aviso sobre `app-amber-bg`, error sobre `risk-bg`.

**Campos.** 40px de alto, borde `app-line-2`, radio 10px, 14.5px; los numéricos, de fecha y de RUT en Geist Mono. Al pasar el cursor el borde pasa a `#AEBDB7`; con foco, contorno `forest` de 2px y borde `forest`; inválidos con borde `app-risk`. Selector de opciones (`segmento`): etiquetas con borde que al marcarse toman borde `forest` sobre `forest-50`.

**Pestañas de la carpeta.** 40px, texto `muted`; la activa en `forest` con subrayado de 2px.

**Foco.** `:focus-visible` con contorno de 2px `forest` y separación de 2px en toda la app; dentro del menú el contorno es ámbar. Nunca se quita el contorno.

**Movimiento.** Estados en 120 a 180ms con `cubic-bezier(0.2, 0, 0, 1)`; entradas (detalle, cajón, flecha del desglose) con `cubic-bezier(0.16, 1, 0.3, 1)`. `prefers-reduced-motion: reduce` desactiva todas las transiciones.

**Impresión.** Solo se imprime `#print-section`; el resto del cuerpo se oculta. Página carta con márgenes de 12mm (`@page { size: letter; margin: 12mm; }`), una hoja por documento con salto de página entre hojas, sin sombra, 11.5px, y el total, los datos y el título conservan su color (`print-color-adjust: exact`). Total, firmas, bases y tablas llevan `break-inside: avoid`. La liquidación impresa lleva filete `forest` de 2px bajo el encabezado y el total en una banda `forest` con cifra Mono; las cartas, título centrado en `forest`, cuerpo justificado y firmas al pie.

### Do's and Don'ts

**Do:**
- **Do** usar el menú lateral `app-sidebar` de 248px con el logo en su versión de pie de página, y la barra superior blanca de 56px.
- **Do** separar con filetes `app-line` de 1px y mostrar las cifras clave en una franja sin cajas.
- **Do** expresar los estados como sellos de texto (Emitida, Preparada, Sin preparar).
- **Do** poner toda cifra, fecha y RUT en Geist Mono tabular.
- **Do** verificar en 1440px, 1080px, 800px y 390px, y la impresión en hoja carta.

**Don't:**
- **Don't** agregar a `/app` el header, la franja de indicadores ni el footer del sitio.
- **Don't** armar tableros de tarjetas con métricas, gráficos decorativos ni íconos en cuadrados de color.
- **Don't** usar el ámbar como fondo de botones o superficies dentro de la app, ni el rose fuera del riesgo legal y las acciones destructivas.
- **Don't** llevar a la pantalla las mayúsculas espaciadas de la liquidación impresa: son convención del documento, no de la interfaz.

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
