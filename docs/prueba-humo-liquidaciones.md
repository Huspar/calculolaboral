# Prueba de interés: generador de liquidaciones para pymes

**Inicio:** el día que se publique en producción. **Revisión:** 14 días después.

## Qué se prueba
Si hay empleadores dispuestos a pagar **$2.990 por liquidación** por un generador que arma la liquidación de sueldo en PDF con los datos de la empresa y del trabajador. El producto **no existe**: la página lo dice antes del botón y no cobra nada.

## Piezas
- `/generador-liquidacion-sueldo`: página de prueba (`noindex`, fuera del sitemap). Botón "Quiero usarlo" y formulario opcional de correo.
- Entradas: bloque en `/liquidacion-de-sueldo#formato` (`guia-formato`) y enlace bajo el resultado de `/sueldo_liquido` (`empleadores-bajo-resultado`).
- `js/prueba_liquidacion.js`: eventos GA4 y envío del correo.
- `api/send-lead.js`: tipo `InteresProducto` con su correo de confirmación ("te avisaremos si lo lanzamos").

## Cómo medir (GA4, excluyendo tráfico interno)
| Paso | Evento | Filtro |
| :--- | :--- | :--- |
| Ven el bloque y entran | `select_promotion` | `promotion_id = liquidacion-pyme`, por `creative_slot` |
| Visitan la página | `page_view` | ruta `/generador-liquidacion-sueldo` |
| Pulsan "Quiero usarlo" | `interes_producto` | `producto = liquidacion-pyme` |
| Dejan el correo | `generate_lead` | `lead_type = Interes_LiquidacionPyme` (también llega el aviso por correo) |

## Criterio de decisión (sugerido)
- **Construir:** 10 o más clics en "Quiero usarlo" y 3 o más correos en 14 días.
- **Descartar:** menos de 5 clics en "Quiero usarlo".
- **Entre medio:** extender 14 días más o probar otro precio.

## Al terminar
Si se descarta: borrar la página, el script, los dos enlaces y el tipo `InteresProducto`. A quien dejó su correo se le escribe solo si el generador se lanza.
