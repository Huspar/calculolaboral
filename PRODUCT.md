# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primario hoy:** dueños de pymes chilenas con 1 a 5 trabajadores (panadería, taller, local comercial) que hacen ellos mismos las remuneraciones y los papeles laborales, sin formación laboral ni contable. Trabajan sobre todo en computador, en la oficina o en la casa, a fin de mes: preparan liquidaciones, imprimen y emiten documentos. El celular es para consultas rápidas.
- **Secundario, a futuro:** contadores o asesores que llevan las remuneraciones de varias pymes. Hoy una cuenta equivale a una empresa; el producto debe quedar preparado para varias empresas por cuenta, sin construirlo todavía (confirmado 13-oct-2026).
- Visitantes de calculolaboral.cl (trabajadores y empleadores) que usan las calculadoras gratuitas sin cuenta.

## Product Purpose

calculolaboral.cl es una suite de calculadoras, guías y generadores laborales para Chile, basada en el Código del Trabajo. El **Asistente Laboral Pyme** es la parte con cuenta: el empleador guarda una vez los datos de su empresa y de sus trabajadores (cifrados) y desde ahí prepara las liquidaciones de cada mes, emite documentos laborales y ve lo que tiene pendiente. Éxito: que un dueño de pyme cierre su mes laboral (liquidaciones impresas, plazos a la vista, documentos emitidos) sin volver a escribir datos y sin depender de un contador para lo rutinario.

## Positioning

- Hecho para la pyme chilena muy pequeña (hasta 5 trabajadores), con las reglas chilenas ya incorporadas: AFP, Fonasa/Isapre, seguro de cesantía, gratificación del art. 50, feriados nacionales, plazos del art. 162.
- Datos de trabajadores cifrados en la aplicación antes de guardarse; el usuario descarga o elimina todo cuando quiere.
- Entra con un enlace al correo, sin contraseña. Pago único (Pase Pyme), sin renovación automática.
- Vive dentro de calculolaboral.cl, un sitio que la gente ya usa por sus calculadoras gratuitas.

## Operating Context

- Ritual mensual: alrededor del cierre de mes y antes del día 10 a 13 (pago de cotizaciones en Previred, que el producto NO hace): preparar liquidaciones del mes, revisar, marcar emitidas, imprimir todas juntas.
- Eventos puntuales: ingreso de un trabajador, vencimiento de un plazo fijo, vacaciones, amonestación, término de contrato, certificados que pide un banco o una caja de compensación.
- Documentos impresos en carta/A4 que se firman y se entregan al trabajador o se envían a la Inspección del Trabajo.

## Capabilities and Constraints

Construido (rama `claude/asistente-pyme-plan`, sin publicar, 13-oct-2026):
- Cuenta con enlace mágico, sesión de 30 días, casilla de aceptación de Términos y encargo de tratamiento.
- Empresa y hasta 5 trabajadores activos con Pase (1 sin pase), cifrados (AES-256-GCM).
- Liquidaciones por mes: preparar el mes con valores base, editar con vista previa, guardar, marcar emitida, imprimir todas. Máximo 120 meses por trabajador.
- Ocho documentos: certificado de antigüedad, certificado de remuneraciones, comprobante de feriado, carta 159 N°4, carta 161, amonestación, anexo de datos y finiquito (feriado desde el registro de vacaciones; sin marca solo con el Pase de 12 meses). El registro guarda solo tipo y fecha, nunca el texto.
- Costo del empleador por trabajador (aporte de la Ley 21.735, SIS, cesantía y mutual con las tasas de Previred de cada mes) y resumen estimado de lo que se paga en Previred por institución (13-oct-2026).
- Avisos del registro del contrato en Mi DT (arts. 9 y 9 bis) y del término de plazo fijo.
- Prellenado de los generadores de contrato, anexo 42 h y finiquito desde la ficha.
- Pase Pyme: $19.990 (3 meses) y $59.990 (12 meses) por Flow, reembolso total de 14 días corridos; venta cerrada hasta `PYME_PASE_VENTA=1`.
- Pendientes del mes: plazos fijos por vencer, fecha de cotizaciones, liquidaciones sin emitir, respaldo.
- Exportar todos los datos y eliminar la cuenta.

Primera versión del software en `/app` (confirmado 13-oct-2026): además de lo anterior, vacaciones (saldo y registro), calendario laboral, inicio con resumen del mes e historial de documentos por trabajador.

Fuera de alcance: declarar o pagar cotizaciones (Previred), Libro de Remuneraciones, cartas del art. 160, asesoría legal, varias empresas por cuenta (preparado, no construido).

Técnicas: sitio estático HTML + Tailwind en Vercel (plan Hobby, máximo 12 funciones; el asistente usa una sola, `api/pyme/[ruta].js`), Neon Postgres en São Paulo, Resend para correos, Flow para pagos, Cloudflare delante. Sin framework de frontend.

## Brand Commitments

- Nombre y logo de Cálculo Laboral (balanza con monograma C y L), verde bosque `#00382E` y ámbar `#FFB703`, Geist y Geist Mono (cifras siempre en mono). Ver `DESIGN.md` y `AGENTS.md`.
- El software vive en `calculolaboral.cl/app`, con su propio marco de aplicación (menú lateral) y sin el encabezado ni el pie del sitio público; debe sentirse como un software profesional, no como una página del sitio ni como algo hecho por IA (pedido del dueño, 13-oct-2026).
- Reglas comerciales y legales de `AGENTS.md` sección 2.1: nada de "oficial", "garantiza validez", precios tachados; nunca afirmar revisión de abogados (los textos no la tienen).
- Español de Chile, trato de "tú".

## Evidence on Hand

- Motor de liquidaciones validado con 32 casos y pruebas automáticas; normas citadas verificadas contra el Código del Trabajo de la DT (oct-2026).
- Pruebas contra la base real (24 correctas) y compra de prueba en el sandbox de Flow (correcta).
- Sin clientes, testimonios ni cifras de uso: no inventarlos.
- Ningún texto ni documento ha sido revisado por un abogado (decisión del dueño de lanzar así; brief en `docs/brief-abogado-laboral.html`).

## Product Principles

1. **El mes laboral es la unidad de trabajo:** todo se ordena alrededor de cerrar el mes y de lo que vence.
2. **Escribir una vez:** cada dato de la empresa o del trabajador se ingresa una sola vez y llega solo a cada liquidación y documento.
3. **Avisar antes que corregir:** los plazos y riesgos legales (plazo fijo, cotizaciones, art. 162) se muestran antes de que el usuario actúe.
4. **Modelos de referencia, no asesoría:** nunca prometer validez legal; el usuario revisa y firma.
5. **Los datos son del usuario:** cifrados, descargables y eliminables en cualquier momento.

## Accessibility & Inclusion

- Usuarios no técnicos y de todas las edades: textos claros, sin jerga, objetivos de clic de al menos 44 px, contraste AA.
