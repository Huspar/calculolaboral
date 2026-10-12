# Revisión legal del Asistente Laboral Pyme: qué debe ver un abogado

12-oct-2026. Documento para entregar al abogado junto con los textos. Todo el contenido del Asistente se redactó con apoyo de IA y **ningún texto ha sido revisado por un abogado**. No se publica hasta que se revise.

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

## 4. Aparte: antes de vender el Pase (no antes de abrir cuentas)

- **Retracto y reembolso.** Los Términos vigentes excluyen el retracto para bienes digitales descargables. El Pase es un servicio con duración (3 o 12 meses): el abogado debe indicar qué corresponde y cómo informarlo antes de pagar. No quedó escrito en los Términos.
- Textos de venta del Pase, que siguen las reglas de la sección 2.1 de `AGENTS.md` (sin promesas de validez, sin "oficial", sin precios tachados).

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

## 6. Mientras esto no esté revisado

Se puede seguir construyendo todo el panel y probarlo con datos de ejemplo en la rama de pruebas. No se abren cuentas a clientes reales ni se publican las secciones nuevas de Términos y Privacidad.
