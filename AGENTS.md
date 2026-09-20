# Directrices Estrictas de Desarrollo: Cálculo Laboral Chile

Este archivo define las reglas obligatorias e innegociables para el desarrollo de cualquier página, herramienta, calculadora, simulador o artículo dentro de `calculolaboral.cl`. Todo agente, desarrollador o script debe cumplir estas directrices sin excepción.

---

## 1. REGLA DE ORO: Consistencia Invariable de Encabezado (Header) y Pie de Página (Footer)

> **ESTRICTO:** Ninguna página del sitio puede tener un encabezado o un pie de página con colores, tipografías, logotipos o estructuras distintas a la plantilla oficial de `index.html`. Está terminantemente prohibido utilizar fondos oscuros (`bg-slate-900` o similares) en el pie de página o inventar logotipos de texto plano (`CL`).

---

### A. Logotipo Oficial de la Marca (Innegociable)
El logotipo oficial está compuesto por un contenedor azul cielo con el **isotipo SVG de la balanza con monograma C y L**, acompañado del texto corporativo con "Cálculo" en gris oscuro y "Laboral" en azul:

```html
<a href="./" class="flex-shrink-0 flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity">
    <div class="w-8 h-8 rounded-lg bg-sky-500 flex items-center justify-center shadow-md shadow-sky-500/20 active:scale-95 transition-transform">
        <svg class="w-5 h-5 text-white" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
            <!-- Pedestal Base -->
            <path d="M30 84h40M38 79h24"></path>
            <!-- Vertical Pillar -->
            <path d="M50 22v57"></path>
            <!-- Center pointer tip -->
            <path d="M50 14l-2 4h4l-2-4v8"></path>
            <!-- Balance Beam -->
            <path d="M18 36c10-9 22-12 32-12s22 3 32 12"></path>
            <!-- Left Pan strings and dish -->
            <path d="M18 36l-8 18h16Z"></path>
            <path d="M10 54c0 3 3.5 5 8 5s8-2 8-5"></path>
            <!-- Right Pan strings and dish -->
            <path d="M82 36l-8 18h16Z"></path>
            <path d="M74 54c0 3 3.5 5 8 5s8-2 8-5"></path>
            <!-- Monogram C wrapping left side -->
            <path d="M41 43.5a10 10 0 1 0 0 20h6"></path>
            <!-- Monogram L wrapping right side -->
            <path d="M58 43.5v20h10"></path>
        </svg>
    </div>
    <span class="font-bold text-xl tracking-tight text-slate-900">Cálculo<span class="text-sky-500">Laboral</span></span>
</a>
```

---

### B. Encabezado Oficial (Header / Navbar)
* **Fondo y borde:** `bg-white border-b border-slate-200 shadow-sm sticky top-0 w-full z-50 no-print`
* **Contenedor:** `max-w-[1200px] mx-auto px-6 h-16`
* **Menú Desktop:**
  * Dropdown *Calculadoras*: Debe incluir todas las herramientas vigentes:
    * `simulador-despido-injustificado-chile` (Simulador Despido Injustificado)
    * `sueldo_liquido` (Sueldo Líquido)
    * `finiquito_calculator` (Finiquito)
    * `generador-finiquito-chile` (Generador Finiquito Word/PDF)
    * `calculadora-horas-extras` (Horas Extras)
    * `calculadora-sueldo-part-time` (Sueldo Part-Time)
    * `calculadora-vacaciones-proporcionales` (Vacaciones Proporcionales)
    * `calculadora-despido-articulo-160` (Despido Art. 160)
  * Dropdown *Guías*
  * Botón *Para Empleadores* (`bg-slate-100/90 text-slate-700`)
  * Enlaces *Blog* y *Contacto*
* **Menú Mobile:** Dropdown estándar con `<details class="md:hidden">` idéntico al de `index.html`.

---

### C. Barra de Indicadores Económicos Oficiales (Sub-header)
Toda página de calculadora o herramienta debe incluir la barra de indicadores micro-tarjetas con las clases de protección contra saltos de línea:
* **Clases:** `indicators-carousel sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-2.5`
* **Tarjetas:** `indicator-card bg-white border border-slate-200/90 rounded-xl py-2 px-3 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all`
* **Rótulos con no-wrap:** `block text-[9px] sm:text-[9.5px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5 leading-tight whitespace-nowrap`
* **CSS Responsive obligatorio:**
```css
@media (max-width: 639px) {
    .indicators-carousel {
        display: flex !important;
        overflow-x: auto !important;
        scroll-snap-type: x mandatory !important;
        -webkit-overflow-scrolling: touch !important;
        gap: 0.5rem !important;
    }
    .indicator-card {
        min-width: 125px !important;
        max-width: 125px !important;
        width: 125px !important;
        flex-shrink: 0 !important;
        scroll-snap-align: start !important;
    }
}
@media (min-width: 640px) and (max-width: 1023px) {
    .indicators-carousel {
        display: grid !important;
        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
        gap: 0.5rem !important;
    }
    .indicator-card {
        width: 100% !important;
        min-width: 0 !important;
        flex-shrink: 1 !important;
    }
}
@media (min-width: 1024px) {
    .indicators-carousel {
        display: grid !important;
        grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
        gap: 0.625rem !important;
    }
    .indicator-card {
        width: 100% !important;
        min-width: 0 !important;
        flex-shrink: 1 !important;
    }
}
```

---

### D. Pie de Página Oficial (Footer Blanco Invariable)
* **Fondo:** `bg-white border-t border-slate-200 pt-16 pb-12 mt-auto no-print` (¡NUNCA OSCURO!)
* **Estructura:** Cuadrícula de 4 columnas (`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10`):
  1. **Columna Marca:** Logotipo oficial SVG + Breve descripción + Versión (`Versión 2.0.0 (2026)`).
  2. **Columna Calculadoras:** Lista completa de enlaces a calculadoras y simuladores.
  3. **Columna Guías Populares:** Lista completa de enlaces a las guías pilares del sitio.
  4. **Columna Sobre el Sitio:** Enlaces institucionales (Para Empleadores, Kit Blindaje, Sobre Nosotros, Contacto, Términos, Privacidad, Disclaimer).
* **Barra Inferior:** `max-w-[1200px] mx-auto px-6 border-t border-slate-200 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left` con leyenda legal oficial y sello de verificación `DT Chile Conforme`.

---

## 2. Directrices de Estilo Visual (Taste & Design System)
1. **Tipografía:**
   * Textos generales, títulos y botones: `font-sans` (**Geist** o **Inter**).
   * Valores monetarios, porcentajes, fechas y cifras matemáticas: `font-mono` (**Geist Mono**) para alineación y legibilidad financiera.
2. **Paleta de Colores:**
   * **Base:** `bg-slate-50` para el fondo del body y `bg-white` para las tarjetas.
   * **Bordes:** `border-slate-200/90` o `border-slate-200`.
   * **Texto principal:** `text-slate-900` para títulos principales y `text-slate-700` / `text-slate-600` para textos secundarios.
   * **Acentos principales:** `bg-sky-500` / `text-sky-500` para acciones primarias.
   * **Alertas y Riesgo:** `bg-rose-50` / `border-rose-200` / `text-rose-600` para advertencias laborales, nulidad de despido y demandas.
   * **Validación y Éxito:** `bg-emerald-50` / `text-emerald-700` para certificaciones DT y confirmaciones.
3. **Contraste Accesible:** Todo botón o enlace con fondo de color (`bg-sky-500`, `bg-rose-600`, `bg-slate-900`, `bg-emerald-600`) DEBE incluir explícitamente `!text-white` o `style="color: #ffffff !important;"` para evitar texto oscuro ilegible.

---

## 3. Checklist Pre-Despliegue para Nuevas Páginas
Antes de dar por terminada la creación de cualquier página o herramienta:
- [ ] ¿El header tiene el logotipo oficial con el SVG de la balanza?
- [ ] ¿El header es de fondo blanco y contiene la navegación oficial?
- [ ] ¿La barra de indicadores tiene `whitespace-nowrap` y CSS responsive de 1 fila en mobile?
- [ ] ¿El footer es de fondo blanco (`bg-white border-t border-slate-200`) con las 4 columnas oficiales?
- [ ] ¿Los botones de pago Flow.cl (`$12.990` y `$19.990`) tienen los tokens vigentes?
- [ ] ¿Se añadió la página a `sitemap.xml` con su respectiva prioridad?
- [ ] ¿Se verificó en vista desktop (1200px) y móvil (390px)?
