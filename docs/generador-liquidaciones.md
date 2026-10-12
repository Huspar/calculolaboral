# Generador de liquidaciones de sueldo

Página: `/generador-liquidacion-sueldo` · Precio: $2.990 por liquidación (un trabajador, un mes) · Lanzado: 12-oct-2026.

## Piezas
| Archivo | Qué hace |
| :--- | :--- |
| `js/liquidacion_parametros.js` | Valores oficiales por mes (UF al cierre, UTM, ingreso mínimo, topes, tasas AFP). Solo los meses de esta tabla aparecen en el generador. |
| `js/liquidacion_engine.js` | Motor de cálculo puro (`calcular(datos, mes)`). Criterios documentados en su encabezado. |
| `js/liquidacion_app.js` | Interfaz: formulario, trabajadores y meses en `localStorage` (`cl_liq_v1`), vista previa con marca de agua, respaldo JSON, logo, cobro y desbloqueo. |
| `tools/test_liquidacion.js` | Casos de referencia calculados a mano. Ejecutar `node tools/test_liquidacion.js` antes de publicar cualquier cambio del motor o de los parámetros. |
| `api/_flow.js` | Producto `liquidacion` (código `GL`, $2.990, desbloqueo de 48 h). |
| `js/checkout_consent.js` | `GA_ITEMS.liquidacion` para `view_item`, `begin_checkout`, `purchase` y `select_promotion`. |

## Cobro
1. Antes de ir a Flow, la página guarda `cl_liq_pendiente` (trabajador, RUT y mes).
2. Al volver, `CLCheckout.unlockFromUrl('liquidacion')` valida la firma con `/api/unlock` y la página asocia la orden a ese RUT y mes en `cl_liq_pagos`.
3. Durante 48 horas se puede corregir y volver a descargar esa liquidación. Otro trabajador u otro mes vuelve a pedir pago.
4. El PDF se genera con la impresión del navegador ("Guardar como PDF"), igual que los otros generadores.

Los datos de trabajadores nunca se envían al servidor. Flow recibe solo el correo del comprador y la razón social.

## Actualización mensual (obligatoria)
Cuando el SII publique la UF del último día del mes siguiente (alrededor del día 9), agregar el mes en `js/liquidacion_parametros.js`:
- `uf`: UF del último día del mes (sii.cl, valores y fechas, UF).
- `utm`: UTM del mes (sii.cl, UTM).
- `imm`, `topeAfpUF`, `topeAfcUF` y tasas `afp`: revisar si cambiaron (reajuste del ingreso mínimo, resoluciones de la Superintendencia de Pensiones, comisiones AFP).
- Correr `node tools/test_liquidacion.js` y subir la versión `?v=` del script en la página.

Noviembre de 2026 se puede agregar desde el ~9 de noviembre (UF al 30-nov).

## Límites conocidos (v1)
- Sin semana corrida, subsidios por licencia ni asignación familiar por tramo (montos a mano).
- Tope imponible proporcional a los días trabajados en meses incompletos.
- No muestra los aportes del empleador (cotización adicional de la reforma de pensiones, SIS, seguro de cesantía del empleador): pendiente verificar si deben informarse en la liquidación.
- El desbloqueo se valida en el navegador: alguien con conocimientos técnicos podría saltarlo, igual que en los otros generadores.
