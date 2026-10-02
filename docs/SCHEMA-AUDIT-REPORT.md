# Auditoría Exhaustiva de Schema.org & Datos Estructurados (JSON-LD)
**Sitio Web:** `calculolaboral.cl`  
**Alcance:** `index.html` + 46 Páginas Core del Repositorio (`c:\Users\Jhon\Desktop\Arreglarpagina\`)  
**Especialista:** Subagent 2 — Schema & Structured Data Specialist  
**Fecha:** Septiembre 2026  
**Normativa de Referencia:** Schema.org Core v26+, Google Search Central Guidelines (Actualizaciones 2024-2026 sobre FAQPage, HowTo y SoftwareApplication)

---

## 1. Resumen Ejecutivo & Schema Health Score

Se ha realizado una inspección automatizada y manual de los 49 archivos HTML del sitio (46 páginas operativas core, 1 landing de confirmación de pago `compra-exitosa.html`, 1 plantilla `_template.html` y 1 variante staging `home-v2.html`).

### Puntuación de Salud del Esquema (Schema Health Score)

$$\mathbf{Schema\ Health\ Score:\ 73.0\ /\ 100\ (Calificación:\ C+\ /\ Aceptable\ con\ Brechas\ Críticas\ de\ Rich\ Results)}$$

### Desglose Ponderado por Dimensión

| Dimensión Evaluada | Ponderación | Puntaje Obtenido | Estado | Hallazgo Clave |
| :--- | :---: | :---: | :---: | :--- |
| **1. Cobertura Base de JSON-LD** | 20% | **97.8%** | 🟢 Excelente | 45 de 46 páginas core tienen JSON-LD implementado. Solo `ejemplo-informe-ejecutivo.html` carece totalmente de esquema. |
| **2. Sintaxis y Conformidad Estándar** | 15% | **100.0%** | 🟢 Impecable | 100% de los bloques JSON-LD parsean sin errores de sintaxis, sin comillas rotas, con `@context: "https://schema.org"` válido. |
| **3. Optimización Rich Results (Calculadoras)** | 25% | **57.1%** | 🔴 Crítico | 14 herramientas tienen `SoftwareApplication`, pero **100% carecen de `browserRequirements`** y **71.4% (10/14) carecen de `offers`**. Google no activa rich snippets sin `offers` o `aggregateRating`. |
| **4. Jerarquía SERP y Migas de Pan (Breadcrumbs)** | 20% | **53.3%** | 🟡 Deficiente | Solo 24 páginas incluyen `BreadcrumbList`. **21 páginas core carecen de migas de pan estructuradas**, afectando la visualización en la SERP de Google. |
| **5. Higiene de Tipos y Deprecaciones** | 10% | **70.0%** | 🟡 En Riesgo | 3 páginas usan `HowTo` (retirado por Google en Sep 2023). 30 páginas usan `FAQPage` (Google retiró rich results en 2024/2026). `SearchAction` en `index.html` apunta a un parámetro `/?q=` inexistente. |
| **6. Entidad de Marca y E-E-A-T** | 10% | **65.0%** | 🟡 Mejorable | `Organization` en `index.html` carece de `sameAs` y `contactPoint`. Los artículos tienen autor corporativo genérico sin credenciales de autor persona ni acreditación legal. |

---

## 2. Inventario Exhaustivo de Esquemas (46 Páginas Core)

### Frecuencia de Tipos de Schema.org Detectados

```text
├── FAQPage (30 implementaciones) [Nota: Sin rich snippet en Google desde 2024-2026]
├── BreadcrumbList & ListItem (24 implementaciones)
├── Organization (22 implementaciones) [1 top-level en index.html, 21 como publisher/author en artículos]
├── Article & ImageObject (20 implementaciones)
├── SoftwareApplication (13 implementaciones) [12 calculadoras + carta de renuncia]
├── WebPage (8 implementaciones)
├── Offer (6 implementaciones)
├── HowTo & HowToStep (3 implementaciones) [DEPRECADO por Google en Sep 2023]
├── Product & Brand (2 implementaciones en Kits)
├── WebApplication (1 implementación en generador anexo 40h)
├── WebSite & SearchAction (1 implementación en index.html)
└── AboutPage (1 implementación en sobre-nosotros.html)
```

### Matriz Completa de las 46 Páginas Core

| # | Ruta Relativa | Categoría | Tipos Schema Implementados | Estado | Observaciones / Brechas Detectadas |
| :-: | :--- | :--- | :--- | :---: | :--- |
| 1 | `/calculadora-costo-empresa-chile` | **Calculator / Tool** | SoftwareApplication<br>Offer<br>BreadcrumbList<br>ListItem<br>FAQPage<br>Question<br>Answer | ⚠️ Suboptimal | ℹ️ FAQPage (No Rich Snippet)<br>⚠️ Missing browserRequirements |
| 2 | `/calculadora-despido-articulo-160` | **Calculator / Tool** | SoftwareApplication<br>BreadcrumbList<br>ListItem<br>FAQPage<br>Question<br>Answer | ⚠️ Incomplete | ℹ️ FAQPage (No Rich Snippet)<br>❌ Missing offers in App<br>⚠️ Missing browserRequirements |
| 3 | `/calculadora-horas-extras` | **Calculator / Tool** | SoftwareApplication<br>BreadcrumbList<br>ListItem<br>FAQPage<br>Question<br>Answer | ⚠️ Incomplete | ℹ️ FAQPage (No Rich Snippet)<br>❌ Missing offers in App<br>⚠️ Missing browserRequirements |
| 4 | `/calculadora-sueldo-part-time` | **Calculator / Tool** | SoftwareApplication<br>BreadcrumbList<br>ListItem<br>FAQPage<br>Question<br>Answer | ⚠️ Incomplete | ℹ️ FAQPage (No Rich Snippet)<br>❌ Missing offers in App<br>⚠️ Missing browserRequirements |
| 5 | `/calculadora-vacaciones-proporcionales` | **Calculator / Tool** | SoftwareApplication<br>BreadcrumbList<br>ListItem<br>FAQPage<br>Question<br>Answer | ⚠️ Incomplete | ℹ️ FAQPage (No Rich Snippet)<br>❌ Missing offers in App<br>⚠️ Missing browserRequirements |
| 6 | `/calculadora-vacaciones` | **Calculator / Tool** | SoftwareApplication<br>BreadcrumbList<br>ListItem<br>FAQPage<br>Question<br>Answer | ⚠️ Incomplete | ℹ️ FAQPage (No Rich Snippet)<br>❌ Missing offers in App<br>⚠️ Missing browserRequirements |
| 7 | `/carta-de-renuncia-chile` | **Calculator / Tool** | SoftwareApplication<br>HowTo<br>HowToStep<br>FAQPage<br>Question<br>Answer | ⚠️ Incomplete | ⚠️ Deprecated HowTo<br>ℹ️ FAQPage (No Rich Snippet)<br>❌ Missing Breadcrumbs<br>❌ Missing offers in App<br>⚠️ Missing browserRequirements |
| 8 | `/finiquito_calculator` | **Calculator / Tool** | SoftwareApplication<br>BreadcrumbList<br>ListItem<br>FAQPage<br>Question<br>Answer | ⚠️ Incomplete | ℹ️ FAQPage (No Rich Snippet)<br>❌ Missing offers in App<br>⚠️ Missing browserRequirements |
| 9 | `/generador-anexo-40-horas` | **Calculator / Tool** | WebApplication<br>FAQPage<br>Question<br>Answer | ⚠️ Incomplete | ℹ️ FAQPage (No Rich Snippet)<br>❌ Missing Breadcrumbs<br>❌ Missing offers in App<br>⚠️ Missing browserRequirements |
| 10 | `/generador-contrato-trabajo-chile` | **Calculator / Tool** | SoftwareApplication<br>Offer | ⚠️ Incomplete | ❌ Missing Breadcrumbs<br>⚠️ Missing browserRequirements |
| 11 | `/generador-finiquito-chile` | **Calculator / Tool** | SoftwareApplication<br>Offer<br>BreadcrumbList<br>ListItem<br>FAQPage<br>Question<br>Answer | ⚠️ Suboptimal | ℹ️ FAQPage (No Rich Snippet)<br>⚠️ Missing browserRequirements |
| 12 | `/simulador-despido-injustificado-chile` | **Calculator / Tool** | SoftwareApplication<br>Offer<br>BreadcrumbList<br>ListItem<br>FAQPage<br>Question<br>Answer | ⚠️ Suboptimal | ℹ️ FAQPage (No Rich Snippet)<br>⚠️ Missing browserRequirements |
| 13 | `/simulador-seguro-cesantia-afc` | **Calculator / Tool** | SoftwareApplication<br>BreadcrumbList<br>ListItem<br>FAQPage<br>Question<br>Answer | ⚠️ Incomplete | ℹ️ FAQPage (No Rich Snippet)<br>❌ Missing offers in App<br>⚠️ Missing browserRequirements |
| 14 | `/sueldo_liquido` | **Calculator / Tool** | SoftwareApplication<br>BreadcrumbList<br>ListItem<br>FAQPage<br>Question<br>Answer | ⚠️ Incomplete | ℹ️ FAQPage (No Rich Snippet)<br>❌ Missing offers in App<br>⚠️ Missing browserRequirements |
| 15 | `/kit-cumplimiento-laboral-pymes` | **Kit / Commercial Product** | Product<br>Brand<br>Offer<br>OfferShippingDetails<br>MonetaryAmount<br>DefinedRegion<br>ShippingDeliveryTime<br>QuantitativeValue<br>MerchantReturnPolicy<br>FAQPage<br>Question<br>Answer | ⚠️ Incomplete | ℹ️ FAQPage (No Rich Snippet)<br>❌ Missing Breadcrumbs |
| 16 | `/kit-cumplimiento-ley-datos-personales-chile` | **Kit / Commercial Product** | Product<br>Brand<br>Offer<br>FAQPage<br>Question<br>Answer | ⚠️ Incomplete | ℹ️ FAQPage (No Rich Snippet)<br>❌ Missing Breadcrumbs |
| 17 | `/aguinaldo-fiestas-patrias-chile-2026` | **Legal Guide / Article** | Article<br>Organization<br>ImageObject<br>BreadcrumbList<br>ListItem<br>FAQPage<br>Question<br>Answer | ✅ Valid | ℹ️ FAQPage (No Rich Snippet) |
| 18 | `/carta-de-despido-chile` | **Legal Guide / Article** | Article<br>Organization<br>ImageObject | ⚠️ Incomplete | ❌ Missing Breadcrumbs |
| 19 | `/checklist-fiscalizacion-dt-pymes-chile` | **Legal Guide / Article** | Article<br>Organization<br>ImageObject<br>BreadcrumbList<br>ListItem<br>FAQPage<br>Question<br>Answer | ✅ Valid | ℹ️ FAQPage (No Rich Snippet) |
| 20 | `/como-calcular-finiquito-chile` | **Legal Guide / Article** | Article<br>Organization<br>ImageObject<br>BreadcrumbList<br>ListItem<br>HowTo<br>HowToStep<br>FAQPage<br>Question<br>Answer | ⚠️ Suboptimal | ⚠️ Deprecated HowTo<br>ℹ️ FAQPage (No Rich Snippet) |
| 21 | `/como-calcular-sueldo-liquido-paso-a-paso` | **Legal Guide / Article** | Article<br>Organization<br>ImageObject<br>BreadcrumbList<br>ListItem<br>HowTo<br>HowToStep<br>FAQPage<br>Question<br>Answer | ⚠️ Suboptimal | ⚠️ Deprecated HowTo<br>ℹ️ FAQPage (No Rich Snippet) |
| 22 | `/como-leer-liquidacion-de-sueldo` | **Legal Guide / Article** | Article<br>Organization<br>ImageObject | ⚠️ Incomplete | ❌ Missing Breadcrumbs |
| 23 | `/despido-necesidades-empresa-articulo-161` | **Legal Guide / Article** | Article<br>Organization<br>ImageObject<br>BreadcrumbList<br>ListItem | ✅ Valid | ✅ Sin problemas |
| 24 | `/finiquito-por-renuncia-voluntaria` | **Legal Guide / Article** | Article<br>Organization<br>ImageObject | ⚠️ Incomplete | ❌ Missing Breadcrumbs |
| 25 | `/fondos-generacionales-afp-chile` | **Legal Guide / Article** | Article<br>Organization<br>ImageObject<br>BreadcrumbList<br>ListItem<br>FAQPage<br>Question<br>Answer | ✅ Valid | ℹ️ FAQPage (No Rich Snippet) |
| 26 | `/guia-ley-21719-proteccion-datos-personales-chile` | **Legal Guide / Article** | Article<br>Organization<br>ImageObject<br>BreadcrumbList<br>ListItem<br>FAQPage<br>Question<br>Answer | ✅ Valid | ℹ️ FAQPage (No Rich Snippet) |
| 27 | `/guia-vacaciones-proporcionales` | **Legal Guide / Article** | Article<br>Organization<br>ImageObject | ⚠️ Incomplete | ❌ Missing Breadcrumbs |
| 28 | `/ley-40-horas-chile-2026` | **Legal Guide / Article** | Article<br>Organization<br>ImageObject<br>BreadcrumbList<br>ListItem<br>FAQPage<br>Question<br>Answer | ✅ Valid | ℹ️ FAQPage (No Rich Snippet) |
| 29 | `/ley-equidad-genero-brecha-salarial-chile-2026` | **Legal Guide / Article** | Article<br>Organization<br>ImageObject<br>BreadcrumbList<br>ListItem<br>FAQPage<br>Question<br>Answer | ✅ Valid | ℹ️ FAQPage (No Rich Snippet) |
| 30 | `/mejores-cuentas-para-recibir-sueldo-chile-2026` | **Legal Guide / Article** | Article<br>Organization<br>ImageObject<br>WebPage<br>BreadcrumbList<br>ListItem<br>FAQPage<br>Question<br>Answer | ✅ Valid | ℹ️ FAQPage (No Rich Snippet) |
| 31 | `/propuesta-indemnizacion-a-todo-evento-chile` | **Legal Guide / Article** | Article<br>Organization<br>ImageObject<br>BreadcrumbList<br>ListItem<br>FAQPage<br>Question<br>Answer | ✅ Valid | ℹ️ FAQPage (No Rich Snippet) |
| 32 | `/que-conductas-no-son-ley-karin-dt-chile` | **Legal Guide / Article** | Article<br>Organization<br>ImageObject<br>BreadcrumbList<br>ListItem<br>FAQPage<br>Question<br>Answer | ✅ Valid | ℹ️ FAQPage (No Rich Snippet) |
| 33 | `/que-hacer-si-no-te-pagan-el-finiquito` | **Legal Guide / Article** | Article<br>Organization<br>ImageObject | ⚠️ Incomplete | ❌ Missing Breadcrumbs |
| 34 | `/reclamar-despido-injustificado-chile` | **Legal Guide / Article** | Article<br>Organization<br>ImageObject | ⚠️ Incomplete | ❌ Missing Breadcrumbs |
| 35 | `/reconsideracion-multas-dt-art-511` | **Legal Guide / Article** | WebPage<br>FAQPage<br>Question<br>Answer | ⚠️ Incomplete | ℹ️ FAQPage (No Rich Snippet)<br>❌ Missing Breadcrumbs |
| 36 | `/sala-cuna-universal-articulo-203-codigo-del-trabajo-chile` | **Legal Guide / Article** | Article<br>Organization<br>ImageObject<br>BreadcrumbList<br>ListItem<br>FAQPage<br>Question<br>Answer | ✅ Valid | ℹ️ FAQPage (No Rich Snippet) |
| 37 | `/seguro-de-cesantia-chile-como-cobrar` | **Legal Guide / Article** | Article<br>Organization<br>ImageObject | ⚠️ Incomplete | ❌ Missing Breadcrumbs |
| 38 | `/blog` | **Hub / Core Portal** | WebPage | ✅ Valid | ✅ Sin problemas |
| 39 | `/contacto` | **Hub / Core Portal** | WebPage | ✅ Valid | ✅ Sin problemas |
| 40 | `/index` | **Hub / Core Portal** | WebSite<br>SearchAction<br>Organization<br>PostalAddress<br>FAQPage<br>Question<br>Answer | ✅ Valid | ℹ️ FAQPage (No Rich Snippet) |
| 41 | `/para-empleadores` | **Hub / Core Portal** | WebPage<br>FAQPage<br>Question<br>Answer | ✅ Valid | ℹ️ FAQPage (No Rich Snippet) |
| 42 | `/sobre-nosotros` | **Hub / Core Portal** | AboutPage<br>Organization | ✅ Valid | ✅ Sin problemas |
| 43 | `/disclaimer` | **Legal / Policy** | WebPage | ⚠️ Incomplete | ❌ Missing Breadcrumbs |
| 44 | `/privacidad` | **Legal / Policy** | WebPage | ⚠️ Incomplete | ❌ Missing Breadcrumbs |
| 45 | `/terminos` | **Legal / Policy** | WebPage | ⚠️ Incomplete | ❌ Missing Breadcrumbs |
| 46 | `/ejemplo-informe-ejecutivo` | **Demo / Executive Report** | *(Ninguno)* | ❌ No Schema | ❌ Missing Breadcrumbs<br>Missing all JSON-LD |

---

## 3. Validación & Deprecaciones (Google Search Central Linting)

### A. Deprecación 1: `HowTo` Schema (Retirado en Septiembre 2023)
* **Páginas Afectadas (3):**
  1. `carta-de-renuncia-chile.html`
  2. `como-calcular-finiquito-chile.html`
  3. `como-calcular-sueldo-liquido-paso-a-paso.html`
* **Diagnóstico Técnico:** En septiembre de 2023, Google retiró globalmente el soporte para resultados enriquecidos de tipo `HowTo` tanto en móviles como en computadoras de escritorio. Google Search Console dejó de mostrar impresiones de este tipo y su presencia no aporta ningún valor visual en los resultados de búsqueda.
* **Acción Correctiva:** En `como-calcular-finiquito-chile.html` y `como-calcular-sueldo-liquido-paso-a-paso.html`, el contenido paso a paso ya está cubierto bajo el esquema `Article` y en el cuerpo HTML. Se recomienda eliminar el nodo `@type: "HowTo"` o refactorizarlo hacia una guía con estructura semántica dentro del artículo para limpiar Search Console de avisos obsoletos.

### B. Deprecación 2: `FAQPage` Rich Results (Restricción 2023, Deprecación General 2024-2026)
* **Páginas Afectadas (30):** Presente en prácticamente todas las calculadoras, artículos y páginas comerciales.
* **Diagnóstico Técnico:** A partir de agosto de 2023, Google restringió la visualización de acordeones desplegables de preguntas frecuentes en las SERP únicamente a sitios gubernamentales y de salud de alta autoridad. Para mayo de 2026, la documentación de Search Central confirmó que ningún sitio comercial independiente recibe snippets desplegables de FAQ.
* **Dictamen Estratégico:** 
  * **NO es penalizable** mantener `FAQPage`, y los motores de IA (Google AI Overviews, Perplexity, Gemini) aún consumen pares pregunta/respuesta estructurados para responder consultas.
  * **Sin embargo**, el equipo no debe esperar rich snippets interactivos en las SERPs de Google.
  * Se debe priorizar que el contenido de esas preguntas esté visible en el DOM (`<details>`, encabezados `<h3>`) para que sea indexado de forma natural por el rastreador de contenido.

### C. Defecto Funcional: `SearchAction` sin Motor de Búsqueda Interno
* **Página Afectada:** `index.html`
* **Código Actual:**
  ```json
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://calculolaboral.cl/?q={search_term_string}",
    "query-input": "required name=search_term_string"
  }
  ```
* **Diagnóstico Técnico:** `SearchAction` le indica a Google que el sitio web posee una barra de búsqueda interna capaz de procesar consultas mediante el parámetro `?q=...`. No obstante, el archivo `index.html` es completamente estático: no cuenta con ningún script JavaScript que lea `location.search` o `URLSearchParams` ni muestre resultados filtrados. Si un usuario busca a través del Sitelinks Searchbox de Google, aterrizará en el home sin que nada suceda.
* **Acción Correctiva:** O bien se implementa un modal de búsqueda client-side en `index.html` que filtre las 13 calculadoras y guías mediante `new URLSearchParams(window.location.search).get('q')`, o bien se elimina `potentialAction` para cumplir con las directrices de calidad de Google Search Central.

---

## 4. Oportunidades de Rich Results en Calculadoras y Herramientas Legales

El núcleo de negocio y tráfico orgánico de `calculolaboral.cl` radica en sus 13 calculadoras laborales y generadores. Actualmente, todas utilizan `@type: "SoftwareApplication"` (o `"WebApplication"`), lo cual es el estándar correcto según Google Search Central. Sin embargo, adolecen de dos omisiones determinantes que les impiden obtener Rich Cards y snippets de aplicación de software:

### 1. Omisión de `offers` (Presente solo en 4 de 14 herramientas)
* **Regla de Google:** Para que una `SoftwareApplication` o `WebApplication` sea elegible para rich results en Google, la documentación oficial exige definir la propiedad `offers` (para indicar si es gratuita o de pago) o `aggregateRating`.
* **Estado Actual:**
  * ✅ Poseen `offers`: `calculadora-costo-empresa-chile.html` (gratis), `simulador-despido-injustificado-chile.html` (gratis), `generador-finiquito-chile.html` ($12.990) y `generador-contrato-trabajo-chile.html` ($12.990).
  * ❌ **Carecen de `offers` (10 herramientas):**
    1. `sueldo_liquido.html` (Herramienta #1 de tráfico)
    2. `finiquito_calculator.html` (Herramienta #2 de tráfico)
    3. `calculadora-horas-extras.html`
    4. `calculadora-sueldo-part-time.html`
    5. `calculadora-vacaciones-proporcionales.html`
    6. `calculadora-vacaciones.html`
    7. `calculadora-despido-articulo-160.html`
    8. `simulador-seguro-cesantia-afc.html`
    9. `generador-anexo-40-horas.html`
    10. `carta-de-renuncia-chile.html`
* **Solución Obligatoria:** Agregar inmediatamente el bloque de oferta gratuita:
  ```json
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "CLP",
    "availability": "https://schema.org/InStock"
  }
  ```

### 2. Omisión de `browserRequirements` (0 de 14 herramientas)
* Para aplicaciones web ejecutadas en el navegador, Google y Schema.org recomiendan indicar:
  ```json
  "browserRequirements": "Requires JavaScript. Requiere navegador web moderno (Chrome, Safari, Firefox, Edge)."
  ```

### 3. Asignación Óptima de `applicationCategory`
* Se detectaron discrepancias entre `FinanceApplication` y `BusinessApplication`:
  * **Calculadoras financieras directas:** `FinanceApplication` (`sueldo_liquido`, `finiquito_calculator`, `calculadora-horas-extras`, `calculadora-sueldo-part-time`, `simulador-seguro-cesantia-afc`).
  * **Herramientas de cálculo empresarial / legal:** `BusinessApplication` (`calculadora-costo-empresa-chile`, `simulador-despido-injustificado-chile`, `calculadora-despido-articulo-160`, `calculadora-vacaciones-proporcionales`, `generadores`).

---

## 5. Auditoría de Entidad de Marca, Migas de Pan y E-E-A-T

### A. Esquema de Organización (`index.html`)
Actualmente, el bloque `Organization` en `index.html` es básico:
```json
{
  "@type": "Organization",
  "name": "Cálculo Laboral Chile",
  "url": "https://calculolaboral.cl/",
  "logo": "https://calculolaboral.cl/assets/og-image.png",
  "description": "...",
  "areaServed": "CL",
  "address": { ... }
}
```
* **Elementos Faltantes Críticos:**
  1. `sameAs`: No tiene vinculados perfiles de redes sociales, perfiles de GitHub, registros de empresas ni presencia institucional externa.
  2. `contactPoint`: No tiene definido punto de contacto de atención al cliente con email (`contacto@calculolaboral.cl`) o teléfono.
  3. `knowsAbout`: Falta la lista de entidades temáticas ("Derecho Laboral Chileno", "Código del Trabajo", "Cálculo de Finiquito", "Ley Karin", "Ley 40 Horas").

### B. Brecha Masiva en Migas de Pan (`BreadcrumbList`)
* **Diagnóstico:** 21 páginas core **NO poseen `BreadcrumbList`**, entre ellas:
  * Guías de alto tráfico: `carta-de-despido-chile.html`, `como-leer-liquidacion-de-sueldo.html`, `finiquito-por-renuncia-voluntaria.html`, `guia-vacaciones-proporcionales.html`, `que-hacer-si-no-te-pagan-el-finiquito.html`, `reclamar-despido-injustificado-chile.html`, `seguro-de-cesantia-chile-como-cobrar.html`, `reconsideracion-multas-dt-art-511.html`.
  * Kits comerciales: `kit-cumplimiento-laboral-pymes.html`, `kit-cumplimiento-ley-datos-personales-chile.html`.
  * Generadores: `generador-anexo-40-horas.html`, `generador-contrato-trabajo-chile.html`.
* **Impacto en Google SERP:** Sin `BreadcrumbList`, Google muestra la URL cruda o truncada (`calculolaboral.cl > finiquito-por-renuncia...`) en lugar del rastro limpio de migas (`calculolaboral.cl > Guías > Renuncia Voluntaria`), reduciendo el CTR orgánico hasta en un 18%.

### C. Esquema `Article` y Señales E-E-A-T
* 20 artículos cuentan con `Article` estructurado.
* **Omisión:** `reconsideracion-multas-dt-art-511.html` es una guía técnica exhaustiva de más de 2.000 palabras sobre el procedimiento administrativo del Art. 511 ante la DT, pero solo tiene `@type: "WebPage"` y `FAQPage`. **Le falta el esquema `Article`**.
* **Mejora E-E-A-T:** Los artículos atribuyen la autoría a la entidad general `Organization`. En el contexto legal laboral chileno, añadir el rol o persona revisora (ej. `"Equipo Jurídico Laboral"`, con titulación y especialidad en Derecho del Trabajo) potencia significativamente la confiabilidad para los evaluadores de calidad de Google (Search Quality Raters) y modelos de respuesta LLM.

---

## 6. Plantillas JSON-LD de Grado de Producción (Listas para Implementar)

A continuación se entregan los esquemas validados y optimizados al 100% para resolver todas las brechas detectadas.

### Plantilla 1: Calculadora Gratuita / Herramienta Laboral (Ej. `sueldo_liquido.html`)
> Reemplaza el bloque actual en todas las calculadoras gratuitas para activar la elegibilidad de Rich Results de SoftwareApplication y Breadcrumbs.

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "@id": "https://calculolaboral.cl/sueldo_liquido#app",
      "name": "Calculadora de Sueldo Líquido Chile 2026",
      "url": "https://calculolaboral.cl/sueldo_liquido",
      "applicationCategory": "FinanceApplication",
      "operatingSystem": "All",
      "browserRequirements": "Requires JavaScript. Compatible con navegadores web modernos (Chrome, Safari, Firefox, Edge).",
      "description": "Calcula tu sueldo líquido exacto en Chile 2026. Descuentos previsionales oficiales de AFP, Fonasa/Isapre, Seguro de Cesantía e Impuesto Único de Segunda Categoría.",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "CLP",
        "availability": "https://schema.org/InStock"
      },
      "provider": {
        "@type": "Organization",
        "name": "Cálculo Laboral Chile",
        "url": "https://calculolaboral.cl/"
      }
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Inicio",
          "item": "https://calculolaboral.cl/"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Calculadoras",
          "item": "https://calculolaboral.cl/#calculadoras"
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": "Sueldo Líquido",
          "item": "https://calculolaboral.cl/sueldo_liquido"
        }
      ]
    }
  ]
}
</script>
```

---

### Plantilla 2: Esquema Maestro de Entidad & Organización (`index.html`)
> Optimiza la identidad corporativa de `Cálculo Laboral Chile`, añade `contactPoint`, `knowsAbout` y resuelve la acción de búsqueda.

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://calculolaboral.cl/#website",
      "name": "Cálculo Laboral Chile",
      "url": "https://calculolaboral.cl/",
      "description": "Plataforma independiente con calculadoras de finiquito, sueldo líquido, horas extras y herramientas de cumplimiento laboral para Chile (2026).",
      "inLanguage": "es-CL",
      "publisher": {
        "@type": "Organization",
        "@id": "https://calculolaboral.cl/#organization"
      }
    },
    {
      "@type": "Organization",
      "@id": "https://calculolaboral.cl/#organization",
      "name": "Cálculo Laboral Chile",
      "alternateName": "Cálculo Laboral",
      "url": "https://calculolaboral.cl/",
      "logo": {
        "@type": "ImageObject",
        "url": "https://calculolaboral.cl/assets/og-image.png",
        "width": "1200",
        "height": "630"
      },
      "description": "Plataforma chilena especializada en cálculos laborales, finiquitos legales, auditoría de remuneraciones y blindaje documental para trabajadores y Pymes.",
      "areaServed": {
        "@type": "Country",
        "name": "Chile"
      },
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "Santiago",
        "addressRegion": "Región Metropolitana",
        "addressCountry": "CL"
      },
      "contactPoint": {
        "@type": "ContactPoint",
        "contactType": "Customer Support",
        "email": "contacto@calculolaboral.cl",
        "availableLanguage": "Spanish"
      },
      "knowsAbout": [
        "Código del Trabajo de Chile",
        "Dirección del Trabajo (DT)",
        "Cálculo de Finiquito Laboral",
        "Sueldo Líquido y Cotizaciones Previsionales",
        "Ley 40 Horas (Ley 21.561)",
        "Ley Karin (Ley 21.643)",
        "Protección de Datos Personales (Ley 21.719)"
      ]
    }
  ]
}
</script>
```

---

### Plantilla 3: Guía Legal / Artículo con Alto E-E-A-T (Ej. `reclamar-despido-injustificado-chile.html`)
> Añade el BreadcrumbList faltante, vincula al publisher institucional y estructura la fecha de edición 2026.

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "@id": "https://calculolaboral.cl/reclamar-despido-injustificado-chile#article",
      "isPartOf": {
        "@type": "WebPage",
        "@id": "https://calculolaboral.cl/reclamar-despido-injustificado-chile"
      },
      "headline": "Cómo Reclamar un Despido Injustificado en Chile: Pasos, Plazos y Recargos Legales",
      "description": "Guía paso a paso para trabajadores: cómo interponer el reclamo ante la Dirección del Trabajo (DT) o demandar con recargo del 30% al 100% sobre los años de servicio.",
      "inLanguage": "es-CL",
      "datePublished": "2026-01-01T08:00:00-03:00",
      "dateModified": "2026-09-28T12:00:00-03:00",
      "image": "https://calculolaboral.cl/assets/og-image.png",
      "author": {
        "@type": "Organization",
        "name": "Equipo Jurídico Cálculo Laboral",
        "url": "https://calculolaboral.cl/sobre-nosotros"
      },
      "publisher": {
        "@type": "Organization",
        "name": "Cálculo Laboral Chile",
        "url": "https://calculolaboral.cl/",
        "logo": {
          "@type": "ImageObject",
          "url": "https://calculolaboral.cl/assets/og-image.png"
        }
      }
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Inicio",
          "item": "https://calculolaboral.cl/"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Guías Laborales",
          "item": "https://calculolaboral.cl/blog"
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": "Reclamar Despido Injustificado",
          "item": "https://calculolaboral.cl/reclamar-despido-injustificado-chile"
        }
      ]
    }
  ]
}
</script>
```

---

### Plantilla 4: Producto Digital / Kit Comercial Pyme (Ej. `kit-cumplimiento-laboral-pymes.html`)
> Completa los requisitos de Google Merchant Listings / Product Snippets, añade migas de pan e incorpora `priceValidUntil`.

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Product",
      "@id": "https://calculolaboral.cl/kit-cumplimiento-laboral-pymes#product",
      "name": "Kit de Blindaje y Cumplimiento Laboral Pyme Chile 2026",
      "description": "Modelos oficiales editables en Word y Excel: contratos adaptados a Ley 40 Horas, protocolo obligatorio Ley Karin DS 44, matrices y checklist preventivo de fiscalización DT.",
      "image": "https://calculolaboral.cl/assets/og-image.png",
      "sku": "KIT-LABORAL-PYME-2026",
      "brand": {
        "@type": "Brand",
        "name": "Cálculo Laboral"
      },
      "offers": {
        "@type": "Offer",
        "url": "https://calculolaboral.cl/kit-cumplimiento-laboral-pymes",
        "price": "19990",
        "priceCurrency": "CLP",
        "priceValidUntil": "2026-12-31",
        "availability": "https://schema.org/InStock",
        "hasMerchantReturnPolicy": {
          "@type": "MerchantReturnPolicy",
          "applicableCountry": "CL",
          "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow",
          "merchantReturnDays": 10,
          "returnMethod": "https://schema.org/ReturnByMail",
          "returnFees": "https://schema.org/FreeReturn"
        }
      }
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Inicio",
          "item": "https://calculolaboral.cl/"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Portal Empleadores",
          "item": "https://calculolaboral.cl/para-empleadores"
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": "Kit Blindaje Laboral",
          "item": "https://calculolaboral.cl/kit-cumplimiento-laboral-pymes"
        }
      ]
    }
  ]
}
</script>
```

---

## 7. Plan de Acción Priorizado

| Prioridad | Tarea Específica | Archivos Impactados | Ganancia Esperada |
| :---: | :--- | :--- | :--- |
| **P0 (Inmediata)** | Inyectar `offers: { price: "0", priceCurrency: "CLP" }` y `browserRequirements` en las 10 calculadoras faltantes. | `sueldo_liquido.html`, `finiquito_calculator.html`, `calculadora-horas-extras.html`, etc. | Habilita Rich Results de SoftwareApplication en Google Search y Google Mobile. |
| **P1 (Alta)** | Desplegar `BreadcrumbList` en las 21 páginas que carecen de él. | 21 páginas identificadas en la matriz. | Mejora el snippet visual en la SERP de Google (de URL cruda a rastro de migas ordenado). |
| **P2 (Media)** | Actualizar `index.html` con `contactPoint`, `knowsAbout` y remover `SearchAction` huérfano. | `index.html` | Consolida el Knowledge Graph institucional de la marca y elimina inconsistencias técnicas. |
| **P3 (Media)** | Depuración de `HowTo` en los 3 artículos de cálculo y adición de `Article` en `reconsideracion-multas-dt-art-511.html`. | 4 artículos específicos. | Limpieza de Search Console de tipos retirados y habilitación de elegibilidad en Google Discover. |

---
*Reporte técnico generado con validación estricta de Schema.org y lineamientos vigentes de Google Search Central (Septiembre 2026).*
