# Regla de Consistencia UI: Header y Footer Estándar

Toda página HTML del proyecto `calculolaboral.cl` debe implementar de forma exacta e inalterada el encabezado (Header con logo SVG oficial de balanza) y el pie de página (Footer curvado verde de 4 columnas) definidos en `AGENTS.md` e `index.html`.

### Puntos Críticos Obligatorios:
1. **Logo Oficial:** SVG de balanza con monograma C y L. En el header, contenedor verde bosque `#00382E` con isotipo ámbar `#FFB703`; en el footer, contenedor ámbar con isotipo verde. Texto `CálculoLaboral`. Nunca usar texto plano `CL`.
2. **Encabezado Universal:** Contenedor `max-w-[1200px]`, dropdown de Calculadoras (8 accesos), dropdown de Guías (16 guías), botón "Para Empleadores", Blog, Contacto y menú móvil `<details>`.
3. **Color Footer:** Siempre el footer curvado `.teal-footer-curve` con fondo verde bosque `#00382E` y texto blanco, idéntico al de `index.html`. Prohibido `bg-slate-900` y el footer blanco antiguo.
4. **Footer:** 4 columnas equilibradas (Marca, Calculadoras, Guías Clave, Para Empresas) y barra horizontal inferior con Términos, Privacidad, Disclaimer y DT Conforme.
5. **Indicadores:** Carousel con `whitespace-nowrap` en etiquetas.
