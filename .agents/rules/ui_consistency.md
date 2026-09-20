# Regla de Consistencia UI: Header y Footer Estándar

Toda página HTML del proyecto `calculolaboral.cl` debe implementar de forma exacta e inalterada el encabezado (Header con logo SVG oficial de balanza) y el pie de página (Footer blanco compacto de 4 columnas) definidos en `AGENTS.md` e `index.html`.

### Puntos Críticos Obligatorios:
1. **Logo Oficial:** SVG de balanza con monograma C y L en contenedor azul `bg-sky-500` con `CálculoLaboral`. Nunca usar texto plano `CL`.
2. **Encabezado Universal:** Contenedor `max-w-[1200px]`, dropdown de Calculadoras (8 accesos), dropdown de Guías (16 guías), botón "Para Empleadores", Blog, Contacto y menú móvil `<details>`.
3. **Color Footer:** Siempre `bg-white border-t border-slate-200`. Prohibido el fondo oscuro `bg-slate-900`.
4. **Footer Compacto:** Altura optimizada `pt-10 pb-8`, 4 columnas equilibradas (Marca, Calculadoras, Guías Clave, Para Empresas) y barra horizontal inferior con Términos, Privacidad, Disclaimer y DT Conforme.
5. **Indicadores:** Carousel con `whitespace-nowrap` en etiquetas.
