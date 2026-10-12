# Generador de liquidaciones de sueldo

Página: `/generador-liquidacion-sueldo` · Precio: $2.990 por liquidación (un trabajador, un mes) · Lanzado: 12-oct-2026.

## Piezas
| Archivo | Qué hace |
| :--- | :--- |
| `js/liquidacion_parametros.js` | Vigencias del ingreso mínimo, topes imponibles (UF) y comisiones AFP; rango de meses ofrecidos (`PRIMER_MES`, `ULTIMO_MES`); respaldo de UF y UTM confirmados en el SII. |
| `js/liquidacion_valores.js` | Obtiene la UF del último día del mes y la UTM del mes desde la API (mindicador.cl y findic.cl a la vez, gana el primer valor válido), con control de rango, control cruzado con el respaldo, caché de meses cerrados y respaldo si las APIs fallan. |
| `js/liquidacion_engine.js` | Motor de cálculo puro (`calcular(datos, mes)`). Criterios documentados en su encabezado. |
| `js/liquidacion_app.js` | Interfaz: formulario, trabajadores y meses en `localStorage` (`cl_liq_v1`), estado de carga y errores de los valores del mes, vista previa con marca de agua, respaldo JSON, logo, cobro y desbloqueo. |
| `tools/test_liquidacion.js` | 7 casos del motor calculados a mano y 14 casos de obtención de valores (API, respaldo, fallos). Ejecutar `node tools/test_liquidacion.js` antes de publicar cualquier cambio. |
| `api/_flow.js` | Producto `liquidacion` (código `GL`, $2.990, desbloqueo de 48 h). |
| `js/checkout_consent.js` | `GA_ITEMS.liquidacion` para `view_item`, `begin_checkout`, `purchase` y `select_promotion`. |

## De dónde sale cada valor
| Valor | Fuente | Cuándo se actualiza |
| :--- | :--- | :--- |
| UF del último día del mes | API (SII) | Solo: se consulta al elegir el mes. La UF de fin de mes se publica alrededor del día 9 de ese mes. |
| UTM del mes | API (SII) | Solo. |
| Ingreso mínimo, topes de 90 y 135,2 UF, comisiones AFP | `VIGENCIAS` en `liquidacion_parametros.js` | A mano, cuando cambian (2 o 3 veces al año). |
| Tramos del impuesto único | Calculados en el motor con la UTM del mes | Solos. |

Reglas de `liquidacion_valores.js`:
- Un valor de la API se acepta solo si pasa el control de rango (UF entre 30.000 y 70.000, UTM entre 50.000 y 150.000) y la fecha coincide.
- Si el mes tiene respaldo en `RESPALDO` y la API difiere, gana el respaldo (SII) y la liquidación muestra un aviso.
- Si las dos APIs fallan, se usa el respaldo con aviso; sin respaldo el mes no se puede emitir.
- Los meses cerrados quedan guardados en el navegador (`cl_liq_vals_AAAA-MM`) para que la misma liquidación dé siempre los mismos montos. Con valores de respaldo de emergencia no se guarda.
- La liquidación muestra la fuente de la UF y de la UTM.
- findic.cl no publica UF de fechas futuras; para el fin del mes en curso responde solo mindicador.cl, que a veces tarda más de 8 segundos (el tiempo límite es de 15 s).

## Cobro
1. Antes de ir a Flow, la página guarda `cl_liq_pendiente` (trabajador, RUT y mes).
2. Al volver, `CLCheckout.unlockFromUrl('liquidacion')` valida la firma con `/api/unlock` y la página asocia la orden a ese RUT y mes en `cl_liq_pagos`.
3. Durante 48 horas se puede corregir y volver a descargar esa liquidación. Otro trabajador u otro mes vuelve a pedir pago.
4. El PDF se genera con la impresión del navegador ("Guardar como PDF"), igual que los otros generadores.

Los datos de trabajadores nunca se envían al servidor. Flow recibe solo el correo del comprador y la razón social.

## Mantenimiento
**Cada mes: nada.** Noviembre se habilita solo cuando se publique la UF del 30 de noviembre (~9 de noviembre).

**Cuando cambien el ingreso mínimo, los topes o la comisión de una AFP:** agregar una vigencia nueva en `VIGENCIAS` (con `desde` = primer mes en que rige y su fuente), correr `node tools/test_liquidacion.js` y subir la versión `?v=` de `liquidacion_parametros.js` en la página.

**Para ofrecer más meses:** ampliar `ULTIMO_MES` (hacia adelante) o bajar `PRIMER_MES` (hacia atrás). Antes confirmar que las vigencias de esos meses son correctas: para enero a abril de 2026 hay que verificar el ingreso mínimo anterior a mayo, la comisión de cada AFP y el tope de enero (89,9 UF).
Los meses posteriores a la fecha `verificado` de la vigencia muestran un aviso para confirmar que esos valores no cambiaron (hoy: noviembre y diciembre de 2026).

Respaldo (`RESPALDO`): los meses ya confirmados en el SII. No es obligatorio agregar los nuevos; sirve de control cruzado y de plan B.

## Límites conocidos
- Sin semana corrida, subsidios por licencia ni asignación familiar por tramo (montos a mano).
- Tope imponible proporcional a los días trabajados en meses incompletos.
- No muestra los aportes del empleador (cotización adicional de la reforma de pensiones, SIS, seguro de cesantía del empleador): pendiente verificar si deben informarse en la liquidación.
- El desbloqueo se valida en el navegador: alguien con conocimientos técnicos podría saltarlo, igual que en los otros generadores.
