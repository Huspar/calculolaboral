# Directrices Estrictas de Desarrollo: Cálculo Laboral Chile

Este archivo define las reglas obligatorias e innegociables para el desarrollo de cualquier página, herramienta, calculadora, simulador o artículo dentro de `calculolaboral.cl`. Todo agente, desarrollador o script debe cumplir estas directrices sin excepción.

---

## 1. REGLA DE ORO: Consistencia Invariable de Encabezado (Header) y Pie de Página (Footer)

> **ESTRICTO:** Ninguna página del sitio puede tener un encabezado o un pie de página con colores, tipografías, logotipos o estructuras distintas a la plantilla oficial de `index.html`. Está terminantemente prohibido utilizar fondos oscuros genéricos (`bg-slate-900` o similares) en el pie de página, inventar logotipos de texto plano (`CL`) o usar un color de marca distinto del verde bosque `#00382E` y el ámbar `#FFB703`.

---

### A. Logotipo Oficial de la Marca (Innegociable - Paleta Oficial Opción 1)
El logotipo oficial está compuesto por un emblema de alto contraste con el **isotipo SVG de la balanza con monograma C y L**:
- **En Encabezado (Header/Navbar):** Contenedor verde bosque profundo (`#00382E`) de `w-9 h-9 rounded-xl`, isotipo SVG en ámbar dorado cálido (`#FFB703`), con tipografía corporativa "Cálculo" en gris oscuro (`text-slate-900`) y "Laboral" en verde bosque (`color: #00382E`).
- **En Pie de Página (Footer Curvado TealHQ):** Contenedor en ámbar dorado cálido (`#FFB703`) de `w-9 h-9 rounded-xl`, isotipo SVG en verde bosque profundo (`#00382E`), con tipografía corporativa "Cálculo" en blanco (`text-white`) y "Laboral" en ámbar dorado (`color: #FFB703`).

#### Versión Header (Navbar Oficial):
```html
<a href="./" class="flex-shrink-0 flex items-center gap-2.5 cursor-pointer hover:opacity-90 transition-opacity">
    <div class="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm active:scale-95 transition-transform shrink-0" style="background-color: #00382E;">
        <svg class="w-5 h-5" style="color: #FFB703;" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
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
    <span class="font-bold text-xl tracking-tight text-slate-900">Cálculo<span style="color: #00382E;">Laboral</span></span>
</a>
```

#### Versión Footer (.teal-footer-curve Oficial):
```html
<a href="./" class="flex items-center gap-2.5 cursor-pointer hover:opacity-90 transition-opacity">
    <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm" style="background-color: #FFB703;">
        <svg class="w-5 h-5" style="color: #00382E;" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
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
    <span class="font-bold text-xl tracking-tight text-white leading-none">Cálculo<span style="color: #FFB703;">Laboral</span></span>
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

### D. Pie de Página Oficial (Footer Curvado Verde Bosque, Invariable)
> **Fuente de verdad: `index.html` (producción).** Este bloque reemplaza la versión anterior de footer blanco con logo `bg-sky-500`, que ya no se usa en el sitio.

* **Contenedor:** `<footer class="no-print mt-16">` con un `div.teal-footer-curve` interno. La clase `.teal-footer-curve` (definida en el CSS de cada página) aplica `background-color: #00382E`, texto blanco y `border-top-left-radius` y `border-top-right-radius` de 40px.
* **Logo del footer:** contenedor ámbar `#FFB703`, isotipo `#00382E`, "Cálculo" en blanco y "Laboral" en `#FFB703` (ver sección 1.A).
* **Estructura:** cuadrícula de 4 columnas (`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4`): Marca, Calculadoras (6 enlaces), Guías Legales (5 enlaces + "Ver todas las guías →") y Para Empresas (6 enlaces).
* **Enlaces:** `text-white/80` con `hover:text-[#FFB703]`; enlaces destacados en `text-white` o `text-[#FFB703]`.
* **Barra inferior:** `border-t border-white/10`, con leyenda legal, Términos, Privacidad, Disclaimer y el sello `Fórmulas Conforme a DT` en `text-emerald-400`.
* **Prohibido:** fondos `bg-slate-900` u otros oscuros distintos a `#00382E`, y el footer blanco antiguo. Copiar siempre el bloque de `index.html`.

```html
    <footer class="no-print mt-16">
        <div class="teal-footer-curve">
            <div class="footer-inner-container site-container max-w-[1240px] mx-auto px-6 sm:px-8 py-12 md:py-16">

                <!-- Main Grid 4 Columns -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-10 lg:gap-8 text-left">

                    <!-- Col 1: Brand & Description -->
                    <div class="space-y-4">
                        <a href="./" class="flex items-center gap-2.5 cursor-pointer hover:opacity-90 transition-opacity">
                            <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm" style="background-color: #FFB703;">
                                <svg class="w-5 h-5" style="color: #00382E;" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
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
                            <span class="font-bold text-xl tracking-tight text-white leading-none">Cálculo<span style="color: #FFB703;">Laboral</span></span>
                        </a>
                        <p class="text-xs text-white/75 leading-relaxed max-w-xs">
                            Plataforma independiente con herramientas laborales y simuladores legales actualizados para trabajadores y pymes en Chile (2026).
                        </p>
                        <div class="pt-1 text-[11px] font-mono-num text-white/50">
                            Versión 2.5 · Actualizada Marzo 2026
                        </div>
                    </div>

                    <!-- Col 2: Calculadoras -->
                    <div class="space-y-3">
                        <p class="text-xs font-bold text-white/60 uppercase tracking-wider mb-0">Calculadoras</p>
                        <ul class="space-y-2 text-xs">
                            <li><a href="finiquito_calculator" class="text-white hover:text-[#FFB703] font-bold transition-colors">Finiquito Legal</a></li>
                            <li><a href="simulador-despido-injustificado-chile" class="text-white/80 hover:text-[#FFB703] transition-colors">Despido Injustificado</a></li>
                            <li><a href="sueldo_liquido" class="text-white/80 hover:text-[#FFB703] transition-colors">Sueldo Líquido</a></li>
                            <li><a href="calculadora-horas-extras" class="text-white/80 hover:text-[#FFB703] transition-colors">Horas Extras 42h</a></li>
                            <li><a href="calculadora-vacaciones-proporcionales" class="text-white/80 hover:text-[#FFB703] transition-colors">Vacaciones Proporcionales</a></li>
                            <li><a href="calculadora-sueldo-part-time" class="text-white/80 hover:text-[#FFB703] transition-colors">Sueldo Part-Time</a></li>
                        </ul>
                    </div>

                    <!-- Col 3: Guías Legales -->
                    <div class="space-y-3">
                        <p class="text-xs font-bold text-white/60 uppercase tracking-wider mb-0">Guías Legales</p>
                        <ul class="space-y-2 text-xs">
                            <li><a href="reclamar-despido-injustificado-chile" class="text-white/80 hover:text-[#FFB703] transition-colors">Cómo Reclamar Despido</a></li>
                            <li><a href="carta-de-renuncia-chile" class="text-white/80 hover:text-[#FFB703] transition-colors">Carta de Renuncia</a></li>
                            <li><a href="despido-necesidades-empresa-articulo-161" class="text-white/80 hover:text-[#FFB703] transition-colors">Art. 161 Necesidades</a></li>
                            <li><a href="checklist-fiscalizacion-dt-pymes-chile" class="text-white/80 hover:text-[#FFB703] transition-colors">Checklist Fiscalización DT</a></li>
                            <li><a href="ley-40-horas-chile-2026" class="text-white/80 hover:text-[#FFB703] transition-colors">Ley 40 Horas</a></li>
                            <li><a href="blog" class="text-[#FFB703] hover:underline font-semibold block pt-1">Ver todas las guías →</a></li>
                        </ul>
                    </div>

                    <!-- Col 4: Para Empresas -->
                    <div class="space-y-3">
                        <p class="text-xs font-bold text-white/60 uppercase tracking-wider mb-0">Para Empresas</p>
                        <ul class="space-y-2 text-xs">
                            <li><a href="para-empleadores" class="text-white/80 hover:text-[#FFB703] transition-colors">Portal Empleadores</a></li>
                            <li><a href="kit-cumplimiento-ley-datos-personales-chile" class="text-white/80 hover:text-[#FFB703] transition-colors">Kit Ley 21.719 Datos</a></li>
                            <li><a href="kit-cumplimiento-laboral-pymes" class="text-white/80 hover:text-[#FFB703] transition-colors">Kit Blindaje Laboral</a></li>
                            <li><a href="generador-finiquito-chile" class="text-white/80 hover:text-[#FFB703] transition-colors">Generador Finiquito</a></li>
                            <li><a href="sobre-nosotros" class="text-white/80 hover:text-[#FFB703] transition-colors">Sobre Nosotros</a></li>
                            <li><a href="contacto" class="text-white/80 hover:text-[#FFB703] transition-colors">Contacto Directo</a></li>
                        </ul>
                    </div>

                </div>

                <!-- Bottom Bar -->
                <div class="pt-8 mt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-white/50 text-center md:text-left">
                    <div>
                        &copy; 2026 Cálculo Laboral Chile. Fórmulas conformes al Código del Trabajo y dictámenes de la Dirección del Trabajo.
                    </div>
                    <div class="flex flex-wrap items-center justify-center gap-4">
                        <a href="terminos" class="hover:text-white transition-colors">Términos</a>
                        <span>·</span>
                        <a href="privacidad" class="hover:text-white transition-colors">Privacidad</a>
                        <span>·</span>
                        <a href="disclaimer" class="hover:text-white transition-colors">Disclaimer</a>
                        <span>·</span>
                        <span class="inline-flex items-center gap-1 text-emerald-400 font-medium">
                            <span class="material-icons text-xs" aria-hidden="true">verified</span>
                            Fórmulas Conforme a DT
                        </span>
                    </div>
                </div>

            </div>
        </div>
    </footer>
```

---

## 2. Directrices de Estilo Visual (Taste & Design System)
1. **Tipografía:**
   * Textos generales, títulos y botones: `font-sans` (**Geist** o **Inter**).
   * Valores monetarios, porcentajes, fechas y cifras matemáticas: `font-mono` (**Geist Mono**) para alineación y legibilidad financiera.
2. **Paleta de Colores:**
   * **Marca:** verde bosque `#00382E` (hover `#002820`, deep `#00261F`) y ámbar `#FFB703`. Definidos como `--teal-forest`, `--teal-yellow` y relacionados en `index.html`.
   * **Base:** `#FFFFFF` para el fondo del body (con bandas `#F4F7F6`) y `bg-white` para las tarjetas.
   * **Bordes:** `border-slate-200/90` o `border-slate-200`.
   * **Texto principal:** `text-slate-900` para títulos principales y `text-slate-700` / `text-slate-600` para textos secundarios.
   * **Acentos:** el verde bosque es el color de marca. `text-sky-500` / `text-sky-600` queda solo para enlaces y acciones secundarias, no para el logo ni el footer.
   * **Alertas y Riesgo:** `bg-rose-50` / `border-rose-200` / `text-rose-600` para advertencias laborales, nulidad de despido y demandas.
   * **Validación y Éxito:** `bg-emerald-50` / `text-emerald-700` para certificaciones DT y confirmaciones.
3. **Contraste Accesible:** Todo botón o enlace con fondo de color (`bg-sky-500`, `bg-rose-600`, `bg-slate-900`, `bg-emerald-600`) DEBE incluir explícitamente `!text-white` o `style="color: #ffffff !important;"` para evitar texto oscuro ilegible.

---

## 3. Checklist Pre-Despliegue para Nuevas Páginas
Antes de dar por terminada la creación de cualquier página o herramienta:
- [ ] ¿El header tiene el logotipo oficial con el SVG de la balanza?
- [ ] ¿El header es de fondo blanco y contiene la navegación oficial?
- [ ] ¿La barra de indicadores tiene `whitespace-nowrap` y CSS responsive de 1 fila en mobile?
- [ ] ¿El footer es el curvado verde `.teal-footer-curve` (`#00382E`) idéntico al de `index.html`, con las 4 columnas oficiales?
- [ ] ¿Los botones de pago Flow.cl (`$12.990`, `$19.990` y `$29.990`) tienen los tokens vigentes?
- [ ] ¿Se añadió la página a `sitemap.xml` con su respectiva prioridad?
- [ ] ¿Se verificó en vista desktop (1200px) y móvil (390px)?
