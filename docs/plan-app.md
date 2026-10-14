# Plan: el Asistente Laboral Pyme como software en `/app`

13-oct-2026. Plan de diseño y funciones; todavía no se construye nada. Reemplaza el panel `asistente-pyme.html` (rama `claude/asistente-pyme-plan`, sin publicar). Producto y usuarios: `PRODUCT.md`. Marca y reglas visuales: `DESIGN.md` y `AGENTS.md`.

## 1. Para quién y para qué

- **Quién entra:** el dueño de una pyme de 1 a 5 trabajadores, en el computador, sobre todo a fin de mes. Sin formación laboral. A futuro, contadores con varias empresas (el diseño queda preparado, no se construye).
- **Modo:** operar. Lo que importa es que se vea qué falta, se haga rápido y no haya errores; la marca vive en los detalles, no en adornos.
- **Éxito:** cerrar el mes laboral desde una sola pantalla: liquidaciones preparadas, revisadas, emitidas e impresas, plazos a la vista y documentos emitidos sin volver a escribir datos.

## 2. Dirección elegida: «Cierre de mes»

La pantalla de Inicio es el **mes**: una grilla con cada trabajador y sus pasos del mes hasta cerrarlo. Elegida por el dueño en la página de decisiones (13-oct-2026) entre tres estructuras: «Ficha por persona», «Tablero de módulos» y «Cierre de mes».

Dos piezas tomadas de las otras estructuras (propuestas por Claude, el dueño puede quitarlas):

1. **De «Ficha por persona»:** la sección Trabajadores muestra la carpeta de cada persona con pestañas (Ficha, Liquidaciones, Vacaciones, Documentos).
2. **Del «Tablero de módulos»:** una franja delgada sobre la grilla con tres cifras útiles del mes.

Lo que este diseño rechaza: el tablero genérico de tarjetas con números y gráficos decorativos, los degradados, los íconos en cuadrados de color sobre cada título, los brillos y las tarjetas dentro de tarjetas. Es lo que hace que un software «se vea hecho por IA».

## 3. Marco de la aplicación (lo que se ve en todas las pantallas)

- **Sin el encabezado ni el pie de calculolaboral.cl.** El software tiene su propio marco. Requiere agregar una excepción a la regla 1 de `AGENTS.md` solo para `/app`.
- **Menú lateral fijo a la izquierda** (unos 240 px), con el logo oficial de Cálculo Laboral arriba y, debajo, el nombre de la empresa. Ese bloque queda listo para convertirse en selector de empresas cuando lleguen los contadores.
- **Barra superior delgada:** el mes que se está mirando (con flechas para ir al anterior o al siguiente), el estado del Pase y la cuenta (correo, salir).
- **Contenido** a la derecha, ancho completo del espacio que queda, sin el límite de 1200 px del sitio.
- **Color:** sobrio. Fondo claro, superficies blancas, verde bosque para la marca y lo activo, ámbar para lo pendiente (elemento activo del menú, lo que vence pronto, liquidaciones preparadas sin emitir y su tramo en el avance del mes, el modo de ejemplo), rose solo para riesgo legal (los avisos urgentes llevan fondo rose suave). Encabezados de tabla con el tinte verde (`--forest-50`). Tema claro: se usa de día, en una oficina, y se imprime. (Ámbar ampliado por pedido del dueño el 14-oct-2026: el panel se veía solo verde y blanco.)
- **Tipografía:** Geist para todo; Geist Mono con cifras tabulares para montos, fechas, RUT y días.
- **Celular:** el menú lateral se convierte en una barra inferior con las cinco secciones principales y un botón «Más». La grilla del mes pasa a una lista por trabajador. Se diseña primero para escritorio (1280 a 1600 px) y se verifica en 390 px.

## 4. Secciones del menú y lo que hace cada una

| # | Sección | Qué hace | Estado |
| :--- | :--- | :--- | :--- |
| 1 | **Inicio: cierre del mes** | Franja con 3 cifras: total líquido a pagar del mes, trabajadores activos (de 5) y el próximo vencimiento con su fecha. Grilla del mes: una fila por trabajador y columnas Liquidación (sin preparar, preparada, emitida), Vacaciones del mes y Documentos del mes, con el avance «2 de 3 emitidas». Panel lateral con el detalle de lo que se elige y sus acciones. Abajo, lo que vence en los próximos 30 días. Botones del mes: preparar todas, imprimir todas. | Nuevo diseño con lo ya construido |
| 2 | **Trabajadores** | Lista con búsqueda y estado. Carpeta de cada persona con pestañas: **Ficha** (los datos de hoy), **Liquidaciones** (todos sus meses), **Vacaciones** (saldo y registro) y **Documentos** (emitir e historial). Alta, edición, desactivar y reactivar. | Ficha ya existe; pestañas nuevas |
| 3 | **Liquidaciones** | El editor actual con vista previa, organizado por mes: lista del mes, editar, guardar, marcar emitida, imprimir una o todas. | Ya existe, se reubica |
| 4 | **Documentos** | Emitir los 7 modelos con los datos ya cargados, con sus advertencias. **Historial** de todo lo emitido en la empresa, filtrable por trabajador y tipo. | Emitir ya existe; historial nuevo |
| 5 | **Vacaciones** | Saldo de días de cada trabajador, registro de cada período tomado y comprobante de feriado con un clic. | Nuevo |
| 6 | **Calendario** | Vista del mes con vencimientos de plazos fijos, fechas de cotizaciones, feriados, vacaciones registradas y liquidaciones por emitir. | Nuevo |
| 7 | **Contratos y finiquitos** | Accesos a los generadores de contrato, anexo 42 h y finiquito con la ficha del trabajador ya cargada; indica cuáles incluye el Pase. Se abren en otra pestaña, porque son páginas del sitio. | Ya existe el prellenado |
| 8 | **Empresa** | Datos de la empresa y logo. | Ya existe |
| 9 | **Mi cuenta** | Pase Pyme (vigencia, comprar, reembolso de 14 días), descargar respaldo, eliminar cuenta, términos y privacidad. | Ya existe, se reubica |

### Detalle de las funciones nuevas

**Vacaciones**
- Saldo: 15 días hábiles por año de servicio (art. 67), más el feriado progresivo de un día por cada tres años nuevos sobre 10 años trabajados (art. 68, que permite contar hasta 10 años con empleadores anteriores; la ficha ya tiene ese dato), menos los días registrados como tomados.
- Registro de cada período: desde, hasta, días hábiles (calculados con los feriados ya cargados y el sábado inhábil para el feriado, art. 69). Se guarda cifrado en la tabla `vacaciones`, que ya existe en la base.
- Desde cada registro se emite el comprobante de feriado que ya está construido.
- Se presenta como referencia: «Saldo estimado según los datos ingresados».

**Calendario**
- Se arma con los datos que ya existen (fichas, meses guardados, vacaciones) y los feriados de `js/feriados_cl.js`. No necesita tablas nuevas.
- Vista mensual y lista de los próximos 30 días. Cada evento lleva a su acción (editar ficha, preparar liquidación, ver vacaciones).

**Inicio con resumen**
- Las cifras salen de las liquidaciones guardadas del mes (el líquido y los haberes que ya se guardan con cada mes).
- **No** se muestra el «costo empleador» en esta versión: exige calcular aportes del empleador (seguro de cesantía, SIS, mutual y la cotización del empleador de la reforma previsional) que el motor no calcula hoy, y una cifra equivocada es peor que ninguna.

**Historial de documentos**
- El registro guarda solo el tipo y la fecha de cada documento emitido, nunca el texto (decisión de privacidad de la fase 4). El historial lista qué se emitió y cuándo; «volver a generar» lo arma de nuevo con los datos **actuales**, y el aviso lo dice, porque puede no coincidir con lo que se entregó.
- Las liquidaciones sí quedan completas, porque se guarda cada mes.

## 5. Estados que hay que diseñar

- **Primera vez:** cuenta nueva sin empresa. Inicio muestra tres pasos (empresa, primer trabajador, primer mes) en vez de una grilla vacía.
- **Sin Pase:** 1 trabajador activo, documentos con la marca «Vista previa», y lo que el Pase agrega dicho sin presión.
- **Pase por vencer y vencido:** aviso en la barra superior y en Mi cuenta.
- **Cargando, error de conexión y sesión vencida:** mensajes claros y volver a intentar; la sesión vencida lleva a entrar de nuevo sin perder lo que se estaba escribiendo cuando sea posible.
- **Mes sin liquidaciones, trabajador sin datos suficientes y documentos bloqueados** (por ejemplo, la carta 159 N°4 con dos renovaciones): explicar el motivo y cómo resolverlo.

## 6. Cómo se construye

- Un archivo `app.html` con su propio marco, servido en `calculolaboral.cl/app` y sus subrutas (`/app/trabajadores`, `/app/liquidaciones`…) mediante reglas de `vercel.json`; navegación dentro de la página sin recargar, con el botón atrás funcionando.
- `noindex`, fuera del sitemap. La página pública `/asistente-laboral-pyme` sigue siendo la vitrina indexable y sus botones pasan a llevar a `/app`.
- `/asistente-pyme` redirige a `/app`. El enlace de acceso por correo y la vuelta desde Flow llevan a `/app`.
- Se reutiliza todo lo de atrás: la API (`api/pyme/[ruta].js`, sigue siendo una sola función de Vercel), la base, el cifrado, el Pase, `js/pyme_liquidaciones.js`, `js/pyme_docs.js`, `js/liquidacion_documento.js`, `js/pyme_pendientes.js` y `js/feriados_cl.js`.
- Agregados en la API: guardar, listar y borrar vacaciones (cifradas, con candado por trabajador como los meses) y el historial de documentos con filtros. Sin migración nueva: la tabla `vacaciones` ya existe.
- Sin framework nuevo: HTML, CSS y JavaScript como el resto del sitio.

## 7. Etapas

1. **Marco y lo que ya existe:** menú lateral, barra superior, Inicio «Cierre de mes» con su franja de cifras, Trabajadores con carpeta por persona (Ficha y Liquidaciones), Liquidaciones, Documentos (emitir), Contratos y finiquitos, Empresa y Mi cuenta. Redirecciones y enlaces a `/app`.
2. **Funciones nuevas:** Vacaciones (API y pantalla), Calendario e historial de documentos (pestaña de cada trabajador y sección general).
3. **Terminación:** primera vez, estados vacíos y de error, celular, impresión, revisión de diseño independiente (impeccable) y actualización de `DESIGN.md` con el marco de la aplicación.
4. **Lanzamiento:** lo que ya estaba pendiente (migración de la base de producción, mezcla a `main` con tu «Sí, súbelo y mézclalo directo a main», `PYME_PASE_VENTA=1`, indexar la página pública).

Cada etapa se prueba en el navegador en 1280 px y 390 px, con las pruebas automáticas en verde, y se revisa contigo antes de seguir.

## Estado

- **Etapa 1: hecha en código y probada en el navegador (13-oct-2026), sin publicar.** `app.html`, `assets/css/app.css` y `js/app_pyme.js` reemplazan a `asistente-pyme.html` y `js/pyme_app.js` (borrados; `/asistente-pyme` redirige a `/app` en `vercel.json`). El enlace de acceso, la vuelta desde Flow (`/app/cuenta?pase=`), el comprobante, el prellenado de los generadores y la página pública ya apuntan a `/app`. Probado con datos de demostración: cierre del mes (preparar, marcar emitida, detalle, cifras, avisos), trabajadores y carpeta (ficha y liquidaciones), editor de liquidaciones, documentos (carta 159 N°4 con la advertencia de cotizaciones), contratos, empresa y cuenta, en 1440 px y 390 px sin desborde horizontal. En celular el menú es un cajón lateral; la barra inferior queda para la etapa 3.
- **Etapa 2: hecha en código y probada en el navegador (13-oct-2026), sin publicar.** Vacaciones (`js/pyme_vacaciones.js`, 8 pruebas): saldo por años completos (15 o 20 días, progresivo del art. 68), períodos con días hábiles contados por el servidor (sin sábados, domingos ni feriados), ajuste de días tomados antes, sin cruces, cifradas; rutas `GET /api/pyme/vacaciones`, `POST|DELETE /api/pyme/vacacion`. Calendario del mes (feriados, cotizaciones, plazos fijos, vacaciones, aniversarios, pase). Historial de documentos (`GET /api/pyme/documentos`) en Documentos y en la carpeta, con «Preparar de nuevo». El comprobante de feriado se prellena desde el registro de vacaciones. Exportación versión 4 (incluye vacaciones). `tools/test_pyme_almacen_db.js` tiene el paso de vacaciones, **sin correr aún contra Neon**.
- **Etapa 3: hecha (13-oct-2026), sin publicar.** Barra inferior en celular (Cierre, Personas, Liquidaciones, Calendario y «Más» con el cajón), pantalla de error de carga con «Reintentar», avisos bajo la grilla, filas de una línea (52 px) con el sello «Emitida · fecha», «Hoy» en el próximo vencimiento, cotizaciones urgentes el día del plazo, respaldo como aviso informativo, historial de vacaciones compacto en celular e impresión corregida (las reglas de pantalla ya no se aplican al papel: una liquidación por hoja carta, la carta en una hoja). Revisión independiente de impeccable con veredicto «ship» y `DESIGN.md` con la sección «Software /app». Segunda vuelta de diseño (13-oct-2026, con todas las skills de diseño del proyecto): foco al título al cambiar de sección, enlace «Saltar al contenido», menú del celular con foco atrapado (`inert`), botón de cerrar y retorno del foco, confirmaciones propias con `<dialog>` en vez de `window.confirm`, `aria-current` en filas (no `aria-selected`), calendario con roles válidos, detalle sin animación al moverse con el teclado, objetivos táctiles de 44 px y campos de 16 px en celular (sin zoom de iOS), Liquidaciones del mes como fichas en celular (las acciones ya no quedan fuera de pantalla), estados vacíos con acción, alineación de Imprimir y Marcar emitida, la lista del calendario y las columnas de vacaciones sin el desfase de 16 px, y colores repetidos pasados a tokens. Queda como falso positivo del detector el «padding apretado» en los paneles con tablas (las celdas ya traen su relleno). Falta solo la vista previa del documento, que mantiene colores slate a propósito porque imita el papel.

- **Etapa 1 de la revisión de producto (13-oct-2026), sin publicar:** costo del empleador por trabajador y del mes (Ley 21.735, SIS, cesantía y mutual con las tasas de Previred de cada mes de 2026; tasa de la mutual en «Empresa»), resumen estimado de lo que se paga en Previred por institución en Liquidaciones, aviso y fecha en el calendario para registrar el contrato en Mi DT (arts. 9 y 9 bis), y finiquito como octavo documento (feriado pendiente y proporcional desde el registro de vacaciones, indemnizaciones del art. 161, descuentos; sin marca solo con el Pase de 12 meses). Datos de demostración: `node tools/demo_pyme.js` con `pyme-dev` corriendo.

## 8. Decisiones abiertas

- **Costo empleador:** fuera de esta versión (ver sección 4). Se puede sumar más adelante si se amplía el motor y se valida.
- **Modo de ejemplo (14-oct-2026):** `/app/ejemplo` o el botón «Ver un ejemplo» de la entrada abren una panadería ficticia con tres trabajadores, en la memoria de la pestaña y sin llamar al servidor (`js/pyme_demo.js` + `js/pyme_demo_servidor.js`, generado con `node tools/build_pyme_demo.js` desde `api/_pyme/datos.js`, `validar.js` y el almacén en memoria; `tools/test_pyme_demo.js` falla si el paquete quedó viejo). Sin Pase: los documentos salen con «Vista previa». No crea enlaces, no envía correos ni compra.
- **Subdominio `app.calculolaboral.cl`:** más adelante, sin cambiar el diseño.
- **Varias empresas por cuenta:** preparado en el menú, no construido. Requiere cambios en la base y en el plan de precios.
- **Revisión legal** del cálculo de vacaciones y de los textos: igual que el resto, sin revisión de abogado.
