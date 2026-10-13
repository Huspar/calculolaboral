# Generador de liquidaciones de sueldo

Página: `/generador-liquidacion-sueldo` · Precio: $2.990 por liquidación (un trabajador, un mes) · Lanzado: 12-oct-2026 · Meses: enero a diciembre de 2026.

## Piezas
| Archivo | Qué hace |
| :--- | :--- |
| `js/liquidacion_parametros.js` | Vigencias del ingreso mínimo, topes imponibles (UF), jornada máxima legal y comisiones AFP; notas por mes; rango de meses (`PRIMER_MES`, `ULTIMO_MES`); respaldo de UF y UTM. |
| `js/liquidacion_valores.js` | Obtiene la UF del último día del mes y la UTM del mes desde la API (mindicador.cl y findic.cl a la vez, gana el primer valor válido), con control de rango, control cruzado con el respaldo, caché de meses cerrados y respaldo si las APIs fallan. |
| `js/liquidacion_engine.js` | Motor de cálculo puro (`calcular(datos, mes)`, con `datos.periodo`). Criterios documentados en su encabezado. |
| `js/liquidacion_app.js` | Interfaz: formulario, trabajadores y meses en `localStorage` (`cl_liq_v1`), estado de carga y errores de los valores del mes, vista previa con marca de agua, respaldo JSON, logo, cobro y desbloqueo. |
| `tools/test_liquidacion.js` | 32 casos: motor (cálculos a mano, enero a octubre, jornada de 44 y 42 horas, 11 años de cesantía), parámetros contra Previred y obtención de valores (API, respaldo, fallos). Ejecutar `node tools/test_liquidacion.js` antes de publicar cualquier cambio. |
| `tools/previred_indicadores.py` | Lee los indicadores mensuales de Previred (PDF) y muestra UF, topes, ingreso mínimo y tasas AFP. Se usa para armar una vigencia nueva. |
| `api/_flow.js` | Producto `liquidacion` (código `GL`, $2.990, desbloqueo de 48 h). |
| `js/checkout_consent.js` | `GA_ITEMS.liquidacion` para `view_item`, `begin_checkout`, `purchase` y `select_promotion`. |

## De dónde sale cada valor
| Valor | Fuente | Cuándo se actualiza |
| :--- | :--- | :--- |
| UF del último día del mes | API (SII) | Sola: se consulta al elegir el mes. La UF de fin de mes se publica alrededor del día 9 de ese mes. |
| UTM del mes | API (SII) | Sola. |
| Ingreso mínimo, topes de 90 y 135,2 UF, jornada máxima, comisiones AFP | `VIGENCIAS` en `liquidacion_parametros.js` | A mano, cuando cambian (2 o 3 veces al año). |
| Tramos del impuesto único | Calculados en el motor con la UTM del mes | Solos. |

Vigencias cargadas (fuente: indicadores previsionales de Previred, verificados el 12-oct-2026):
| Desde | Ingreso mínimo | Tope AFP / cesantía | Jornada máxima |
| :--- | ---: | :--- | ---: |
| ene-2026 | $539.000 | 89,9 UF / 135,1 UF | 44 h |
| feb-2026 | $539.000 | 90 UF / 135,2 UF | 44 h |
| abr-2026 | $539.000 | 90 UF / 135,2 UF | 44 h (cambia a 42 el 26-abr; nota en el mes) |
| may-2026 | $553.553 (con efecto retroactivo, publicado el 22-jun) | 90 UF / 135,2 UF | 42 h |

Las comisiones de las AFP no cambiaron entre enero y septiembre de 2026 (cargo del trabajador: Capital y Cuprum 11,44%, Habitat 11,27%, PlanVital 11,16%, Provida 11,45%, Modelo 10,58%, Uno 10,46%). El 0,1% adicional que Previred muestra como "cargo del empleador" no se descuenta al trabajador.

Los topes en pesos de los nueve meses (enero a septiembre) coinciden exactamente con los que publica Previred, y la UF y la UTM de la API coinciden con sus indicadores. Esa verificación está como prueba en `tools/test_liquidacion.js`.

Reglas de `liquidacion_valores.js`:
- Un valor de la API se acepta solo si pasa el control de rango (UF entre 30.000 y 70.000, UTM entre 50.000 y 150.000) y la fecha coincide.
- Si el mes tiene respaldo en `RESPALDO` y la API difiere, gana el respaldo y la liquidación muestra un aviso.
- Si las dos APIs fallan, se usa el respaldo con aviso; sin respaldo el mes no se puede emitir.
- Los meses cerrados quedan guardados en el navegador (`cl_liq_vals_AAAA-MM`) para que la misma liquidación dé siempre los mismos montos. Con valores de respaldo de emergencia no se guarda.
- La liquidación muestra la fuente de la UF y de la UTM.
- findic.cl no publica UF de fechas futuras; para el fin del mes en curso responde solo mindicador.cl, que a veces tarda más de 8 segundos (el tiempo límite es de 15 s).

## Reglas del motor que dependen del mes o del trabajador
- **Jornada máxima:** 44 horas hasta el 25-abr-2026 y 42 desde el 26-abr-2026 (Ley 21.561). Determina el valor de la hora extra y el ingreso mínimo proporcional de la jornada parcial. Si el trabajador tiene una jornada mayor al máximo del mes, se limita y se avisa.
- **Seguro de cesantía a los 11 años (art. 9 de la Ley 19.728):** el trabajador con contrato indefinido deja de cotizar (0,6%) cuando cumple 11 años con el mismo empleador; el empleador sigue aportando el 0,8% al Fondo Solidario. Se aplica si se indica la fecha de ingreso: sin descuento desde el mes siguiente al aniversario; en el mes del aniversario se mantiene el descuento y se avisa (criterio a confirmar con la AFC si hace falta el detalle de ese mes).
- **Ingreso mínimo de mayo de 2026:** rige desde las remuneraciones de mayo, con efecto retroactivo. El generador usa $553.553 desde mayo y lo explica en una nota del mes.

## Cobro
1. Antes de ir a Flow, la página guarda `cl_liq_pendiente` (trabajador, RUT y mes).
2. Al volver, `CLCheckout.unlockFromUrl('liquidacion')` valida la firma con `/api/unlock` y la página asocia la orden a ese RUT y mes en `cl_liq_pagos`.
3. Durante 48 horas se puede corregir y volver a descargar esa liquidación. Otro trabajador u otro mes vuelve a pedir pago.
4. El PDF se genera con la impresión del navegador ("Guardar como PDF"), igual que los otros generadores.

Los datos de trabajadores nunca se envían al servidor. Flow recibe solo el correo del comprador y la razón social.

## Mantenimiento
**Cada mes: nada.** Noviembre y diciembre se habilitan solos cuando se publique la UF del último día de cada mes (~9 de noviembre y ~9 de diciembre).

**Cuando cambien el ingreso mínimo, los topes, la jornada o la comisión de una AFP:** correr `python -I tools/previred_indicadores.py AAAA-MM` con el mes del cambio, agregar una vigencia nueva en `VIGENCIAS` (con `desde` = primer mes en que rige), correr `node tools/test_liquidacion.js` y subir la versión `?v=` de `liquidacion_parametros.js` en la página.

**Enero de 2027 (preparar con anticipación):**
- El ingreso mínimo se reajusta según el IPC acumulado entre el 1-may y el 31-dic-2026 (según la ley de reajuste de 2026): agregar la vigencia cuando se publique el monto.
- Los topes imponibles se actualizan cada febrero con una resolución de la Superintendencia de Pensiones (en enero rige el valor anterior).
- Para ofrecer 2027, ampliar `ULTIMO_MES` y agregar esas vigencias; antes confirmar las comisiones AFP vigentes.
- Mientras tanto, el Asistente Pyme (no este generador) sigue calculando los meses de 2027 con la última vigencia: `valores.crear({ extender: true })` usa `vigenciaEstimada`, con las tasas del empleador «por confirmar» y un aviso visible, hasta `ULTIMO_MES_EXTENDIDO` (12 meses después de `ULTIMO_MES`). Desde agosto de 2027 avisa además que el aporte del empleador de la Ley 21.735 sube a 4,25%. Al cargar las vigencias reales y ampliar `ULTIMO_MES`, los avisos desaparecen solos.

Los meses posteriores a la fecha `verificado` de la vigencia muestran un aviso para confirmar que esos valores no cambiaron (hoy: noviembre y diciembre de 2026).

Respaldo (`RESPALDO`): meses ya confirmados (enero a octubre de 2026). No es obligatorio agregar los nuevos; sirve de control cruzado y de plan B.

## Límites conocidos
- Sin semana corrida, subsidios por licencia ni asignación familiar por tramo (montos a mano).
- Tope imponible proporcional a los días trabajados en meses incompletos.
- Sin modo de trabajadora de casa particular (tiene reglas propias de seguro de cesantía y cotizaciones).
- No muestra los aportes del empleador (cotización adicional del 0,1% por AFP, SIS, seguro de cesantía del empleador): pendiente verificar si deben informarse en la liquidación.
- El desbloqueo se valida en el navegador: alguien con conocimientos técnicos podría saltarlo, igual que en los otros generadores.
