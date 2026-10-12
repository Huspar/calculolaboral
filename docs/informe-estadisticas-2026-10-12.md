# Informe de estadísticas: Search Console y Google Analytics (GA4)

**Sitio:** calculolaboral.cl · **Preparado:** 12 de octubre de 2026
**Ventana analizada:** últimas dos semanas, comparadas con las dos semanas anteriores. Donde la herramienta solo entrega 28 días (páginas, consultas, canales), se usa esa ventana y se compara con los 28 días anteriores.
**Fuentes:** Search Console (solo Google) y GA4 (todas las fuentes), consultados con OpenRush.

> **Fechas efectivas.** Search Console llega hasta el 9-oct (retraso de 2 a 3 días; los últimos días son preliminares). GA4 llega hasta el 11-oct. Por eso las dos semanas son: Search Console 28-sep → 9-oct frente a 14-sep → 25-sep (12 días cada una), y GA4 28-sep → 10-oct frente a 15-sep → 27-sep (13 días cada una).

---

## 1. Resumen ejecutivo

1. **El sitio crece con fuerza.** En 28 días Search Console registra 931 clics (+143% frente a los 28 días previos) y 75.930 impresiones (+66%). La posición media mejoró de 8,3 a 7,2.
2. **Las dos últimas semanas siguen la misma tendencia.** Clics de Google +43% (362 → 517) e impresiones +66% (27.221 → 45.159). Las sesiones de GA4 suben +78% (1.079 → 1.921).
3. **El CTR de Google baja** (1,33% → 1,14%) porque las impresiones crecen más que los clics. La causa principal es una sola página: `/ley-40-horas-chile-2026` tiene el 53% de las impresiones del sitio pero solo el 22% de los clics.
4. **Bing y Yahoo ya pesan más que Google en sesiones.** Bing orgánico (1.038) y Yahoo (unos 400) suman cerca de 1.440 sesiones, frente a 1.222 de Google orgánico. Hoy no hay forma de medir Bing en Search Console, porque no está configurado Bing Webmaster Tools.
5. **Hay "ruido" que infla las cifras de GA4.** El tráfico Directo (333 sesiones) es en su mayoría pruebas propias (44%) y bots de centros de datos de Singapur, EE. UU. y China (32%). Las 350 sesiones `(not set)` son personas reales (Chile, computador, desde buscadores) que vuelven a una pestaña antigua: no suman usuarios (ver 3.5).
6. **Los cambios de la auditoría (publicados el 9 de octubre) todavía no se pueden evaluar.** Los datos de Search Console llegan solo hasta el 9-oct. La primera lectura útil es hacia el 5 de noviembre.

---

## 2. Search Console (Google)

### 2.1 Totales

| Período | Clics | Impresiones | CTR | Posición |
| :--- | ---: | ---: | ---: | ---: |
| 28 días (14-sep → 11-oct) | 931 | 75.930 | 1,23% | 7,16 |
| 28 días previos (17-ago → 13-sep) | 383 | 45.637 | 0,84% | 8,34 |
| **Cambio** | **+143%** | **+66%** | **+0,39 pp** | **1,2 puestos mejor** |

Las cifras de clics e impresiones previas se obtienen restando el cambio informado por Search Console al valor actual de la vista por páginas (920 clics, 73.105 impresiones).

### 2.2 Dos semanas contra dos semanas

| Ventana (12 días) | Clics | Impresiones | CTR | Posición |
| :--- | ---: | ---: | ---: | ---: |
| 14-sep → 25-sep | 362 | 27.221 | 1,33% | 7,44 |
| 28-sep → 9-oct | 517 | 45.159 | 1,14% | 7,00 |
| **Cambio** | **+43%** | **+66%** | **−0,19 pp** | **0,4 puestos mejor** |

**Lectura:** el sitio gana visibilidad más rápido de lo que gana clics. La posición mejora, pero buena parte de las impresiones nuevas son consultas con poca intención de clic (ver sección 2.4).

### 2.3 Patrón diario

- Los días de semana rinden entre 16 y 66 clics (los mejores, de 55 a 66); los fines de semana, entre 6 y 33. Es el patrón normal de un sitio laboral.
- **Días de mayor tráfico:** 5-oct (66 clics, 5.002 impresiones), 8-oct (66) y 7-oct (63). El 5-oct coincide con la publicación de las páginas de liquidación de sueldo, impuesto único y gratificación.
- **Días con CTR muy bajo:** 1-oct (0,48%) y 4-oct (0,48%). Hubo muchas impresiones y pocos clics, típico de aumentos de impresiones en consultas informativas.
- **Dos saltos de posición** (25-sep: 10,6 y 9-oct: 10,8, este último preliminar) son picos aislados de mezcla de consultas, no un cambio sostenido: los días vecinos están en torno a 6,5.

### 2.4 Páginas (28 días, con cambio frente al período anterior)

| Página | Clics | Impresiones | CTR | Posición | Observación |
| :--- | ---: | ---: | ---: | ---: | :--- |
| `/` (inicio) | 474 | 17.538 | 2,70% | 7,9 | +302 clics. Es el 51% de los clics; gran parte son búsquedas de marca. |
| `/ley-40-horas-chile-2026` | 203 | 38.675 | **0,52%** | 5,2 | La mayor oportunidad de CTR (ver 2.6). |
| `/liquidacion-de-sueldo` | 52 | 599 | **8,68%** | 7,1 | Página nueva (5-oct) con muy buen CTR. |
| `/calculadora-sueldo-part-time` | 40 | 1.892 | 2,11% | 6,8 | |
| `/fondos-generacionales-afp-chile` | 24 | 847 | 2,83% | 5,6 | +17 clics. |
| `/finiquito_calculator` | 23 | 3.428 | 0,67% | 8,4 | Mejoró 4,1 puestos; sin cambio en clics. |
| `/calculadora-costo-empresa-chile` | 19 | 784 | 2,42% | 5,3 | |
| `/calculadora-vacaciones` | 17 | 1.094 | 1,55% | 9,1 | |
| `/sueldo_liquido` | 17 | 2.394 | 0,71% | 18,1 | Mejoró 11,9 puestos (venía de la posición 30). |
| `/guia-vacaciones-proporcionales` | 7 | 1.528 | 0,46% | 8,3 | Ya redirige a `/calculadora-vacaciones` (301); Google aún la muestra. |
| `/como-calcular-sueldo-liquido-paso-a-paso` | 3 | 616 | 0,49% | **39,6** | Muy abajo. |

Nota: `/guia-vacaciones-proporcionales` y `/como-leer-liquidacion-de-sueldo` aparecen en Search Console pero ya redirigen (301); sus datos se irán trasladando a los destinos.

### 2.5 Consultas principales (28 días)

Las 30 consultas principales suman solo 108 de los 931 clics (12%): la mayor parte del tráfico está en consultas poco frecuentes que Search Console no desglosa. Las más visibles:

| Consulta | Clics | Impresiones | CTR | Posición |
| :--- | ---: | ---: | ---: | ---: |
| calculadora finiquito | 13 | 557 | 2,3% | 9,0 |
| calculadora laboral (marca) | 12 | 53 | 22,6% | 1,8 |
| calculadora de finiquito | 11 | 605 | 1,8% | 9,8 |
| simulador cálculo de finiquito | 6 | 154 | 3,9% | 8,2 |
| simulador de finiquito | 5 | 703 | 0,7% | 9,4 |
| a cuánto está la hora de trabajo en chile | 2 | 535 | 0,4% | 4,4 |
| valor hora de trabajo en chile 2026 | 3 | 216 | 1,4% | 3,2 |

**Familia "finiquito"** (calculadora, simulador, calcular): suma más de 2.500 impresiones entre las posiciones 8 y 12. Es el grupo con más margen de subida en la primera página de resultados.

**Familia "liquidación de sueldo"** (plantilla, formato Excel, calcular días trabajados): pocas impresiones pero CTR de 10% a 44%. Es tráfico muy cualificado que confirma el acierto de `/liquidacion-de-sueldo`.

### 2.6 Oportunidades

1. **`/ley-40-horas-chile-2026`: CTR de 0,52% con posición 5,2.** Tiene 38.675 impresiones en 28 días. Las consultas ("a cuánto está la hora de trabajo", "valor hora de trabajo") piden una cifra. **Corrección:** el título y la descripción ya muestran el valor de la hora ($3.075) desde el 5-oct (commit `9658bf2`). Desde ese cambio el CTR de la página pasó de 0,50% (14-sep → 4-oct) a 0,59% (5 → 9-oct) y la posición mejoró de 5,5 a 4,7; son solo 5 días de datos, así que conviene esperar antes de tocarla de nuevo. Si el CTR llegara a 1,5%, serían unos 380 clics más cada 28 días.
2. **Familia "finiquito".** Está en las posiciones 8 a 12. Mover esas consultas a la posición 3 a 5 es la mayor ganancia posible del sitio. **No tocar `/finiquito_calculator` hasta el 5 de noviembre** (congelación de 6 a 8 semanas acordada para ver el efecto de los cambios anteriores).
3. **Móvil.** El 69% de las impresiones es móvil pero con CTR de 0,87% (escritorio: 2,03%) y mejor posición (6,1 frente a 9,5). El problema es el fragmento que se muestra, no el ranking.
4. **`/sueldo_liquido`** mejoró 12 puestos y sigue en la 18: aún no recibe clics relevantes. `/como-calcular-sueldo-liquido-paso-a-paso` está en la posición 40.

### 2.7 Dispositivos y países

| | Clics | Impresiones | CTR | Posición |
| :--- | ---: | ---: | ---: | ---: |
| Escritorio | 473 | 23.273 | 2,03% | 9,5 |
| Móvil | 454 | 52.456 | 0,87% | 6,1 |
| Tableta | 4 | 201 | 1,99% | 6,9 |

Chile concentra el 99% de los clics (917 de 926). Colombia, Perú, EE. UU., Brasil y Alemania aportan entre 1 y 3 clics cada uno.

---

## 3. Google Analytics (GA4)

### 3.1 Totales

| Período | Sesiones | Usuarios | Sesiones con interacción | Tasa de interacción | Páginas vistas |
| :--- | ---: | ---: | ---: | ---: | ---: |
| 28 días (15-sep → 12-oct) | 3.101 | 2.299 | 1.866 | 60,2% | 5.128 |
| 28 días previos | 1.704 | 1.317 | 997 | 58,5% | 2.068 |
| **Cambio** | **+82%** | **+75%** | **+87%** | **+1,7 pp** | **+148%** |

Tiempo medio de interacción: 98 segundos (+1,9 s). Páginas por sesión: 1,65.

### 3.2 Dos semanas contra dos semanas

| Ventana (13 días) | Sesiones | Usuarios | Tasa de interacción | Páginas vistas |
| :--- | ---: | ---: | ---: | ---: |
| 15-sep → 27-sep | 1.079 | 904 | 65,2% | 1.379 |
| 28-sep → 10-oct | 1.921 | 1.627 | 59,4% | 3.695 |
| **Cambio** | **+78%** | **+80%** | **−5,8 pp** | **+168%** |

**Atención:** las páginas vistas crecen más que las sesiones por tres días con muchas páginas por sesión (30-sep: 575; 1-oct: 672; 8-oct: 689). Son días de auditoría y pruebas del sitio, no de usuarios reales. La baja de la tasa de interacción también se debe en parte a ese ruido.

### 3.3 Canales y fuentes (28 días)

| Fuente / medio | Sesiones | Tasa de interacción | Observación |
| :--- | ---: | ---: | :--- |
| google / organic | 1.222 | 62% | |
| **bing / organic** | **1.038** | **68%** | Casi igual a Google. Mejor interacción. |
| cl.search.yahoo.com / referral | 358 | 67% | Yahoo (resultados con motor Bing). |
| (direct) / (none) | 333 | **34%** | 5,5 páginas por sesión: sospechoso (ver 3.5). |
| yahoo / organic y otros Yahoo | 40 | | |
| duckduckgo, ecosia | 22 | | |
| google / cpc | 9 | 0% | 9 sesiones, ninguna con interacción. |
| chatgpt.com / ai-assistant | 3 | | |
| Referral (otros sitios) | 5 | | |

- **Orgánico total:** 2.684 sesiones (+69%), el 87% del tráfico.
- **Asistentes de IA:** solo 4 sesiones en 28 días (3 de chatgpt.com). Hoy no es un canal relevante, por lo que el bloqueo parcial de bots de IA tiene un costo muy bajo.
- **Pago:** 9 sesiones `google / cpc` sin ninguna interacción. Si no hay campañas activas, es tráfico residual; conviene revisarlo.

### 3.4 Páginas de entrada (28 días)

| Página | Sesiones | Cambio | Interacción | Observación |
| :--- | ---: | ---: | ---: | :--- |
| `/` | 653 | +364 | 69% | |
| `/calculadora-horas-extras` | 367 | −45 | 75% | Casi no recibe clics de Google (4): su tráfico viene de Bing y Yahoo. |
| `(not set)` | **350** | +148 | 13% | Sesiones sin página de entrada: ruido de medición. |
| `/ley-40-horas-chile-2026` | 288 | +48 | 50% | La interacción más baja de las páginas grandes. |
| `/calculadora-sueldo-part-time` | 169 | +106 | 75% | |
| `/fondos-generacionales-afp-chile` | 151 | +121 | 72% | |
| `/finiquito_calculator` | 136 | −3 | 76% | 163 s de interacción: la más comprometida. |
| `/liquidacion-de-sueldo` | 106 | nueva | 80% | |
| `/calculadora-vacaciones` | 87 | | 76% | |
| `/aguinaldo-fiestas-patrias-chile-2026` | 78 | +66 | 67% | Tráfico estacional. |
| `/sueldo_liquido` | 61 | +41 | 46% | Interacción baja y 76 s: revisar la experiencia. |
| `/calculadora-costo-empresa-chile` | 48 | | 42% | Interacción baja. |
| `/guia-vacaciones-proporcionales` | 46 | −74 | 87% | Cayó por la redirección a la calculadora. |
| `/carta-de-despido-chile` | 30 | −25 | 67% | En descenso. |

### 3.5 Calidad de los datos (revisión del 12-oct)

**Tráfico "Directo" (333 sesiones, 5,5 páginas por sesión, 34% de interacción).** No es tráfico de personas; se reparte así (estimación):

| Origen | Sesiones | Cómo se reconoce |
| :--- | ---: | :--- |
| **Pruebas y auditorías propias** | unas 146 (44%) | 90% de las páginas vistas son de Santiago y Windows. Tres días concentran 1.408 de las 1.827 páginas vistas: 30-sep (384), 1-oct (544) y 8-oct (480). Entran por `/index.html` (18 sesiones y 744 páginas vistas, 41 por sesión) y por direcciones con `.html`, que ninguna persona usa. |
| **Bots desde centros de datos** | unas 105 (32%) | Singapur (40), EE. UU. (41, en Council Bluffs, Ashburn, Boardman, San José y Des Moines, ciudades de nubes de Google y Amazon), China (18) e India (3). Casi sin interacción (0 a 27%) y 0,7 segundos de tiempo medio en Singapur. |
| **Personas reales** | unas 80 (25%) | Visitas que escriben la dirección, usan un favorito o llegan por mensajes (WhatsApp). |

**Sesiones sin página de entrada `(not set)` (350, el 11%).** Corrección a lo dicho antes: **no son rastreadores**. Son personas reales:
- El 99% es de Chile y el 95% en computador (Chrome 51%, Edge 46%).
- Llegan por Bing (163), Google (104) y Yahoo (71): vienen de buscadores.
- **Ningún usuario nuevo** (0 de 350) y 0 páginas vistas: son sesiones que GA4 abre sin registrar la página, típicamente cuando alguien vuelve a una pestaña que dejó abierta más de 30 minutos. No son visitantes adicionales: son los mismos usuarios contados otra vez.
- Cantidad estable desde el 15-sep (5 a 37 por día), así que **no la causó** el cambio del 9-oct (Analytics ahora carga en reposo).
- Efecto: suben las sesiones en un 11% y bajan la tasa de interacción (87% de rebote), pero no cambian los usuarios.

**Qué hacer**
1. Tus visitas ya se marcan como internas (`?interno=1`) y el filtro está en Pruebas: pasarlo a Activo cuando confirmes que funciona.
2. Las auditorías automáticas (rastreos, capturas) deben entrar con el modo interno activado, o se repetirán los días de 400 a 500 páginas vistas.
3. Bots: son el 3% de las sesiones. Si molestan, una regla de Cloudflare con "desafío administrado" para Singapur y China (el sitio es solo para Chile). No bloquear EE. UU., porque Googlebot y Bingbot salen de ahí.
4. Al analizar, ignorar `(not set)` y mirar los usuarios, no las sesiones.

### 3.6 Dispositivos

| | Sesiones | Interacción | Tiempo medio |
| :--- | ---: | ---: | ---: |
| Escritorio | 2.217 (71%) | 65% | 112 s |
| Móvil | 809 (26%) | **51%** | 69 s |
| Tableta | 14 | 21% | 35 s |

Móvil tiene 14 puntos menos de interacción y casi la mitad de tiempo. Los arreglos móviles publicados el 9-oct (franja superior en una fila, objetivos táctiles, barra de resultados que no tapa el pie) apuntan a esto. Se podrá evaluar en el próximo informe.

---

## 4. Lo que estas cifras no dicen

- **Ventas y conversiones.** La herramienta de analítica no entrega eventos ni compras, así que este informe no cubre `begin_checkout` ni `purchase` de los kits y generadores. Para eso hay que mirar GA4 directamente o los registros de Vercel (`[VENTA]`).
- **Efecto de la auditoría.** Los cambios se publicaron el 9-oct y Search Console llega hasta ese día. Es demasiado pronto para atribuir efectos.
- **Bing.** Aporta tanto tráfico como Google, pero no hay datos de consultas, posiciones ni indexación.

---

## 5. Acciones recomendadas (por prioridad)

| # | Acción | Efecto esperado |
| :-: | :--- | :--- |
| 1 | **No reescribir todavía** `/ley-40-horas-chile-2026`: el título ya muestra el valor de la hora desde el 5-oct. Medir hasta el 5 de noviembre y, si el CTR sigue bajo 1%, probar otro ángulo (por ejemplo, la tabla de valor hora por jornada). | Subir el CTR de 0,5-0,6% hacia 1,5%: unos 380 clics más cada 28 días. |
| 2 | Configurar **Bing Webmaster Tools** (verificar el dominio, enviar el sitemap y activar IndexNow). | Medir y mejorar más de la mitad (53%) del tráfico orgánico, que hoy no se ve. |
| 3 | En GA4, crear el filtro de tráfico interno y revisar `(not set)` y el tráfico directo anómalo. | Cifras confiables para decidir. |
| 4 | **Esperar al 5 de noviembre** antes de tocar `/finiquito_calculator` y revisar la familia "finiquito" (posiciones 8 a 12). | Evita mezclar efectos; es la mayor ganancia de posición posible. |
| 5 | Revisar `/sueldo_liquido`, `/calculadora-costo-empresa-chile` y `/ley-40-horas-chile-2026` (interacción de 42% a 50%). | Mejor experiencia y señales de calidad. |
| 6 | Mejorar el fragmento móvil (título y descripción cortos con la respuesta) en las páginas con más impresiones. | Acercar el CTR móvil (0,87%) al de escritorio (2,03%). |
| 7 | Confirmar si hay campañas activas de `google / cpc` (9 sesiones sin interacción). | Evitar gasto sin retorno o limpiar un resto de etiquetas. |
| 8 | Repetir este informe el **5 de noviembre**, ya con datos posteriores a los cambios del 9-oct, y revisar los títulos modificados: `/sueldo_liquido`, `/mejores-cuentas-para-recibir-sueldo-chile-2026`, `/para-empleadores`, la guía Ley Karin y la guía de la Ley 21.719. | Medir el efecto real de la auditoría. |

---

*Notas metodológicas.* Los clics de Search Console no equivalen a las sesiones de GA4 (Search Console solo cubre Google; GA4 incluye Bing, Yahoo y tráfico directo). Los valores de las ventanas de 12 y 13 días se calcularon sumando las cifras diarias; la posición se pondera por impresiones. Los últimos 2 a 3 días de cada fuente son preliminares.
