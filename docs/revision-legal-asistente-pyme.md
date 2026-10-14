# Revisión legal del Asistente Laboral Pyme: qué debe ver un abogado

12-oct-2026. **Anexo técnico.** El documento para presentar a un abogado laboral es `docs/brief-abogado-laboral.html`; este archivo es el detalle de apoyo. Todo el contenido del Asistente se redactó con apoyo de IA y **ningún texto ha sido revisado por un abogado**. El dueño decidió el 12-oct-2026 lanzar sin esa revisión, con textos conservadores (ver sección 6).

## 1. Qué es el servicio, en una frase

Un panel con cuenta (sin contraseña, acceso por enlace al correo) donde una empresa guarda sus datos y los de hasta 5 trabajadores, para generar liquidaciones y modelos de documentos laborales. Los datos personales se cifran en la aplicación antes de guardarse. Hoy no se cobra; más adelante se venderá un "Pase" de 3 o 12 meses.

## 2. Los textos que necesitan revisión sí o sí (antes de abrir cuentas a cualquier persona)

Son las **únicas partes nuevas o modificadas**; el resto de Términos y Privacidad no cambia.

| # | Texto | Dónde está | Qué dice, en resumen |
| :--- | :--- | :--- | :--- |
| 1 | **Términos, sección 12** "Asistente Laboral Pyme: cuenta, datos y encargo de tratamiento" | `terminos.html`, ancla `#asistente-pyme` | La empresa es la responsable de los datos de sus trabajadores y Cálculo Laboral es encargado de tratamiento; obligaciones del encargado; exportación y eliminación; carácter referencial de los documentos |
| 2 | **Privacidad, sección 10** "Asistente Laboral Pyme: datos que guardamos y cómo los protegemos" | `privacidad.html`, ancla `#asistente-pyme` | Qué datos se guardan, para qué, cómo se protegen, proveedores y ubicación (Brasil), plazos de conservación, derechos de los trabajadores ante su empleador |
| 3 | **Dos frases corregidas en Privacidad** (secciones 1 y 4) | `privacidad.html` | Antes decían que ningún dato viaja a nuestros servidores y que no hay cuentas; ahora tienen la excepción del Asistente |
| 4 | **Texto de la casilla de aceptación** | `api/_pyme/correo.js`, función `paginaConfirmar` | "Acepto los Términos y la cláusula de encargo de tratamiento de datos, y declaro haber leído la Política de Privacidad". Se marca la primera vez que se entra y se registra la fecha |

El correo con el enlace de acceso (`correoAcceso` en el mismo archivo) no contiene compromisos legales y no requiere revisión.

## 3. Preguntas concretas para el abogado

1. **Roles.** ¿Es correcto tratar a la empresa cliente como responsable y a Cálculo Laboral como encargado de tratamiento? ¿Qué contenido mínimo exige la ley para el encargo, y basta una casilla aceptada al crear la cuenta? (La Ley 21.719 rige desde el 1 de diciembre de 2026; mientras tanto aplica la Ley 19.628.)
2. **Transferencia internacional.** La base de datos está en Neon, región São Paulo (Brasil); Vercel (alojamiento) y Resend (correos) operan en Estados Unidos. ¿Qué exige la ley para esas transferencias y basta lo que dice la Política?
3. **Incidentes de seguridad.** El texto promete avisar "al correo de la cuenta" cuando se detecte y confirme un incidente. ¿Qué plazo y contenido exige la ley, y qué debe hacer el encargado frente al responsable y frente a la Agencia?
4. **Datos de salud.** Se guarda el sistema de salud del trabajador (Fonasa o Isapre). Más adelante podrían guardarse licencias médicas. ¿Se trata como dato sensible con reglas especiales?
5. **Conservación.** Plazos propuestos: respaldos del proveedor 7 días; al vencer el servicio, la cuenta queda en solo lectura y descarga por 90 días y luego se borran los datos, con aviso previo. ¿Son adecuados? Además, el empleador tiene obligaciones de conservar documentos laborales: ¿corresponde advertirlo al cliente?
6. **Derechos de los trabajadores.** Si un trabajador pide sus datos directamente a Cálculo Laboral, ¿qué debemos hacer? (Hoy el texto lo deriva al empleador.)
7. **Obligaciones formales.** ¿Hay registros, inscripciones, designaciones o evaluaciones que Cálculo Laboral deba tener como encargado (por ejemplo, registro de actividades de tratamiento)?
8. **Responsabilidad.** ¿Están bien las cláusulas de modelos de referencia, la ausencia de garantía de disponibilidad y la recomendación de revisar documentos con un abogado?

## 3 bis. Lo que se alcanzó a contrastar con fuentes (12-oct-2026) y lo que NO está verificado

Se buscó el texto de la ley, pero **no se pudo leer el texto oficial** (BCN / Diario Oficial): solo fuentes secundarias (blogs y documentos de terceros). Lo siguiente es orientación, no confirmación:

| Tema | Lo que dicen las fuentes secundarias | Efecto en los textos |
| :--- | :--- | :--- |
| Vigencia | Las modificaciones a la Ley 19.628 rigen desde el 1 de diciembre de 2026 | Los textos ya lo indican |
| Encargo (art. 15 bis, según blogs) | El tratamiento por un encargado debe regirse por un contrato que defina objeto, duración, naturaleza del tratamiento y obligaciones de seguridad; el encargado actúa según las instrucciones del responsable; el responsable sigue siendo responsable ante el titular y la Agencia | Se agregó a los Términos el "objeto y duración" y que se trata solo según instrucciones. **Duda abierta:** si una casilla aceptada basta como contrato, y qué otro contenido mínimo falta (por ejemplo, el registro de actividades de tratamiento que algunas plantillas atribuyen al encargado) |
| Incidentes de seguridad (art. 14 sexies, según fuentes) | Se informa a la Agencia "sin dilaciones indebidas", sin un número de horas; una fuente aislada menciona 72 horas y no coincide con las demás. No se encontró qué debe hacer el encargado frente al responsable | Los textos pasaron de "cuando detecte y confirme" a "sin dilaciones indebidas desde que tome conocimiento". **Duda abierta:** plazo y forma exactos |
| Transferencia internacional (arts. 27 y 28, según fuentes) | Es lícita en los casos que fija el artículo 27, entre ellos el uso de cláusulas contractuales tipo; mientras no existan países declarados "adecuados" se apoya en esas cláusulas. La Subsecretaría de Economía aprobó cláusulas modelo en diciembre de 2025 (publicadas en el Diario Oficial el 19-dic-2025) | **No es solo un problema de redacción.** La Política informa de la transferencia a Brasil y EE. UU., pero puede que se necesite además un mecanismo contractual con Neon, Vercel y Resend. Pendiente de confirmar con el abogado y de revisar qué acuerdos de tratamiento de datos (DPA) ofrece cada proveedor |

Fuentes consultadas (todas secundarias): [Prey Project sobre DPA y Ley 21.719](https://preyproject.com/es/blog/data-processing-agreement-dpa-chile-ley-21719), [Informe de Transferencias Internacionales (Minsegpres)](https://www.minsegpres.gob.cl/wp-content/uploads/2025/09/Informe-2-Transferencias-Internacionales-FINAL.pdf), [Cláusulas contractuales tipo (Guerrero Olivos)](https://guerrero.cl/wp-content/uploads/2026/01/DOC_Aprobacion-Clausulas-Contractuales-Tipo.pdf), [Prey Project sobre notificación de brechas](https://preyproject.com/es/blog/notificacion-de-brechas-de-datos-personales).

## 3 ter. Los siete documentos del panel (fase 4): también son textos legales

Los modelos están en `js/pyme_docs.js` y se arman con los datos de la empresa y del trabajador. Llevan al pie "Modelo de referencia basado en la normativa vigente; no constituye asesoría legal". **No han sido revisados por un abogado**; el sitio no dice lo contrario. Lo que sí se verificó (12-oct-2026) es que las normas que citan existen y dicen lo que se usa, contra el texto del Código del Trabajo en la edición de octubre de 2026 que publica la Dirección del Trabajo (arts. 67 a 70, 154 N°10, 159 N°4, 161, 162, 163, 169 y 172).

| Documento | Qué debe mirar el abogado |
| :--- | :--- |
| Carta de término por plazo fijo (art. 159 N°4) | Si el texto cumple el art. 162 (causal, hechos, estado de las cotizaciones con comprobantes, aviso de finiquito presencial o electrónico y reserva de derechos, copia a la Inspección dentro de 3 días hábiles). El sistema cuenta el sábado como día hábil para ese plazo; confirmar el criterio. Bloquea con 2 o más renovaciones |
| Carta de término por necesidades de la empresa (art. 161) | Texto de la causal y de la oferta irrevocable (art. 169 a); cálculo de la indemnización por años de servicio (30 días por año y fracción superior a 6 meses, tope 11 años, base limitada a 90 UF con la UF de hoy y no con la del último día del mes anterior al pago, que es lo que dice el art. 172); la base de la "última remuneración mensual" la escribe el usuario guiado por el art. 172; casillas de confirmación de licencia médica, fuero y cotizaciones |
| Amonestación escrita | Que la redacción no dé a entender una sanción donde el reglamento interno no existe (art. 154 N°10 y 11) |
| Comprobante de feriado | Reintegro cuando el trabajador labora de lunes a sábado (el sábado es inhábil para el feriado, art. 69, pero puede ser día de trabajo); el saldo de días lo escribe el usuario |
| Certificados de antigüedad y de remuneraciones | Fórmulas de certificación; el promedio del líquido sale de las liquidaciones guardadas por el propio usuario |
| Anexo de protección de datos | Está basado en el anexo del Kit Ley 21.719 (ya vendido); con cláusulas opcionales de biometría, herramientas corporativas y encargados. La Ley 21.719 rige desde el 1-dic-2026 |

El registro de documentos emitidos guarda solo el tipo y la fecha, nunca el texto.

## 4. Aparte: antes de vender el Pase (no antes de abrir cuentas)

- **Retracto y reembolso (cubierto con un reembolso voluntario de 14 días; ver sección 6).** Los Términos vigentes excluyen el retracto para bienes digitales descargables. El Pase es un servicio con duración (3 o 12 meses): el abogado debe indicar qué corresponde y cómo informarlo antes de pagar. No quedó escrito en los Términos.
- Textos de venta del Pase, que siguen las reglas de la sección 2.1 de `AGENTS.md` (sin promesas de validez, sin "oficial", sin precios tachados).
- **Qué ya está construido y qué no afirma.** El aviso previo al pago del Pase (`js/checkout_consent.js`, variante "servicio") dice solo: acceso por los días del producto desde que se confirma el pago, no se renueva solo, un segundo pase empieza cuando termina el anterior, y los documentos son modelos de referencia. Desde el 12-oct-2026 el aviso, la sección 12 de los Términos y el comprobante por correo informan además el reembolso total de 14 días corridos; un abogado puede ajustar la redacción.
- **Datos del pago.** El pago de Flow lleva el id de la cuenta (no datos de trabajadores). El comprobante va al correo de la cuenta, no al que se escriba en Flow.
- **Al vencer el pase.** Hoy la cuenta vuelve a 1 trabajador activo y a los documentos con marca de agua, y conserva sus datos. No hay borrado automático. El plan original proponía solo lectura y exportación por 90 días y luego borrar con aviso: el plazo y la comunicación los define el abogado, y requieren correos automáticos que hoy están fuera de alcance.
- **Página pública** (`asistente-laboral-pyme.html`): también son textos para el abogado (qué hace y qué no hace el asistente, sección de datos, planes y preguntas frecuentes). Dice expresamente que los documentos no fueron revisados por abogados y no promete validez.
- **Corrección hecha el 12-oct-2026 en Privacidad §10:** el borrador decía que, sin servicio vigente, la cuenta pasaba a modo de lectura por 90 días y luego se borraban los datos con aviso por correo. Eso no está construido; hoy el texto dice que la cuenta sigue disponible con las funciones gratuitas y que los datos se conservan mientras la cuenta esté activa. El abogado debe decir si conviene un plazo máximo para cuentas sin uso (y entonces habría que construir el borrado y el aviso).
- **Venta cerrada.** El Pase solo se puede comprar si en Vercel está `PYME_PASE_VENTA=1`. Se activa tras las pruebas con la base real y el sandbox de Flow.

## 5. Datos de hecho para el abogado

| Tema | Dato |
| :--- | :--- |
| Proveedores | Neon (base de datos, São Paulo), Vercel (alojamiento; las funciones del sitio se mueven a São Paulo el 12-oct-2026), Resend (correos), Flow (pagos; no recibe datos de trabajadores), Cloudflare (CDN) |
| Cifrado | Los datos de la empresa y de los trabajadores se cifran con AES-256-GCM en la aplicación antes de guardarlos; la clave no está en la base de datos |
| Qué no se cifra | El correo de la cuenta (se necesita para enviar los enlaces) y fechas de control |
| Accesos | Enlace de un solo uso (15 minutos) y sesión de 30 días; solo se guardan huellas de tokens y de IP |
| Respaldo | Historial de recuperación de 7 días en el proveedor de la base de datos |
| Borrado | Eliminar la cuenta borra en cascada todos los datos de esa cuenta |
| Quién accede | Solo el dueño del sitio; no hay equipo ni terceros con acceso |

## 6. Operación sin revisión de abogado (decisión del 12-oct-2026)

Se lanza sin revisión legal, reduciendo la exposición con estos cambios:

1. **Reembolso total de 14 días corridos del Pase**, informado en el aviso previo al pago, los Términos (§5 y §12), el comprobante, el panel y la página pública. Cubre el retracto legal de 10 días contados como corridos o como hábiles, sea o no aplicable a este servicio. Cómo se atiende: reembolsar en Flow y correr `tools/revocar_pase.js`.
2. **Sin cláusulas amplias de exclusión de responsabilidad en el Asistente.** La viñeta de disponibilidad pasó de «sin garantía de disponibilidad» a un texto factual (puede haber interrupciones; se puede descargar un respaldo). La sección 10 de los Términos, anterior al Asistente, no se tocó y está en el brief como punto A4.
3. **Advertencia de cotizaciones en las cartas de los arts. 159 N°4 y 161:** primer aviso en pantalla, en nivel de advertencia, y recordatorio de la consecuencia del art. 162 en la casilla obligatoria.
4. **Transparencia:** los Términos, el aviso previo y la página pública dicen que los documentos no han sido revisados por un abogado.

Los textos de las secciones 2 a 4 de este anexo siguen siendo los que un abogado debería ver; el orden de prioridad está en el brief.
