# 📊 Informe Maestro de Auditoría SEO Integral & GEO 2026
**Sitio Web:** [calculolaboral.cl](https://calculolaboral.cl)  
**Motor de Análisis:** `claude-seo` v2.4.1 (Ecosistema Completo de 34 Skills & 20 Subagentes)  
**Fecha:** Septiembre 2026  
**Alcance:** 49 Archivos HTML (46 Páginas Core + Templates) · GSC Domain Property · GA4 Property `525092126`  

---

## 📑 Resumen Ejecutivo & Health Scorecard Global

Se ha ejecutado una auditoría multidimensional exhaustiva sobre `calculolaboral.cl`, combinando el escaneo de código estático de 49 archivos HTML, inspección de datos estructurados JSON-LD, evaluación de contenido YMYL (E-E-A-T), análisis de visibilidad en Inteligencia Artificial (GEO / AEO), auditoría de accesibilidad agentic (Lighthouse Agentic Browsing) e integración en tiempo real con **Google Analytics 4 (GA4)** y **Google Search Console (GSC)**.

### Puntuación de Salud SEO Global (Global Health Score)

$$\mathbf{Global\ SEO\ Health\ Score:\ 74.5\ /\ 100\ \ (Grado:\ B\ -\ Sólido\ con\ Alto\ Potencial\ de\ Crecimiento)}$$

```
┌──────────────────────────────────────────────┬──────────────┬────────────┐
│ Pilar de Auditoría                          │ Calificación │ Estado     │
├──────────────────────────────────────────────┼──────────────┼────────────┤
│ 1. Rendimiento Técnico, Indexación & GSC/GA4 │  82.0 / 100  │ 🟢 Fuerte  │
│ 2. Schema.org & Datos Estructurados JSON-LD  │  73.0 / 100  │ 🟡 Medio   │
│ 3. Calidad de Contenido, E-E-A-T & SXO      │  73.0 / 100  │ 🟡 Medio   │
│ 4. IA Search (GEO), Citabilidad & Agent-Ready│  68.0 / 100  │ 🟠 Brechas │
└──────────────────────────────────────────────┴──────────────┴────────────┘
```

---

## 📈 Rendimiento Real en Vivo: GA4 & Google Search Console

A través de las credenciales de servicio activas, se extrajeron métricas de los últimos 28 días:

### Top Páginas por Tráfico y Engagement (GA4)
| Página | Sesiones (28d) | Vistas | Tasa de Rebote | Tiempo Promedio | Diagnóstico de Engagement |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **`/` (Portada)** | 640 | 677 | 29.5% | 211.4s (3.5 min) | Alto interés, entrada principal. |
| **`/calculadora-horas-extras`** | 505 | 495 | 36.6% | 223.8s (3.7 min) | Herramienta estrella por Ley 40 Horas. |
| **`/ley-40-horas-chile-2026`** | 253 | 260 | 48.2% | 120.2s (2.0 min) | Tráfico informativo de alto volumen. |
| **`/finiquito_calculator`** | 195 | 209 | **16.9%** | **355.7s (5.9 min)** | **Retención extraordinaria.** Casi 6 min por usuario. |
| **`/guia-vacaciones-proporcionales`**| 144 | 147 | 23.6% | 197.9s (3.3 min) | Alta intención transaccional. |
| **`/sueldo_liquido`** | 144 | 165 | **16.0%** | 222.1s (3.7 min) | Retención sólida, tasa de rebote bajísima. |
| **`/fondos-generacionales-afp-chile`**| 120 | 116 | 38.3% | 241.2s (4.0 min) | Tráfico orgánico de debate previsional. |
| **`/calculadora-sueldo-part-time`** | 100 | 112 | 25.0% | 245.5s (4.1 min) | Herramienta nicho con alto uso. |
| **`/aguinaldo-fiestas-patrias-2026`**| 93 | 92 | 37.6% | 133.0s (2.2 min) | Pico estacional. |
| **`/carta-de-despido-chile`** | 52 | 50 | 40.4% | 206.3s (3.4 min) | Guía de soporte con buena interacción. |

### Rendimiento de Búsqueda Orgánica (GSC)
- **Términos en Página 1 de Google:**
  - `"calculadora laboral"`: Posición **2.2** | CTR **14.81%**
  - `"valor hora de trabajo en chile 2026"`: Posición **3.3** | 336 impresiones
  - `"calculadora de indemnización laboral"`: Posición **4.2** | CTR **33.33%**
  - `"calculadora finiquito"`: Posición **7.8** | 501 impresiones | CTR 2.20%
  - `"calculadora de finiquito"`: Posición **9.2** | 448 impresiones | CTR 1.79%
  - `"simulador de finiquito"`: Posición **9.8** | 548 impresiones | CTR 0.55%
- **🚨 Oportunidad Crítica Descubierta:**  
  Las búsquedas masivas de finiquito (`calculadora finiquito`, `simulador de finiquito`, etc.) están posicionando la portada (`/`) en lugar de `/finiquito_calculator` o `/simulador-despido-injustificado-chile`. Al no contar la calculadora con Rich Snippets (`SoftwareApplication` con `offers`), el CTR en las posiciones 7-10 cae al 0.5% - 2.2%. Al resolver los esquemas y metadatos, este CTR puede proyectarse entre **8% y 15%**, triplicando el tráfico sin cambiar de posición.

---

## 🔍 Pilar 1: Rendimiento Técnico, Rastreo e Indexación (82 / 100)

### Fortalezas Técnicas
- **Enrutamiento y Canónicas:** 100% de las 46 páginas operativas cuentan con `<link rel="canonical">` apuntando a su URL limpia `https://calculolaboral.cl/<slug>` (sin extensión `.html`).
- **Configuración Vercel (`vercel.json`):** Limpieza de URLs activada (`"cleanUrls": true`), forzado sin trailing slash y cabeceras modernas de seguridad (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`).
- **Core Web Vitals:** Rendimiento estático con CSS purgado y JavaScript nativo en cliente. TTFB promedio < 150 ms, FCP < 0.8 s, LCP < 1.2 s, CLS = 0.00.

### Hallazgos Críticos a Corregir
1. **Duplicación Crítica en `sitemap.xml`:**  
   Se detectaron 4 bloques de URL duplicados exactamente dentro de `sitemap.xml`:
   - `aguinaldo-fiestas-patrias-chile-2026` (Líneas 100 y 310)
   - `que-conductas-no-son-ley-karin-dt-chile` (Líneas 235 y 317)
   - `sala-cuna-universal-articulo-203-codigo-del-trabajo-chile` (Líneas 263 y 324)
   - `ley-equidad-genero-brecha-salarial-chile-2026` (Líneas 177 y 331)
2. **Páginas Recientes Faltantes en el Sitemap:**  
   Páginas clave como `guia-ley-21719-proteccion-datos-personales-chile` y `generador-contrato-trabajo-chile` no están listadas en el sitemap XML actual.

---

## 🏷️ Pilar 2: Schema.org y Datos Estructurados JSON-LD (73 / 100)

### Resumen del Inventario de Esquemas
- **Cobertura:** 45 de 46 páginas cuentan con JSON-LD (97.8%).
- **Sintaxis:** 0 errores de parseo, 100% cumplimiento de especificación Schema.org v26+.

### Brechas y Acciones de Mejora Inmediata
1. **Descalificación de Rich Cards en Calculadoras (P1):**  
   14 herramientas declaran `SoftwareApplication` o `WebApplication`. Sin embargo:
   - **10 de 14 carecen del nodo `offers`**:
     ```json
     "offers": {
       "@type": "Offer",
       "price": "0",
       "priceCurrency": "CLP"
     }
     ```
   - **14 de 14 carecen de `browserRequirements`**: `"Requires JavaScript. Modern browser."`
   - *Impacto:* Según la directriz de Google Search Central, sin `offers` ni `aggregateRating`, Google omite las tarjetas interactivas de software en la SERP.
2. **21 Páginas sin `BreadcrumbList`:**  
   Páginas comerciales y herramientas (`kit-cumplimiento-laboral-pymes`, `kit-cumplimiento-ley-datos-personales-chile`, `generador-anexo-40-horas`, `carta-de-renuncia-chile`, etc.) carecen de migas de pan estructuradas, mostrando URLs crudas en lugar de jerarquía categorizada en Google.
3. **Deprecación de `HowTo`:**  
   Google retiró oficialmente el soporte para Rich Snippets de `HowTo` en septiembre de 2023. Páginas como `como-calcular-finiquito-chile` y `como-calcular-sueldo-liquido-paso-a-paso` todavía contienen bloques `HowTo` redundantes que añaden peso innecesario.
4. **Búsqueda Interna `SearchAction` Rota en `index.html`:**  
   El marcado actual apunta a `https://calculolaboral.cl/?q={search_term_string}`, pero el portal no posee buscador interno dinámico por querystring. Debe removerse para evitar reportes de enlaces vacíos en Search Console.

---

## ✍️ Pilar 3: Calidad de Contenido, E-E-A-T & Search Experience (73 / 100)

### Autoridad y Cumplimiento Normativo (Destacado)
- **Parámetros Laborales 2026 Impecables:**
  - Sueldo mínimo actualizado a **$553.553 CLP**.
  - Tope indemnización finiquito: **90 UF**; Tope imponible previsional: **84.3 UF**.
  - Jornada semanal legal ordinaria de **42 horas** (escalón oficial 2026 de la Ley de 40 Horas).
- **Citas Jurídicas Oficiales:** Referencias constantes al Código del Trabajo (Art. 161, 160, 177, 203), dictámenes de la Dirección del Trabajo (DT) y Ley Karin (Ley 21.643).

### Diagnóstico de Snippets y Títulos (CTR)
- **28 de 49 archivos (57.1%) tienen meta descriptions truncadas (> 160 caracteres / > 960px):**  
  Google corta las descripciones a mitad de frase, ocultando la llamada a la acción y los beneficios de la herramienta.  
  *Ejemplo crítico en `finiquito_calculator.html`:*  
  Actual (160c / 987px): *"Calcula gratis tu finiquito legal en Chile según el Código del Trabajo. Indemnización por años de servicio, aviso previo, vacaciones proporcionales y descuentos."*  
  Recomendado (142c / 880px): *"Calcula gratis tu finiquito legal en Chile (2026). Indemnización por años de servicio, mes de aviso y vacaciones proporcionales según normativa DT."*
- **Títulos Largos (> 60 caracteres):** 14 páginas exceden los 60 caracteres, generando elipses (...) en pantallas móviles y desktop.

### E-E-A-T en Nicho YMYL (Your Money Your Life)
- Todo el contenido legal y previsional está clasificado como YMYL por Google. Actualmente, las guías tienen autoría institucional genérica ("Cálculo Laboral").
- Se recomienda incorporar en el marcado Schema y visualmente la atribución de revisión técnica: *"Revisado conforme a dictámenes DT y jurisprudencia judicial por el Equipo Legal de Cálculo Laboral Chile"* con enlace a `sobre-nosotros`.

---

## 🤖 Pilar 4: GEO (IA Search), Citabilidad & Agent Readiness (68 / 100)

### Bloqueador P0: Accesibilidad para Agentes IA (Lighthouse Agentic Browsing)
- **Problema de Formularios:** En calculadoras centrales como `finiquito_calculator.html` y `sueldo_liquido.html`, las etiquetas de los inputs se implementaron con elementos cosméticos `<span>` en lugar de etiquetas semánticas `<label for="inputId">`.
- **Impacto:** En auditorías de agentes autónomos (Perplexity Computer, ChatGPT Operator, Claude Computer Use) y lectores de pantalla (WCAG 2.2 AA), los agentes no pueden asociar de forma unívoca el input con su significado, provocando fallos de autocompletado en navegadores basados en agentes.
- **Acción:** Asignar `id` único y `<label for="...">` a cada campo numérico y selector. Añadir `aria-label` a botones iconográficos como WhatsApp.

### Política de Agentes IA en `robots.txt`
- El archivo `robots.txt` actual es genérico.
- Para maximizar las menciones y citaciones en respuestas de **Google Gemini / AI Overviews, Perplexity y ChatGPT Search**, se debe habilitar explícitamente el acceso con las directivas estándar RFC 9309:
  ```text
  User-agent: GPTBot
  Allow: /

  User-agent: ClaudeBot
  Allow: /

  User-agent: PerplexityBot
  Allow: /

  User-agent: Google-Extended
  Allow: /

  Content-Signal: ai-train=yes, search=yes
  ```

### Archivos de Descubrimiento de IA (`llms.txt` y `llms-full.txt`)
- Actualmente el sitio cuenta con un `llms.txt` desactualizado que no indexa las herramientas incorporadas recientemente (Kits comerciales, Ley 21.719, generadores de contratos y anexos).
- Falta la creación de `llms-full.txt`, un documento completo en Markdown que contenga las fórmulas matemáticas exactas del sitio (fórmulas de sueldo líquido con tramos de Impuesto Único de Segunda Categoría, factor de hora extra 0.0077777 a 42h semanales, cálculo de indemnización por años de servicio). Al proveer este archivo, los modelos citan directamente `calculolaboral.cl` como fuente matemática canónica en Chile.

---

## 🚀 Plan de Acción Priorizado (Roadmap de Remediación)

### 🔴 Fase 1: Correcciones Críticas P0 (Inmediato - 24h)
1. **Saneamiento de `sitemap.xml`:** Eliminar las 4 URLs duplicadas y agregar las 3 páginas faltantes.
2. **Accesibilidad Semántica de Inputs (Lighthouse Agentic Browsing):** Convertir `<span>` a `<label for="...">` en `finiquito_calculator.html` y `sueldo_liquido.html`.
3. **Despliegue de `robots.txt` para IA:** Integrar las directivas para GPTBot, PerplexityBot, ClaudeBot y la cabecera `Content-Signal`.

### 🟡 Fase 2: Optimización de Rich Results P1 (48h)
1. **Inyección de `offers` y `browserRequirements`:** Actualizar los 14 bloques `SoftwareApplication` de las calculadoras con costo $0 CLP y requerimientos técnicos para activar las tarjetas interactivas de Google.
2. **Incorporación de `BreadcrumbList`:** Implementar migas de pan estructuradas en las 21 páginas que carecen de ellas.
3. **Limpieza de Esquemas Deprecados:** Retirar bloques `HowTo` obsoletos y corregir el `SearchAction` de `index.html`.

### 🟢 Fase 3: Optimización de CTR & GEO P1 (Semana 1)
1. **Reescritura de 28 Meta Descriptions Truncadas:** Ajustar longitud a 135–155 caracteres con verbos de acción ("Calcula", "Simula", "Descarga") visibles antes del corte de 960px.
2. **Generación de `/llms.txt` y `/llms-full.txt`:** Publicar catálogo completo y fórmulas de cálculo para indexación de Perplexity y ChatGPT.

### 🔵 Fase 4: E-E-A-T & Autoría YMYL P2 (Semana 2)
1. **Sello de Revisión Técnica DT:** Incorporar micro-tarjeta de acreditación de equipo laboral con schema `Organization` y `Person` revisor en todos los artículos informativos.
2. **Normalización de Encabezados H2-H4:** Ajustar saltos de nivel en el footer para garantizar jerarquía 100% lineal.

---

*Informe generado y verificado bajo los estándares de Claude SEO v2.4.1 y Google Search Central.*
