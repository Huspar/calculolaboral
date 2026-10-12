# Prueba de interés: generador de liquidaciones para pymes

**Estado: terminada el 12-oct-2026, el mismo día que empezó.** El dueño del sitio decidió construir el generador sin esperar el resultado. La página de prueba se reemplazó por la herramienta real en `/generador-liquidacion-sueldo` (ver `docs/generador-liquidaciones.md`).

## Qué se había montado
- `/generador-liquidacion-sueldo` como página de prueba (`noindex`): describía el producto, decía que aún no existía y medía clics en "Quiero usarlo" y correos opcionales.
- Entradas desde `/liquidacion-de-sueldo#formato` y bajo el resultado de `/sueldo_liquido`.
- `js/prueba_liquidacion.js` y el tipo de lead `InteresProducto` en `api/send-lead.js`.

Todo eso se retiró al lanzar la herramienta. Los correos que alcanzaron a llegar como lead (si hay alguno) están en la casilla del dueño; escribirles para avisar del lanzamiento queda a su decisión.
